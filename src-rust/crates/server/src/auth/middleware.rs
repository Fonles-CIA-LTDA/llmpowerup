use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};

use crate::error::ApiError;
use crate::tenant::context::{TenantContext, TenantPlan};
use crate::AppState;

/// Authentication middleware.
///
/// Extracts `Authorization: Bearer clst_xxx`, looks up tenant, injects TenantContext.
pub async fn authenticate(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, ApiError> {
    let auth_header = request
        .headers()
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| ApiError::Unauthorized("Missing Authorization header".into()))?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or_else(|| ApiError::Unauthorized("Invalid Authorization format. Use: Bearer clst_xxx".into()))?;

    if !token.starts_with("clst_") {
        return Err(ApiError::Unauthorized(
            "Invalid API key format. Keys start with 'clst_'".into(),
        ));
    }

    let key_hash = crate::auth::api_key::hash_api_key(token);

    let row = sqlx::query_as::<_, ApiKeyRow>(
        r#"
        SELECT
            ak.id AS api_key_id,
            ak.permissions,
            t.id AS tenant_id,
            t.rate_limit_rpm,
            t.max_concurrent,
            t.plan,
            t.stripe_customer_id
        FROM api_keys ak
        JOIN tenants t ON t.id = ak.tenant_id
        WHERE ak.key_hash = $1
          AND ak.is_active = TRUE
          AND t.is_active = TRUE
          AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
        "#,
    )
    .bind(&key_hash)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| ApiError::Internal(format!("DB error: {e}")))?
    .ok_or_else(|| ApiError::Unauthorized("Invalid or expired API key".into()))?;

    // Update last_used (fire-and-forget)
    let db = state.db.clone();
    let key_id = row.api_key_id;
    tokio::spawn(async move {
        let _ = sqlx::query("UPDATE api_keys SET last_used = NOW() WHERE id = $1")
            .bind(key_id)
            .execute(&db)
            .await;
    });

    let permissions: Vec<String> = serde_json::from_value(row.permissions.clone())
        .unwrap_or_else(|_| vec!["*".to_string()]);

    let tenant_ctx = TenantContext {
        tenant_id: row.tenant_id,
        api_key_id: row.api_key_id,
        rate_limit_rpm: row.rate_limit_rpm,
        max_concurrent: row.max_concurrent,
        plan: TenantPlan::from_str(&row.plan),
        permissions,
        stripe_customer_id: row.stripe_customer_id,
    };

    request.extensions_mut().insert(tenant_ctx);
    Ok(next.run(request).await)
}

#[derive(sqlx::FromRow)]
struct ApiKeyRow {
    api_key_id: uuid::Uuid,
    permissions: serde_json::Value,
    tenant_id: uuid::Uuid,
    rate_limit_rpm: i32,
    max_concurrent: i32,
    plan: String,
    stripe_customer_id: Option<String>,
}
