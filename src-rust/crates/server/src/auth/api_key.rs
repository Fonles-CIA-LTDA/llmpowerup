use rand::Rng;
use sha2::{Digest, Sha256};

const KEY_PREFIX: &str = "clst_";
const KEY_RANDOM_BYTES: usize = 32;

/// Generate a new API key with the format `clst_<random>`.
///
/// Returns `(full_key, key_hash, key_prefix)` where:
/// - `full_key` is shown to the user once (never stored)
/// - `key_hash` is SHA-256 hex stored in DB for lookup
/// - `key_prefix` is first 12 chars for display (e.g., "clst_abc1...")
pub fn generate_api_key() -> (String, String, String) {
    let random_bytes: Vec<u8> = rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(KEY_RANDOM_BYTES)
        .map(|b| b as u8)
        .collect();
    let random_str = String::from_utf8(random_bytes).expect("alphanumeric is valid utf8");
    let full_key = format!("{KEY_PREFIX}{random_str}");
    let key_hash = hash_api_key(&full_key);
    let key_prefix = full_key[..12.min(full_key.len())].to_string();
    (full_key, key_hash, key_prefix)
}

/// SHA-256 hash of the full API key (for constant-time DB lookup).
pub fn hash_api_key(key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(key.as_bytes());
    hex::encode(hasher.finalize())
}
