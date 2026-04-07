use crate::tenant::context::TenantPlan;

/// Plan limits and pricing.
///
/// Simple model: 1 request = 1 API call, regardless of tools/agents used.
pub struct PlanLimits {
    /// Monthly request allowance.
    pub monthly_requests: i64,
    /// Cost per extra request beyond allowance (in microcents, $0.005 = 500).
    pub overage_microcents: i64,
    /// Maximum concurrent agent runs.
    pub max_concurrent: i32,
    /// Requests per minute.
    pub rate_limit_rpm: i32,
}

impl PlanLimits {
    pub fn for_plan(plan: &TenantPlan) -> Self {
        match plan {
            TenantPlan::Free => Self {
                monthly_requests: 100,
                overage_microcents: 0, // no overage, just blocked
                max_concurrent: 1,
                rate_limit_rpm: 5,
            },
            TenantPlan::Pro => Self {
                monthly_requests: 10_000,
                overage_microcents: 300, // $0.003 per extra request
                max_concurrent: 10,
                rate_limit_rpm: 60,
            },
            TenantPlan::Enterprise => Self {
                monthly_requests: 100_000,
                overage_microcents: 100, // $0.001 per extra request
                max_concurrent: 50,
                rate_limit_rpm: 300,
            },
        }
    }

    /// Check if the tenant can make another request this month.
    pub fn can_make_request(plan: &TenantPlan, monthly_usage: i64) -> bool {
        let limits = Self::for_plan(plan);
        match plan {
            TenantPlan::Free => monthly_usage < limits.monthly_requests,
            // Paid plans allow overage (billed at end of cycle)
            TenantPlan::Pro | TenantPlan::Enterprise => true,
        }
    }
}

/// Stripe price IDs (set via env vars in production).
pub struct StripePrices;

impl StripePrices {
    pub fn pro_monthly() -> String {
        std::env::var("STRIPE_PRICE_PRO").unwrap_or_else(|_| "price_pro_monthly".into())
    }

    pub fn enterprise_monthly() -> String {
        std::env::var("STRIPE_PRICE_ENTERPRISE").unwrap_or_else(|_| "price_enterprise_monthly".into())
    }
}
