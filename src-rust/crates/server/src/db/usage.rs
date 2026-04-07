use sqlx::PgPool;
use uuid::Uuid;

/// Record a single API request.
pub async fn record_request(
    pool: &PgPool,
    tenant_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO usage_events (tenant_id, event_type, credits, metadata)
        VALUES ($1, 'request', 1, '{}'::jsonb)
        "#,
    )
    .bind(tenant_id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Get the number of requests this calendar month.
pub async fn get_monthly_request_count(
    pool: &PgPool,
    tenant_id: Uuid,
) -> Result<i64, sqlx::Error> {
    let count: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM usage_events
        WHERE tenant_id = $1
          AND event_type = 'request'
          AND created_at >= date_trunc('month', NOW())
        "#,
    )
    .bind(tenant_id)
    .fetch_one(pool)
    .await?;

    Ok(count)
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct UsageSummary {
    pub total_requests: i64,
    pub requests_today: i64,
}

/// Get usage summary for a tenant.
pub async fn get_usage_summary(
    pool: &PgPool,
    tenant_id: Uuid,
) -> Result<UsageSummary, sqlx::Error> {
    sqlx::query_as::<_, UsageSummary>(
        r#"
        SELECT
            COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW())) AS total_requests,
            COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW())) AS requests_today
        FROM usage_events
        WHERE tenant_id = $1 AND event_type = 'request'
        "#,
    )
    .bind(tenant_id)
    .fetch_one(pool)
    .await
}

/// Get daily request counts for the last N days (for charts).
pub async fn get_daily_usage(
    pool: &PgPool,
    tenant_id: Uuid,
    days: i32,
) -> Result<Vec<DailyUsage>, sqlx::Error> {
    sqlx::query_as::<_, DailyUsage>(
        r#"
        SELECT
            date_trunc('day', created_at)::date AS day,
            COUNT(*) AS requests
        FROM usage_events
        WHERE tenant_id = $1
          AND event_type = 'request'
          AND created_at >= NOW() - ($2 || ' days')::interval
        GROUP BY day
        ORDER BY day
        "#,
    )
    .bind(tenant_id)
    .bind(days)
    .fetch_all(pool)
    .await
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct DailyUsage {
    pub day: chrono::NaiveDate,
    pub requests: i64,
}
