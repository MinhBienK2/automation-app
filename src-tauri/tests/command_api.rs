mod support;

use std::time::Duration;

use support::{poll_status, test_state, test_state_with_runner, FakeRunExecutor};
use workflow_automation_manager_lib::{
    commands,
    domain::{ActionConfig, ActionType, RunStatus, ScrollDirection},
};

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
        "",
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
    assert!(json.contains("\"name\":\"Scroll\""));
}

#[tokio::test]
async fn update_step_can_save_custom_step_name() {
    let (state, _db_path) = test_state().await;

    let workflow = commands::create_workflow_impl(&state, "Named steps")
        .await
        .expect("create");
    let step = commands::add_step_impl(&state, &workflow.id, ActionType::Click)
        .await
        .expect("add");

    commands::update_step_impl(
        &state,
        &step.id,
        "Click login button",
        ActionConfig::Click {
            xpath: "//*[@id=\"login\"]".to_string(),
        },
    )
    .await
    .expect("update");

    let detail = commands::get_workflow_impl(&state, &workflow.id)
        .await
        .expect("get")
        .expect("workflow exists");
    let json = serde_json::to_string(&detail.steps[0]).expect("serialize step");

    assert!(json.contains("\"name\":\"Click login button\""));
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
async fn run_workflow_starts_background_run_and_finishes_successfully() {
    let (state, _db_path) = test_state_with_runner(FakeRunExecutor::success()).await;

    let workflow = commands::create_workflow_impl(&state, "Run success")
        .await
        .expect("create");
    let open = commands::add_step_impl(&state, &workflow.id, ActionType::OpenUrl)
        .await
        .expect("open");
    commands::update_step_impl(
        &state,
        &open.id,
        "Open URL",
        ActionConfig::OpenUrl {
            url: "https://example.com".to_string(),
        },
    )
    .await
    .expect("update open");
    let type_text = commands::add_step_impl(&state, &workflow.id, ActionType::TypeText)
        .await
        .expect("type");
    commands::update_step_impl(
        &state,
        &type_text.id,
        "Type Text",
        ActionConfig::TypeText {
            xpath: "//*[@name=\"email\"]".to_string(),
            text: "user@example.com".to_string(),
        },
    )
    .await
    .expect("update type");
    let click = commands::add_step_impl(&state, &workflow.id, ActionType::Click)
        .await
        .expect("click");
    commands::update_step_impl(
        &state,
        &click.id,
        "Click",
        ActionConfig::Click {
            xpath: "//*[@id=\"submit\"]".to_string(),
        },
    )
    .await
    .expect("update click");

    let run_state = commands::run_workflow_impl(&state, &workflow.id)
        .await
        .expect("start run");
    assert_eq!(run_state.status, RunStatus::Running);

    poll_status(&state, RunStatus::Success).await;
}

#[tokio::test]
async fn run_workflow_finishes_successfully_with_injected_runner() {
    let (state, _db_path) = test_state_with_runner(FakeRunExecutor::success()).await;

    let workflow = commands::create_workflow_impl(&state, "Run success")
        .await
        .expect("create");
    let sleep = commands::add_step_impl(&state, &workflow.id, ActionType::Sleep)
        .await
        .expect("sleep");
    commands::update_step_impl(
        &state,
        &sleep.id,
        "Sleep",
        ActionConfig::Sleep { seconds: 1.0 },
    )
    .await
    .expect("update sleep");

    let run_state = commands::run_workflow_impl(&state, &workflow.id)
        .await
        .expect("start run");
    assert_eq!(run_state.status, RunStatus::Running);

    poll_status(&state, RunStatus::Success).await;
    let finished = commands::get_run_state_impl(&state).await;
    assert_eq!(finished.completed_step_ids, vec![sleep.id]);
}

#[tokio::test]
async fn test_step_runs_only_through_selected_step_and_reports_first_failure() {
    let (state, _db_path) = test_state_with_runner(FakeRunExecutor::success()).await;

    let workflow = commands::create_workflow_impl(&state, "Test step")
        .await
        .expect("create");
    let open = commands::add_step_impl(&state, &workflow.id, ActionType::OpenUrl)
        .await
        .expect("open");
    commands::update_step_impl(
        &state,
        &open.id,
        "Open URL",
        ActionConfig::OpenUrl {
            url: "https://example.com".to_string(),
        },
    )
    .await
    .expect("update open");
    let sleep = commands::add_step_impl(&state, &workflow.id, ActionType::Sleep)
        .await
        .expect("sleep");
    commands::update_step_impl(
        &state,
        &sleep.id,
        "Sleep",
        ActionConfig::Sleep { seconds: 0.2 },
    )
    .await
    .expect("update sleep");
    let bad_click = commands::add_step_impl(&state, &workflow.id, ActionType::Click)
        .await
        .expect("bad click");
    commands::update_step_impl(
        &state,
        &bad_click.id,
        "Click",
        ActionConfig::Click {
            xpath: "//*[@id=\"missing\"]".to_string(),
        },
    )
    .await
    .expect("update bad click");

    assert_eq!(
        commands::test_step_impl(&state, &workflow.id, &sleep.id)
            .await
            .expect("start test")
            .status,
        RunStatus::Running
    );
    poll_status(&state, RunStatus::Success).await;

    let run_state = commands::get_run_state_impl(&state).await;
    let run_state_json = serde_json::to_string(&run_state).expect("serialize run state");
    assert!(run_state_json.contains("\"mode\":\"test_step\""));
    assert!(run_state_json.contains("\"completed_step_ids\""));
    assert!(run_state.error.is_none());
}

#[tokio::test]
async fn run_workflow_maps_fake_runner_failure_to_step_error() {
    let (state, _db_path) =
        test_state_with_runner(FakeRunExecutor::failed(2, "XPath not found")).await;

    let workflow = commands::create_workflow_impl(&state, "Run failure")
        .await
        .expect("create");
    let first = commands::add_step_impl(&state, &workflow.id, ActionType::Sleep)
        .await
        .expect("first");
    let second = commands::add_step_impl(&state, &workflow.id, ActionType::Click)
        .await
        .expect("second");
    commands::update_step_impl(
        &state,
        &second.id,
        "Click login",
        ActionConfig::Click {
            xpath: "//*[@id=\"missing\"]".to_string(),
        },
    )
    .await
    .expect("update second");

    commands::run_workflow_impl(&state, &workflow.id)
        .await
        .expect("start run");
    poll_status(&state, RunStatus::Failed).await;

    let run_state = commands::get_run_state_impl(&state).await;
    let error = run_state.error.expect("failure payload");
    assert_eq!(error.step_id.as_deref(), Some(second.id.as_str()));
    assert_eq!(error.step_number, 2);
    assert_eq!(error.reason, "XPath not found");
    assert!(run_state.completed_step_ids.contains(&first.id));
}

#[tokio::test]
async fn test_step_exposes_target_current_and_completed_progress() {
    let (state, _db_path) = test_state_with_runner(FakeRunExecutor::stopped_on_cancel()).await;

    let workflow = commands::create_workflow_impl(&state, "Progress")
        .await
        .expect("create");
    let sleep = commands::add_step_impl(&state, &workflow.id, ActionType::Sleep)
        .await
        .expect("sleep");
    commands::update_step_impl(
        &state,
        &sleep.id,
        "Wait long enough",
        ActionConfig::Sleep { seconds: 10.0 },
    )
    .await
    .expect("update sleep");

    let started = commands::test_step_impl(&state, &workflow.id, &sleep.id)
        .await
        .expect("start test");
    let started_json = serde_json::to_string(&started).expect("serialize started");

    assert_eq!(started.status, RunStatus::Running);
    assert!(started_json.contains("\"mode\":\"test_step\""));
    assert!(started_json.contains(&format!("\"target_step_id\":\"{}\"", sleep.id)));

    let mut running_json = String::new();
    for _ in 0..50 {
        running_json =
            serde_json::to_string(&commands::get_run_state_impl(&state).await).expect("serialize");
        if running_json.contains(&format!("\"current_step_id\":\"{}\"", sleep.id)) {
            break;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    assert!(running_json.contains(&format!("\"current_step_id\":\"{}\"", sleep.id)));
    assert!(running_json.contains("\"current_step_number\":1"));

    commands::stop_run_impl(&state).await.expect("stop");
}

#[tokio::test]
async fn stop_run_cancels_active_sleep_and_second_run_is_rejected() {
    let (state, _db_path) = test_state_with_runner(FakeRunExecutor::stopped_on_cancel()).await;

    let workflow = commands::create_workflow_impl(&state, "Stop run")
        .await
        .expect("create");
    let open = commands::add_step_impl(&state, &workflow.id, ActionType::OpenUrl)
        .await
        .expect("open");
    commands::update_step_impl(
        &state,
        &open.id,
        "Open URL",
        ActionConfig::OpenUrl {
            url: "https://example.com".to_string(),
        },
    )
    .await
    .expect("update open");
    let sleep = commands::add_step_impl(&state, &workflow.id, ActionType::Sleep)
        .await
        .expect("sleep");
    commands::update_step_impl(
        &state,
        &sleep.id,
        "Sleep",
        ActionConfig::Sleep { seconds: 10.0 },
    )
    .await
    .expect("update sleep");

    assert_eq!(
        commands::run_workflow_impl(&state, &workflow.id)
            .await
            .expect("start run")
            .status,
        RunStatus::Running
    );

    let second_run = commands::run_workflow_impl(&state, &workflow.id)
        .await
        .expect_err("second run rejected");
    assert_eq!(second_run.message, "A workflow is already running");

    let stopped = commands::stop_run_impl(&state).await.expect("stop run");
    assert_eq!(stopped.status, RunStatus::Stopped);

    let run_state = commands::get_run_state_impl(&state).await;
    assert_eq!(run_state.status, RunStatus::Stopped);
}
