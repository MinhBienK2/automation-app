use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::{ActionConfig, ActionType, ValidationError};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Workflow {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

impl Workflow {
    pub fn new(name: impl Into<String>) -> Self {
        let now = String::new();

        Self {
            id: Uuid::new_v4().to_string(),
            name: name.into(),
            created_at: now.clone(),
            updated_at: now,
        }
    }

    pub fn validate(&self) -> Result<(), ValidationError> {
        if self.name.trim().is_empty() {
            return Err(ValidationError::new("name", "Workflow name is required"));
        }

        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WorkflowStep {
    pub id: String,
    pub workflow_id: String,
    pub order_index: i64,
    pub action_type: ActionType,
    pub config: ActionConfig,
    pub created_at: String,
    pub updated_at: String,
}

impl WorkflowStep {
    pub fn new(workflow_id: impl Into<String>, order_index: i64, config: ActionConfig) -> Self {
        let now = String::new();
        let action_type = config.action_type();

        Self {
            id: Uuid::new_v4().to_string(),
            workflow_id: workflow_id.into(),
            order_index,
            action_type,
            config,
            created_at: now.clone(),
            updated_at: now,
        }
    }

    pub fn action_type(&self) -> ActionType {
        self.action_type
    }

    pub fn validate(&self) -> Result<(), ValidationError> {
        self.config.validate()
    }
}
