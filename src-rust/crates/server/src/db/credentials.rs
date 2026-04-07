use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand::RngCore;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::ApiError;

#[derive(Debug, sqlx::FromRow, serde::Serialize)]
pub struct ProviderCredentialInfo {
    pub id: Uuid,
    pub provider_id: String,
    pub api_base: Option<String>,
    pub is_default: bool,
    pub label: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Encrypt a provider API key using AES-256-GCM.
fn encrypt_key(plaintext: &str, encryption_key: &[u8; 32]) -> Result<Vec<u8>, ApiError> {
    let cipher = Aes256Gcm::new_from_slice(encryption_key)
        .map_err(|e| ApiError::Internal(format!("Cipher init: {e}")))?;
    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| ApiError::Internal(format!("Encrypt: {e}")))?;

    // Prepend nonce to ciphertext: [12 bytes nonce | ciphertext]
    let mut result = Vec::with_capacity(12 + ciphertext.len());
    result.extend_from_slice(&nonce_bytes);
    result.extend_from_slice(&ciphertext);
    Ok(result)
}

/// Decrypt a provider API key.
fn decrypt_key(encrypted: &[u8], encryption_key: &[u8; 32]) -> Result<String, ApiError> {
    if encrypted.len() < 13 {
        return Err(ApiError::Internal("Invalid encrypted data".into()));
    }
    let cipher = Aes256Gcm::new_from_slice(encryption_key)
        .map_err(|e| ApiError::Internal(format!("Cipher init: {e}")))?;
    let nonce = Nonce::from_slice(&encrypted[..12]);
    let plaintext = cipher
        .decrypt(nonce, &encrypted[12..])
        .map_err(|e| ApiError::Internal(format!("Decrypt: {e}")))?;
    String::from_utf8(plaintext).map_err(|e| ApiError::Internal(format!("UTF-8: {e}")))
}

/// Store a provider credential (encrypted).
pub async fn store_credential(
    pool: &PgPool,
    tenant_id: Uuid,
    provider_id: &str,
    api_key: &str,
    api_base: Option<&str>,
    label: Option<&str>,
    encryption_key: &[u8; 32],
) -> Result<ProviderCredentialInfo, ApiError> {
    let encrypted = encrypt_key(api_key, encryption_key)?;

    let info = sqlx::query_as::<_, ProviderCredentialInfo>(
        r#"
        INSERT INTO provider_credentials (tenant_id, provider_id, encrypted_key, api_base, label)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (tenant_id, provider_id, label)
        DO UPDATE SET encrypted_key = $3, api_base = $4, updated_at = NOW()
        RETURNING id, provider_id, api_base, is_default, label, created_at
        "#,
    )
    .bind(tenant_id)
    .bind(provider_id)
    .bind(&encrypted)
    .bind(api_base)
    .bind(label)
    .fetch_one(pool)
    .await?;

    Ok(info)
}

/// Retrieve and decrypt a provider API key for a tenant.
pub async fn get_decrypted_key(
    pool: &PgPool,
    tenant_id: Uuid,
    provider_id: &str,
    encryption_key: &[u8; 32],
) -> Result<(String, Option<String>), ApiError> {
    let row = sqlx::query_as::<_, EncryptedRow>(
        r#"
        SELECT encrypted_key, api_base
        FROM provider_credentials
        WHERE tenant_id = $1 AND provider_id = $2 AND is_active = TRUE
        ORDER BY is_default DESC, created_at DESC
        LIMIT 1
        "#,
    )
    .bind(tenant_id)
    .bind(provider_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| {
        ApiError::BadRequest(format!(
            "No API key configured for provider '{provider_id}'. Add one via the dashboard."
        ))
    })?;

    let decrypted = decrypt_key(&row.encrypted_key, encryption_key)?;
    Ok((decrypted, row.api_base))
}

/// List all provider credentials for a tenant (without decrypting keys).
pub async fn list_credentials(
    pool: &PgPool,
    tenant_id: Uuid,
) -> Result<Vec<ProviderCredentialInfo>, sqlx::Error> {
    sqlx::query_as::<_, ProviderCredentialInfo>(
        r#"
        SELECT id, provider_id, api_base, is_default, label, created_at
        FROM provider_credentials
        WHERE tenant_id = $1 AND is_active = TRUE
        ORDER BY provider_id, created_at DESC
        "#,
    )
    .bind(tenant_id)
    .fetch_all(pool)
    .await
}

#[derive(sqlx::FromRow)]
struct EncryptedRow {
    encrypted_key: Vec<u8>,
    api_base: Option<String>,
}
