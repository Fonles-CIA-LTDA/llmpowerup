use axum::extract::State;
use axum::Json;
use serde_json::{json, Value};

use crate::AppState;

/// GET /health — basic liveness check.
pub async fn health() -> Json<Value> {
    Json(json!({
        "status": "ok",
        "service": "claurst-server",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

/// GET /ready — checks database connectivity.
pub async fn ready(State(state): State<AppState>) -> Result<Json<Value>, Json<Value>> {
    match sqlx::query("SELECT 1").execute(&state.db).await {
        Ok(_) => Ok(Json(json!({
            "status": "ready",
            "database": "connected",
        }))),
        Err(e) => Err(Json(json!({
            "status": "not_ready",
            "database": format!("error: {e}"),
        }))),
    }
}
