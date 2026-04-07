use axum::extract::State;
use axum::{Extension, Json};
use serde_json::{json, Value};

use crate::credits::pricing::PlanLimits;
use crate::db;
use crate::error::ApiError;
use crate::tenant::context::TenantContext;
use crate::AppState;

/// GET /v1/usage -- current plan usage.
pub async fn current(
    State(state): State<AppState>,
    Extension(tenant): Extension<TenantContext>,
) -> Result<Json<Value>, ApiError> {
    let summary = db::usage::get_usage_summary(&state.db, tenant.tenant_id).await?;
    let limits = PlanLimits::for_plan(&tenant.plan);

    let remaining = (limits.monthly_requests - summary.total_requests).max(0);
    let pct_used = if limits.monthly_requests > 0 {
        ((summary.total_requests as f64 / limits.monthly_requests as f64) * 100.0).min(100.0)
    } else {
        0.0
    };

    Ok(Json(json!({
        "plan": tenant.plan.display_name(),
        "monthly_limit": limits.monthly_requests,
        "used_this_month": summary.total_requests,
        "remaining": remaining,
        "percent_used": pct_used,
        "requests_today": summary.requests_today,
        "rate_limit_rpm": limits.rate_limit_rpm,
        "max_concurrent": limits.max_concurrent,
    })))
}
