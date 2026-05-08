use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use super::{
    BehaviorProfile, RunStatus, ValidationError, Workflow, WorkflowGraph, WorkflowSettings,
    WorkflowSettingsAdvanced, WorkflowSettingsBrowser, WorkflowSettingsEnvironment,
    WorkflowSettingsExecution, WorkflowSettingsGeneral, WorkflowSettingsInputs,
    WorkflowSettingsSection, WorkflowSettingsTriggers, WorkflowStep,
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ScheduleKind {
    OnceAt { timestamp: String },
    Interval { every_seconds: u64 },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OrchestrationSchedule {
    pub workflow_id: String,
    pub enabled: bool,
    pub kind: ScheduleKind,
}

impl OrchestrationSchedule {
    pub fn validate(&self) -> Result<(), ValidationError> {
        if self.workflow_id.trim().is_empty() {
            return Err(ValidationError::new(
                "workflow_id",
                "Workflow id is required",
            ));
        }

        match &self.kind {
            ScheduleKind::OnceAt { timestamp } if timestamp.trim().is_empty() => Err(
                ValidationError::new("timestamp", "Schedule timestamp is required"),
            ),
            ScheduleKind::Interval { every_seconds } if *every_seconds == 0 => Err(
                ValidationError::new("every_seconds", "Interval must be greater than 0"),
            ),
            _ => Ok(()),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BatchRunRequest {
    pub rows: Vec<BTreeMap<String, String>>,
    pub concurrency_limit: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub headless: Option<bool>,
}

impl BatchRunRequest {
    pub fn validate(&self) -> Result<(), ValidationError> {
        if self.rows.is_empty() {
            return Err(ValidationError::new(
                "rows",
                "Batch input must include at least one row",
            ));
        }

        if matches!(self.concurrency_limit, Some(0)) {
            return Err(ValidationError::new(
                "concurrency_limit",
                "Concurrency limit must be greater than 0",
            ));
        }

        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BatchRunRowResult {
    pub row_index: usize,
    pub status: RunStatus,
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BatchRunSummary {
    pub total: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub results: Vec<BatchRunRowResult>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WorkflowExport {
    pub version: u32,
    pub workflow: Workflow,
    pub steps: Vec<WorkflowStep>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub settings: Option<WorkflowSettings>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkflowPackageWorkflow {
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkflowPackageExportOptions {
    #[serde(default)]
    pub include_flow: bool,
    #[serde(default)]
    pub settings_sections: Vec<WorkflowSettingsSection>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkflowPackageImportOptions {
    #[serde(default)]
    pub include_flow: bool,
    #[serde(default)]
    pub settings_sections: Vec<WorkflowSettingsSection>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WorkflowPackageSettings {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub general: Option<WorkflowSettingsGeneral>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub execution: Option<WorkflowSettingsExecution>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub browser: Option<WorkflowSettingsBrowser>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub behavior: Option<BehaviorProfile>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub environment: Option<WorkflowSettingsEnvironment>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub inputs: Option<WorkflowSettingsInputs>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub triggers: Option<WorkflowSettingsTriggers>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub advanced: Option<WorkflowSettingsAdvanced>,
}

impl WorkflowPackageSettings {
    pub fn is_empty(&self) -> bool {
        self.general.is_none()
            && self.execution.is_none()
            && self.browser.is_none()
            && self.behavior.is_none()
            && self.environment.is_none()
            && self.inputs.is_none()
            && self.triggers.is_none()
            && self.advanced.is_none()
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WorkflowPackage {
    pub kind: String,
    pub version: u32,
    pub workflow: WorkflowPackageWorkflow,
    #[serde(default)]
    pub included_sections: Vec<String>,
    #[serde(default)]
    pub omitted_fields: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub flow: Option<WorkflowGraph>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub settings: Option<WorkflowPackageSettings>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkflowPackagePreview {
    pub workflow_name: String,
    pub includes_flow: bool,
    pub settings_sections: Vec<WorkflowSettingsSection>,
    pub omitted_fields: Vec<String>,
}
