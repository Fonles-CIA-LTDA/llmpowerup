use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, sqlx::FromRow, serde::Serialize)]
pub struct MessageRow {
    pub id: Uuid,
    pub session_id: Uuid,
    pub role: String,
    pub content: serde_json::Value,
    pub usage: Option<serde_json::Value>,
    pub cost: Option<serde_json::Value>,
    pub turn: i32,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Save a message to the database.
pub async fn save_message(
    pool: &PgPool,
    session_id: Uuid,
    tenant_id: Uuid,
    role: &str,
    content: serde_json::Value,
    usage: Option<serde_json::Value>,
    cost: Option<serde_json::Value>,
    turn: i32,
) -> Result<MessageRow, sqlx::Error> {
    sqlx::query_as::<_, MessageRow>(
        r#"
        INSERT INTO messages (session_id, tenant_id, role, content, usage, cost, turn)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, session_id, role, content, usage, cost, turn, created_at
        "#,
    )
    .bind(session_id)
    .bind(tenant_id)
    .bind(role)
    .bind(content)
    .bind(usage)
    .bind(cost)
    .bind(turn)
    .fetch_one(pool)
    .await
}

/// Load all messages for a session, ordered by turn.
pub async fn load_messages(
    pool: &PgPool,
    session_id: Uuid,
) -> Result<Vec<MessageRow>, sqlx::Error> {
    sqlx::query_as::<_, MessageRow>(
        r#"
        SELECT id, session_id, role, content, usage, cost, turn, created_at
        FROM messages
        WHERE session_id = $1
        ORDER BY turn ASC, created_at ASC
        "#,
    )
    .bind(session_id)
    .fetch_all(pool)
    .await
}
