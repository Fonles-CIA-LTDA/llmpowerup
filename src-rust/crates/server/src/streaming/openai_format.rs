use axum::response::sse::Event;
use claurst_query::QueryEvent;
use serde_json::json;

/// Encode a QueryEvent into OpenAI-compatible SSE format.
///
/// This makes the API compatible with LangChain's `ChatOpenAI` client.
pub fn encode(event: &QueryEvent, model: &str, run_id: &str) -> Option<Event> {
    let data = match event {
        QueryEvent::Stream(stream_event) => {
            if let Some(text) = extract_text_delta(stream_event) {
                let chunk = json!({
                    "id": run_id,
                    "object": "chat.completion.chunk",
                    "model": model,
                    "choices": [{
                        "index": 0,
                        "delta": { "content": text },
                        "finish_reason": serde_json::Value::Null,
                    }]
                });
                format!("data: {}\n\n", serde_json::to_string(&chunk).unwrap_or_default())
            } else {
                return None;
            }
        }
        QueryEvent::ToolStart { tool_name, tool_id, input_json, .. } => {
            let input: serde_json::Value = serde_json::from_str(input_json).unwrap_or(serde_json::Value::Null);
            let chunk = json!({
                "id": run_id,
                "object": "chat.completion.chunk",
                "model": model,
                "choices": [{
                    "index": 0,
                    "delta": {
                        "tool_calls": [{
                            "index": 0,
                            "id": tool_id,
                            "type": "function",
                            "function": {
                                "name": tool_name,
                                "arguments": serde_json::to_string(&input).unwrap_or_default(),
                            }
                        }]
                    },
                    "finish_reason": serde_json::Value::Null,
                }]
            });
            format!("data: {}\n\n", serde_json::to_string(&chunk).unwrap_or_default())
        }
        QueryEvent::TurnComplete { .. } => {
            let chunk = json!({
                "id": run_id,
                "object": "chat.completion.chunk",
                "model": model,
                "choices": [{
                    "index": 0,
                    "delta": {},
                    "finish_reason": "stop",
                }]
            });
            format!(
                "data: {}\n\ndata: [DONE]\n\n",
                serde_json::to_string(&chunk).unwrap_or_default()
            )
        }
        _ => return None,
    };

    Some(Event::default().data(data))
}

fn extract_text_delta(event: &claurst_api::AnthropicStreamEvent) -> Option<String> {
    match event {
        claurst_api::AnthropicStreamEvent::ContentBlockDelta { delta, .. } => {
            if let claurst_api::streaming::ContentDelta::TextDelta { text } = delta {
                Some(text.clone())
            } else {
                None
            }
        }
        _ => None,
    }
}
