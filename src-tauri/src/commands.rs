use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{
    app_state::{AppState, RunStateDto},
    domain::{ActionConfig, ActionType, ScrollDirection, ValidationError, Workflow},
    repositories::{RepositoryError, WorkflowDetail, WorkflowSummary},
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CommandError {
    pub message: String,
    pub field: Option<String>,
}

impl CommandError {
    fn message(message: impl Into<String>) -> Self {
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
    config: ActionConfig,
) -> Result<(), CommandError> {
    config.validate().map_err(CommandError::validation)?;

    state
        .repository()
        .update_step(step_id, config)
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
    _state: &AppState,
    _workflow_id: &str,
) -> Result<RunStateDto, CommandError> {
    Err(CommandError::message("Runner is not implemented yet"))
}

pub async fn test_step_impl(
    _state: &AppState,
    _workflow_id: &str,
    _step_id: &str,
) -> Result<RunStateDto, CommandError> {
    Err(CommandError::message("Runner is not implemented yet"))
}

pub async fn stop_run_impl(_state: &AppState) -> Result<RunStateDto, CommandError> {
    Err(CommandError::message("No active run to stop"))
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
    config: ActionConfig,
) -> Result<(), CommandError> {
    update_step_impl(&state, &step_id, config).await
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

fn default_config(action_type: ActionType) -> ActionConfig {
    match action_type {
        ActionType::OpenUrl => ActionConfig::OpenUrl { url: String::new() },
        ActionType::Sleep => ActionConfig::Sleep { seconds: 1.0 },
        ActionType::TypeText => ActionConfig::TypeText {
            xpath: String::new(),
            text: String::new(),
        },
        ActionType::Click => ActionConfig::Click {
            xpath: String::new(),
        },
        ActionType::Scroll => ActionConfig::Scroll {
            direction: ScrollDirection::Down,
            pixels: 500,
        },
    }
}
