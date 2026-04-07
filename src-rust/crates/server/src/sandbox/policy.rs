use std::collections::HashSet;
use claurst_core::permissions::{PermissionDecision, PermissionHandler, PermissionRequest};
use claurst_tools::PermissionLevel;
use crate::tenant::context::TenantPlan;

/// Defines which tools a tenant is allowed to use.
#[derive(Debug, Clone)]
pub struct ToolPolicy {
    /// Tool names explicitly allowed (empty = all built-in allowed).
    pub allowed_tools: HashSet<String>,
    /// Tool names explicitly denied.
    pub denied_tools: HashSet<String>,
    /// Whether Bash tool is enabled.
    pub allow_bash: bool,
    /// Whether file-write tools are enabled.
    pub allow_write: bool,
}

impl ToolPolicy {
    /// Create the default tool policy for a given plan tier.
    /// All plans get all tools. The only difference is rate limits and monthly requests.
    pub fn for_plan(plan: &TenantPlan) -> Self {
        match plan {
            // All plans: all 42 tools available
            TenantPlan::Free | TenantPlan::Pro | TenantPlan::Enterprise => Self {
                allowed_tools: HashSet::new(), // empty = all allowed
                denied_tools: HashSet::new(),
                allow_bash: true,
                allow_write: true,
            },
        }
    }

    /// Check if a specific tool is allowed by this policy.
    pub fn is_tool_allowed(&self, tool_name: &str) -> bool {
        if self.denied_tools.contains(tool_name) {
            return false;
        }
        if self.allowed_tools.is_empty() {
            return true; // empty = all allowed
        }
        self.allowed_tools.contains(tool_name)
    }
}

/// Permission handler for API mode.
///
/// Auto-allows tools within the tenant's policy, auto-denies everything else.
/// No interactive prompts — this is a non-interactive API server.
pub struct ServerPermissionHandler {
    policy: ToolPolicy,
}

impl ServerPermissionHandler {
    pub fn new(policy: ToolPolicy) -> Self {
        Self { policy }
    }
}

impl PermissionHandler for ServerPermissionHandler {
    fn check_permission(&self, request: &PermissionRequest) -> PermissionDecision {
        if self.policy.is_tool_allowed(&request.tool_name) {
            PermissionDecision::Allow
        } else {
            PermissionDecision::Deny
        }
    }

    fn request_permission(&self, request: &PermissionRequest) -> PermissionDecision {
        self.check_permission(request)
    }
}

/// Filter `all_tools()` to only include tools allowed by the policy.
pub fn filter_tools_by_policy(
    tools: Vec<Box<dyn claurst_tools::Tool>>,
    policy: &ToolPolicy,
) -> Vec<Box<dyn claurst_tools::Tool>> {
    tools
        .into_iter()
        .filter(|t| policy.is_tool_allowed(t.name()))
        .collect()
}
