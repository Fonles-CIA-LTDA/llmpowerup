use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, sqlx::FromRow, serde::Serialize)]
pub struct SessionRow {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub title: Option<String>,
    pub model: String,
    pub provider_id: String,
    pub system_prompt: Option<String>,
    pub status: String,
    pub message_count: i32,
    pub total_tokens: i64,
    pub credits_used: i64,
    pub config: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

/// Create a new session.
pub async fn create_session(
    pool: &PgPool,
    tenant_id: Uuid,
    model: &str,
    provider_id: &str,
    system_prompt: Option<&str>,
    config: serde_json::Value,
) -> Result<SessionRow, sqlx::Error> {
    sqlx::query_as::<_, SessionRow>(
        r#"
        INSERT INTO sessions (tenant_id, model, provider_id, system_prompt, config)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, tenant_id, title, model, provider_id, system_prompt,
                  status, message_count, total_tokens, credits_used,
                  config, created_at, updated_at
        "#,
    )
    .bind(tenant_id)
    .bind(model)
    .bind(provider_id)
    .bind(system_prompt)
    .bind(config)
    .fetch_one(pool)
    .await
}

/// Get a session by ID (verifying tenant ownership).
pub async fn get_session(
    pool: &PgPool,
    tenant_id: Uuid,
    session_id: Uuid,
) -> Result<Option<SessionRow>, sqlx::Error> {
    sqlx::query_as::<_, SessionRow>(
        r#"
        SELECT id, tenant_id, title, model, provider_id, system_prompt,
               status, message_count, total_tokens, credits_used,
               config, created_at, updated_at
        FROM sessions
        WHERE id = $1 AND tenant_id = $2
        "#,
    )
    .bind(session_id)
    .bind(tenant_id)
    .fetch_optional(pool)
    .await
}

/// List sessions for a tenant.
pub async fn list_sessions(
    pool: &PgPool,
    tenant_id: Uuid,
    limit: i64,
    offset: i64,
) -> Result<Vec<SessionRow>, sqlx::Error> {
    sqlx::query_as::<_, SessionRow>(
        r#"
        SELECT id, tenant_id, title, model, provider_id, system_prompt,
               status, message_count, total_tokens, credits_used,
               config, created_at, updated_at
        FROM sessions
        WHERE tenant_id = $1
        ORDER BY updated_at DESC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(tenant_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
}

/// Delete a session.
pub async fn delete_session(
    pool: &PgPool,
    tenant_id: Uuid,
    session_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        "DELETE FROM sessions WHERE id = $1 AND tenant_id = $2",
    )
    .bind(session_id)
    .bind(tenant_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// Increment message count and update session metadata.
pub async fn update_session_stats(
    pool: &PgPool,
    session_id: Uuid,
    additional_messages: i32,
    additional_tokens: i64,
    additional_credits: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE sessions
        SET message_count = message_count + $2,
            total_tokens = total_tokens + $3,
            credits_used = credits_used + $4,
            updated_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(session_id)
    .bind(additional_messages)
    .bind(additional_tokens)
    .bind(additional_credits)
    .execute(pool)
    .await?;
    Ok(())
}
