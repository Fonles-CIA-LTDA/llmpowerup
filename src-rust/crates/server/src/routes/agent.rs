use std::convert::Infallible;
use std::sync::Arc;

use axum::extract::State;
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::{Extension, Json};
use futures::stream::Stream;
use serde::Deserialize;
use serde_json::{json, Value};
use tokio::sync::mpsc;
use tokio_stream::wrappers::UnboundedReceiverStream;
use tokio_stream::StreamExt;
use uuid::Uuid;

use claurst_query::{QueryConfig, QueryEvent};

use crate::db;
use crate::error::ApiError;
use crate::sandbox::policy::{filter_tools_by_policy, ToolPolicy};
use crate::streaming::sse::{query_event_to_sse, StreamFormat};
use crate::tenant::context::TenantContext;
use crate::AppState;

#[derive(Deserialize)]
pub struct AgentRunRequest {
    /// The message content to send.
    pub content: String,
    /// Model to use (e.g., "google/gemini-3-flash-preview").
    pub model: String,
    /// Provider ID (e.g., "anthropic", "openai").
    #[serde(default = "default_provider")]
    pub provider: String,
    /// Optional session ID to continue a conversation.
    pub session_id: Option<Uuid>,
    /// Optional system prompt.
    pub system_prompt: Option<String>,
    /// Maximum number of agent turns (default: 10).
    pub max_turns: Option<u32>,
    /// Maximum tokens per response (default: 32000).
    pub max_tokens: Option<u32>,
    /// Stream format: "native", "vercel", or "openai" (default: "native").
    pub stream_format: Option<String>,
}

fn default_provider() -> String {
    "anthropic".to_string()
}

/// POST /v1/agent/run -- start a full agent run with tools and streaming.
pub async fn create_run(
    State(state): State<AppState>,
    Extension(tenant): Extension<TenantContext>,
    Json(req): Json<AgentRunRequest>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, ApiError> {
    // 1. Determine stream format
    let format = StreamFormat::from_header(None, req.stream_format.as_deref());
    let max_turns = req.max_turns.unwrap_or(10);

    // 2. Create or resume session
    let session_id = if let Some(sid) = req.session_id {
        db::sessions::get_session(&state.db, tenant.tenant_id, sid)
            .await?
            .ok_or_else(|| ApiError::NotFound("Session not found".into()))?;
        sid
    } else {
        let session = db::sessions::create_session(
            &state.db,
            tenant.tenant_id,
            &req.model,
            &req.provider,
            req.system_prompt.as_deref(),
            json!({}),
        )
        .await?;
        session.id
    };

    // 4. Build provider from BYOK key
    let anthropic_client = state
        .provider_factory
        .build_anthropic_client(tenant.tenant_id)
        .await?;
    let provider_registry = state
        .provider_factory
        .build_registry(tenant.tenant_id, &req.provider)
        .await
        .ok();

    // 5. Build sandboxed ToolContext
    let policy = ToolPolicy::for_plan(&tenant.plan);
    let (tool_ctx, cost_tracker) = state
        .tool_context_factory
        .create(tenant.tenant_id, session_id, &req.model, &policy)?;

    // 6. Filter tools by policy
    let tools = filter_tools_by_policy(claurst_tools::all_tools(), &policy);

    // 7. Load conversation history and append new message
    let stored_messages = db::messages::load_messages(&state.db, session_id).await?;
    let mut messages: Vec<claurst_core::Message> = stored_messages
        .iter()
        .filter_map(|m| message_row_to_core(m))
        .collect();

    // Add the new user message
    let user_message = claurst_core::Message {
        role: claurst_core::Role::User,
        content: claurst_core::MessageContent::Text(req.content.clone()),
        uuid: Some(Uuid::new_v4().to_string()),
        cost: None,
    };
    messages.push(user_message);

    // Save user message to DB
    let turn = stored_messages.len() as i32 + 1;
    let _ = db::messages::save_message(
        &state.db,
        session_id,
        tenant.tenant_id,
        "user",
        json!({"type": "text", "text": &req.content}),
        None,
        None,
        turn,
    )
    .await;

    // 8. Build QueryConfig
    let query_config = QueryConfig {
        model: req.model.clone(),
        max_tokens: req.max_tokens.unwrap_or(32_000),
        max_turns,
        system_prompt: req.system_prompt.clone(),
        provider_registry: provider_registry.map(Arc::new),
        ..Default::default()
    };

    // 9. Create event channel
    let (event_tx, event_rx) = mpsc::unbounded_channel::<QueryEvent>();
    let cancel_token = tokio_util::sync::CancellationToken::new();

    // Send session_id to client so it can use it for follow-up messages
    let _ = event_tx.send(QueryEvent::Status(format!("session:{}", session_id)));

    // 10. Generate run ID
    let run_id = Uuid::new_v4().to_string();
    let model = req.model.clone();

    // 11. Load tenant's tool API keys (Brave Search, etc.)
    // These are read from env vars by the tool implementations,
    // so we set them in the spawned task before running the query loop.
    let brave_key = load_tenant_tool_key(&state, tenant.tenant_id, "brave").await;

    // 12. Spawn the query loop in a background task
    let db_clone = state.db.clone();
    let tenant_id = tenant.tenant_id;
    let cancel_bg = cancel_token.clone();

    tokio::spawn(async move {
        // Set tool API keys as env vars for this task
        if let Some(ref key) = brave_key {
            std::env::set_var("BRAVE_SEARCH_API_KEY", key);
        }

        let outcome = claurst_query::run_query_loop(
            &anthropic_client,
            &mut messages,
            &tools,
            &tool_ctx,
            &query_config,
            cost_tracker.clone(),
            Some(event_tx.clone()),
            cancel_bg,
            None,
        )
        .await;

        // Always send turn_complete so the client knows the stream is done,
        // even if the query loop errored or returned early.
        let stop_reason = match &outcome {
            claurst_query::QueryOutcome::EndTurn { .. } => "end_turn",
            claurst_query::QueryOutcome::MaxTokens { .. } => "max_tokens",
            claurst_query::QueryOutcome::Cancelled => "cancelled",
            claurst_query::QueryOutcome::Error(_) => "error",
            claurst_query::QueryOutcome::BudgetExceeded { .. } => "budget_exceeded",
        };
        let _ = event_tx.send(QueryEvent::TurnComplete {
            turn: max_turns,
            stop_reason: stop_reason.to_string(),
            usage: None,
        });
        // Drop event_tx explicitly so the SSE stream ends
        drop(event_tx);

        // Persist the final assistant message
        if let Some(last) = messages.last() {
            if last.role == claurst_core::Role::Assistant {
                let content = serde_json::to_value(&last.content).unwrap_or(json!(null));
                let _ = db::messages::save_message(
                    &db_clone,
                    session_id,
                    tenant_id,
                    "assistant",
                    content,
                    None,
                    None,
                    turn + 1,
                )
                .await;
            }
        }

        // Update session stats
        let _ = db::sessions::update_session_stats(
            &db_clone,
            session_id,
            2,
            cost_tracker.total_tokens() as i64,
            0,
        )
        .await;

        // Cleanup
        claurst_tools::clear_session_shell_state(&session_id.to_string());
    });

    // 13. Convert event channel to SSE stream with heartbeats.
    // When the event channel closes (query loop done), the stream ends.
    let event_stream = UnboundedReceiverStream::new(event_rx);
    let model_c = req.model.clone();
    let run_id_c = run_id.clone();

    use tokio_stream::StreamExt as _;
    use async_stream::stream;

    let combined = stream! {
        let mut events = std::pin::pin!(event_stream);
        let mut heartbeat = tokio::time::interval(std::time::Duration::from_millis(500));
        let mut done = false;

        while !done {
            tokio::select! {
                maybe_event = events.next() => {
                    match maybe_event {
                        Some(event) => {
                            if let Some(sse) = query_event_to_sse(&event, format, &model_c, &run_id_c) {
                                yield Ok::<_, std::convert::Infallible>(sse);
                            }
                        }
                        None => {
                            // event_tx dropped → query loop finished
                            done = true;
                        }
                    }
                }
                _ = heartbeat.tick() => {
                    yield Ok(Event::default().comment("heartbeat"));
                }
            }
        }
    };

    Ok(Sse::new(combined))
}

/// Convert a stored message row back to claurst_core::Message.
fn message_row_to_core(row: &db::messages::MessageRow) -> Option<claurst_core::Message> {
    let role = match row.role.as_str() {
        "user" => claurst_core::Role::User,
        "assistant" => claurst_core::Role::Assistant,
        _ => return None,
    };

    Some(claurst_core::Message {
        role,
        content: claurst_core::MessageContent::Text(
            row.content
                .get("text")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
        ),
        uuid: Some(row.id.to_string()),
        cost: None,
    })
}

/// Load a tool API key for a tenant from provider_credentials.
/// Falls back to raw UTF-8 bytea and handles JSON byte array encoding
/// (same as the OpenRouter key).
async fn load_tenant_tool_key(
    state: &AppState,
    tenant_id: Uuid,
    provider_id: &str,
) -> Option<String> {
    let raw = sqlx::query_scalar::<_, String>(
        "SELECT convert_from(encrypted_key, 'UTF8') FROM provider_credentials WHERE tenant_id = $1 AND provider_id = $2 AND is_active = TRUE LIMIT 1"
    )
    .bind(tenant_id)
    .bind(provider_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten()?;

    // Handle JSON byte array encoding: [115,107,45,...]
    let key = if raw.starts_with('[') {
        serde_json::from_str::<Vec<u8>>(&raw)
            .ok()
            .and_then(|bytes| String::from_utf8(bytes).ok())
            .unwrap_or(raw)
    } else {
        raw
    };

    if key.is_empty() { None } else { Some(key) }
}
