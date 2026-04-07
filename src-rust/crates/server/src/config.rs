use std::net::SocketAddr;

/// Server configuration, loaded from environment variables.
#[derive(Clone, Debug)]
pub struct ServerConfig {
    /// Address to bind the HTTP server to.
    pub bind_addr: SocketAddr,
    /// Supabase/PostgreSQL connection string.
    pub database_url: String,
    /// AES-256 encryption key for provider credentials (hex-encoded, 64 chars).
    pub encryption_key: [u8; 32],
    /// Supabase JWT secret for dashboard auth validation.
    pub supabase_jwt_secret: String,
    /// Base directory for per-tenant sandboxes.
    pub sandbox_base_dir: String,
    /// Maximum concurrent agent runs per server instance.
    pub max_concurrent_runs: usize,
}

impl ServerConfig {
    /// Load configuration from environment variables.
    pub fn from_env() -> Result<Self, anyhow::Error> {
        let port: u16 = std::env::var("PORT")
            .unwrap_or_else(|_| "3000".to_string())
            .parse()?;
        let bind_addr = SocketAddr::from(([0, 0, 0, 0], port));

        let database_url =
            std::env::var("DATABASE_URL").map_err(|_| anyhow::anyhow!("DATABASE_URL is required"))?;

        let enc_hex = std::env::var("ENCRYPTION_KEY")
            .map_err(|_| anyhow::anyhow!("ENCRYPTION_KEY is required (64 hex chars)"))?;
        let enc_bytes = hex::decode(&enc_hex)?;
        if enc_bytes.len() != 32 {
            anyhow::bail!("ENCRYPTION_KEY must be exactly 32 bytes (64 hex chars)");
        }
        let mut encryption_key = [0u8; 32];
        encryption_key.copy_from_slice(&enc_bytes);

        let supabase_jwt_secret = std::env::var("SUPABASE_JWT_SECRET")
            .unwrap_or_else(|_| "super-secret-jwt-token-with-at-least-32-characters".to_string());

        let sandbox_base_dir =
            std::env::var("SANDBOX_BASE_DIR").unwrap_or_else(|_| "/tmp/llmpowerup-sandboxes".to_string());

        let max_concurrent_runs: usize = std::env::var("MAX_CONCURRENT_RUNS")
            .unwrap_or_else(|_| "200".to_string())
            .parse()?;

        Ok(Self {
            bind_addr,
            database_url,
            encryption_key,
            supabase_jwt_secret,
            sandbox_base_dir,
            max_concurrent_runs,
        })
    }
}
