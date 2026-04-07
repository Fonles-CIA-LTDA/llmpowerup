use std::sync::Arc;

use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use claurst_server::config::ServerConfig;
use claurst_server::db::pool::create_pool;
use claurst_server::tenant::provider_factory::ProviderFactory;
use claurst_server::tenant::tool_context_factory::ToolContextFactory;
use claurst_server::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load .env file
    let _ = dotenvy::dotenv();

    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "llmpowerup_server=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting llmpowerup-server v{}", env!("CARGO_PKG_VERSION"));

    // Load configuration
    let config = ServerConfig::from_env()?;
    let bind_addr = config.bind_addr;

    tracing::info!("Connecting to database...");
    let pool = create_pool(&config.database_url).await?;
    tracing::info!("Database connected");

    // Create sandbox base directory
    std::fs::create_dir_all(&config.sandbox_base_dir)?;

    // Build application state
    let state = AppState {
        db: pool.clone(),
        provider_factory: Arc::new(ProviderFactory::new(pool.clone(), config.encryption_key)),
        tool_context_factory: Arc::new(ToolContextFactory::new(&config.sandbox_base_dir)),
        config: Arc::new(config),
    };

    // Build the application
    let app = claurst_server::build_app(state);

    // Start the server
    let listener = tokio::net::TcpListener::bind(bind_addr).await?;
    tracing::info!("Server listening on {bind_addr}");
    tracing::info!("Health check: http://{bind_addr}/health");
    tracing::info!("API base: http://{bind_addr}/v1/");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    tracing::info!("Server shut down gracefully");
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("Shutdown signal received");
}
