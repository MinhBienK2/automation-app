use std::path::PathBuf;

use uuid::Uuid;
use workflow_automation_manager_lib::{
    app_state::AppState,
    commands,
    domain::{ActionConfig, ActionType, RunStatus, ScrollDirection},
};

async fn test_state() -> (AppState, PathBuf) {
    let db_path = std::env::temp_dir().join(format!("wam-command-test-{}.sqlite", Uuid::new_v4()));
    let state = AppState::initialize(&db_path).await.expect("init state");

    (state, db_path)
}

#[tokio::test]
async fn command_api_rejects_invalid_workflow_name() {
    let (state, _db_path) = test_state().await;

    let error = commands::create_workflow_impl(&state, "  ")
        .await
        .expect_err("blank name should fail");

    assert_eq!(error.field.as_deref(), Some("name"));
    assert_eq!(error.message, "Workflow name is required");
}

#[tokio::test]
async fn workflow_and_step_commands_return_json_safe_dtos() {
    let (state, _db_path) = test_state().await;

    let workflow = commands::create_workflow_impl(&state, "Login flow")
        .await
        .expect("create");
    let step = commands::add_step_impl(&state, &workflow.id, ActionType::Sleep)
        .await
        .expect("add");

    commands::update_step_impl(
        &state,
        &step.id,
        ActionConfig::Scroll {
            direction: ScrollDirection::Down,
            pixels: 500,
        },
    )
    .await
    .expect("update");

    let detail = commands::get_workflow_impl(&state, &workflow.id)
        .await
        .expect("get")
        .expect("workflow exists");

    assert_eq!(detail.workflow.name, "Login flow");
    assert_eq!(detail.steps.len(), 1);
    assert_eq!(
        detail.steps[0].config,
        ActionConfig::Scroll {
            direction: ScrollDirection::Down,
            pixels: 500,
        }
    );

    let json = serde_json::to_string(&detail).expect("serialize detail");
    assert!(json.contains("\"workflow\""));
    assert!(json.contains("\"steps\""));
}

#[tokio::test]
async fn reorder_and_delete_commands_work() {
    let (state, _db_path) = test_state().await;

    let workflow = commands::create_workflow_impl(&state, "Ordering")
        .await
        .expect("create");
    let first = commands::add_step_impl(&state, &workflow.id, ActionType::OpenUrl)
        .await
        .expect("first");
    let second = commands::add_step_impl(&state, &workflow.id, ActionType::Click)
        .await
        .expect("second");

    commands::reorder_steps_impl(
        &state,
        &workflow.id,
        vec![second.id.clone(), first.id.clone()],
    )
    .await
    .expect("reorder");

    let detail = commands::get_workflow_impl(&state, &workflow.id)
        .await
        .expect("get")
        .expect("workflow exists");
    assert_eq!(detail.steps[0].id, second.id);

    commands::delete_step_impl(&state, &second.id)
        .await
        .expect("delete step");

    let detail = commands::get_workflow_impl(&state, &workflow.id)
        .await
        .expect("get")
        .expect("workflow exists");
    assert_eq!(detail.steps.len(), 1);

    commands::delete_workflow_impl(&state, &workflow.id)
        .await
        .expect("delete workflow");
    let workflows = commands::list_workflows_impl(&state).await.expect("list");
    assert!(workflows.is_empty());
}

#[tokio::test]
async fn run_commands_are_safe_placeholders_until_runner_exists() {
    let (state, _db_path) = test_state().await;

    let run_error = commands::run_workflow_impl(&state, "workflow-id")
        .await
        .expect_err("runner should be unavailable");
    assert_eq!(run_error.message, "Runner is not implemented yet");

    let test_error = commands::test_step_impl(&state, "workflow-id", "step-id")
        .await
        .expect_err("runner should be unavailable");
    assert_eq!(test_error.message, "Runner is not implemented yet");

    let stop_error = commands::stop_run_impl(&state)
        .await
        .expect_err("no run should be active");
    assert_eq!(stop_error.message, "No active run to stop");

    let run_state = commands::get_run_state_impl(&state).await;
    assert_eq!(run_state.status, RunStatus::Idle);
}
