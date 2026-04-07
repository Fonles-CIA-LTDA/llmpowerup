use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, sqlx::FromRow, serde::Serialize)]
pub struct ApiKeyInfo {
    pub id: Uuid,
    pub key_prefix: String,
    pub name: String,
    pub is_active: bool,
    pub last_used: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Create a new API key for a tenant.
pub async fn create_api_key(
    pool: &PgPool,
    tenant_id: Uuid,
    name: &str,
) -> Result<(String, ApiKeyInfo), sqlx::Error> {
    let (full_key, key_hash, key_prefix) = crate::auth::api_key::generate_api_key();

    let info = sqlx::query_as::<_, ApiKeyInfo>(
        r#"
        INSERT INTO api_keys (tenant_id, key_hash, key_prefix, name)
        VALUES ($1, $2, $3, $4)
        RETURNING id, key_prefix, name, is_active, last_used, created_at
        "#,
    )
    .bind(tenant_id)
    .bind(&key_hash)
    .bind(&key_prefix)
    .bind(name)
    .fetch_one(pool)
    .await?;

    Ok((full_key, info))
}

/// List all API keys for a tenant (without exposing the hash).
pub async fn list_api_keys(
    pool: &PgPool,
    tenant_id: Uuid,
) -> Result<Vec<ApiKeyInfo>, sqlx::Error> {
    sqlx::query_as::<_, ApiKeyInfo>(
        r#"
        SELECT id, key_prefix, name, is_active, last_used, created_at
        FROM api_keys
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(tenant_id)
    .fetch_all(pool)
    .await
}

/// Revoke (deactivate) an API key.
pub async fn revoke_api_key(
    pool: &PgPool,
    tenant_id: Uuid,
    key_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        "UPDATE api_keys SET is_active = FALSE WHERE id = $1 AND tenant_id = $2",
    )
    .bind(key_id)
    .bind(tenant_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}
