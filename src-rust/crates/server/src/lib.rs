pub mod auth;
pub mod config;
pub mod credits;
pub mod db;
pub mod error;
pub mod rate_limit;
pub mod routes;
pub mod sandbox;
pub mod streaming;
pub mod tenant;

use std::sync::Arc;
use std::time::Duration;

use axum::middleware;
use axum::routing::{delete, get, post};
use axum::Router;
use sqlx::PgPool;
use tower_http::cors::CorsLayer;
use tower_http::timeout::TimeoutLayer;
use tower_http::trace::TraceLayer;

use crate::config::ServerConfig;
use crate::rate_limit::middleware::RateLimitState;
use crate::tenant::provider_factory::ProviderFactory;
use crate::tenant::tool_context_factory::ToolContextFactory;

/// Shared application state available in all handlers.
#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub provider_factory: Arc<ProviderFactory>,
    pub tool_context_factory: Arc<ToolContextFactory>,
    pub config: Arc<ServerConfig>,
}

/// Build the complete axum application with all routes and middleware.
pub fn build_app(state: AppState) -> Router {
    let rate_limit_state = RateLimitState::new();

    // API routes (auth + rate limit + usage check)
    let api_routes = Router::new()
        .route("/v1/agent/run", post(routes::agent::create_run))
        .route("/v1/sessions", post(routes::sessions::create).get(routes::sessions::list))
        .route(
            "/v1/sessions/{id}",
            get(routes::sessions::get).delete(routes::sessions::delete),
        )
        .route("/v1/models", get(routes::models::list_models))
        .route("/v1/tools", get(routes::tools::list_tools))
        .route("/v1/usage", get(routes::usage::current))
        // Middleware (innermost first):
        // 1. Check monthly usage limit
        .layer(middleware::from_fn_with_state(
            state.clone(),
            credits::middleware::check_usage,
        ))
        // 2. Rate limiting (429)
        .layer(middleware::from_fn_with_state(
            rate_limit_state,
            rate_limit::middleware::rate_limit,
        ))
        // 3. Authentication (401)
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth::middleware::authenticate,
        ));

    // Stripe webhook (no auth - verified by signature)
    let webhook_routes = Router::new()
        .route("/webhooks/stripe", post(routes::stripe_webhook::handle_webhook));

    // Public routes
    let public_routes = Router::new()
        .route("/health", get(routes::health::health))
        .route("/ready", get(routes::health::ready));

    Router::new()
        .merge(api_routes)
        .merge(webhook_routes)
        .merge(public_routes)
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .layer(TimeoutLayer::with_status_code(
            axum::http::StatusCode::REQUEST_TIMEOUT,
            Duration::from_secs(300),
        ))
        .with_state(state)
}
