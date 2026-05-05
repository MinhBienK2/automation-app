use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

use crate::{
    app_state::{AppState, RunStateDto},
    domain::{
        ActionConfig, ActionType, BatchRunRequest, BatchRunRowResult, BatchRunSummary,
        ClickWaitUntil, CompiledWorkflowGraph, ElementSnapshot, GeneratedFixture,
        GraphValidationIssue, OrchestrationSchedule, RecordedEvent, RunMode, RunStatus,
        SelectorCandidate, ValidationError, Workflow, WorkflowBrowserConfig, WorkflowExport,
        WorkflowGraph,
    },
    repositories::{RepositoryError, WorkflowDetail, WorkflowSummary},
    runner::{RunnerCancellation, RunnerStatus},
    services::run_service::{default_config, start_background_run},
};

mod graph;
mod import_export;
pub use graph::{
    compile_workflow_graph_impl, get_workflow_graph_impl, run_workflow_graph_impl,
    save_workflow_graph_impl, validate_workflow_graph_impl,
};
pub use import_export::{
    export_workflow_impl, import_workflow_impl, normalize_workflow_export_value,
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

pub async fn get_workflow_browser_config_impl(
    state: &AppState,
    workflow_id: &str,
) -> Result<WorkflowBrowserConfig, CommandError> {
    state
        .repository()
        .get_workflow(workflow_id)
        .await
        .map_err(CommandError::from)?
        .ok_or_else(|| CommandError::message("Workflow not found"))?;

    Ok(state
        .repository()
        .get_workflow_browser_config(workflow_id)
        .await
        .map_err(CommandError::from)?
        .unwrap_or_else(|| WorkflowBrowserConfig::default_for_workflow(workflow_id)))
}

pub async fn save_workflow_browser_config_impl(
    state: &AppState,
    workflow_id: &str,
    config: WorkflowBrowserConfig,
) -> Result<(), CommandError> {
    state
        .repository()
        .get_workflow(workflow_id)
        .await
        .map_err(CommandError::from)?
        .ok_or_else(|| CommandError::message("Workflow not found"))?;

    let mut config = config.normalized();
    config.workflow_id = workflow_id.to_string();
    config.validate().map_err(CommandError::validation)?;

    state
        .repository()
        .save_workflow_browser_config(config)
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
    run_workflow_graph_impl(state, workflow_id).await
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
        None,
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
            .map(|(name, value)| ActionConfig::SetVariable {
                name: Some(name),
                value: Some(value),
                value_type: None,
                variables: Vec::new(),
            })
            .collect::<Vec<_>>();
        action_configs.extend(base_steps.clone());

        let outcome = run_executor
            .run_steps(
                action_configs,
                None,
                RunnerCancellation::new(),
                Box::new(|_| {}),
            )
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

pub async fn suggest_selectors_impl(
    snapshot: ElementSnapshot,
) -> Result<Vec<SelectorCandidate>, CommandError> {
    let mut candidates = Vec::new();
    if let Some(test_id) = snapshot
        .test_id
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        candidates.push(SelectorCandidate {
            selector_type: "xpath".to_string(),
            selector: format!("//*[@data-testid='{}']", escape_xpath_literal(test_id)),
            score: 100,
            reason: "Uses stable test id attribute".to_string(),
        });
    }
    if let Some(id) = snapshot
        .id
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        candidates.push(SelectorCandidate {
            selector_type: "xpath".to_string(),
            selector: format!("//*[@id='{}']", escape_xpath_literal(id)),
            score: 90,
            reason: "Uses stable id attribute".to_string(),
        });
    }
    if let Some(name) = snapshot
        .name
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        candidates.push(SelectorCandidate {
            selector_type: "xpath".to_string(),
            selector: format!("//{}[@name='{}']", snapshot.tag, escape_xpath_literal(name)),
            score: 80,
            reason: "Uses form name attribute".to_string(),
        });
    }
    if let Some(text) = snapshot
        .text
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        candidates.push(SelectorCandidate {
            selector_type: "xpath".to_string(),
            selector: format!(
                "//{}[normalize-space(.)='{}']",
                snapshot.tag,
                escape_xpath_literal(text.trim())
            ),
            score: 60,
            reason: "Uses visible text and may change with copy".to_string(),
        });
    }
    for class_name in snapshot
        .classes
        .iter()
        .filter(|class_name| !class_name.trim().is_empty())
        .take(2)
    {
        candidates.push(SelectorCandidate {
            selector_type: "css".to_string(),
            selector: format!("{}.{}", snapshot.tag, class_name.trim()),
            score: 40,
            reason: "Uses class name; verify it is stable".to_string(),
        });
    }
    candidates.sort_by_key(|candidate| std::cmp::Reverse(candidate.score));
    Ok(candidates)
}

pub async fn normalize_recorded_events_impl(
    events: Vec<RecordedEvent>,
) -> Result<Vec<ActionConfig>, CommandError> {
    events
        .into_iter()
        .map(|event| match event {
            RecordedEvent::Click { xpath } => Ok(ActionConfig::Click {
                xpath,
                iframe_xpath: None,
                mode: None,
                button: None,
                click_count: None,
                scroll_into_view: None,
                block: None,
                inline: None,
                position: None,
                offset_x: None,
                offset_y: None,
                wait_until: Some(ClickWaitUntil::Clickable),
                timeout_ms: Some(5000),
                retry_interval_ms: None,
                post_click_wait_ms: None,
            }),
            RecordedEvent::InputText { xpath, text } => Ok(ActionConfig::InputText {
                xpath,
                iframe_xpath: None,
                text,
                clear_before_input: true,
                typing_mode: None,
                delay_ms: None,
                wait_until: Some(ClickWaitUntil::Visible),
                timeout_ms: Some(5000),
            }),
        })
        .collect()
}

pub async fn dry_run_validate_config_impl(config: ActionConfig) -> Result<(), CommandError> {
    config.validate().map_err(CommandError::validation)
}

pub async fn generate_fixture_impl(
    path: String,
    body_html: String,
) -> Result<GeneratedFixture, CommandError> {
    if path.trim().is_empty() {
        return Err(CommandError {
            message: "Fixture path is required".to_string(),
            field: Some("path".to_string()),
        });
    }
    let html = format!(
        "<!doctype html><html><head><meta charset=\"utf-8\"></head><body>{body_html}</body></html>"
    );
    std::fs::write(&path, html).map_err(|error| CommandError::message(error.to_string()))?;
    Ok(GeneratedFixture { path })
}

fn escape_xpath_literal(value: &str) -> String {
    value.replace('\'', "&apos;")
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
pub async fn get_workflow_browser_config(
    state: State<'_, AppState>,
    workflow_id: String,
) -> Result<WorkflowBrowserConfig, CommandError> {
    get_workflow_browser_config_impl(&state, &workflow_id).await
}

#[tauri::command]
pub async fn save_workflow_browser_config(
    state: State<'_, AppState>,
    workflow_id: String,
    config: WorkflowBrowserConfig,
) -> Result<(), CommandError> {
    save_workflow_browser_config_impl(&state, &workflow_id, config).await
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
pub async fn get_workflow_graph(
    state: State<'_, AppState>,
    workflow_id: String,
) -> Result<WorkflowGraph, CommandError> {
    get_workflow_graph_impl(&state, &workflow_id).await
}

#[tauri::command]
pub async fn save_workflow_graph(
    state: State<'_, AppState>,
    workflow_id: String,
    graph: WorkflowGraph,
) -> Result<(), CommandError> {
    save_workflow_graph_impl(&state, &workflow_id, graph).await
}

#[tauri::command]
pub async fn validate_workflow_graph(
    graph: WorkflowGraph,
) -> Result<Vec<GraphValidationIssue>, CommandError> {
    validate_workflow_graph_impl(graph).await
}

#[tauri::command]
pub async fn compile_workflow_graph(
    graph: WorkflowGraph,
) -> Result<CompiledWorkflowGraph, CommandError> {
    compile_workflow_graph_impl(graph).await
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
    exported: Value,
) -> Result<WorkflowDetail, CommandError> {
    let exported = normalize_workflow_export_value(exported)?;
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

#[tauri::command]
pub async fn suggest_selectors(
    snapshot: ElementSnapshot,
) -> Result<Vec<SelectorCandidate>, CommandError> {
    suggest_selectors_impl(snapshot).await
}

#[tauri::command]
pub async fn normalize_recorded_events(
    events: Vec<RecordedEvent>,
) -> Result<Vec<ActionConfig>, CommandError> {
    normalize_recorded_events_impl(events).await
}

#[tauri::command]
pub async fn dry_run_validate_config(config: ActionConfig) -> Result<(), CommandError> {
    dry_run_validate_config_impl(config).await
}

#[tauri::command]
pub async fn generate_fixture(
    path: String,
    body_html: String,
) -> Result<GeneratedFixture, CommandError> {
    generate_fixture_impl(path, body_html).await
}
