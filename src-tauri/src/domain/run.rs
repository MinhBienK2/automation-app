use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RunStatus {
    Idle,
    Running,
    Success,
    Failed,
    Stopped,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RunError {
    pub step_number: usize,
    pub action_type: String,
    pub reason: String,
}

impl RunError {
    pub fn new(
        step_number: usize,
        action_type: impl Into<String>,
        reason: impl Into<String>,
    ) -> Self {
        Self {
            step_number,
            action_type: action_type.into(),
            reason: reason.into(),
        }
    }
}
