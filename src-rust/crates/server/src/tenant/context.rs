use uuid::Uuid;

/// Tenant plan tier, determines tool access and rate limits.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TenantPlan {
    Free,
    Pro,
    Enterprise,
}

impl TenantPlan {
    pub fn from_str(s: &str) -> Self {
        match s {
            "pro" => Self::Pro,
            "enterprise" => Self::Enterprise,
            _ => Self::Free,
        }
    }

    pub fn display_name(&self) -> &str {
        match self {
            Self::Free => "Free",
            Self::Pro => "Pro",
            Self::Enterprise => "Enterprise",
        }
    }
}

/// Per-request tenant context, extracted by auth middleware.
#[derive(Debug, Clone)]
pub struct TenantContext {
    pub tenant_id: Uuid,
    pub api_key_id: Uuid,
    /// Requests per minute limit.
    pub rate_limit_rpm: i32,
    /// Maximum concurrent agent runs.
    pub max_concurrent: i32,
    /// Tenant's plan tier.
    pub plan: TenantPlan,
    /// Scoped permissions from the API key.
    pub permissions: Vec<String>,
    /// Stripe customer ID (for billing).
    pub stripe_customer_id: Option<String>,
}

impl TenantContext {
    pub fn has_permission(&self, scope: &str) -> bool {
        self.permissions.iter().any(|p| p == "*" || p == scope)
    }
}
