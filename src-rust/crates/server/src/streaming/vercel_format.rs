use axum::response::sse::Event;
use claurst_query::QueryEvent;
use serde_json::json;

/// Encode a QueryEvent into Vercel AI SDK text stream format.
///
/// Vercel AI SDK protocol:
/// - `0:"text"` -- text delta
/// - `9:{toolCallId, toolName, args}` -- tool call start
/// - `a:{toolCallId, result}` -- tool result
/// - `d:{finishReason, usage}` -- finish message
pub fn encode(event: &QueryEvent) -> Option<Event> {
    let data = match event {
        QueryEvent::Stream(stream_event) => {
            if let Some(text) = extract_text_delta(stream_event) {
                format!("0:{}\n", serde_json::to_string(&text).unwrap_or_default())
            } else {
                return None;
            }
        }
        QueryEvent::ToolStart { tool_name, tool_id, input_json, .. } => {
            let input: serde_json::Value = serde_json::from_str(input_json).unwrap_or(serde_json::Value::Null);
            let tool_call = json!({
                "toolCallId": tool_id,
                "toolName": tool_name,
                "args": input,
            });
            format!("9:{}\n", serde_json::to_string(&tool_call).unwrap_or_default())
        }
        QueryEvent::ToolEnd { tool_id, result, .. } => {
            let tool_result = json!({
                "toolCallId": tool_id,
                "result": result,
            });
            format!("a:{}\n", serde_json::to_string(&tool_result).unwrap_or_default())
        }
        QueryEvent::TurnComplete { usage, .. } => {
            let finish = json!({
                "finishReason": "stop",
                "usage": format!("{:?}", usage),
            });
            format!("d:{}\n", serde_json::to_string(&finish).unwrap_or_default())
        }
        _ => return None,
    };

    Some(Event::default().data(data))
}

/// Extract text content from an Anthropic stream event.
fn extract_text_delta(event: &claurst_api::AnthropicStreamEvent) -> Option<String> {
    match event {
        claurst_api::AnthropicStreamEvent::ContentBlockDelta { delta, .. } => {
            // ContentDelta is in the streaming module
            if let claurst_api::streaming::ContentDelta::TextDelta { text } = delta {
                Some(text.clone())
            } else {
                None
            }
        }
        _ => None,
    }
}
