use axum::Extension;
use axum::Json;
use serde_json::{json, Value};

use crate::error::ApiError;
use crate::sandbox::policy::ToolPolicy;
use crate::tenant::context::TenantContext;

/// GET /v1/tools — list available tools for this tenant's plan.
pub async fn list_tools(
    Extension(tenant): Extension<TenantContext>,
) -> Result<Json<Value>, ApiError> {
    let policy = ToolPolicy::for_plan(&tenant.plan);
    let all = claurst_tools::all_tools();

    let tools: Vec<Value> = all
        .iter()
        .map(|t| {
            let allowed = policy.is_tool_allowed(t.name());
            json!({
                "name": t.name(),
                "description": t.description(),
                "permission_level": format!("{:?}", t.permission_level()),
                "available": allowed,
                "input_schema": t.input_schema(),
            })
        })
        .collect();

    Ok(Json(json!({
        "tools": tools,
        "count": tools.len(),
        "plan": format!("{:?}", tenant.plan),
    })))
}
