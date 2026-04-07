use axum::Extension;
use axum::Json;
use serde_json::{json, Value};

use crate::error::ApiError;
use crate::tenant::context::TenantContext;

/// GET /v1/models -- list available models from the model registry.
pub async fn list_models(
    Extension(_tenant): Extension<TenantContext>,
) -> Result<Json<Value>, ApiError> {
    // Return a static list of supported models
    let models = json!([
        {"id": "claude-opus-4-6", "provider": "anthropic", "name": "Claude Opus 4.6"},
        {"id": "claude-sonnet-4-6", "provider": "anthropic", "name": "Claude Sonnet 4.6"},
        {"id": "claude-haiku-4-5-20251001", "provider": "anthropic", "name": "Claude Haiku 4.5"},
        {"id": "gpt-4o", "provider": "openai", "name": "GPT-4o"},
        {"id": "gpt-4o-mini", "provider": "openai", "name": "GPT-4o Mini"},
        {"id": "gemini-2.0-flash", "provider": "google", "name": "Gemini 2.0 Flash"},
        {"id": "gemini-2.5-pro", "provider": "google", "name": "Gemini 2.5 Pro"},
        {"id": "deepseek-chat", "provider": "deepseek", "name": "DeepSeek Chat"},
        {"id": "llama-3.3-70b-versatile", "provider": "groq", "name": "Llama 3.3 70B (Groq)"},
    ]);

    Ok(Json(json!({
        "models": models,
        "count": models.as_array().map(|a| a.len()).unwrap_or(0),
    })))
}
