use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::AtomicUsize;

use uuid::Uuid;

use claurst_core::CostTracker;
use claurst_tools::ToolContext;

use crate::error::ApiError;
use crate::sandbox::policy::{ServerPermissionHandler, ToolPolicy};

/// Creates sandboxed ToolContexts for API requests.
pub struct ToolContextFactory {
    /// Base directory for all sandboxes (e.g., /tmp/claurst-sandboxes/).
    base_dir: PathBuf,
}

impl ToolContextFactory {
    pub fn new(base_dir: impl Into<PathBuf>) -> Self {
        Self {
            base_dir: base_dir.into(),
        }
    }

    /// Create a ToolContext for a specific tenant session.
    ///
    /// - `working_dir` is isolated to `/base/{tenant_id}/{session_id}/`
    /// - `permission_mode` is AcceptEdits (no interactive prompts)
    /// - `non_interactive` is true (API mode)
    pub fn create(
        &self,
        tenant_id: Uuid,
        session_id: Uuid,
        model: &str,
        policy: &ToolPolicy,
    ) -> Result<(ToolContext, Arc<CostTracker>), ApiError> {
        let sandbox_dir = self
            .base_dir
            .join(tenant_id.to_string())
            .join(session_id.to_string());
        std::fs::create_dir_all(&sandbox_dir)
            .map_err(|e| ApiError::Internal(format!("Failed to create sandbox: {e}")))?;

        let cost_tracker = CostTracker::new();
        let permission_handler = Arc::new(ServerPermissionHandler::new(policy.clone()));

        let ctx = ToolContext {
            working_dir: sandbox_dir,
            permission_mode: claurst_core::PermissionMode::AcceptEdits,
            permission_handler,
            cost_tracker: cost_tracker.clone(),
            session_id: session_id.to_string(),
            file_history: Arc::new(parking_lot::Mutex::new(
                claurst_core::file_history::FileHistory::new(),
            )),
            current_turn: Arc::new(AtomicUsize::new(0)),
            non_interactive: true,
            mcp_manager: None,
            config: {
                let mut cfg = claurst_core::config::Config::default();
                cfg.provider = Some("openrouter".to_string());
                cfg
            },
        };

        Ok((ctx, cost_tracker))
    }

    /// Clean up a session's sandbox directory.
    pub fn cleanup(&self, tenant_id: Uuid, session_id: Uuid) {
        let sandbox_dir = self
            .base_dir
            .join(tenant_id.to_string())
            .join(session_id.to_string());
        let _ = std::fs::remove_dir_all(&sandbox_dir);
    }
}
