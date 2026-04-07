use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};

use crate::credits::pricing::PlanLimits;
use crate::error::ApiError;
use crate::tenant::context::TenantContext;
use crate::AppState;

/// Usage check middleware.
///
/// Counts requests this month and checks against the plan limit.
/// Free users are blocked when they hit the limit.
/// Paid users can exceed (overage billed at end of cycle).
pub async fn check_usage(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Result<Response, ApiError> {
    let tenant = request
        .extensions()
        .get::<TenantContext>()
        .ok_or_else(|| ApiError::Internal("TenantContext not found".into()))?
        .clone();

    // Get this month's usage count
    let monthly_usage = crate::db::usage::get_monthly_request_count(
        &state.db,
        tenant.tenant_id,
    )
    .await
    .unwrap_or(0);

    if !PlanLimits::can_make_request(&tenant.plan, monthly_usage) {
        return Err(ApiError::UsageLimitReached);
    }

    // Increment request count (fire-and-forget)
    let db = state.db.clone();
    let tid = tenant.tenant_id;
    tokio::spawn(async move {
        let _ = crate::db::usage::record_request(&db, tid).await;
    });

    Ok(next.run(request).await)
}
