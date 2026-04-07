use axum::extract::{Path, State};
use axum::{Extension, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::db;
use crate::error::ApiError;
use crate::tenant::context::TenantContext;
use crate::AppState;

#[derive(Deserialize)]
pub struct CreateSessionRequest {
    pub model: String,
    #[serde(default = "default_provider")]
    pub provider: String,
    pub system_prompt: Option<String>,
    #[serde(default)]
    pub config: Value,
}

fn default_provider() -> String {
    "anthropic".to_string()
}

/// POST /v1/sessions — create a new session.
pub async fn create(
    State(state): State<AppState>,
    Extension(tenant): Extension<TenantContext>,
    Json(req): Json<CreateSessionRequest>,
) -> Result<Json<Value>, ApiError> {
    let session = db::sessions::create_session(
        &state.db,
        tenant.tenant_id,
        &req.model,
        &req.provider,
        req.system_prompt.as_deref(),
        req.config,
    )
    .await?;

    Ok(Json(json!({
        "id": session.id,
        "model": session.model,
        "provider": session.provider_id,
        "status": session.status,
        "created_at": session.created_at,
    })))
}

/// GET /v1/sessions/:id — get session details.
pub async fn get(
    State(state): State<AppState>,
    Extension(tenant): Extension<TenantContext>,
    Path(session_id): Path<Uuid>,
) -> Result<Json<Value>, ApiError> {
    let session = db::sessions::get_session(&state.db, tenant.tenant_id, session_id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Session not found".into()))?;

    // Load messages
    let messages = db::messages::load_messages(&state.db, session_id).await?;

    Ok(Json(json!({
        "id": session.id,
        "model": session.model,
        "provider": session.provider_id,
        "status": session.status,
        "message_count": session.message_count,
        "total_tokens": session.total_tokens,
        "credits_used": session.credits_used,
        "messages": messages,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
    })))
}

/// DELETE /v1/sessions/:id — delete a session.
pub async fn delete(
    State(state): State<AppState>,
    Extension(tenant): Extension<TenantContext>,
    Path(session_id): Path<Uuid>,
) -> Result<Json<Value>, ApiError> {
    let deleted = db::sessions::delete_session(&state.db, tenant.tenant_id, session_id).await?;

    if !deleted {
        return Err(ApiError::NotFound("Session not found".into()));
    }

    // Clean up sandbox and shell state
    state
        .tool_context_factory
        .cleanup(tenant.tenant_id, session_id);
    claurst_tools::clear_session_shell_state(&session_id.to_string());
    claurst_tools::clear_session_snapshot(&session_id.to_string());

    Ok(Json(json!({"deleted": true})))
}

/// GET /v1/sessions — list sessions.
pub async fn list(
    State(state): State<AppState>,
    Extension(tenant): Extension<TenantContext>,
) -> Result<Json<Value>, ApiError> {
    let sessions = db::sessions::list_sessions(&state.db, tenant.tenant_id, 50, 0).await?;

    Ok(Json(json!({
        "sessions": sessions,
        "count": sessions.len(),
    })))
}
