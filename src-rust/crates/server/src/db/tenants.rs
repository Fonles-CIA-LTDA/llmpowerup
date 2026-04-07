use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, sqlx::FromRow)]
pub struct TenantRow {
    pub id: Uuid,
    pub supabase_uid: Uuid,
    pub email: String,
    pub display_name: Option<String>,
    pub plan: String,
    pub credit_balance: i64,
    pub credit_reserved: i64,
    pub rate_limit_rpm: i32,
    pub max_concurrent: i32,
    pub is_active: bool,
}

/// Create a new tenant.
pub async fn create_tenant(
    pool: &PgPool,
    supabase_uid: Uuid,
    email: &str,
    display_name: Option<&str>,
) -> Result<TenantRow, sqlx::Error> {
    sqlx::query_as::<_, TenantRow>(
        r#"
        INSERT INTO tenants (supabase_uid, email, display_name)
        VALUES ($1, $2, $3)
        RETURNING id, supabase_uid, email, display_name, plan,
                  credit_balance, credit_reserved, rate_limit_rpm,
                  max_concurrent, is_active
        "#,
    )
    .bind(supabase_uid)
    .bind(email)
    .bind(display_name)
    .fetch_one(pool)
    .await
}

/// Get a tenant by ID.
pub async fn get_tenant(pool: &PgPool, tenant_id: Uuid) -> Result<Option<TenantRow>, sqlx::Error> {
    sqlx::query_as::<_, TenantRow>(
        r#"
        SELECT id, supabase_uid, email, display_name, plan,
               credit_balance, credit_reserved, rate_limit_rpm,
               max_concurrent, is_active
        FROM tenants
        WHERE id = $1
        "#,
    )
    .bind(tenant_id)
    .fetch_optional(pool)
    .await
}

/// Get a tenant by Supabase user ID.
pub async fn get_tenant_by_uid(
    pool: &PgPool,
    supabase_uid: Uuid,
) -> Result<Option<TenantRow>, sqlx::Error> {
    sqlx::query_as::<_, TenantRow>(
        r#"
        SELECT id, supabase_uid, email, display_name, plan,
               credit_balance, credit_reserved, rate_limit_rpm,
               max_concurrent, is_active
        FROM tenants
        WHERE supabase_uid = $1
        "#,
    )
    .bind(supabase_uid)
    .fetch_optional(pool)
    .await
}
