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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RunMode {
    None,
    RunWorkflow,
    TestStep,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RunError {
    pub step_id: Option<String>,
    pub step_number: usize,
    pub step_name: Option<String>,
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
            step_id: None,
            step_number,
            step_name: None,
            action_type: action_type.into(),
            reason: reason.into(),
        }
    }

    pub fn for_step(
        step_id: impl Into<String>,
        step_number: usize,
        step_name: impl Into<String>,
        action_type: impl Into<String>,
        reason: impl Into<String>,
    ) -> Self {
        Self {
            step_id: Some(step_id.into()),
            step_number,
            step_name: Some(step_name.into()),
            action_type: action_type.into(),
            reason: reason.into(),
        }
    }
}
