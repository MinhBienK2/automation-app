mod support;

use std::{collections::BTreeMap, sync::Arc, time::Duration};

use support::{
    poll_status, test_state, test_state_with_runner, FakeRunExecutor, FakeRunOutcome,
    RecordingRunExecutor,
};
use workflow_automation_manager_lib::{
    commands,
    domain::{
        ActionConfig, ActionType, BatchRunRequest, ElementSnapshot, GraphEdge, GraphNode,
        GraphNodeType, GraphPort, GraphPortDirection, GraphPosition, GraphValidationLevel,
        GraphViewport, HeaderPair, OrchestrationSchedule, RecordedEvent, RunStatus, ScheduleKind,
        ScrollDirection, VariableAssignment, VariableValueType, WaitCondition,
        WorkflowBrowserChallengePolicy, WorkflowBrowserConfig, WorkflowBrowserRetention,
        WorkflowGraph, WorkflowInputValueType, WorkflowPackageExportOptions,
        WorkflowPackageImportOptions, WorkflowSettings, WorkflowSettingsCookie,
        WorkflowSettingsGeolocation, WorkflowSettingsInputRow, WorkflowSettingsSection,
        WorkflowSettingsStorageEntry, WorkflowTriggerMode,
    },
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
    let step = commands::add_step_impl(&state, &workflow.id, ActionType::Wait)
        .await
        .expect("add");

    commands::update_step_impl(
        &state,
        &step.id,
        "",
        ActionConfig::Scroll {
            target: None,
            mode: None,
            direction: ScrollDirection::Down,
            pixels: 500,
            xpath: None,
            iframe_xpath: None,
            behavior: None,
            block: None,
            inline: None,
            max_attempts: None,
            wait_ms: None,
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
            target: None,
            mode: None,
            direction: ScrollDirection::Down,
            pixels: 500,
            xpath: None,
            iframe_xpath: None,
            behavior: None,
            block: None,
            inline: None,
            max_attempts: None,
            wait_ms: None,
        }
    );

    let json = serde_json::to_string(&detail).expect("serialize detail");
    assert!(json.contains("\"workflow\""));
    assert!(json.contains("\"steps\""));
    assert!(json.contains("\"name\":\"Scroll\""));
}

#[tokio::test]
async fn graph_commands_generate_save_validate_and_run_workflow_graphs() {
    let (state, _db_path) = test_state_with_runner(FakeRunExecutor::success()).await;
    let workflow = commands::create_workflow_impl(&state, "Graph flow")
        .await
        .expect("create");

    let default_graph = commands::get_workflow_graph_impl(&state, &workflow.id)
        .await
        .expect("get default graph");
    assert_eq!(default_graph.version, 1);
    assert_eq!(default_graph.nodes.len(), 2);
    assert_eq!(default_graph.nodes[0].node_type, GraphNodeType::Start);
    assert_eq!(default_graph.nodes[1].node_type, GraphNodeType::Action);
    assert_eq!(default_graph.nodes[1].label, "New node");
    assert!(default_graph.nodes[1].config.is_null());
    assert_eq!(default_graph.edges.len(), 1);
    assert_eq!(default_graph.edges[0].source_node_id, "start");
    assert_eq!(default_graph.edges[0].target_node_id, "new-node");

    let graph = sample_graph();
    commands::save_workflow_graph_impl(&state, &workflow.id, graph.clone())
        .await
        .expect("save graph");
    let saved = commands::get_workflow_graph_impl(&state, &workflow.id)
        .await
        .expect("get saved graph");
    assert_eq!(saved, graph);

    let issues = commands::validate_workflow_graph_impl(graph.clone())
        .await
        .expect("validate graph");
    assert!(issues.is_empty(), "expected valid graph, got {issues:?}");

    let compiled = commands::compile_workflow_graph_impl(graph.clone())
        .await
        .expect("compile graph");
    assert_eq!(compiled.steps.len(), 1);
    assert_eq!(compiled.steps[0].node_id, "wait");

    let run_state = commands::run_workflow_impl(&state, &workflow.id)
        .await
        .expect("run graph");
    assert_eq!(run_state.status, RunStatus::Running);
    assert!(run_state.outputs.is_empty());

    poll_status(&state, RunStatus::Success).await;
}

#[tokio::test]
async fn duplicate_workflow_copies_graph_and_unsanitized_settings() {
    let (state, _db_path) = test_state().await;
    let workflow = commands::create_workflow_impl(&state, "Source flow")
        .await
        .expect("create");
    let legacy_step = commands::add_step_impl(&state, &workflow.id, ActionType::Wait)
        .await
        .expect("legacy step");
    commands::update_step_impl(
        &state,
        &legacy_step.id,
        "Legacy wait",
        ActionConfig::Wait {
            target: None,
            condition: WaitCondition::Duration,
            xpath: None,
            text: None,
            url: None,
            duration_ms: Some(250),
            timeout_ms: None,
        },
    )
    .await
    .expect("update legacy step");

    let graph = graph_with_action_path(vec![navigate_node("open", "https://example.test")]);
    commands::save_workflow_graph_impl(&state, &workflow.id, graph.clone())
        .await
        .expect("save graph");

    let mut settings = WorkflowSettings::default_for_workflow(&workflow);
    settings.browser.proxy_enabled = true;
    settings.browser.proxy_server = Some("http://proxy.local:8080".to_string());
    settings.browser.proxy_username = Some("agent".to_string());
    settings.browser.proxy_password = Some("secret-password".to_string());
    settings.environment.download_directory = Some("/tmp/source-downloads".to_string());
    settings.environment.cookies = vec![WorkflowSettingsCookie {
        name: "session".to_string(),
        value: "abc123".to_string(),
        domain: Some("example.test".to_string()),
        path: Some("/".to_string()),
    }];
    settings.environment.local_storage = vec![WorkflowSettingsStorageEntry {
        key: "token".to_string(),
        value: "local-secret".to_string(),
    }];
    commands::save_workflow_settings_impl(&state, &workflow.id, settings)
        .await
        .expect("save settings");

    let copied = commands::duplicate_workflow_impl(&state, &workflow.id, "Copy of Source flow")
        .await
        .expect("duplicate");

    assert_ne!(copied.workflow.id, workflow.id);
    assert_eq!(copied.workflow.name, "Copy of Source flow");
    assert_eq!(copied.steps.len(), 1);
    assert_eq!(copied.steps[0].name, "Legacy wait");

    let copied_graph = commands::get_workflow_graph_impl(&state, &copied.workflow.id)
        .await
        .expect("copied graph");
    assert_eq!(copied_graph, graph);

    let copied_settings = commands::get_workflow_settings_impl(&state, &copied.workflow.id)
        .await
        .expect("copied settings");
    assert_eq!(copied_settings.general.name, "Copy of Source flow");
    assert_eq!(
        copied_settings.browser.proxy_password.as_deref(),
        Some("secret-password")
    );
    assert_eq!(
        copied_settings.environment.download_directory.as_deref(),
        Some("/tmp/source-downloads")
    );
    assert_eq!(copied_settings.environment.cookies.len(), 1);
    assert_eq!(copied_settings.environment.local_storage.len(), 1);
}

#[tokio::test]
async fn workflow_browser_config_commands_round_trip_and_validate() {
    let (state, _db_path) = test_state().await;
    let workflow = commands::create_workflow_impl(&state, "Runtime config")
        .await
        .expect("create");

    let default_config = commands::get_workflow_browser_config_impl(&state, &workflow.id)
        .await
        .expect("get default browser config");
    assert_eq!(default_config.workflow_id, workflow.id);
    assert_eq!(default_config.profile_name, None);
    assert_eq!(
        default_config.challenge_policy,
        WorkflowBrowserChallengePolicy::None
    );

    let config = WorkflowBrowserConfig {
        workflow_id: workflow.id.clone(),
        profile_name: Some(" release ".to_string()),
        proxy_enabled: true,
        proxy_server: Some("http://proxy.local:8080".to_string()),
        proxy_username: Some("agent".to_string()),
        proxy_password: Some("secret".to_string()),
        user_agent: Some("WorkflowBot/1.0".to_string()),
        viewport_width: Some(1440),
        viewport_height: Some(900),
        mobile: false,
        touch: false,
        challenge_policy: WorkflowBrowserChallengePolicy::PauseForHuman,
        headless: false,
    };
    commands::save_workflow_browser_config_impl(&state, &workflow.id, config.clone())
        .await
        .expect("save browser config");

    let loaded = commands::get_workflow_browser_config_impl(&state, &workflow.id)
        .await
        .expect("get saved browser config");
    assert_eq!(loaded, config.normalized());

    let error = commands::save_workflow_browser_config_impl(
        &state,
        &workflow.id,
        WorkflowBrowserConfig {
            proxy_enabled: true,
            ..WorkflowBrowserConfig::default_for_workflow(&workflow.id)
        },
    )
    .await
    .expect_err("invalid browser config should fail");
    assert_eq!(error.field.as_deref(), Some("proxy_server"));
    assert_eq!(error.message, "Proxy server is required");
}

#[tokio::test]
async fn workflow_settings_commands_round_trip_validate_and_map_browser_config() {
    let (state, _db_path) = test_state().await;
    let workflow = commands::create_workflow_impl(&state, "Settings config")
        .await
        .expect("create");

    let defaults = commands::get_workflow_settings_impl(&state, &workflow.id)
        .await
        .expect("get default settings");
    assert_eq!(defaults.workflow_id, workflow.id);
    assert_eq!(defaults.general.name, "Settings config");
    assert_eq!(
        defaults.browser.challenge_policy,
        WorkflowBrowserChallengePolicy::None
    );

    let mut settings = WorkflowSettings::default_for_workflow(&workflow);
    settings.general.name = "Settings config updated".to_string();
    settings.execution.default_action_timeout_ms = Some(5000);
    settings.browser.profile_name = Some("release".to_string());
    settings.browser.challenge_policy = WorkflowBrowserChallengePolicy::PauseForHuman;

    let saved = commands::save_workflow_settings_impl(&state, &workflow.id, settings.clone())
        .await
        .expect("save settings");
    assert_eq!(saved.general.name, "Settings config updated");
    assert_eq!(saved.browser.profile_name.as_deref(), Some("release"));

    let mut browser = saved.browser.clone();
    browser.proxy_enabled = true;
    browser.proxy_server = Some("http://proxy.local:8080".to_string());
    let saved = commands::save_workflow_settings_section_impl(
        &state,
        &workflow.id,
        WorkflowSettingsSection::Browser,
        serde_json::to_value(browser).expect("browser section JSON"),
    )
    .await
    .expect("save browser section");
    assert!(saved.browser.proxy_enabled);

    let legacy_browser = commands::get_workflow_browser_config_impl(&state, &workflow.id)
        .await
        .expect("get mapped browser config");
    assert_eq!(
        legacy_browser.proxy_server.as_deref(),
        Some("http://proxy.local:8080")
    );

    commands::save_workflow_browser_config_impl(
        &state,
        &workflow.id,
        WorkflowBrowserConfig {
            workflow_id: workflow.id.clone(),
            profile_name: Some("legacy-command-profile".to_string()),
            proxy_enabled: false,
            proxy_server: None,
            proxy_username: None,
            proxy_password: None,
            user_agent: None,
            viewport_width: None,
            viewport_height: None,
            mobile: false,
            touch: false,
            challenge_policy: WorkflowBrowserChallengePolicy::DetectOnly,
            headless: false,
        },
    )
    .await
    .expect("legacy browser config command maps to settings");
    let mapped_settings = commands::get_workflow_settings_impl(&state, &workflow.id)
        .await
        .expect("get mapped settings");
    assert_eq!(
        mapped_settings.browser.profile_name.as_deref(),
        Some("legacy-command-profile")
    );
    assert_eq!(
        mapped_settings.browser.challenge_policy,
        WorkflowBrowserChallengePolicy::DetectOnly
    );

    let mut invalid = mapped_settings;
    invalid.triggers.enabled = true;
    invalid.triggers.mode = WorkflowTriggerMode::Interval;
    invalid.triggers.interval_seconds = Some(0);
    let issues = commands::validate_workflow_settings_impl(invalid)
        .await
        .expect("validate settings");
    assert_eq!(issues.len(), 1);
    assert_eq!(issues[0].section, WorkflowSettingsSection::Triggers);
    assert_eq!(issues[0].field.as_deref(), Some("interval_seconds"));
}

#[tokio::test]
async fn validate_workflow_run_reports_settings_issues_before_launch() {
    let runner = RecordingRunExecutor::new();
    let (state, _db_path) = test_state_with_runner(runner.clone()).await;
    let workflow = commands::create_workflow_impl(&state, "Validate run")
        .await
        .expect("create");
    commands::save_workflow_graph_impl(
        &state,
        &workflow.id,
        graph_with_action_path(vec![action_node("wait")]),
    )
    .await
    .expect("save graph");

    let mut settings = WorkflowSettings::default_for_workflow(&workflow);
    settings.inputs.input_schema = vec![WorkflowSettingsInputRow {
        name: "email".to_string(),
        value_type: WorkflowInputValueType::Text,
        required: true,
        default_value: None,
        description: None,
    }];
    commands::save_workflow_settings_impl(&state, &workflow.id, settings)
        .await
        .expect("save settings");

    let issues = commands::validate_workflow_run_impl(&state, &workflow.id)
        .await
        .expect("validate run");

    assert_eq!(issues.len(), 1);
    assert_eq!(issues[0].source.as_str(), "settings");
    assert_eq!(issues[0].field.as_deref(), Some("inputs.input_schema"));
    assert!(runner.recorded_runs().is_empty());
}

#[tokio::test]
async fn run_workflow_uses_saved_browser_config_before_legacy_launch_actions() {
    let runner = RecordingRunExecutor::new();
    let (state, _db_path) = test_state_with_runner(runner.clone()).await;
    let workflow = commands::create_workflow_impl(&state, "Runtime config precedence")
        .await
        .expect("create");

    let legacy_profile = action_node_with_config(
        "legacy-profile",
        "Legacy profile",
        serde_json::json!({
            "type": "use_profile",
            "config": { "name": "legacy-profile" }
        }),
    );
    let wait = action_node("wait");
    commands::save_workflow_graph_impl(
        &state,
        &workflow.id,
        graph_with_action_path(vec![legacy_profile, wait]),
    )
    .await
    .expect("save graph");
    commands::save_workflow_browser_config_impl(
        &state,
        &workflow.id,
        WorkflowBrowserConfig {
            workflow_id: workflow.id.clone(),
            profile_name: Some("workflow-profile".to_string()),
            proxy_enabled: true,
            proxy_server: Some("http://proxy.local:8080".to_string()),
            proxy_username: None,
            proxy_password: None,
            user_agent: Some("WorkflowBot/1.0".to_string()),
            viewport_width: Some(1280),
            viewport_height: Some(720),
            mobile: false,
            touch: true,
            challenge_policy: WorkflowBrowserChallengePolicy::DetectOnly,
            headless: false,
        },
    )
    .await
    .expect("save browser config");

    commands::run_workflow_impl(&state, &workflow.id)
        .await
        .expect("run workflow");
    poll_status(&state, RunStatus::Success).await;

    let recorded_browser_configs = runner.recorded_browser_configs();
    assert_eq!(recorded_browser_configs.len(), 1);
    let recorded = recorded_browser_configs[0]
        .as_ref()
        .expect("workflow browser config should be passed to runner");
    assert_eq!(recorded.profile_name.as_deref(), Some("workflow-profile"));
    assert_eq!(
        recorded.proxy_server.as_deref(),
        Some("http://proxy.local:8080")
    );
    assert_eq!(recorded.user_agent.as_deref(), Some("WorkflowBot/1.0"));
    assert_eq!(recorded.viewport_width, Some(1280));
    assert!(recorded.touch);
}

#[tokio::test]
async fn run_workflow_applies_headless_and_browser_retention_settings() {
    let runner = RecordingRunExecutor::new();
    let (state, _db_path) = test_state_with_runner(runner.clone()).await;
    let workflow = commands::create_workflow_impl(&state, "Runtime truth")
        .await
        .expect("create");

    commands::save_workflow_graph_impl(
        &state,
        &workflow.id,
        graph_with_action_path(vec![action_node("wait")]),
    )
    .await
    .expect("save graph");
    let mut settings = WorkflowSettings::default_for_workflow(&workflow);
    settings.browser.headless = true;
    settings.execution.browser_retention = WorkflowBrowserRetention::Close;
    commands::save_workflow_settings_impl(&state, &workflow.id, settings)
        .await
        .expect("save settings");

    commands::run_workflow_impl(&state, &workflow.id)
        .await
        .expect("run workflow");
    poll_status(&state, RunStatus::Success).await;

    let recorded_browser_configs = runner.recorded_browser_configs();
    let recorded = recorded_browser_configs[0]
        .as_ref()
        .expect("workflow browser config should be passed to runner");
    assert!(recorded.headless);
}

#[tokio::test]
async fn run_workflow_max_duration_cancels_and_reports_timeout_failure() {
    let (state, _db_path) = test_state_with_runner(FakeRunExecutor::stopped_on_cancel()).await;
    let workflow = commands::create_workflow_impl(&state, "Timeout run")
        .await
        .expect("create");

    commands::save_workflow_graph_impl(
        &state,
        &workflow.id,
        graph_with_action_path(vec![action_node("wait")]),
    )
    .await
    .expect("save graph");
    let mut settings = WorkflowSettings::default_for_workflow(&workflow);
    settings.execution.max_workflow_duration_ms = Some(25);
    commands::save_workflow_settings_impl(&state, &workflow.id, settings)
        .await
        .expect("save settings");

    commands::run_workflow_impl(&state, &workflow.id)
        .await
        .expect("run workflow");
    poll_status(&state, RunStatus::Failed).await;

    let run_state = commands::get_run_state_impl(&state).await;
    let error = run_state
        .error
        .expect("timeout failure should include error");
    assert!(error.reason.contains("exceeded maximum duration"));
}

#[tokio::test]
async fn run_workflow_applies_environment_and_input_settings_before_graph_steps() {
    let runner = RecordingRunExecutor::new();
    let (state, _db_path) = test_state_with_runner(runner.clone()).await;
    let workflow = commands::create_workflow_impl(&state, "Settings run context")
        .await
        .expect("create");

    commands::save_workflow_graph_impl(
        &state,
        &workflow.id,
        graph_with_action_path(vec![action_node("wait")]),
    )
    .await
    .expect("save graph");

    let mut settings = WorkflowSettings::default_for_workflow(&workflow);
    settings.environment.geolocation = Some(WorkflowSettingsGeolocation {
        latitude: 10.0,
        longitude: 20.0,
        accuracy: Some(5.0),
    });
    settings.environment.permissions = vec!["geolocation".to_string()];
    settings.environment.extra_http_headers = vec![HeaderPair {
        name: "X-Test-Run".to_string(),
        value: "settings".to_string(),
    }];
    settings.environment.download_directory = Some("/tmp/wam-downloads".to_string());
    settings.environment.cookies = vec![WorkflowSettingsCookie {
        name: "session".to_string(),
        value: "abc".to_string(),
        domain: Some("example.com".to_string()),
        path: Some("/".to_string()),
    }];
    settings.environment.local_storage = vec![WorkflowSettingsStorageEntry {
        key: "feature".to_string(),
        value: "on".to_string(),
    }];
    settings.environment.session_storage = vec![WorkflowSettingsStorageEntry {
        key: "tab".to_string(),
        value: "checkout".to_string(),
    }];
    settings.inputs.input_schema = vec![WorkflowSettingsInputRow {
        name: "email".to_string(),
        value_type: WorkflowInputValueType::Text,
        required: true,
        default_value: Some("user@example.com".to_string()),
        description: None,
    }];
    settings.inputs.initial_variables = vec![VariableAssignment {
        name: "tenant".to_string(),
        value_type: VariableValueType::Text,
        value: "qa".to_string(),
    }];
    commands::save_workflow_settings_impl(&state, &workflow.id, settings)
        .await
        .expect("save settings");

    commands::run_workflow_impl(&state, &workflow.id)
        .await
        .expect("run workflow");
    poll_status(&state, RunStatus::Success).await;

    let runs = runner.recorded_runs();
    assert_eq!(runs.len(), 1);
    assert!(matches!(runs[0][0], ActionConfig::SetGeolocation { .. }));
    assert!(matches!(runs[0][1], ActionConfig::GrantPermission { .. }));
    assert!(matches!(runs[0][2], ActionConfig::SetExtraHeaders { .. }));
    assert!(matches!(
        runs[0][3],
        ActionConfig::SetDownloadDirectory { .. }
    ));
    assert!(matches!(runs[0][4], ActionConfig::SetCookie { .. }));
    assert!(matches!(runs[0][5], ActionConfig::SetLocalStorage { .. }));
    assert!(matches!(runs[0][6], ActionConfig::SetSessionStorage { .. }));
    match &runs[0][7] {
        ActionConfig::SetVariable { variables, .. } => {
            assert!(variables.iter().any(|variable| {
                variable.name == "email" && variable.value == "user@example.com"
            }));
            assert!(variables
                .iter()
                .any(|variable| variable.name == "tenant" && variable.value == "qa"));
        }
        other => panic!("expected input seed variables, got {other:?}"),
    }
    assert!(matches!(runs[0][8], ActionConfig::Wait { .. }));
}

#[tokio::test]
async fn run_workflow_applies_execution_default_timeout_to_actions_without_timeout() {
    let runner = RecordingRunExecutor::new();
    let (state, _db_path) = test_state_with_runner(runner.clone()).await;
    let workflow = commands::create_workflow_impl(&state, "Timeout defaults")
        .await
        .expect("create");

    commands::save_workflow_graph_impl(
        &state,
        &workflow.id,
        graph_with_action_path(vec![action_node("wait")]),
    )
    .await
    .expect("save graph");
    let mut settings = WorkflowSettings::default_for_workflow(&workflow);
    settings.execution.default_action_timeout_ms = Some(7000);
    commands::save_workflow_settings_impl(&state, &workflow.id, settings)
        .await
        .expect("save settings");

    commands::run_workflow_impl(&state, &workflow.id)
        .await
        .expect("run workflow");
    poll_status(&state, RunStatus::Success).await;

    let runs = runner.recorded_runs();
    match &runs[0][0] {
        ActionConfig::Wait { timeout_ms, .. } => assert_eq!(*timeout_ms, Some(7000)),
        other => panic!("expected wait action, got {other:?}"),
    }
}

#[tokio::test]
async fn run_workflow_inserts_global_wait_between_non_wait_nodes() {
    let runner = RecordingRunExecutor::new();
    let (state, _db_path) = test_state_with_runner(runner.clone()).await;
    let workflow = commands::create_workflow_impl(&state, "Global wait")
        .await
        .expect("create");

    commands::save_workflow_graph_impl(
        &state,
        &workflow.id,
        graph_with_action_path(vec![
            navigate_node("first", "https://example.com/one"),
            navigate_node("second", "https://example.com/two"),
        ]),
    )
    .await
    .expect("save graph");
    let mut settings = WorkflowSettings::default_for_workflow(&workflow);
    settings.execution.wait_between_nodes_enabled = true;
    settings.execution.wait_between_nodes_ms = Some(250);
    commands::save_workflow_settings_impl(&state, &workflow.id, settings)
        .await
        .expect("save settings");

    commands::run_workflow_impl(&state, &workflow.id)
        .await
        .expect("run workflow");
    poll_status(&state, RunStatus::Success).await;

    let runs = runner.recorded_runs();
    assert_eq!(runs[0].len(), 3);
    assert!(matches!(runs[0][0], ActionConfig::Navigate { .. }));
    match &runs[0][1] {
        ActionConfig::Wait {
            target: None,
            condition: WaitCondition::Duration,
            duration_ms,
            ..
        } => assert_eq!(*duration_ms, Some(250)),
        other => panic!("expected inserted wait action, got {other:?}"),
    }
    assert!(matches!(runs[0][2], ActionConfig::Navigate { .. }));
}

#[tokio::test]
async fn run_workflow_lets_explicit_wait_nodes_override_global_wait() {
    let runner = RecordingRunExecutor::new();
    let (state, _db_path) = test_state_with_runner(runner.clone()).await;
    let workflow = commands::create_workflow_impl(&state, "Wait override")
        .await
        .expect("create");

    commands::save_workflow_graph_impl(
        &state,
        &workflow.id,
        graph_with_action_path(vec![
            navigate_node("first", "https://example.com/one"),
            action_node("explicit-wait"),
            navigate_node("second", "https://example.com/two"),
        ]),
    )
    .await
    .expect("save graph");
    let mut settings = WorkflowSettings::default_for_workflow(&workflow);
    settings.execution.wait_between_nodes_enabled = true;
    settings.execution.wait_between_nodes_ms = Some(999);
    commands::save_workflow_settings_impl(&state, &workflow.id, settings)
        .await
        .expect("save settings");

    commands::run_workflow_impl(&state, &workflow.id)
        .await
        .expect("run workflow");
    poll_status(&state, RunStatus::Success).await;

    let runs = runner.recorded_runs();
    assert_eq!(runs[0].len(), 3);
    match &runs[0][1] {
        ActionConfig::Wait {
            target: None,
            condition: WaitCondition::Duration,
            duration_ms,
            ..
        } => assert_eq!(*duration_ms, Some(100)),
        other => panic!("expected explicit wait action, got {other:?}"),
    }
}

#[tokio::test]
async fn run_workflow_inserts_global_wait_inside_nested_graph_blocks() {
    let runner = RecordingRunExecutor::new();
    let (state, _db_path) = test_state_with_runner(runner.clone()).await;
    let workflow = commands::create_workflow_impl(&state, "Nested wait")
        .await
        .expect("create");

    commands::save_workflow_graph_impl(
        &state,
        &workflow.id,
        graph_with_action_path(vec![action_node_with_config(
            "branch",
            "Branch",
            serde_json::json!({
                "type": "if_condition",
                "config": {
                    "condition": { "kind": "output_equals", "name": "ready", "value": "true" },
                    "then_steps": [
                        { "type": "navigate", "config": { "url": "https://example.com/one" } },
                        { "type": "navigate", "config": { "url": "https://example.com/two" } }
                    ],
                    "else_steps": []
                }
            }),
        )]),
    )
    .await
    .expect("save graph");
    let mut settings = WorkflowSettings::default_for_workflow(&workflow);
    settings.execution.wait_between_nodes_enabled = true;
    settings.execution.wait_between_nodes_ms = Some(300);
    commands::save_workflow_settings_impl(&state, &workflow.id, settings)
        .await
        .expect("save settings");

    commands::run_workflow_impl(&state, &workflow.id)
        .await
        .expect("run workflow");
    poll_status(&state, RunStatus::Success).await;

    let runs = runner.recorded_runs();
    match &runs[0][0] {
        ActionConfig::IfCondition { then_steps, .. } => {
            assert_eq!(then_steps.len(), 3);
            match &then_steps[1] {
                ActionConfig::Wait {
                    target: None,
                    condition: WaitCondition::Duration,
                    duration_ms,
                    ..
                } => assert_eq!(*duration_ms, Some(300)),
                other => panic!("expected nested inserted wait, got {other:?}"),
            }
        }
        other => panic!("expected if condition action, got {other:?}"),
    }
}

#[tokio::test]
async fn run_workflow_rejects_required_settings_input_without_value_before_runner_start() {
    let runner = RecordingRunExecutor::new();
    let (state, _db_path) = test_state_with_runner(runner.clone()).await;
    let workflow = commands::create_workflow_impl(&state, "Required input")
        .await
        .expect("create");
    commands::save_workflow_graph_impl(
        &state,
        &workflow.id,
        graph_with_action_path(vec![action_node("wait")]),
    )
    .await
    .expect("save graph");

    let mut settings = WorkflowSettings::default_for_workflow(&workflow);
    settings.inputs.input_schema = vec![WorkflowSettingsInputRow {
        name: "email".to_string(),
        value_type: WorkflowInputValueType::Text,
        required: true,
        default_value: None,
        description: None,
    }];
    commands::save_workflow_settings_impl(&state, &workflow.id, settings)
        .await
        .expect("save settings");

    let error = commands::run_workflow_impl(&state, &workflow.id)
        .await
        .expect_err("required input should block run");

    assert_eq!(error.field.as_deref(), Some("inputs.input_schema"));
    assert_eq!(
        error.message,
        "Input \"email\" is required but no default, batch mapping, or run value was provided."
    );
    assert!(runner.recorded_runs().is_empty());
}

#[tokio::test]
async fn run_workflow_rejects_default_new_node_graph_without_starting_runner() {
    let (state, _db_path) = test_state_with_runner(FakeRunExecutor::success()).await;
    let workflow = commands::create_workflow_impl(&state, "Empty graph")
        .await
        .expect("create");

    let error = commands::run_workflow_impl(&state, &workflow.id)
        .await
        .expect_err("unconfigured new node graph should not run");

    assert_eq!(error.field.as_deref(), Some("graph"));
    assert_eq!(
        error.message,
        "Choose an action type before running this node"
    );
}

#[tokio::test]
async fn graph_commands_reject_blocking_semantic_errors_before_runner_start() {
    let runner = RecordingRunExecutor::new();
    let (state, _db_path) = test_state_with_runner(runner.clone()).await;
    let workflow = commands::create_workflow_impl(&state, "Ambiguous graph")
        .await
        .expect("create");
    let mut graph = sample_graph();
    graph.nodes.push(action_node("other"));
    graph.edges.push(GraphEdge {
        id: "edge-start-other".to_string(),
        source_node_id: "start".to_string(),
        source_port: "out".to_string(),
        target_node_id: "other".to_string(),
        target_port: "in".to_string(),
        label: Some("next".to_string()),
        condition: None,
    });

    let issues = commands::validate_workflow_graph_impl(graph.clone())
        .await
        .expect("validate graph");
    assert!(issues.iter().any(|issue| {
        issue.level == GraphValidationLevel::Error
            && issue.edge_id.as_deref() == Some("edge-start-other")
            && issue
                .message
                .contains("Only one edge can leave an output port")
    }));

    let compile_error = commands::compile_workflow_graph_impl(graph.clone())
        .await
        .expect_err("ambiguous graph should not compile");
    assert_eq!(compile_error.field.as_deref(), Some("graph"));

    commands::save_workflow_graph_impl(&state, &workflow.id, graph)
        .await
        .expect("save graph");
    let run_error = commands::run_workflow_impl(&state, &workflow.id)
        .await
        .expect_err("ambiguous graph should not run");
    assert_eq!(run_error.field.as_deref(), Some("graph"));
    assert!(runner.recorded_runs().is_empty());
}

#[tokio::test]
async fn run_workflow_graph_expands_subworkflow_nodes_before_runner_start() {
    let runner = RecordingRunExecutor::new();
    let (state, _db_path) = test_state_with_runner(runner.clone()).await;
    let child = commands::create_workflow_impl(&state, "Child graph")
        .await
        .expect("create child");
    commands::save_workflow_graph_impl(&state, &child.id, sample_graph())
        .await
        .expect("save child graph");
    let parent = commands::create_workflow_impl(&state, "Parent graph")
        .await
        .expect("create parent");
    let parent_graph = graph_with_action_path(vec![run_subworkflow_node("run-child", &child.id)]);
    commands::save_workflow_graph_impl(&state, &parent.id, parent_graph)
        .await
        .expect("save parent graph");

    commands::run_workflow_impl(&state, &parent.id)
        .await
        .expect("run parent graph");
    poll_status(&state, RunStatus::Success).await;

    let runs = runner.recorded_runs();
    assert_eq!(runs.len(), 1);
    assert!(runs[0]
        .iter()
        .all(|config| !matches!(config, ActionConfig::RunSubworkflow { .. })));
    assert!(runs[0]
        .iter()
        .any(|config| matches!(config, ActionConfig::Wait { .. })));
}

#[tokio::test]
async fn run_workflow_graph_rejects_graphs_with_blocking_issues() {
    let (state, _db_path) = test_state_with_runner(FakeRunExecutor::success()).await;
    let workflow = commands::create_workflow_impl(&state, "Invalid graph")
        .await
        .expect("create");
    let graph = WorkflowGraph {
        version: 1,
        nodes: vec![action_node("wait")],
        edges: vec![],
        viewport: GraphViewport {
            x: 0.0,
            y: 0.0,
            zoom: 1.0,
        },
    };
    commands::save_workflow_graph_impl(&state, &workflow.id, graph)
        .await
        .expect("save invalid graph draft");

    let error = commands::run_workflow_impl(&state, &workflow.id)
        .await
        .expect_err("invalid graph should not run");

    assert!(error
        .message
        .contains("Graph must contain exactly one start node"));
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
            target: None,
            xpath: "//*[@id=\"login\"]".to_string(),
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
            wait_until: None,
            timeout_ms: None,
            retry_interval_ms: None,
            post_click_wait_ms: None,
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
    let first = commands::add_step_impl(&state, &workflow.id, ActionType::Navigate)
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
    let open = commands::add_step_impl(&state, &workflow.id, ActionType::Navigate)
        .await
        .expect("navigate");
    commands::update_step_impl(
        &state,
        &open.id,
        "Navigate",
        ActionConfig::Navigate {
            url: "https://example.com".to_string(),
            wait_until: None,
            timeout_ms: None,
        },
    )
    .await
    .expect("update navigate");
    let input_text = commands::add_step_impl(&state, &workflow.id, ActionType::InputText)
        .await
        .expect("input");
    commands::update_step_impl(
        &state,
        &input_text.id,
        "Input Text",
        ActionConfig::InputText {
            target: None,
            xpath: "//*[@name=\"email\"]".to_string(),
            iframe_xpath: None,
            text: "user@example.com".to_string(),
            clear_before_input: true,
            typing_mode: None,
            delay_ms: None,
            wait_until: None,
            timeout_ms: None,
        },
    )
    .await
    .expect("update input");
    let click = commands::add_step_impl(&state, &workflow.id, ActionType::Click)
        .await
        .expect("click");
    commands::update_step_impl(
        &state,
        &click.id,
        "Click",
        ActionConfig::Click {
            target: None,
            xpath: "//*[@id=\"submit\"]".to_string(),
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
            wait_until: None,
            timeout_ms: None,
            retry_interval_ms: None,
            post_click_wait_ms: None,
        },
    )
    .await
    .expect("update click");
    commands::save_workflow_graph_impl(
        &state,
        &workflow.id,
        graph_with_action_path(vec![
            action_node(&open.id),
            action_node(&input_text.id),
            action_node(&click.id),
        ]),
    )
    .await
    .expect("save runnable graph");

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
    let graph = graph_with_action_path(vec![action_node("wait")]);
    commands::save_workflow_graph_impl(&state, &workflow.id, graph)
        .await
        .expect("save graph");

    let run_state = commands::run_workflow_impl(&state, &workflow.id)
        .await
        .expect("start run");
    assert_eq!(run_state.status, RunStatus::Running);

    poll_status(&state, RunStatus::Success).await;
    let finished = commands::get_run_state_impl(&state).await;
    assert_eq!(finished.completed_step_ids, vec!["wait"]);
}

#[tokio::test]
async fn test_step_runs_only_through_selected_step_and_reports_first_failure() {
    let (state, _db_path) = test_state_with_runner(FakeRunExecutor::success()).await;

    let workflow = commands::create_workflow_impl(&state, "Test step")
        .await
        .expect("create");
    let open = commands::add_step_impl(&state, &workflow.id, ActionType::Navigate)
        .await
        .expect("navigate");
    commands::update_step_impl(
        &state,
        &open.id,
        "Navigate",
        ActionConfig::Navigate {
            url: "https://example.com".to_string(),
            wait_until: None,
            timeout_ms: None,
        },
    )
    .await
    .expect("update navigate");
    let wait = commands::add_step_impl(&state, &workflow.id, ActionType::Wait)
        .await
        .expect("wait");
    commands::update_step_impl(
        &state,
        &wait.id,
        "Wait",
        ActionConfig::Wait {
            target: None,
            condition: WaitCondition::Duration,
            xpath: None,
            text: None,
            url: None,
            duration_ms: Some((0.2 * 1000.0) as u64),
            timeout_ms: None,
        },
    )
    .await
    .expect("update wait");
    let bad_click = commands::add_step_impl(&state, &workflow.id, ActionType::Click)
        .await
        .expect("bad click");
    commands::update_step_impl(
        &state,
        &bad_click.id,
        "Click",
        ActionConfig::Click {
            target: None,
            xpath: "//*[@id=\"missing\"]".to_string(),
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
            wait_until: None,
            timeout_ms: None,
            retry_interval_ms: None,
            post_click_wait_ms: None,
        },
    )
    .await
    .expect("update bad click");

    assert_eq!(
        commands::test_step_impl(&state, &workflow.id, &wait.id)
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
    let graph = graph_with_action_path(vec![action_node("first"), action_node("second")]);
    commands::save_workflow_graph_impl(&state, &workflow.id, graph)
        .await
        .expect("save graph");

    commands::run_workflow_impl(&state, &workflow.id)
        .await
        .expect("start run");
    poll_status(&state, RunStatus::Failed).await;

    let run_state = commands::get_run_state_impl(&state).await;
    let error = run_state.error.expect("failure payload");
    assert_eq!(error.step_id.as_deref(), Some("second"));
    assert_eq!(error.step_number, 2);
    assert_eq!(error.reason, "XPath not found");
    assert!(run_state.completed_step_ids.contains(&"first".to_string()));
}

#[tokio::test]
async fn test_step_exposes_target_current_and_completed_progress() {
    let (state, _db_path) = test_state_with_runner(FakeRunExecutor::stopped_on_cancel()).await;

    let workflow = commands::create_workflow_impl(&state, "Progress")
        .await
        .expect("create");
    let wait = commands::add_step_impl(&state, &workflow.id, ActionType::Wait)
        .await
        .expect("wait");
    commands::update_step_impl(
        &state,
        &wait.id,
        "Wait long enough",
        ActionConfig::Wait {
            target: None,
            condition: WaitCondition::Duration,
            xpath: None,
            text: None,
            url: None,
            duration_ms: Some((10.0 * 1000.0) as u64),
            timeout_ms: None,
        },
    )
    .await
    .expect("update wait");

    let started = commands::test_step_impl(&state, &workflow.id, &wait.id)
        .await
        .expect("start test");
    let started_json = serde_json::to_string(&started).expect("serialize started");

    assert_eq!(started.status, RunStatus::Running);
    assert!(started_json.contains("\"mode\":\"test_step\""));
    assert!(started_json.contains(&format!("\"target_step_id\":\"{}\"", wait.id)));

    let mut running_json = String::new();
    for _ in 0..50 {
        running_json =
            serde_json::to_string(&commands::get_run_state_impl(&state).await).expect("serialize");
        if running_json.contains(&format!("\"current_step_id\":\"{}\"", wait.id)) {
            break;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    assert!(running_json.contains(&format!("\"current_step_id\":\"{}\"", wait.id)));
    assert!(running_json.contains("\"current_step_number\":1"));

    commands::stop_run_impl(&state).await.expect("stop");
}

#[tokio::test]
async fn stop_run_cancels_active_wait_and_second_run_is_rejected() {
    let (state, _db_path) = test_state_with_runner(FakeRunExecutor::stopped_on_cancel()).await;

    let workflow = commands::create_workflow_impl(&state, "Stop run")
        .await
        .expect("create");
    let open = commands::add_step_impl(&state, &workflow.id, ActionType::Navigate)
        .await
        .expect("navigate");
    commands::update_step_impl(
        &state,
        &open.id,
        "Navigate",
        ActionConfig::Navigate {
            url: "https://example.com".to_string(),
            wait_until: None,
            timeout_ms: None,
        },
    )
    .await
    .expect("update navigate");
    let wait = commands::add_step_impl(&state, &workflow.id, ActionType::Wait)
        .await
        .expect("wait");
    commands::update_step_impl(
        &state,
        &wait.id,
        "Wait",
        ActionConfig::Wait {
            target: None,
            condition: WaitCondition::Duration,
            xpath: None,
            text: None,
            url: None,
            duration_ms: Some((10.0 * 1000.0) as u64),
            timeout_ms: None,
        },
    )
    .await
    .expect("update wait");
    commands::save_workflow_graph_impl(
        &state,
        &workflow.id,
        graph_with_action_path(vec![action_node(&open.id), action_node(&wait.id)]),
    )
    .await
    .expect("save runnable graph");

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

#[tokio::test]
async fn phase_ten_schedule_configs_validate() {
    let valid = OrchestrationSchedule {
        workflow_id: "workflow-1".to_string(),
        enabled: true,
        kind: ScheduleKind::Interval { every_seconds: 60 },
    };

    commands::validate_schedule_impl(valid)
        .await
        .expect("valid schedule");

    let invalid = OrchestrationSchedule {
        workflow_id: "workflow-1".to_string(),
        enabled: true,
        kind: ScheduleKind::Interval { every_seconds: 0 },
    };

    let error = commands::validate_schedule_impl(invalid)
        .await
        .expect_err("zero interval rejected");
    assert_eq!(error.field.as_deref(), Some("every_seconds"));
}

#[tokio::test]
async fn phase_ten_export_and_import_workflow_round_trip_steps() {
    let (state, _db_path) = test_state().await;

    let workflow = commands::create_workflow_impl(&state, "Export me")
        .await
        .expect("create");
    let wait = commands::add_step_impl(&state, &workflow.id, ActionType::Wait)
        .await
        .expect("add");
    commands::update_step_impl(
        &state,
        &wait.id,
        "Short wait",
        ActionConfig::Wait {
            target: None,
            condition: WaitCondition::Duration,
            xpath: None,
            text: None,
            url: None,
            duration_ms: Some((0.5 * 1000.0) as u64),
            timeout_ms: None,
        },
    )
    .await
    .expect("update");
    let mut settings = WorkflowSettings::default_for_workflow(&workflow);
    settings.general.description = "Exported settings".to_string();
    settings.browser.profile_name = Some("export-profile".to_string());
    commands::save_workflow_settings_impl(&state, &workflow.id, settings)
        .await
        .expect("save settings");

    let exported = commands::export_workflow_impl(&state, &workflow.id)
        .await
        .expect("export");
    assert_eq!(exported.version, 1);
    assert_eq!(exported.workflow.name, "Export me");
    assert_eq!(exported.steps.len(), 1);
    assert_eq!(
        exported
            .settings
            .as_ref()
            .and_then(|settings| settings.browser.profile_name.as_deref()),
        Some("export-profile")
    );

    let imported = commands::import_workflow_impl(&state, exported)
        .await
        .expect("import");

    assert_ne!(imported.workflow.id, workflow.id);
    assert_eq!(imported.workflow.name, "Export me (imported)");
    assert_eq!(imported.steps.len(), 1);
    assert_eq!(imported.steps[0].name, "Short wait");
    assert_eq!(
        imported.steps[0].config,
        ActionConfig::Wait {
            target: None,
            condition: WaitCondition::Duration,
            xpath: None,
            text: None,
            url: None,
            duration_ms: Some((0.5 * 1000.0) as u64),
            timeout_ms: None
        }
    );
    let imported_settings = commands::get_workflow_settings_impl(&state, &imported.workflow.id)
        .await
        .expect("get imported settings");
    assert_eq!(imported_settings.general.name, "Export me (imported)");
    assert_eq!(imported_settings.general.description, "Exported settings");
    assert_eq!(
        imported_settings.browser.profile_name.as_deref(),
        Some("export-profile")
    );
}

#[tokio::test]
async fn workflow_package_export_import_round_trips_flow_and_safe_settings() {
    let (state, _db_path) = test_state().await;

    let workflow = commands::create_workflow_impl(&state, "Package source")
        .await
        .expect("create");
    let graph = sample_graph();
    commands::save_workflow_graph_impl(&state, &workflow.id, graph.clone())
        .await
        .expect("save graph");

    let mut settings = WorkflowSettings::default_for_workflow(&workflow);
    settings.general.description = "Ready to share".to_string();
    settings.browser.proxy_enabled = true;
    settings.browser.proxy_server = Some("http://proxy.local:8080".to_string());
    settings.browser.proxy_username = Some("operator".to_string());
    settings.browser.proxy_password = Some("secret".to_string());
    settings.environment.download_directory = Some("/home/minhbien/downloads".to_string());
    settings.environment.cookies = vec![WorkflowSettingsCookie {
        name: "session".to_string(),
        value: "private".to_string(),
        domain: Some("example.com".to_string()),
        path: Some("/".to_string()),
    }];
    settings.environment.local_storage = vec![WorkflowSettingsStorageEntry {
        key: "token".to_string(),
        value: "private".to_string(),
    }];
    settings.environment.session_restore_ref = Some("local-session".to_string());
    commands::save_workflow_settings_impl(&state, &workflow.id, settings)
        .await
        .expect("save settings");

    let options = WorkflowPackageExportOptions {
        include_flow: true,
        settings_sections: vec![
            WorkflowSettingsSection::General,
            WorkflowSettingsSection::Browser,
            WorkflowSettingsSection::Environment,
        ],
    };
    let package = commands::export_workflow_package_impl(&state, &workflow.id, options)
        .await
        .expect("export package");

    assert_eq!(package.kind, "workflow_package");
    assert_eq!(package.version, 2);
    assert_eq!(package.workflow.name, "Package source");
    assert_eq!(package.flow.as_ref(), Some(&graph));
    assert_eq!(
        package
            .settings
            .as_ref()
            .and_then(|settings| settings.general.as_ref())
            .map(|general| general.description.as_str()),
        Some("Ready to share")
    );
    assert_eq!(
        package
            .settings
            .as_ref()
            .and_then(|settings| settings.browser.as_ref())
            .and_then(|browser| browser.proxy_password.as_deref()),
        None
    );
    assert!(package
        .settings
        .as_ref()
        .and_then(|settings| settings.environment.as_ref())
        .is_some_and(|environment| {
            environment.download_directory.is_none()
                && environment.cookies.is_empty()
                && environment.local_storage.is_empty()
                && environment.session_restore_ref.is_none()
        }));
    assert!(package
        .omitted_fields
        .iter()
        .any(|field| field == "settings.browser.proxy_password"));

    let preview = commands::preview_workflow_package_impl(package.clone()).expect("preview");
    assert_eq!(preview.workflow_name, "Package source");
    assert!(preview.includes_flow);
    assert_eq!(
        preview.settings_sections,
        vec![
            WorkflowSettingsSection::General,
            WorkflowSettingsSection::Browser,
            WorkflowSettingsSection::Environment
        ]
    );

    let imported = commands::import_workflow_package_impl(
        &state,
        package,
        WorkflowPackageImportOptions {
            include_flow: true,
            settings_sections: vec![
                WorkflowSettingsSection::General,
                WorkflowSettingsSection::Browser,
                WorkflowSettingsSection::Environment,
            ],
        },
    )
    .await
    .expect("import package");

    assert_ne!(imported.workflow.id, workflow.id);
    assert_eq!(imported.workflow.name, "Package source (imported)");
    assert_eq!(
        commands::get_workflow_graph_impl(&state, &imported.workflow.id)
            .await
            .expect("imported graph"),
        graph
    );
    let imported_settings = commands::get_workflow_settings_impl(&state, &imported.workflow.id)
        .await
        .expect("imported settings");
    assert_eq!(imported_settings.general.name, "Package source (imported)");
    assert_eq!(imported_settings.general.description, "Ready to share");
    assert_eq!(imported_settings.browser.proxy_password, None);
    assert!(imported_settings.environment.cookies.is_empty());
    assert_eq!(imported_settings.environment.download_directory, None);
}

#[test]
fn workflow_package_preview_rejects_unsupported_versions() {
    let package = serde_json::json!({
        "kind": "workflow_package",
        "version": 999,
        "workflow": { "name": "Future package" }
    });

    let package = serde_json::from_value(package).expect("deserialize package");
    let error = commands::preview_workflow_package_impl(package)
        .expect_err("unsupported version should fail");

    assert_eq!(error.message, "Unsupported workflow package version");
}

#[test]
fn import_workflow_normalizes_legacy_export_actions() {
    let exported = serde_json::json!({
        "version": 1,
        "workflow": {
            "id": "workflow-old",
            "name": "Old export",
            "created_at": "1",
            "updated_at": "1"
        },
        "steps": [
            {
                "id": "step-open",
                "name": "Open URL",
                "workflow_id": "workflow-old",
                "order_index": 0,
                "action_type": "open_url",
                "config": { "type": "open_url", "config": { "url": "https://example.com" } },
                "created_at": "1",
                "updated_at": "1"
            },
            {
                "id": "step-sleep",
                "name": "Sleep",
                "workflow_id": "workflow-old",
                "order_index": 1,
                "action_type": "sleep",
                "config": { "type": "sleep", "config": { "seconds": 1.5 } },
                "created_at": "1",
                "updated_at": "1"
            },
            {
                "id": "step-type",
                "name": "Type Text",
                "workflow_id": "workflow-old",
                "order_index": 2,
                "action_type": "type_text",
                "config": {
                    "type": "type_text",
                    "config": {
                        "xpath": "//*[@name='email']",
                        "text": "user@example.com"
                    }
                },
                "created_at": "1",
                "updated_at": "1"
            }
        ]
    });

    let normalized = commands::normalize_workflow_export_value(exported).expect("normalize");

    assert_eq!(normalized.steps[0].action_type.as_str(), "navigate");
    assert_eq!(normalized.steps[1].action_type.as_str(), "wait");
    assert_eq!(normalized.steps[2].action_type.as_str(), "input_text");
}

#[tokio::test]
async fn phase_ten_batch_runs_account_for_each_input_row() {
    let runner = Arc::new(FakeRunExecutor::sequence(vec![
        FakeRunOutcome::Success,
        FakeRunOutcome::Failed {
            step_number: 1,
            reason: "row failed".to_string(),
        },
    ]));
    let (state, _db_path) = test_state_with_runner(runner.clone()).await;

    let workflow = commands::create_workflow_impl(&state, "Batch")
        .await
        .expect("create");
    let step = commands::add_step_impl(&state, &workflow.id, ActionType::Wait)
        .await
        .expect("add");
    commands::update_step_impl(
        &state,
        &step.id,
        "Wait",
        ActionConfig::Wait {
            target: None,
            condition: WaitCondition::Duration,
            xpath: None,
            text: None,
            url: None,
            duration_ms: Some((0.1 * 1000.0) as u64),
            timeout_ms: None,
        },
    )
    .await
    .expect("update");
    commands::save_workflow_graph_impl(
        &state,
        &workflow.id,
        graph_with_action_path(vec![action_node(&step.id)]),
    )
    .await
    .expect("save graph");

    let mut first = BTreeMap::new();
    first.insert("email".to_string(), "a@example.com".to_string());
    let mut second = BTreeMap::new();
    second.insert("email".to_string(), "b@example.com".to_string());

    let summary = commands::run_batch_workflow_impl(
        &state,
        &workflow.id,
        BatchRunRequest {
            rows: vec![first, second],
            concurrency_limit: Some(1),
            headless: Some(false),
        },
    )
    .await
    .expect("batch run");

    assert_eq!(summary.total, 2);
    assert_eq!(summary.succeeded, 1);
    assert_eq!(summary.failed, 1);
    assert_eq!(summary.results[0].row_index, 0);
    assert_eq!(summary.results[0].status, RunStatus::Success);
    assert_eq!(summary.results[1].status, RunStatus::Failed);
    assert_eq!(summary.results[1].error.as_deref(), Some("row failed"));
    assert_eq!(runner.run_count(), 2);
}

#[tokio::test]
async fn run_batch_workflow_uses_saved_graph_and_settings_defaults() {
    let runner = RecordingRunExecutor::new();
    let (state, _db_path) = test_state_with_runner(runner.clone()).await;
    let workflow = commands::create_workflow_impl(&state, "Graph batch")
        .await
        .expect("create");
    let legacy = commands::add_step_impl(&state, &workflow.id, ActionType::Navigate)
        .await
        .expect("legacy step");
    commands::update_step_impl(
        &state,
        &legacy.id,
        "Legacy navigate",
        ActionConfig::Navigate {
            url: "https://legacy.example".to_string(),
            wait_until: None,
            timeout_ms: None,
        },
    )
    .await
    .expect("update legacy step");
    commands::save_workflow_graph_impl(
        &state,
        &workflow.id,
        graph_with_action_path(vec![action_node("wait")]),
    )
    .await
    .expect("save graph");
    let mut settings = WorkflowSettings::default_for_workflow(&workflow);
    settings.execution.batch_concurrency_limit = Some(1);
    settings.execution.batch_headless = true;
    commands::save_workflow_settings_impl(&state, &workflow.id, settings)
        .await
        .expect("save settings");

    let mut row = BTreeMap::new();
    row.insert("email".to_string(), "a@example.com".to_string());
    let summary = commands::run_batch_workflow_impl(
        &state,
        &workflow.id,
        BatchRunRequest {
            rows: vec![row],
            concurrency_limit: None,
            headless: None,
        },
    )
    .await
    .expect("batch run");

    assert_eq!(summary.succeeded, 1);
    let runs = runner.recorded_runs();
    assert!(matches!(runs[0][0], ActionConfig::SetVariable { .. }));
    assert!(matches!(runs[0][1], ActionConfig::Wait { .. }));
    assert!(
        runs[0]
            .iter()
            .all(|config| !matches!(config, ActionConfig::Navigate { .. })),
        "batch should execute saved graph steps, not legacy workflow_steps"
    );
    let recorded_browser_configs = runner.recorded_browser_configs();
    let recorded = recorded_browser_configs[0]
        .as_ref()
        .expect("batch browser config");
    assert!(recorded.headless);
}

#[tokio::test]
async fn run_batch_workflow_stops_after_first_failed_row_when_settings_enable_it() {
    let runner = Arc::new(FakeRunExecutor::sequence(vec![
        FakeRunOutcome::Failed {
            step_number: 1,
            reason: "row failed".to_string(),
        },
        FakeRunOutcome::Success,
    ]));
    let (state, _db_path) = test_state_with_runner(runner.clone()).await;
    let workflow = commands::create_workflow_impl(&state, "Stop batch")
        .await
        .expect("create");
    commands::save_workflow_graph_impl(
        &state,
        &workflow.id,
        graph_with_action_path(vec![action_node("wait")]),
    )
    .await
    .expect("save graph");
    let mut settings = WorkflowSettings::default_for_workflow(&workflow);
    settings.execution.batch_stop_on_first_failed_row = true;
    commands::save_workflow_settings_impl(&state, &workflow.id, settings)
        .await
        .expect("save settings");

    let first = BTreeMap::from([("email".to_string(), "a@example.com".to_string())]);
    let second = BTreeMap::from([("email".to_string(), "b@example.com".to_string())]);
    let summary = commands::run_batch_workflow_impl(
        &state,
        &workflow.id,
        BatchRunRequest {
            rows: vec![first, second],
            concurrency_limit: Some(1),
            headless: Some(false),
        },
    )
    .await
    .expect("batch run");

    assert_eq!(summary.total, 1);
    assert_eq!(summary.failed, 1);
    assert_eq!(runner.run_count(), 1);
}

#[tokio::test]
async fn generate_fixture_rejects_paths_outside_dev_fixture_directory() {
    let absolute_error = commands::generate_fixture_impl(
        "/tmp/fixture.html".to_string(),
        "<button>Save</button>".to_string(),
    )
    .await
    .expect_err("absolute fixture paths should be rejected");
    assert_eq!(absolute_error.field.as_deref(), Some("path"));

    let traversal_error = commands::generate_fixture_impl(
        "../fixture.html".to_string(),
        "<button>Save</button>".to_string(),
    )
    .await
    .expect_err("parent traversal should be rejected");
    assert_eq!(traversal_error.field.as_deref(), Some("path"));
}

#[tokio::test]
async fn phase_twelve_suggests_selectors_and_normalizes_recorded_events() {
    let candidates = commands::suggest_selectors_impl(ElementSnapshot {
        tag: "button".to_string(),
        id: Some("save".to_string()),
        test_id: Some("save-button".to_string()),
        name: None,
        text: Some("Save changes".to_string()),
        classes: vec!["btn".to_string(), "primary".to_string()],
    })
    .await
    .expect("selector suggestions");

    assert_eq!(candidates[0].selector, "//*[@data-testid='save-button']");
    assert!(candidates[0].score > candidates[1].score);
    assert!(candidates[0].reason.contains("test id"));

    let steps = commands::normalize_recorded_events_impl(vec![
        RecordedEvent::Click {
            xpath: "//*[@data-testid='save-button']".to_string(),
        },
        RecordedEvent::InputText {
            xpath: "//*[@name='email']".to_string(),
            text: "user@example.com".to_string(),
        },
    ])
    .await
    .expect("normalize events");

    assert!(matches!(steps[0], ActionConfig::Click { .. }));
    assert!(matches!(steps[1], ActionConfig::InputText { .. }));
}

#[tokio::test]
async fn phase_twelve_dry_run_validation_and_fixture_generation_work() {
    commands::dry_run_validate_config_impl(ActionConfig::Click {
        target: None,
        xpath: "//*[@id='save']".to_string(),
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
        wait_until: None,
        timeout_ms: None,
        retry_interval_ms: None,
        post_click_wait_ms: None,
    })
    .await
    .expect("valid config");

    let invalid = commands::dry_run_validate_config_impl(ActionConfig::Click {
        target: None,
        xpath: String::new(),
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
        wait_until: None,
        timeout_ms: None,
        retry_interval_ms: None,
        post_click_wait_ms: None,
    })
    .await
    .expect_err("invalid config rejected");
    assert_eq!(invalid.field.as_deref(), Some("xpath"));

    let path = format!("wam-fixture-{}.html", uuid::Uuid::new_v4());
    let fixture = commands::generate_fixture_impl(
        path,
        "<button data-testid=\"save-button\">Save</button>".to_string(),
    )
    .await
    .expect("generate fixture");
    assert!(std::path::Path::new(&fixture.path).exists());
    assert!(std::fs::read_to_string(&fixture.path)
        .expect("fixture html")
        .contains("save-button"));
}

fn sample_graph() -> WorkflowGraph {
    WorkflowGraph {
        version: 1,
        nodes: vec![start_node(), action_node("wait")],
        edges: vec![GraphEdge {
            id: "edge-start-wait".to_string(),
            source_node_id: "start".to_string(),
            source_port: "out".to_string(),
            target_node_id: "wait".to_string(),
            target_port: "in".to_string(),
            label: Some("next".to_string()),
            condition: None,
        }],
        viewport: GraphViewport {
            x: 0.0,
            y: 0.0,
            zoom: 1.0,
        },
    }
}

fn graph_with_action_path(actions: Vec<GraphNode>) -> WorkflowGraph {
    let mut nodes = vec![start_node()];
    let mut edges = Vec::new();
    let mut previous_node_id = "start".to_string();
    let mut previous_port = "out".to_string();

    for action in actions {
        edges.push(GraphEdge {
            id: format!("edge-{previous_node_id}-{}", action.id),
            source_node_id: previous_node_id,
            source_port: previous_port,
            target_node_id: action.id.clone(),
            target_port: "in".to_string(),
            label: Some("next".to_string()),
            condition: None,
        });
        previous_node_id = action.id.clone();
        previous_port = "out".to_string();
        nodes.push(action);
    }

    WorkflowGraph {
        version: 1,
        nodes,
        edges,
        viewport: GraphViewport {
            x: 0.0,
            y: 0.0,
            zoom: 1.0,
        },
    }
}

fn start_node() -> GraphNode {
    GraphNode {
        id: "start".to_string(),
        node_type: GraphNodeType::Start,
        label: "Start".to_string(),
        position: GraphPosition { x: 0.0, y: 0.0 },
        config: serde_json::json!({}),
        ports: vec![GraphPort {
            id: "out".to_string(),
            label: "Out".to_string(),
            direction: GraphPortDirection::Output,
        }],
        group_id: None,
    }
}

fn action_node(id: &str) -> GraphNode {
    action_node_with_config(
        id,
        "Wait",
        serde_json::json!({
            "type": "wait",
            "config": {
                "condition": "duration",
                "duration_ms": 100
            }
        }),
    )
}

fn navigate_node(id: &str, url: &str) -> GraphNode {
    action_node_with_config(
        id,
        "Navigate",
        serde_json::json!({
            "type": "navigate",
            "config": {
                "url": url
            }
        }),
    )
}

fn action_node_with_config(id: &str, label: &str, config: serde_json::Value) -> GraphNode {
    GraphNode {
        id: id.to_string(),
        node_type: GraphNodeType::Action,
        label: label.to_string(),
        position: GraphPosition { x: 200.0, y: 0.0 },
        config,
        ports: vec![
            GraphPort {
                id: "in".to_string(),
                label: "In".to_string(),
                direction: GraphPortDirection::Input,
            },
            GraphPort {
                id: "out".to_string(),
                label: "Out".to_string(),
                direction: GraphPortDirection::Output,
            },
        ],
        group_id: None,
    }
}

fn run_subworkflow_node(id: &str, workflow_id: &str) -> GraphNode {
    GraphNode {
        id: id.to_string(),
        node_type: GraphNodeType::RunSubworkflow,
        label: "Run Subworkflow".to_string(),
        position: GraphPosition { x: 200.0, y: 0.0 },
        config: serde_json::json!({
            "workflow_id": workflow_id,
            "input_mapping": [],
            "output_mapping": []
        }),
        ports: vec![
            GraphPort {
                id: "in".to_string(),
                label: "In".to_string(),
                direction: GraphPortDirection::Input,
            },
            GraphPort {
                id: "out".to_string(),
                label: "Out".to_string(),
                direction: GraphPortDirection::Output,
            },
        ],
        group_id: None,
    }
}
