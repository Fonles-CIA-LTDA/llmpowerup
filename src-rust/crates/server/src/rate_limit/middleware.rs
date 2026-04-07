use std::num::NonZeroU32;
use std::sync::Arc;

use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use dashmap::DashMap;
use governor::{Quota, RateLimiter};
use uuid::Uuid;

use crate::error::ApiError;
use crate::tenant::context::TenantContext;

type TenantLimiter = RateLimiter<
    governor::state::NotKeyed,
    governor::state::InMemoryState,
    governor::clock::DefaultClock,
>;

/// Shared rate limiter state across all requests.
#[derive(Clone)]
pub struct RateLimitState {
    /// Per-tenant rate limiters.
    limiters: Arc<DashMap<Uuid, Arc<TenantLimiter>>>,
}

impl RateLimitState {
    pub fn new() -> Self {
        Self {
            limiters: Arc::new(DashMap::new()),
        }
    }

    fn get_or_create(&self, tenant_id: Uuid, rpm: u32) -> Arc<TenantLimiter> {
        self.limiters
            .entry(tenant_id)
            .or_insert_with(|| {
                let quota = Quota::per_minute(NonZeroU32::new(rpm.max(1)).unwrap());
                Arc::new(RateLimiter::direct(quota))
            })
            .clone()
    }
}

/// Rate limiting middleware.
///
/// Uses a per-tenant token bucket with the tenant's configured RPM limit.
pub async fn rate_limit(
    State(state): State<RateLimitState>,
    request: Request,
    next: Next,
) -> Result<Response, ApiError> {
    let tenant = request
        .extensions()
        .get::<TenantContext>()
        .ok_or_else(|| ApiError::Internal("TenantContext not found".into()))?;

    let limiter = state.get_or_create(tenant.tenant_id, tenant.rate_limit_rpm as u32);

    if limiter.check().is_err() {
        return Err(ApiError::RateLimited);
    }

    Ok(next.run(request).await)
}
