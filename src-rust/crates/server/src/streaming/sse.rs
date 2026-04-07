use axum::response::sse::Event;
use claurst_api::streaming::{AnthropicStreamEvent, ContentDelta};
use claurst_query::QueryEvent;
use serde_json::json;

/// Stream format selector.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StreamFormat {
    /// Native CLAURST format (full QueryEvent as JSON).
    Native,
    /// Vercel AI SDK text stream protocol.
    Vercel,
    /// OpenAI-compatible SSE chunks.
    OpenAI,
}

impl StreamFormat {
    pub fn from_header(accept: Option<&str>, query: Option<&str>) -> Self {
        let hint = query.or(accept).unwrap_or("native");
        match hint {
            "vercel" | "text/event-stream; format=vercel" => Self::Vercel,
            "openai" | "text/event-stream; format=openai" => Self::OpenAI,
            _ => Self::Native,
        }
    }
}

/// Convert a QueryEvent into an SSE Event.
pub fn query_event_to_sse(event: &QueryEvent, format: StreamFormat, model: &str, run_id: &str) -> Option<Event> {
    match format {
        StreamFormat::Native => native_format(event),
        StreamFormat::Vercel => super::vercel_format::encode(event),
        StreamFormat::OpenAI => super::openai_format::encode(event, model, run_id),
    }
}

fn native_format(event: &QueryEvent) -> Option<Event> {
    let (event_type, data) = match event {
        // --- Anthropic stream events (text content, tool calls, etc.) ---
        QueryEvent::Stream(stream_event) => {
            return native_stream_event(stream_event);
        }
        QueryEvent::ToolStart { tool_name, tool_id, .. } => {
            ("tool_start", json!({"tool_name": tool_name, "tool_id": tool_id}).to_string())
        }
        QueryEvent::ToolEnd { tool_name, tool_id, result, is_error, .. } => {
            ("tool_end", json!({
                "tool_name": tool_name,
                "tool_id": tool_id,
                "result": result,
                "is_error": is_error,
            }).to_string())
        }
        QueryEvent::TurnComplete { stop_reason, usage, .. } => {
            ("turn_complete", json!({
                "stop_reason": stop_reason,
                "usage": usage,
            }).to_string())
        }
        QueryEvent::Status(msg) => {
            ("status", json!({"message": msg}).to_string())
        }
        QueryEvent::Error(err) => {
            ("error", json!({"message": err}).to_string())
        }
        QueryEvent::TokenWarning { state, pct_used } => {
            ("token_warning", json!({"state": format!("{:?}", state), "pct_used": pct_used}).to_string())
        }
    };

    Some(Event::default().event(event_type).data(data))
}

/// Convert an AnthropicStreamEvent into an SSE Event using the Anthropic wire format.
fn native_stream_event(event: &AnthropicStreamEvent) -> Option<Event> {
    let (event_type, data) = match event {
        AnthropicStreamEvent::MessageStart { id, model, usage } => {
            ("message_start", json!({
                "type": "message_start",
                "message": { "id": id, "model": model, "usage": usage }
            }).to_string())
        }
        AnthropicStreamEvent::ContentBlockStart { index, content_block } => {
            ("content_block_start", json!({
                "type": "content_block_start",
                "index": index,
                "content_block": content_block,
            }).to_string())
        }
        AnthropicStreamEvent::ContentBlockDelta { index, delta } => {
            let delta_json = match delta {
                ContentDelta::TextDelta { text } => json!({"type": "text_delta", "text": text}),
                ContentDelta::InputJsonDelta { partial_json } => json!({"type": "input_json_delta", "partial_json": partial_json}),
                ContentDelta::ThinkingDelta { thinking } => json!({"type": "thinking_delta", "thinking": thinking}),
                ContentDelta::SignatureDelta { signature } => json!({"type": "signature_delta", "signature": signature}),
            };
            ("content_block_delta", json!({
                "type": "content_block_delta",
                "index": index,
                "delta": delta_json,
            }).to_string())
        }
        AnthropicStreamEvent::ContentBlockStop { index } => {
            ("content_block_stop", json!({
                "type": "content_block_stop",
                "index": index,
            }).to_string())
        }
        AnthropicStreamEvent::MessageDelta { stop_reason, usage } => {
            ("message_delta", json!({
                "type": "message_delta",
                "delta": { "stop_reason": stop_reason },
                "usage": usage,
            }).to_string())
        }
        AnthropicStreamEvent::MessageStop => {
            ("message_stop", json!({"type": "message_stop"}).to_string())
        }
        AnthropicStreamEvent::Error { error_type, message } => {
            ("error", json!({"type": "error", "error": {"type": error_type, "message": message}}).to_string())
        }
        AnthropicStreamEvent::Ping => return None,
    };

    Some(Event::default().event(event_type).data(data))
}
