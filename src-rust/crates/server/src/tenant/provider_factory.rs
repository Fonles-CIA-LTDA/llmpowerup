use sqlx::PgPool;
use tracing::{debug, warn};
use uuid::Uuid;

use crate::db::credentials;
use crate::error::ApiError;

/// Builds LLM providers from tenant BYOK credentials.
///
/// All tenants use OpenRouter as their unified LLM gateway.
/// The OpenRouter key is stored in provider_credentials with provider_id = "openrouter".
/// OpenRouter is OpenAI-compatible, so we construct an AnthropicClient pointed at
/// OpenRouter's base URL.
pub struct ProviderFactory {
    db: PgPool,
    encryption_key: [u8; 32],
}

impl ProviderFactory {
    pub fn new(db: PgPool, encryption_key: [u8; 32]) -> Self {
        Self { db, encryption_key }
    }

    /// Get the tenant's OpenRouter API key (decrypted).
    async fn get_openrouter_key(&self, tenant_id: Uuid) -> Result<String, ApiError> {
        // Try encrypted key first (from backend encryption)
        let result = credentials::get_decrypted_key(
            &self.db,
            tenant_id,
            "openrouter",
            &self.encryption_key,
        )
        .await;

        match result {
            Ok((key, _)) => {
                debug!(tenant_id = %tenant_id, key_prefix = %&key[..key.len().min(10)], "Got decrypted OR key");
                Ok(key)
            }
            Err(e) => {
                warn!(tenant_id = %tenant_id, error = %e, "Decryption failed, trying raw UTF-8 fallback");
                // Fallback: read raw bytea (from dashboard direct insert)
                let row = sqlx::query_scalar::<_, String>(
                    "SELECT convert_from(encrypted_key, 'UTF8') FROM provider_credentials WHERE tenant_id = $1 AND provider_id = 'openrouter' AND is_active = TRUE LIMIT 1"
                )
                .bind(tenant_id)
                .fetch_optional(&self.db)
                .await
                .map_err(|e| ApiError::Internal(format!("DB error: {e}")))?;

                let raw = row.ok_or_else(|| ApiError::BadRequest(
                    "No OpenRouter API key configured. Add one in Dashboard > Providers.".into()
                ))?;

                // The dashboard stores keys as bytea. Supabase JS may encode them
                // as a JSON array of byte values: "[115,107,45,...]".
                // Decode that into the actual string.
                let key = if raw.starts_with('[') {
                    match serde_json::from_str::<Vec<u8>>(&raw) {
                        Ok(bytes) => String::from_utf8(bytes)
                            .map_err(|e| ApiError::Internal(format!("Invalid UTF-8 in key: {e}")))?,
                        Err(_) => raw,
                    }
                } else {
                    raw
                };

                debug!(tenant_id = %tenant_id, key_prefix = %&key[..key.len().min(8)], "Got OR key (fallback)");
                Ok(key)
            }
        }
    }

    /// Build a ProviderRegistry with OpenRouter as the backend.
    ///
    /// Constructs the OpenRouter provider directly with the tenant's API key
    /// instead of relying on environment variables (which are global/racy in
    /// an async multi-tenant server).
    pub async fn build_registry(
        &self,
        tenant_id: Uuid,
        _provider_id: &str, // ignored — always OpenRouter
    ) -> Result<claurst_api::ProviderRegistry, ApiError> {
        let api_key = self.get_openrouter_key(tenant_id).await?;

        let provider = claurst_api::providers::openai_compat_providers::openrouter()
            .with_api_key(api_key);

        let mut registry = claurst_api::ProviderRegistry::new();
        registry.register(std::sync::Arc::new(provider));

        Ok(registry)
    }

    /// Build an AnthropicClient pointed at OpenRouter.
    ///
    /// `run_query_loop` requires an AnthropicClient. Since OpenRouter is
    /// OpenAI-compatible (and supports Anthropic models), we create a client
    /// with the OpenRouter base URL and the tenant's OpenRouter key.
    ///
    /// Uses direct config instead of env vars to avoid races in async context.
    pub async fn build_anthropic_client(
        &self,
        tenant_id: Uuid,
    ) -> Result<claurst_api::AnthropicClient, ApiError> {
        let api_key = self.get_openrouter_key(tenant_id).await?;

        let mut config = claurst_api::client::ClientConfig::default();
        config.api_key = api_key;
        config.api_base = "https://openrouter.ai/api/v1".to_string();

        claurst_api::AnthropicClient::new(config)
            .map_err(|e| ApiError::ProviderError(format!("Failed to create client: {e}")))
    }
}
