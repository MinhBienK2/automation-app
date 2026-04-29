use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{
    app_state::{AppState, RunStateDto},
    domain::{
        ActionConfig, ActionType, BatchRunRequest, BatchRunRowResult, BatchRunSummary,
        OrchestrationSchedule, RunMode, RunStatus, ValidationError, Workflow, WorkflowExport,
    },
    repositories::{RepositoryError, WorkflowDetail, WorkflowSummary},
    runner::{RunnerCancellation, RunnerStatus},
    services::run_service::{default_config, start_background_run},
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CommandError {
    pub message: String,
    pub field: Option<String>,
}

impl CommandError {
    pub fn message(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            field: None,
        }
    }

    fn validation(error: ValidationError) -> Self {
        Self {
            message: error.message,
            field: Some(error.field),
        }
    }
}

impl From<RepositoryError> for CommandError {
    fn from(error: RepositoryError) -> Self {
        Self::message(error.to_string())
    }
}

pub async fn list_workflows_impl(state: &AppState) -> Result<Vec<WorkflowSummary>, CommandError> {
    state
        .repository()
        .list_workflows()
        .await
        .map_err(CommandError::from)
}

pub async fn create_workflow_impl(state: &AppState, name: &str) -> Result<Workflow, CommandError> {
    let candidate = Workflow::new(name);
    candidate.validate().map_err(CommandError::validation)?;

    state
        .repository()
        .create_workflow(name.trim())
        .await
        .map_err(CommandError::from)
}

pub async fn get_workflow_impl(
    state: &AppState,
    id: &str,
) -> Result<Option<WorkflowDetail>, CommandError> {
    state
        .repository()
        .get_workflow(id)
        .await
        .map_err(CommandError::from)
}

pub async fn rename_workflow_impl(
    state: &AppState,
    id: &str,
    name: &str,
) -> Result<(), CommandError> {
    let candidate = Workflow::new(name);
    candidate.validate().map_err(CommandError::validation)?;

    state
        .repository()
        .rename_workflow(id, name.trim())
        .await
        .map_err(CommandError::from)
}

pub async fn delete_workflow_impl(state: &AppState, id: &str) -> Result<(), CommandError> {
    state
        .repository()
        .delete_workflow(id)
        .await
        .map_err(CommandError::from)
}

pub async fn add_step_impl(
    state: &AppState,
    workflow_id: &str,
    action_type: ActionType,
) -> Result<crate::domain::WorkflowStep, CommandError> {
    state
        .repository()
        .add_step(workflow_id, default_config(action_type))
        .await
        .map_err(CommandError::from)
}

pub async fn update_step_impl(
    state: &AppState,
    step_id: &str,
    name: &str,
    config: ActionConfig,
) -> Result<(), CommandError> {
    config.validate().map_err(CommandError::validation)?;

    state
        .repository()
        .update_step(step_id, name, config)
        .await
        .map_err(CommandError::from)
}

pub async fn delete_step_impl(state: &AppState, step_id: &str) -> Result<(), CommandError> {
    state
        .repository()
        .delete_step(step_id)
        .await
        .map_err(CommandError::from)
}

pub async fn reorder_steps_impl(
    state: &AppState,
    workflow_id: &str,
    ordered_step_ids: Vec<String>,
) -> Result<(), CommandError> {
    state
        .repository()
        .reorder_steps(workflow_id, &ordered_step_ids)
        .await
        .map_err(CommandError::from)
}

pub async fn get_run_state_impl(state: &AppState) -> RunStateDto {
    state.run_state().await
}

pub async fn run_workflow_impl(
    state: &AppState,
    workflow_id: &str,
) -> Result<RunStateDto, CommandError> {
    let detail = state
        .repository()
        .get_workflow(workflow_id)
        .await
        .map_err(CommandError::from)?
        .ok_or_else(|| CommandError::message("Workflow not found"))?;

    start_background_run(state, detail.steps, RunMode::RunWorkflow, None).await
}

pub async fn test_step_impl(
    state: &AppState,
    workflow_id: &str,
    step_id: &str,
) -> Result<RunStateDto, CommandError> {
    let detail = state
        .repository()
        .get_workflow(workflow_id)
        .await
        .map_err(CommandError::from)?
        .ok_or_else(|| CommandError::message("Workflow not found"))?;
    let selected_index = detail
        .steps
        .iter()
        .position(|step| step.id == step_id)
        .ok_or_else(|| CommandError::message("Step not found"))?;

    start_background_run(
        state,
        detail.steps[..=selected_index].to_vec(),
        RunMode::TestStep,
        Some(step_id.to_string()),
    )
    .await
}

pub async fn stop_run_impl(state: &AppState) -> Result<RunStateDto, CommandError> {
    state
        .stop_active_run()
        .await
        .ok_or_else(|| CommandError::message("No active run to stop"))
}

pub async fn validate_schedule_impl(
    schedule: OrchestrationSchedule,
) -> Result<OrchestrationSchedule, CommandError> {
    schedule.validate().map_err(CommandError::validation)?;
    Ok(schedule)
}

pub async fn export_workflow_impl(
    state: &AppState,
    workflow_id: &str,
) -> Result<WorkflowExport, CommandError> {
    let detail = state
        .repository()
        .get_workflow(workflow_id)
        .await
        .map_err(CommandError::from)?
        .ok_or_else(|| CommandError::message("Workflow not found"))?;

    Ok(WorkflowExport {
        version: 1,
        workflow: detail.workflow,
        steps: detail.steps,
    })
}

pub async fn import_workflow_impl(
    state: &AppState,
    exported: WorkflowExport,
) -> Result<WorkflowDetail, CommandError> {
    if exported.version != 1 {
        return Err(CommandError::message("Unsupported workflow export version"));
    }

    let imported_name = format!("{} (imported)", exported.workflow.name.trim());
    let workflow = create_workflow_impl(state, &imported_name).await?;

    for step in exported.steps {
        step.config.validate().map_err(CommandError::validation)?;
        let created = state
            .repository()
            .add_step(&workflow.id, step.config.clone())
            .await
            .map_err(CommandError::from)?;
        state
            .repository()
            .update_step(&created.id, &step.name, step.config)
            .await
            .map_err(CommandError::from)?;
    }

    state
        .repository()
        .get_workflow(&workflow.id)
        .await
        .map_err(CommandError::from)?
        .ok_or_else(|| CommandError::message("Workflow not found after import"))
}

pub async fn run_batch_workflow_impl(
    state: &AppState,
    workflow_id: &str,
    request: BatchRunRequest,
) -> Result<BatchRunSummary, CommandError> {
    request.validate().map_err(CommandError::validation)?;

    let detail = state
        .repository()
        .get_workflow(workflow_id)
        .await
        .map_err(CommandError::from)?
        .ok_or_else(|| CommandError::message("Workflow not found"))?;
    let run_executor = state.run_executor();
    let base_steps = detail
        .steps
        .iter()
        .map(|step| step.config.clone())
        .collect::<Vec<_>>();
    let mut results = Vec::with_capacity(request.rows.len());

    for (row_index, row) in request.rows.into_iter().enumerate() {
        let mut action_configs = row
            .into_iter()
            .map(|(name, value)| ActionConfig::SetVariable { name, value })
            .collect::<Vec<_>>();
        action_configs.extend(base_steps.clone());

        let outcome = run_executor
            .run_steps(action_configs, RunnerCancellation::new(), Box::new(|_| {}))
            .await
            .map_err(|error| CommandError::message(error.to_string()))?;
        let (status, error) = match outcome.status {
            RunnerStatus::Success => (RunStatus::Success, None),
            RunnerStatus::Stopped => (RunStatus::Stopped, None),
            RunnerStatus::Failed => (
                RunStatus::Failed,
                outcome.failed_step.map(|failed_step| failed_step.reason),
            ),
        };

        results.push(BatchRunRowResult {
            row_index,
            status,
            error,
        });
    }

    let succeeded = results
        .iter()
        .filter(|result| result.status == RunStatus::Success)
        .count();
    let failed = results
        .iter()
        .filter(|result| result.status == RunStatus::Failed)
        .count();

    Ok(BatchRunSummary {
        total: results.len(),
        succeeded,
        failed,
        results,
    })
}

#[tauri::command]
pub async fn list_workflows(
    state: State<'_, AppState>,
) -> Result<Vec<WorkflowSummary>, CommandError> {
    list_workflows_impl(&state).await
}

#[tauri::command]
pub async fn create_workflow(
    state: State<'_, AppState>,
    name: String,
) -> Result<Workflow, CommandError> {
    create_workflow_impl(&state, &name).await
}

#[tauri::command]
pub async fn get_workflow(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<WorkflowDetail>, CommandError> {
    get_workflow_impl(&state, &id).await
}

#[tauri::command]
pub async fn rename_workflow(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> Result<(), CommandError> {
    rename_workflow_impl(&state, &id, &name).await
}

#[tauri::command]
pub async fn delete_workflow(state: State<'_, AppState>, id: String) -> Result<(), CommandError> {
    delete_workflow_impl(&state, &id).await
}

#[tauri::command]
pub async fn add_step(
    state: State<'_, AppState>,
    workflow_id: String,
    action_type: ActionType,
) -> Result<crate::domain::WorkflowStep, CommandError> {
    add_step_impl(&state, &workflow_id, action_type).await
}

#[tauri::command]
pub async fn update_step(
    state: State<'_, AppState>,
    step_id: String,
    name: String,
    config: ActionConfig,
) -> Result<(), CommandError> {
    update_step_impl(&state, &step_id, &name, config).await
}

#[tauri::command]
pub async fn delete_step(state: State<'_, AppState>, step_id: String) -> Result<(), CommandError> {
    delete_step_impl(&state, &step_id).await
}

#[tauri::command]
pub async fn reorder_steps(
    state: State<'_, AppState>,
    workflow_id: String,
    ordered_step_ids: Vec<String>,
) -> Result<(), CommandError> {
    reorder_steps_impl(&state, &workflow_id, ordered_step_ids).await
}

#[tauri::command]
pub async fn get_run_state(state: State<'_, AppState>) -> Result<RunStateDto, CommandError> {
    Ok(get_run_state_impl(&state).await)
}

#[tauri::command]
pub async fn run_workflow(
    state: State<'_, AppState>,
    workflow_id: String,
) -> Result<RunStateDto, CommandError> {
    run_workflow_impl(&state, &workflow_id).await
}

#[tauri::command]
pub async fn test_step(
    state: State<'_, AppState>,
    workflow_id: String,
    step_id: String,
) -> Result<RunStateDto, CommandError> {
    test_step_impl(&state, &workflow_id, &step_id).await
}

#[tauri::command]
pub async fn stop_run(state: State<'_, AppState>) -> Result<RunStateDto, CommandError> {
    stop_run_impl(&state).await
}

#[tauri::command]
pub async fn validate_schedule(
    schedule: OrchestrationSchedule,
) -> Result<OrchestrationSchedule, CommandError> {
    validate_schedule_impl(schedule).await
}

#[tauri::command]
pub async fn export_workflow(
    state: State<'_, AppState>,
    workflow_id: String,
) -> Result<WorkflowExport, CommandError> {
    export_workflow_impl(&state, &workflow_id).await
}

#[tauri::command]
pub async fn import_workflow(
    state: State<'_, AppState>,
    exported: WorkflowExport,
) -> Result<WorkflowDetail, CommandError> {
    import_workflow_impl(&state, exported).await
}

#[tauri::command]
pub async fn run_batch_workflow(
    state: State<'_, AppState>,
    workflow_id: String,
    request: BatchRunRequest,
) -> Result<BatchRunSummary, CommandError> {
    run_batch_workflow_impl(&state, &workflow_id, request).await
}
