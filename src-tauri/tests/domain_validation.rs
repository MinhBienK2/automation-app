use workflow_automation_manager_lib::domain::{
    ActionConfig, ActionType, AssertOutputMatchMode, AssertTextMatchMode, CheckboxState,
    ClearInputMethod, ClickButton, ClickMode, ClickPosition, ClickWaitUntil, GraphEdge, GraphNode,
    GraphNodeType, GraphPort, GraphPortDirection, GraphPosition, GraphValidationLevel,
    GraphViewport, HeaderPair, InputTypingMode, RunError, RunStatus, ScrollBehavior, ScrollBlock,
    ScrollDirection, ScrollInline, ScrollMode, SelectOptionMatchBy, SwitchCase, ValidationError,
    VariableMapping, WaitCondition, Workflow, WorkflowBrowserChallengePolicy,
    WorkflowBrowserConfig, WorkflowCondition, WorkflowGraph, WorkflowSettings, WorkflowStep,
};
use workflow_automation_manager_lib::services::run_service::default_config;

fn assert_validation_message(error: ValidationError, field: &str, message: &str) {
    assert_eq!(error.field, field);
    assert_eq!(error.message, message);
}

#[test]
fn set_variable_config_accepts_legacy_and_multi_row_shapes() {
    let legacy: ActionConfig = serde_json::from_value(serde_json::json!({
        "type": "set_variable",
        "config": {
            "name": "token",
            "value": "abc"
        }
    }))
    .expect("legacy single variable config should remain compatible");
    legacy.validate().expect("legacy config should validate");

    let multi: ActionConfig = serde_json::from_value(serde_json::json!({
        "type": "set_variable",
        "config": {
            "variables": [
                { "name": "user.name", "value_type": "text", "value": "Ada" },
                { "name": "roles", "value_type": "json", "value": "[\"admin\", \"editor\"]" },
                { "name": "age", "value_type": "number", "value": "20" },
                { "name": "enabled", "value_type": "boolean", "value": "true" }
            ]
        }
    }))
    .expect("multi-row variable config should deserialize");
    multi.validate().expect("multi-row config should validate");
}

#[test]
fn set_variable_config_validates_typed_rows() {
    let invalid_json: ActionConfig = serde_json::from_value(serde_json::json!({
        "type": "set_variable",
        "config": {
            "variables": [
                { "name": "roles", "value_type": "json", "value": "[admin]" }
            ]
        }
    }))
    .expect("config should deserialize before validation");
    assert_validation_message(
        invalid_json
            .validate()
            .expect_err("invalid JSON row should fail validation"),
        "variables",
        "Variable roles must contain valid JSON",
    );

    let invalid_number: ActionConfig = serde_json::from_value(serde_json::json!({
        "type": "set_variable",
        "config": {
            "variables": [
                { "name": "age", "value_type": "number", "value": "twenty" }
            ]
        }
    }))
    .expect("config should deserialize before validation");
    assert_validation_message(
        invalid_number
            .validate()
            .expect_err("invalid number row should fail validation"),
        "variables",
        "Variable age must contain a finite number",
    );

    let invalid_boolean: ActionConfig = serde_json::from_value(serde_json::json!({
        "type": "set_variable",
        "config": {
            "variables": [
                { "name": "enabled", "value_type": "boolean", "value": "yes" }
            ]
        }
    }))
    .expect("config should deserialize before validation");
    assert_validation_message(
        invalid_boolean
            .validate()
            .expect_err("invalid boolean row should fail validation"),
        "variables",
        "Variable enabled must be true or false",
    );
}

#[test]
fn set_json_variables_config_requires_root_object() {
    let config: ActionConfig = serde_json::from_value(serde_json::json!({
        "type": "set_json_variables",
        "config": {
            "json": "{\"user\":{\"name\":\"Ada\"},\"roles\":[\"admin\"]}"
        }
    }))
    .expect("set_json_variables should deserialize");
    config.validate().expect("object JSON should validate");

    let invalid_root: ActionConfig = serde_json::from_value(serde_json::json!({
        "type": "set_json_variables",
        "config": {
            "json": "[\"admin\"]"
        }
    }))
    .expect("invalid root shape should still deserialize");
    assert_validation_message(
        invalid_root
            .validate()
            .expect_err("array root should fail validation"),
        "json",
        "JSON variables root must be an object",
    );
}

#[test]
fn repeat_for_each_allows_variable_array_source_without_manual_items() {
    let config: ActionConfig = serde_json::from_value(serde_json::json!({
        "type": "repeat_for_each",
        "config": {
            "item_name": "role",
            "items": [],
            "array_variable": "roles",
            "steps": []
        }
    }))
    .expect("repeat_for_each variable source should deserialize");

    config
        .validate()
        .expect("variable array source should not require manual items");

    let invalid: ActionConfig = serde_json::from_value(serde_json::json!({
        "type": "repeat_for_each",
        "config": {
            "item_name": "role",
            "items": [],
            "array_variable": " ",
            "steps": []
        }
    }))
    .expect("invalid variable source should deserialize");
    assert_validation_message(
        invalid
            .validate()
            .expect_err("blank variable array source should fail"),
        "array_variable",
        "Array variable name is required",
    );
}

#[test]
fn workflow_name_is_required() {
    let workflow = Workflow::new("  ");

    let error = workflow.validate().expect_err("blank name should fail");

    assert_validation_message(error, "name", "Workflow name is required");
}

#[test]
fn valid_workflow_name_passes() {
    let workflow = Workflow::new("Login flow");

    workflow.validate().expect("name should be valid");
}

#[test]
fn workflow_browser_config_defaults_and_validation_match_launch_time_settings() {
    let default_config = WorkflowBrowserConfig::default_for_workflow("workflow-1");

    assert_eq!(default_config.workflow_id, "workflow-1");
    assert_eq!(default_config.profile_name, None);
    assert!(!default_config.proxy_enabled);
    assert_eq!(
        default_config.challenge_policy,
        WorkflowBrowserChallengePolicy::None
    );
    default_config
        .validate()
        .expect("default browser config should validate");

    let normalized = WorkflowBrowserConfig {
        workflow_id: "workflow-1".to_string(),
        profile_name: Some("  qa-profile  ".to_string()),
        proxy_enabled: true,
        proxy_server: Some(" http://proxy.local:8080 ".to_string()),
        proxy_username: Some(" agent ".to_string()),
        proxy_password: Some("secret".to_string()),
        user_agent: Some(" WorkflowBot/1.0 ".to_string()),
        viewport_width: Some(1280),
        viewport_height: Some(720),
        mobile: false,
        touch: false,
        challenge_policy: WorkflowBrowserChallengePolicy::PauseForHuman,
    }
    .normalized();

    assert_eq!(normalized.profile_name.as_deref(), Some("qa-profile"));
    assert_eq!(
        normalized.proxy_server.as_deref(),
        Some("http://proxy.local:8080")
    );
    assert_eq!(normalized.proxy_username.as_deref(), Some("agent"));
    assert_eq!(normalized.user_agent.as_deref(), Some("WorkflowBot/1.0"));
}

#[test]
fn workflow_browser_config_rejects_confusing_values_before_save_or_run() {
    let missing_proxy = WorkflowBrowserConfig {
        proxy_enabled: true,
        ..WorkflowBrowserConfig::default_for_workflow("workflow-1")
    };
    assert_validation_message(
        missing_proxy
            .validate()
            .expect_err("enabled proxy should require a server"),
        "proxy_server",
        "Proxy server is required",
    );

    let blank_username = WorkflowBrowserConfig {
        proxy_username: Some("  ".to_string()),
        ..WorkflowBrowserConfig::default_for_workflow("workflow-1")
    };
    assert_validation_message(
        blank_username
            .validate()
            .expect_err("blank username should fail"),
        "proxy_username",
        "Proxy username cannot be blank",
    );

    let empty_password = WorkflowBrowserConfig {
        proxy_password: Some(String::new()),
        ..WorkflowBrowserConfig::default_for_workflow("workflow-1")
    };
    assert_validation_message(
        empty_password
            .validate()
            .expect_err("empty password should fail"),
        "proxy_password",
        "Proxy password cannot be empty",
    );

    let invalid_viewport = WorkflowBrowserConfig {
        viewport_width: Some(0),
        ..WorkflowBrowserConfig::default_for_workflow("workflow-1")
    };
    assert_validation_message(
        invalid_viewport
            .validate()
            .expect_err("zero viewport width should fail"),
        "viewport_width",
        "Viewport width must be greater than 0",
    );
}

#[test]
fn workflow_settings_defaults_and_validation_cover_all_sections() {
    let workflow = Workflow {
        id: "workflow-1".to_string(),
        name: "Login flow".to_string(),
        created_at: "1".to_string(),
        updated_at: "2".to_string(),
    };
    let settings = WorkflowSettings::default_for_workflow(&workflow);

    assert_eq!(settings.workflow_id, "workflow-1");
    assert_eq!(settings.version, 1);
    assert_eq!(settings.general.name, "Login flow");
    assert_eq!(settings.execution.browser_retention.as_str(), "retain");
    assert_eq!(
        settings.browser.challenge_policy,
        WorkflowBrowserChallengePolicy::None
    );
    assert!(settings.environment.permissions.is_empty());
    assert!(settings.inputs.input_schema.is_empty());
    assert!(!settings.triggers.enabled);
    assert!(settings.advanced.compatibility_warnings.is_empty());
    settings
        .validate()
        .expect("default settings should validate");
}

#[test]
fn workflow_settings_rejects_invalid_cross_section_values() {
    let workflow = Workflow {
        id: "workflow-1".to_string(),
        name: "Login flow".to_string(),
        created_at: "1".to_string(),
        updated_at: "2".to_string(),
    };

    let mut missing_name = WorkflowSettings::default_for_workflow(&workflow);
    missing_name.general.name = "  ".to_string();
    assert_validation_message(
        missing_name
            .validate()
            .expect_err("blank settings name should fail"),
        "general.name",
        "Workflow name is required",
    );

    let mut bad_browser = WorkflowSettings::default_for_workflow(&workflow);
    bad_browser.browser.proxy_enabled = true;
    assert_validation_message(
        bad_browser
            .validate()
            .expect_err("enabled proxy should require server"),
        "browser.proxy_server",
        "Proxy server is required",
    );

    let mut bad_duration = WorkflowSettings::default_for_workflow(&workflow);
    bad_duration.execution.default_action_timeout_ms = Some(0);
    assert_validation_message(
        bad_duration
            .validate()
            .expect_err("zero timeout should fail"),
        "execution.default_action_timeout_ms",
        "Default action timeout must be greater than 0",
    );

    let mut bad_wait = WorkflowSettings::default_for_workflow(&workflow);
    bad_wait.execution.wait_between_nodes_enabled = true;
    bad_wait.execution.wait_between_nodes_ms = Some(0);
    assert_validation_message(
        bad_wait.validate().expect_err("zero node wait should fail"),
        "execution.wait_between_nodes_ms",
        "Wait between nodes must be greater than 0",
    );

    let mut bad_random_wait = WorkflowSettings::default_for_workflow(&workflow);
    bad_random_wait.execution.wait_between_nodes_enabled = true;
    bad_random_wait.execution.wait_between_nodes_random = true;
    bad_random_wait.execution.wait_between_nodes_min_ms = Some(3000);
    bad_random_wait.execution.wait_between_nodes_max_ms = Some(1000);
    assert_validation_message(
        bad_random_wait
            .validate()
            .expect_err("invalid random wait range should fail"),
        "execution.wait_between_nodes_max_ms",
        "Random wait maximum must be greater than or equal to minimum",
    );

    let mut bad_trigger = WorkflowSettings::default_for_workflow(&workflow);
    bad_trigger.triggers.enabled = true;
    bad_trigger.triggers.mode =
        workflow_automation_manager_lib::domain::WorkflowTriggerMode::Interval;
    bad_trigger.triggers.interval_seconds = Some(0);
    assert_validation_message(
        bad_trigger
            .validate()
            .expect_err("zero interval should fail"),
        "triggers.interval_seconds",
        "Trigger interval must be greater than 0",
    );
}

#[test]
fn random_wait_config_validates_range() {
    let valid = ActionConfig::RandomWait {
        min_ms: 250,
        max_ms: 750,
    };
    valid.validate().expect("valid random wait range");

    assert_validation_message(
        ActionConfig::RandomWait {
            min_ms: 0,
            max_ms: 750,
        }
        .validate()
        .expect_err("zero random wait minimum should fail"),
        "min_ms",
        "Minimum wait must be greater than 0",
    );

    assert_validation_message(
        ActionConfig::RandomWait {
            min_ms: 1000,
            max_ms: 500,
        }
        .validate()
        .expect_err("inverted random wait range should fail"),
        "max_ms",
        "Maximum wait must be greater than or equal to minimum",
    );
}

#[test]
fn workflow_graph_validation_accepts_a_single_start_with_valid_edges() {
    let graph = graph_with_nodes(
        vec![start_node(), action_node("wait")],
        vec![edge("start", "out", "wait", "in")],
    );

    let issues = graph.validation_issues();

    assert!(
        issues.is_empty(),
        "expected no graph issues, got {issues:?}"
    );
}

#[test]
fn workflow_graph_validation_rejects_missing_start_and_invalid_edge_ports() {
    let graph = graph_with_nodes(
        vec![action_node("wait")],
        vec![edge("missing", "out", "wait", "missing-in")],
    );

    let issues = graph.validation_issues();

    assert!(issues.iter().any(|issue| {
        issue.level == GraphValidationLevel::Error
            && issue.message == "Graph must contain exactly one start node"
    }));
    assert!(issues.iter().any(|issue| {
        issue.level == GraphValidationLevel::Error
            && issue.message.contains("source node does not exist")
    }));
    assert!(issues.iter().any(|issue| {
        issue.level == GraphValidationLevel::Error
            && issue.message.contains("target port does not exist")
    }));
}

#[test]
fn workflow_graph_validation_blocks_unbounded_loop_nodes() {
    let graph = graph_with_nodes(
        vec![start_node(), loop_node("loop")],
        vec![edge("start", "out", "loop", "in")],
    );

    let issues = graph.validation_issues();

    assert!(issues.iter().any(|issue| {
        issue.level == GraphValidationLevel::Error
            && issue.node_id.as_deref() == Some("loop")
            && issue.message.contains("max attempts or timeout")
    }));
}

#[test]
fn workflow_graph_validation_rejects_ambiguous_links() {
    let duplicate_a = GraphEdge {
        id: "duplicate-a".to_string(),
        ..edge("start", "out", "wait", "in")
    };
    let duplicate_b = GraphEdge {
        id: "duplicate-b".to_string(),
        ..edge("start", "out", "wait", "in")
    };
    let second_from_start = GraphEdge {
        id: "parallel-source".to_string(),
        ..edge("start", "out", "other", "in")
    };
    let second_into_wait = GraphEdge {
        id: "parallel-target".to_string(),
        ..edge("other", "out", "wait", "in")
    };
    let self_link = GraphEdge {
        id: "self-link".to_string(),
        ..edge("wait", "out", "wait", "in")
    };
    let graph = graph_with_nodes(
        vec![start_node(), action_node("wait"), action_node("other")],
        vec![
            duplicate_a,
            duplicate_b,
            second_from_start,
            second_into_wait,
            self_link,
        ],
    );

    let issues = graph.validation_issues();

    assert!(issues.iter().any(|issue| {
        issue.level == GraphValidationLevel::Error
            && issue.edge_id.as_deref() == Some("duplicate-b")
            && issue.message.contains("Duplicate edge")
    }));
    assert!(issues.iter().any(|issue| {
        issue.level == GraphValidationLevel::Error
            && issue.edge_id.as_deref() == Some("parallel-source")
            && issue
                .message
                .contains("Only one edge can leave an output port")
    }));
    assert!(issues.iter().any(|issue| {
        issue.level == GraphValidationLevel::Error
            && issue.edge_id.as_deref() == Some("parallel-target")
            && issue
                .message
                .contains("Only one edge can enter an input port")
    }));
    assert!(issues.iter().any(|issue| {
        issue.level == GraphValidationLevel::Error
            && issue.edge_id.as_deref() == Some("self-link")
            && issue.message.contains("Self-links are not allowed")
    }));
}

#[test]
fn workflow_graph_validation_blocks_unconfigured_actions_and_missing_required_body_ports() {
    let mut draft_action = action_node("draft");
    draft_action.label = "New node".to_string();
    draft_action.config = serde_json::Value::Null;
    let graph = graph_with_nodes(
        vec![
            start_node(),
            draft_action,
            repeat_times_node("repeat"),
            retry_node("retry"),
            try_catch_node("try-catch"),
            fallback_node("fallback"),
        ],
        vec![
            edge("start", "out", "draft", "in"),
            edge("draft", "out", "repeat", "in"),
            edge("repeat", "done", "retry", "in"),
            edge("retry", "success", "try-catch", "in"),
            edge("try-catch", "done", "fallback", "in"),
        ],
    );

    let issues = graph.validation_issues();

    for (node_id, message) in [
        ("draft", "Choose an action type before running this node"),
        ("repeat", "Repeat loop branch is required"),
        ("retry", "Retry try branch is required"),
        ("try-catch", "Try branch is required"),
        ("fallback", "Fallback primary branch is required"),
    ] {
        assert!(
            issues.iter().any(|issue| {
                issue.level == GraphValidationLevel::Error
                    && issue.node_id.as_deref() == Some(node_id)
                    && issue.message.contains(message)
            }),
            "missing issue for {node_id}: {issues:?}",
        );
    }
}

#[test]
fn workflow_graph_validation_blocks_loop_control_reachable_outside_loop_body() {
    let graph = graph_with_nodes(
        vec![start_node(), continue_loop_node("continue-loop")],
        vec![edge("start", "out", "continue-loop", "in")],
    );

    let issues = graph.validation_issues();

    assert!(issues.iter().any(|issue| {
        issue.level == GraphValidationLevel::Error
            && issue.node_id.as_deref() == Some("continue-loop")
            && issue
                .message
                .contains("Continue Loop can only be used inside a loop body")
    }));
}

#[test]
fn workflow_graph_validation_warns_for_optional_missing_ports() {
    let graph = graph_with_nodes(
        vec![
            start_node(),
            if_node("if-login"),
            retry_node("retry"),
            action_node("retry-work"),
        ],
        vec![
            edge("start", "out", "if-login", "in"),
            edge("if-login", "done", "retry", "in"),
            edge("retry", "try", "retry-work", "in"),
        ],
    );

    let issues = graph.validation_issues();

    assert!(issues.iter().any(|issue| {
        issue.level == GraphValidationLevel::Warning
            && issue.node_id.as_deref() == Some("if-login")
            && issue
                .message
                .contains("true branch is unconnected and will no-op")
    }));
    assert!(issues.iter().any(|issue| {
        issue.level == GraphValidationLevel::Warning
            && issue.node_id.as_deref() == Some("if-login")
            && issue
                .message
                .contains("false branch is unconnected and will no-op")
    }));
    assert!(issues.iter().any(|issue| {
        issue.level == GraphValidationLevel::Warning
            && issue.node_id.as_deref() == Some("retry")
            && issue
                .message
                .contains("retry failure will fail the workflow")
    }));
}

#[test]
fn workflow_graph_compiles_if_condition_to_nested_action_config() {
    let graph = graph_with_nodes(
        vec![
            start_node(),
            if_node("if-login"),
            action_node("then-wait"),
            action_node("else-wait"),
        ],
        vec![
            edge("start", "out", "if-login", "in"),
            edge("if-login", "true", "then-wait", "in"),
            edge("if-login", "false", "else-wait", "in"),
        ],
    );

    let compiled = graph.compile().expect("compile graph");

    assert_eq!(compiled.steps.len(), 1);
    match &compiled.steps[0].config {
        ActionConfig::IfCondition {
            condition,
            then_steps,
            else_steps,
        } => {
            assert_eq!(
                condition,
                &WorkflowCondition::OutputEquals {
                    name: "logged_in".to_string(),
                    value: "false".to_string(),
                }
            );
            assert_eq!(then_steps.len(), 1);
            assert_eq!(else_steps.len(), 1);
        }
        other => panic!("expected if condition, got {other:?}"),
    }
}

#[test]
fn workflow_graph_compiles_block_nodes_and_continues_through_done_ports() {
    let graph = graph_with_nodes(
        vec![
            start_node(),
            if_node("if-login"),
            action_node("then-wait"),
            action_node("after-if"),
            switch_node("switch-status"),
            action_node("case-wait"),
            action_node("after-switch"),
            try_catch_node("try-catch"),
            action_node("try-action"),
            action_node("after-try"),
        ],
        vec![
            edge("start", "out", "if-login", "in"),
            edge("if-login", "true", "then-wait", "in"),
            edge("if-login", "done", "after-if", "in"),
            edge("after-if", "out", "switch-status", "in"),
            edge("switch-status", "case_1", "case-wait", "in"),
            edge("switch-status", "done", "after-switch", "in"),
            edge("after-switch", "out", "try-catch", "in"),
            edge("try-catch", "try", "try-action", "in"),
            edge("try-catch", "done", "after-try", "in"),
        ],
    );

    let compiled = graph.compile().expect("compile graph");

    assert_eq!(
        compiled
            .steps
            .iter()
            .map(|step| step.node_id.as_str())
            .collect::<Vec<_>>(),
        vec![
            "if-login",
            "after-if",
            "switch-status",
            "after-switch",
            "try-catch",
            "after-try"
        ],
    );
    match &compiled.steps[0].config {
        ActionConfig::IfCondition {
            then_steps,
            else_steps,
            ..
        } => {
            assert_eq!(then_steps.len(), 1);
            assert!(else_steps.is_empty());
        }
        other => panic!("expected if condition, got {other:?}"),
    }
    match &compiled.steps[2].config {
        ActionConfig::SwitchCondition {
            cases,
            default_steps,
            ..
        } => {
            assert_eq!(cases[0].steps.len(), 1);
            assert!(default_steps.is_empty());
        }
        other => panic!("expected switch condition, got {other:?}"),
    }
    match &compiled.steps[4].config {
        ActionConfig::TryCatch {
            try_steps,
            success_steps,
            error_steps,
            finally_steps,
        } => {
            assert_eq!(try_steps.len(), 1);
            assert!(success_steps.is_empty());
            assert!(error_steps.is_empty());
            assert!(finally_steps.is_empty());
        }
        other => panic!("expected try catch, got {other:?}"),
    }
}

#[test]
fn workflow_graph_compiles_loop_and_retry_nodes_to_nested_action_configs() {
    let graph = graph_with_nodes(
        vec![
            start_node(),
            repeat_times_node("repeat"),
            action_node("loop-wait"),
            retry_node("retry"),
            action_node("retry-wait"),
            action_node("after-retry"),
        ],
        vec![
            edge("start", "out", "repeat", "in"),
            edge("repeat", "loop", "loop-wait", "in"),
            edge("repeat", "done", "retry", "in"),
            edge("retry", "try", "retry-wait", "in"),
            edge("retry", "success", "after-retry", "in"),
        ],
    );

    let compiled = graph.compile().expect("compile graph");

    assert_eq!(compiled.steps.len(), 3);
    assert!(matches!(
        compiled.steps[0].config,
        ActionConfig::RepeatTimes { times: 2, .. }
    ));
    assert!(matches!(
        compiled.steps[1].config,
        ActionConfig::RetryBlock {
            max_attempts: 3,
            ..
        }
    ));
    assert_eq!(compiled.steps[2].node_id, "after-retry");
}

#[test]
fn workflow_graph_compiles_repeat_for_each_loop_and_done_ports() {
    let graph = graph_with_nodes(
        vec![
            start_node(),
            repeat_for_each_node("each-item"),
            action_node("loop-wait"),
            action_node("after-loop"),
        ],
        vec![
            edge("start", "out", "each-item", "in"),
            edge("each-item", "loop", "loop-wait", "in"),
            edge("each-item", "done", "after-loop", "in"),
        ],
    );

    let compiled = graph.compile().expect("compile graph");

    assert_eq!(compiled.steps.len(), 2);
    match &compiled.steps[0].config {
        ActionConfig::RepeatForEach {
            item_name,
            array_variable,
            items,
            steps,
        } => {
            assert_eq!(item_name, "item");
            assert_eq!(array_variable, &None);
            assert_eq!(items, &vec!["a".to_string(), "b".to_string()]);
            assert_eq!(steps.len(), 1);
        }
        other => panic!("expected repeat for each, got {other:?}"),
    }
    assert_eq!(compiled.steps[1].node_id, "after-loop");
}

#[test]
fn workflow_graph_compiles_repeat_for_each_variable_array_source() {
    let mut repeat = repeat_for_each_node("each-role");
    repeat.config = serde_json::json!({
        "item_name": "role",
        "array_variable": "roles",
        "items": []
    });
    let graph = graph_with_nodes(
        vec![start_node(), repeat, action_node("loop-wait")],
        vec![
            edge("start", "out", "each-role", "in"),
            edge("each-role", "loop", "loop-wait", "in"),
        ],
    );

    let compiled = graph
        .compile()
        .expect("variable array repeat node should compile");

    match &compiled.steps[0].config {
        ActionConfig::RepeatForEach {
            item_name,
            array_variable,
            items,
            steps,
        } => {
            assert_eq!(item_name, "role");
            assert_eq!(array_variable.as_deref(), Some("roles"));
            assert!(items.is_empty());
            assert_eq!(steps.len(), 1);
        }
        other => panic!("expected repeat for each, got {other:?}"),
    }
}

#[test]
fn workflow_graph_compiles_multi_row_set_variable_node() {
    let mut variables = set_variable_node("set-vars");
    variables.label = "Set Variables".to_string();
    variables.config = serde_json::json!({
        "variables": [
            { "name": "user.name", "value_type": "text", "value": "Ada" },
            { "name": "roles", "value_type": "json", "value": "[\"admin\"]" }
        ]
    });
    let graph = graph_with_nodes(
        vec![start_node(), variables],
        vec![edge("start", "out", "set-vars", "in")],
    );

    let compiled = graph
        .compile()
        .expect("multi-row variable node should compile");

    match &compiled.steps[0].config {
        ActionConfig::SetVariable { variables, .. } => {
            assert_eq!(variables.len(), 2);
            assert_eq!(variables[0].name, "user.name");
            assert_eq!(variables[1].name, "roles");
        }
        other => panic!("expected set variable config, got {other:?}"),
    }
}

#[test]
fn workflow_graph_deserializes_and_compiles_set_json_variables_node() {
    let graph: WorkflowGraph = serde_json::from_value(serde_json::json!({
        "version": 1,
        "nodes": [
            {
                "id": "start",
                "node_type": "start",
                "label": "Start",
                "position": { "x": 0.0, "y": 0.0 },
                "config": {},
                "ports": [{ "id": "out", "label": "Out", "direction": "output" }]
            },
            {
                "id": "json-vars",
                "node_type": "set_json_variables",
                "label": "Set JSON Variables",
                "position": { "x": 200.0, "y": 0.0 },
                "config": { "json": "{\"user\":{\"name\":\"Ada\"},\"roles\":[\"admin\"]}" },
                "ports": [
                    { "id": "in", "label": "In", "direction": "input" },
                    { "id": "out", "label": "Out", "direction": "output" }
                ]
            }
        ],
        "edges": [
            {
                "id": "edge-start-json-vars",
                "source_node_id": "start",
                "source_port": "out",
                "target_node_id": "json-vars",
                "target_port": "in",
                "label": "next"
            }
        ],
        "viewport": { "x": 0.0, "y": 0.0, "zoom": 1.0 }
    }))
    .expect("set_json_variables graph node should deserialize");

    let compiled = graph
        .compile()
        .expect("set JSON variables node should compile");

    assert_eq!(
        compiled.steps[0].config.action_type().as_str(),
        "set_json_variables"
    );
}

#[test]
fn advanced_graph_action_configs_validate_and_round_trip() {
    let nested_step = ActionConfig::SetVariable {
        name: Some("status".to_string()),
        value: Some("ready".to_string()),
        value_type: None,
        variables: Vec::new(),
    };
    let configs = [
        ActionConfig::SwitchCondition {
            expression: "status".to_string(),
            cases: vec![SwitchCase {
                value: "ready".to_string(),
                steps: vec![nested_step.clone()],
            }],
            default_steps: vec![ActionConfig::StopWorkflow {
                status: workflow_automation_manager_lib::domain::StopWorkflowStatus::Failure,
                reason: Some("unknown status".to_string()),
                close_browser: false,
            }],
        },
        ActionConfig::WhileLoop {
            condition: WorkflowCondition::OutputEquals {
                name: "keep_running".to_string(),
                value: "true".to_string(),
            },
            max_attempts: Some(3),
            timeout_ms: None,
            steps: vec![nested_step.clone()],
        },
        ActionConfig::RepeatUntil {
            condition: WorkflowCondition::OutputEquals {
                name: "done".to_string(),
                value: "true".to_string(),
            },
            max_attempts: Some(3),
            timeout_ms: None,
            steps: vec![nested_step.clone()],
            timeout_steps: vec![ActionConfig::StopWorkflow {
                status: workflow_automation_manager_lib::domain::StopWorkflowStatus::Failure,
                reason: Some("condition timed out".to_string()),
                close_browser: false,
            }],
        },
        ActionConfig::TryCatch {
            try_steps: vec![nested_step.clone()],
            success_steps: vec![nested_step.clone()],
            error_steps: vec![nested_step.clone()],
            finally_steps: vec![nested_step.clone()],
        },
        ActionConfig::FallbackBlock {
            primary_steps: vec![nested_step.clone()],
            fallback_steps: vec![nested_step.clone()],
        },
        ActionConfig::BreakLoop {},
        ActionConfig::ContinueLoop {},
        ActionConfig::TransformVariable {
            source_name: "status".to_string(),
            target_name: "status_label".to_string(),
            expression: "String(value).toUpperCase()".to_string(),
        },
        ActionConfig::AssertOutput {
            name: "status".to_string(),
            match_mode: AssertOutputMatchMode::Equals,
            value: "ready".to_string(),
        },
        ActionConfig::RunSubworkflow {
            workflow_id: "child-workflow".to_string(),
            input_mapping: vec![VariableMapping {
                source: "parent_value".to_string(),
                target: "child_value".to_string(),
            }],
            output_mapping: vec![VariableMapping {
                source: "child_result".to_string(),
                target: "parent_result".to_string(),
            }],
        },
        ActionConfig::DomainAllowlist {
            domains: vec!["example.com".to_string(), "*.example.org".to_string()],
        },
    ];

    for config in configs {
        config.validate().expect("advanced config should be valid");
        let json = serde_json::to_string(&config).expect("serialize config");
        let decoded: ActionConfig = serde_json::from_str(&json).expect("deserialize config");

        assert_eq!(decoded, config);
    }
}

#[test]
fn workflow_graph_compiles_switch_and_data_nodes_to_executable_configs() {
    let graph = graph_with_nodes(
        vec![
            start_node(),
            switch_node("switch-status"),
            set_variable_node("ready"),
            domain_allowlist_node("allow-domain"),
            transform_variable_node("transform-status"),
            assert_output_node("assert-status"),
            action_node("default-wait"),
        ],
        vec![
            edge("start", "out", "switch-status", "in"),
            edge("switch-status", "case_1", "ready", "in"),
            edge("ready", "out", "allow-domain", "in"),
            edge("allow-domain", "out", "transform-status", "in"),
            edge("transform-status", "out", "assert-status", "in"),
            edge("switch-status", "default", "default-wait", "in"),
        ],
    );

    let compiled = graph.compile().expect("advanced graph should compile");

    assert_eq!(compiled.steps.len(), 1);
    match &compiled.steps[0].config {
        ActionConfig::SwitchCondition {
            expression,
            cases,
            default_steps,
        } => {
            assert_eq!(expression, "status");
            assert_eq!(cases.len(), 1);
            assert_eq!(cases[0].value, "ready");
            assert!(matches!(
                cases[0].steps[0],
                ActionConfig::SetVariable { .. }
            ));
            assert!(matches!(
                cases[0].steps[1],
                ActionConfig::DomainAllowlist { .. }
            ));
            assert!(matches!(
                cases[0].steps[2],
                ActionConfig::TransformVariable { .. }
            ));
            assert!(matches!(
                cases[0].steps[3],
                ActionConfig::AssertOutput { .. }
            ));
            assert_eq!(default_steps.len(), 1);
        }
        other => panic!("expected switch condition, got {other:?}"),
    }
}

#[test]
fn workflow_graph_compiles_loop_error_and_control_nodes_to_executable_configs() {
    let graph = graph_with_nodes(
        vec![
            start_node(),
            while_node("while-login"),
            action_node("while-action"),
            continue_loop_node("continue-loop"),
            repeat_until_node("repeat-until"),
            action_node("repeat-action"),
            break_loop_node("break-loop"),
            action_node("timeout-action"),
            try_catch_node("try-catch"),
            action_node("try-action"),
            fallback_node("fallback"),
            action_node("primary-action"),
            action_node("fallback-action"),
            stop_workflow_node("stop-success"),
        ],
        vec![
            edge("start", "out", "while-login", "in"),
            edge("while-login", "loop", "while-action", "in"),
            edge("while-action", "out", "continue-loop", "in"),
            edge("while-login", "done", "repeat-until", "in"),
            edge("repeat-until", "loop", "repeat-action", "in"),
            edge("repeat-action", "out", "break-loop", "in"),
            edge("repeat-until", "timeout", "timeout-action", "in"),
            edge("repeat-until", "done", "try-catch", "in"),
            edge("try-catch", "try", "try-action", "in"),
            edge("try-catch", "success", "fallback", "in"),
            edge("fallback", "primary", "primary-action", "in"),
            edge("fallback", "fallback", "fallback-action", "in"),
            edge("fallback", "done", "stop-success", "in"),
        ],
    );

    let compiled = graph
        .compile()
        .expect("advanced control graph should compile");

    assert_eq!(compiled.steps.len(), 3);
    assert!(matches!(
        compiled.steps[0].config,
        ActionConfig::WhileLoop { .. }
    ));
    assert!(matches!(
        compiled.steps[1].config,
        ActionConfig::RepeatUntil { .. }
    ));
    match &compiled.steps[2].config {
        ActionConfig::TryCatch { success_steps, .. } => {
            assert!(matches!(
                success_steps[0],
                ActionConfig::FallbackBlock { .. }
            ));
            assert!(matches!(
                success_steps[1],
                ActionConfig::StopWorkflow { .. }
            ));
        }
        other => panic!("expected try catch, got {other:?}"),
    }
}

#[test]
fn action_config_validation_covers_required_fields() {
    assert_validation_message(
        ActionConfig::Click {
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
        }
        .validate()
        .expect_err("blank XPath should fail"),
        "xpath",
        "XPath is required",
    );

    assert_validation_message(
        ActionConfig::Scroll {
            mode: None,
            direction: ScrollDirection::Down,
            pixels: 0,
            xpath: None,
            iframe_xpath: None,
            behavior: None,
            block: None,
            inline: None,
            max_attempts: None,
            wait_ms: None,
        }
        .validate()
        .expect_err("zero pixels should fail"),
        "pixels",
        "Pixels must be greater than 0",
    );
}

#[test]
fn valid_action_configs_pass_validation() {
    let configs = [
        ActionConfig::Navigate {
            url: "https://example.com".to_string(),
            wait_until: None,
            timeout_ms: None,
        },
        ActionConfig::Wait {
            condition: WaitCondition::Duration,
            xpath: None,
            text: None,
            url: None,
            duration_ms: Some(1500),
            timeout_ms: None,
        },
        ActionConfig::InputText {
            xpath: "//*[@name=\"email\"]".to_string(),
            iframe_xpath: None,
            text: "user@example.com".to_string(),
            clear_before_input: true,
            typing_mode: Some(InputTypingMode::SetValue),
            delay_ms: None,
            wait_until: None,
            timeout_ms: None,
        },
        ActionConfig::Click {
            xpath: "//*[@type=\"submit\"]".to_string(),
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
        ActionConfig::Scroll {
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
    ];

    for config in configs {
        config.validate().expect("config should be valid");
    }
}

#[test]
fn every_action_config_round_trips_through_json() {
    let configs = [
        ActionConfig::Navigate {
            url: "https://example.com".to_string(),
            wait_until: None,
            timeout_ms: None,
        },
        ActionConfig::Wait {
            condition: WaitCondition::Duration,
            xpath: None,
            text: None,
            url: None,
            duration_ms: Some(2000),
            timeout_ms: None,
        },
        ActionConfig::InputText {
            xpath: "//*[@name=\"email\"]".to_string(),
            iframe_xpath: None,
            text: "user@example.com".to_string(),
            clear_before_input: true,
            typing_mode: Some(InputTypingMode::SetValue),
            delay_ms: None,
            wait_until: None,
            timeout_ms: None,
        },
        ActionConfig::Click {
            xpath: "//*[@type=\"submit\"]".to_string(),
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
        ActionConfig::Scroll {
            mode: None,
            direction: ScrollDirection::Up,
            pixels: 300,
            xpath: None,
            iframe_xpath: None,
            behavior: None,
            block: None,
            inline: None,
            max_attempts: None,
            wait_ms: None,
        },
    ];

    for config in configs {
        let json = serde_json::to_string(&config).expect("serialize config");
        let decoded: ActionConfig = serde_json::from_str(&json).expect("deserialize config");

        assert_eq!(decoded, config);
    }
}

#[test]
fn user_action_taxonomy_configs_validate_and_round_trip() {
    let configs = [
        ActionConfig::Navigate {
            url: "https://example.com".to_string(),
            wait_until: None,
            timeout_ms: Some(5000),
        },
        ActionConfig::InputText {
            xpath: "//*[@name=\"email\"]".to_string(),
            iframe_xpath: None,
            text: "user@example.com".to_string(),
            clear_before_input: true,
            typing_mode: Some(InputTypingMode::SetValue),
            delay_ms: None,
            wait_until: None,
            timeout_ms: None,
        },
        ActionConfig::ClearInput {
            xpath: "//*[@name=\"email\"]".to_string(),
            iframe_xpath: None,
            method: Some(ClearInputMethod::SelectAll),
            wait_until: None,
            timeout_ms: None,
        },
        ActionConfig::Wait {
            condition: WaitCondition::ElementVisible,
            xpath: Some("//*[@id=\"ready\"]".to_string()),
            text: None,
            url: None,
            duration_ms: None,
            timeout_ms: Some(3000),
        },
        ActionConfig::SelectOption {
            xpath: "//*[@name=\"country\"]".to_string(),
            iframe_xpath: None,
            match_by: SelectOptionMatchBy::Label,
            value: "Vietnam".to_string(),
            wait_until: None,
            timeout_ms: None,
        },
        ActionConfig::SetCheckbox {
            xpath: "//*[@name=\"terms\"]".to_string(),
            iframe_xpath: None,
            state: CheckboxState::Checked,
            wait_until: None,
            timeout_ms: None,
        },
        ActionConfig::PressKey {
            key: "Enter".to_string(),
        },
        ActionConfig::Hotkey {
            keys: vec!["Control".to_string(), "S".to_string()],
        },
        ActionConfig::Hover {
            xpath: "//*[@id=\"menu\"]".to_string(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: None,
        },
    ];

    for config in configs {
        config
            .validate()
            .expect("new taxonomy config should be valid");
        let json = serde_json::to_string(&config).expect("serialize config");
        let decoded: ActionConfig = serde_json::from_str(&json).expect("deserialize config");

        assert_eq!(decoded, config);
    }
}

#[test]
fn phase_four_data_capture_configs_validate_and_round_trip() {
    let configs = [
        ActionConfig::ExtractText {
            xpath: "//*[@id=\"title\"]".to_string(),
            iframe_xpath: None,
            output_name: "title".to_string(),
            timeout_ms: Some(3000),
        },
        ActionConfig::ExtractAttribute {
            xpath: "//*[@id=\"link\"]".to_string(),
            iframe_xpath: None,
            attribute: "href".to_string(),
            output_name: "link_href".to_string(),
            timeout_ms: Some(3000),
        },
        ActionConfig::ExtractInputValue {
            xpath: "//*[@id=\"email\"]".to_string(),
            iframe_xpath: None,
            output_name: "email".to_string(),
            timeout_ms: Some(3000),
        },
        ActionConfig::ExtractTable {
            xpath: "//*[@id=\"orders\"]".to_string(),
            iframe_xpath: None,
            output_name: "orders".to_string(),
            timeout_ms: Some(3000),
        },
        ActionConfig::ExtractList {
            xpath: "//*[@id=\"items\"]".to_string(),
            iframe_xpath: None,
            output_name: "items".to_string(),
            timeout_ms: Some(3000),
        },
        ActionConfig::TakeScreenshot {
            path: "/tmp/wam-phase-four.png".to_string(),
            output_name: Some("screenshot_path".to_string()),
            full_page: true,
        },
    ];

    for config in configs {
        config.validate().expect("config should be valid");
        let json = serde_json::to_string(&config).expect("serialize config");
        let decoded: ActionConfig = serde_json::from_str(&json).expect("deserialize config");

        assert_eq!(decoded, config);
    }
}

#[test]
fn phase_four_data_capture_configs_validate_required_fields() {
    assert_validation_message(
        ActionConfig::ExtractText {
            xpath: String::new(),
            iframe_xpath: None,
            output_name: "title".to_string(),
            timeout_ms: None,
        }
        .validate()
        .expect_err("blank XPath should fail"),
        "xpath",
        "XPath is required",
    );

    assert_validation_message(
        ActionConfig::ExtractAttribute {
            xpath: "//*[@id=\"link\"]".to_string(),
            iframe_xpath: None,
            attribute: String::new(),
            output_name: "link_href".to_string(),
            timeout_ms: None,
        }
        .validate()
        .expect_err("blank attribute should fail"),
        "attribute",
        "Attribute is required",
    );

    assert_validation_message(
        ActionConfig::ExtractList {
            xpath: "//*[@id=\"items\"]".to_string(),
            iframe_xpath: None,
            output_name: String::new(),
            timeout_ms: None,
        }
        .validate()
        .expect_err("blank output name should fail"),
        "output_name",
        "Output name is required",
    );

    assert_validation_message(
        ActionConfig::TakeScreenshot {
            path: String::new(),
            output_name: Some("screenshot_path".to_string()),
            full_page: false,
        }
        .validate()
        .expect_err("blank screenshot path should fail"),
        "path",
        "Screenshot path is required",
    );
}

#[test]
fn phase_three_browser_context_configs_validate_and_round_trip() {
    let configs = [
        ActionConfig::GoBack {},
        ActionConfig::GoForward {},
        ActionConfig::Reload {},
        ActionConfig::OpenNewTab {
            url: Some("https://example.com".to_string()),
        },
        ActionConfig::SwitchTab { index: 1 },
        ActionConfig::CloseTab { index: Some(1) },
    ];

    for config in configs {
        config.validate().expect("config should be valid");
        let json = serde_json::to_string(&config).expect("serialize config");
        let decoded: ActionConfig = serde_json::from_str(&json).expect("deserialize config");

        assert_eq!(decoded, config);
    }
}

#[test]
fn phase_three_browser_context_configs_validate_required_fields() {
    assert_validation_message(
        ActionConfig::OpenNewTab {
            url: Some(" ".to_string()),
        }
        .validate()
        .expect_err("blank tab URL should fail"),
        "url",
        "URL is required",
    );
}

#[test]
fn phase_three_frame_dialog_download_configs_validate_and_round_trip() {
    let configs = [
        ActionConfig::SwitchFrame {
            xpath: Some("//*[@id=\"checkout-frame\"]".to_string()),
        },
        ActionConfig::SwitchFrame { xpath: None },
        ActionConfig::AcceptDialog {
            prompt_text: Some("approved".to_string()),
        },
        ActionConfig::DismissDialog {},
        ActionConfig::SetDownloadDirectory {
            path: "/tmp/wam-downloads".to_string(),
        },
        ActionConfig::WaitForDownload {
            output_name: "download_path".to_string(),
            timeout_ms: Some(3000),
        },
    ];

    for config in configs {
        config.validate().expect("config should be valid");
        let json = serde_json::to_string(&config).expect("serialize config");
        let decoded: ActionConfig = serde_json::from_str(&json).expect("deserialize config");

        assert_eq!(decoded, config);
    }
}

#[test]
fn phase_three_frame_dialog_download_configs_validate_required_fields() {
    assert_validation_message(
        ActionConfig::SwitchFrame {
            xpath: Some(" ".to_string()),
        }
        .validate()
        .expect_err("blank frame XPath should fail"),
        "xpath",
        "XPath is required",
    );

    assert_validation_message(
        ActionConfig::SetDownloadDirectory {
            path: String::new(),
        }
        .validate()
        .expect_err("blank download directory should fail"),
        "path",
        "Download directory is required",
    );

    assert_validation_message(
        ActionConfig::WaitForDownload {
            output_name: String::new(),
            timeout_ms: Some(3000),
        }
        .validate()
        .expect_err("blank output name should fail"),
        "output_name",
        "Output name is required",
    );
}

#[test]
fn phase_five_logic_configs_validate_and_round_trip() {
    let nested_step = ActionConfig::SetVariable {
        name: Some("status".to_string()),
        value: Some("ready".to_string()),
        value_type: None,
        variables: Vec::new(),
    };
    let configs = [
        ActionConfig::SetVariable {
            name: Some("customer".to_string()),
            value: Some("Ada".to_string()),
            value_type: None,
            variables: Vec::new(),
        },
        ActionConfig::AssertElement {
            xpath: "//*[@id=\"submit\"]".to_string(),
            iframe_xpath: None,
            state: workflow_automation_manager_lib::domain::AssertElementState::Visible,
            timeout_ms: Some(3000),
        },
        ActionConfig::AssertText {
            xpath: Some("//*[@id=\"message\"]".to_string()),
            iframe_xpath: None,
            text: "Saved".to_string(),
            match_mode: workflow_automation_manager_lib::domain::AssertTextMatchMode::Contains,
            timeout_ms: Some(3000),
        },
        ActionConfig::IfCondition {
            condition: workflow_automation_manager_lib::domain::WorkflowCondition::OutputEquals {
                name: "status".to_string(),
                value: "ready".to_string(),
            },
            then_steps: vec![nested_step.clone()],
            else_steps: vec![],
        },
        ActionConfig::RepeatTimes {
            times: 2,
            steps: vec![nested_step.clone()],
        },
        ActionConfig::RepeatForEach {
            item_name: "item".to_string(),
            array_variable: None,
            items: vec!["one".to_string(), "two".to_string()],
            steps: vec![nested_step.clone()],
        },
        ActionConfig::RetryBlock {
            max_attempts: 3,
            delay_ms: Some(100),
            steps: vec![nested_step.clone()],
            failed_steps: Vec::new(),
        },
        ActionConfig::StopWorkflow {
            status: workflow_automation_manager_lib::domain::StopWorkflowStatus::Success,
            reason: Some("done".to_string()),
            close_browser: false,
        },
    ];

    for config in configs {
        config.validate().expect("config should be valid");
        let json = serde_json::to_string(&config).expect("serialize config");
        let decoded: ActionConfig = serde_json::from_str(&json).expect("deserialize config");

        assert_eq!(decoded, config);
    }
}

#[test]
fn phase_five_logic_configs_validate_required_fields() {
    assert_validation_message(
        ActionConfig::SetVariable {
            name: Some(String::new()),
            value: Some("Ada".to_string()),
            value_type: None,
            variables: Vec::new(),
        }
        .validate()
        .expect_err("blank variable name should fail"),
        "name",
        "Variable name is required",
    );

    assert_validation_message(
        ActionConfig::AssertText {
            xpath: None,
            iframe_xpath: None,
            text: String::new(),
            match_mode: workflow_automation_manager_lib::domain::AssertTextMatchMode::Contains,
            timeout_ms: Some(3000),
        }
        .validate()
        .expect_err("blank assert text should fail"),
        "text",
        "Expected text is required",
    );

    assert_validation_message(
        ActionConfig::AssertElement {
            xpath: String::new(),
            iframe_xpath: None,
            state: workflow_automation_manager_lib::domain::AssertElementState::Visible,
            timeout_ms: Some(3000),
        }
        .validate()
        .expect_err("blank assert element xpath should fail"),
        "xpath",
        "XPath is required",
    );

    assert_validation_message(
        ActionConfig::RepeatTimes {
            times: 0,
            steps: vec![],
        }
        .validate()
        .expect_err("zero repeat count should fail"),
        "times",
        "Repeat count must be greater than 0",
    );

    assert_validation_message(
        ActionConfig::RetryBlock {
            max_attempts: 0,
            delay_ms: Some(100),
            steps: vec![],
            failed_steps: Vec::new(),
        }
        .validate()
        .expect_err("zero retry attempts should fail"),
        "max_attempts",
        "Max attempts must be greater than 0",
    );
}

#[test]
fn phase_six_session_profile_secret_configs_validate_and_round_trip() {
    let configs = [
        ActionConfig::UseProfile {
            name: "account-a".to_string(),
        },
        ActionConfig::SaveSession {
            path: "/tmp/session.json".to_string(),
        },
        ActionConfig::LoadSession {
            path: "/tmp/session.json".to_string(),
        },
        ActionConfig::SetCookie {
            name: "token".to_string(),
            value: "abc".to_string(),
            domain: None,
            path: Some("/".to_string()),
        },
        ActionConfig::ClearCookies { domain: None },
        ActionConfig::SetSecret {
            name: "password".to_string(),
            value: "secret".to_string(),
        },
    ];

    for config in configs {
        config.validate().expect("config should be valid");
        let json = serde_json::to_string(&config).expect("serialize config");
        let decoded: ActionConfig = serde_json::from_str(&json).expect("deserialize config");

        assert_eq!(decoded, config);
    }
}

#[test]
fn phase_six_session_profile_secret_configs_validate_required_fields() {
    assert_validation_message(
        ActionConfig::UseProfile {
            name: String::new(),
        }
        .validate()
        .expect_err("blank profile should fail"),
        "name",
        "Profile name is required",
    );

    assert_validation_message(
        ActionConfig::SaveSession {
            path: String::new(),
        }
        .validate()
        .expect_err("blank save session path should fail"),
        "path",
        "Session path is required",
    );

    assert_validation_message(
        ActionConfig::SetCookie {
            name: String::new(),
            value: "abc".to_string(),
            domain: None,
            path: None,
        }
        .validate()
        .expect_err("blank cookie name should fail"),
        "name",
        "Cookie name is required",
    );

    assert_validation_message(
        ActionConfig::SetSecret {
            name: "password".to_string(),
            value: String::new(),
        }
        .validate()
        .expect_err("blank secret value should fail"),
        "value",
        "Secret value is required",
    );
}

#[test]
fn phase_seven_network_device_configs_validate_and_round_trip() {
    let configs = [
        ActionConfig::UseProxy {
            server: "http://127.0.0.1:8080".to_string(),
            username: Some("agent".to_string()),
            password: Some("secret".to_string()),
        },
        ActionConfig::SetUserAgent {
            user_agent: "WAMPhaseSeven/1.0".to_string(),
        },
        ActionConfig::SetViewport {
            width: 390,
            height: 844,
            device_scale_factor: Some(2.0),
            mobile: true,
            touch: true,
        },
        ActionConfig::SetGeolocation {
            latitude: 10.77,
            longitude: 106.70,
            accuracy: Some(15.0),
        },
        ActionConfig::SetExtraHeaders {
            headers: vec![HeaderPair {
                name: "X-WAM-Phase".to_string(),
                value: "seven".to_string(),
            }],
        },
        ActionConfig::GrantPermission {
            origin: Some("http://127.0.0.1:3000".to_string()),
            permissions: vec!["geolocation".to_string()],
        },
    ];

    for config in configs {
        config.validate().expect("config should be valid");
        let json = serde_json::to_string(&config).expect("serialize config");
        let decoded: ActionConfig = serde_json::from_str(&json).expect("deserialize config");

        assert_eq!(decoded, config);
    }
}

#[test]
fn phase_seven_network_device_configs_validate_required_fields() {
    assert_validation_message(
        ActionConfig::UseProxy {
            server: String::new(),
            username: None,
            password: None,
        }
        .validate()
        .expect_err("blank proxy server should fail"),
        "server",
        "Proxy server is required",
    );

    assert_validation_message(
        ActionConfig::SetUserAgent {
            user_agent: String::new(),
        }
        .validate()
        .expect_err("blank user agent should fail"),
        "user_agent",
        "User agent is required",
    );

    assert_validation_message(
        ActionConfig::SetViewport {
            width: 0,
            height: 844,
            device_scale_factor: Some(1.0),
            mobile: false,
            touch: false,
        }
        .validate()
        .expect_err("zero viewport width should fail"),
        "width",
        "Viewport width must be greater than 0",
    );

    assert_validation_message(
        ActionConfig::SetGeolocation {
            latitude: 91.0,
            longitude: 106.70,
            accuracy: Some(15.0),
        }
        .validate()
        .expect_err("invalid latitude should fail"),
        "latitude",
        "Latitude must be between -90 and 90",
    );

    assert_validation_message(
        ActionConfig::SetExtraHeaders { headers: vec![] }
            .validate()
            .expect_err("empty headers should fail"),
        "headers",
        "At least one header is required",
    );

    assert_validation_message(
        ActionConfig::GrantPermission {
            origin: None,
            permissions: vec![],
        }
        .validate()
        .expect_err("empty permissions should fail"),
        "permissions",
        "At least one permission is required",
    );
}

#[test]
fn phase_eight_human_verification_configs_validate_and_round_trip() {
    let configs = [
        ActionConfig::DetectChallenge {
            output_name: "challenge_found".to_string(),
            patterns: vec!["captcha".to_string(), "verify you are human".to_string()],
            timeout_ms: Some(1000),
        },
        ActionConfig::PauseForHuman {
            reason: "Solve the visible challenge".to_string(),
            timeout_ms: Some(1000),
        },
        ActionConfig::ResumeWhenCondition {
            condition: WorkflowCondition::ElementVisible {
                xpath: "//*[@id='content']".to_string(),
            },
            timeout_ms: Some(5000),
        },
    ];

    for config in configs {
        config.validate().expect("config should be valid");
        let json = serde_json::to_string(&config).expect("serialize config");
        let decoded: ActionConfig = serde_json::from_str(&json).expect("deserialize config");

        assert_eq!(decoded, config);
    }
}

#[test]
fn phase_eight_human_verification_configs_validate_required_fields() {
    assert_validation_message(
        ActionConfig::DetectChallenge {
            output_name: String::new(),
            patterns: vec!["captcha".to_string()],
            timeout_ms: Some(1000),
        }
        .validate()
        .expect_err("blank challenge output should fail"),
        "output_name",
        "Output name is required",
    );

    assert_validation_message(
        ActionConfig::DetectChallenge {
            output_name: "challenge_found".to_string(),
            patterns: vec![],
            timeout_ms: Some(1000),
        }
        .validate()
        .expect_err("empty challenge patterns should fail"),
        "patterns",
        "At least one challenge pattern is required",
    );

    assert_validation_message(
        ActionConfig::PauseForHuman {
            reason: String::new(),
            timeout_ms: Some(1000),
        }
        .validate()
        .expect_err("blank pause reason should fail"),
        "reason",
        "Pause reason is required",
    );

    assert_validation_message(
        ActionConfig::ResumeWhenCondition {
            condition: WorkflowCondition::TextVisible {
                text: String::new(),
            },
            timeout_ms: Some(1000),
        }
        .validate()
        .expect_err("invalid resume condition should fail"),
        "text",
        "Condition text is required",
    );
}

#[test]
fn phase_nine_reliability_configs_validate_and_round_trip() {
    let configs = [
        ActionConfig::FallbackSelector {
            output_name: "target_xpath".to_string(),
            xpaths: vec![
                "//*[@data-testid='save']".to_string(),
                "//*[@id='save']".to_string(),
            ],
            timeout_ms: Some(1000),
        },
        ActionConfig::RetryStep {
            max_attempts: 3,
            delay_ms: Some(100),
            step: Box::new(ActionConfig::AssertText {
                xpath: Some("//*[@id='status']".to_string()),
                iframe_xpath: None,
                text: "Ready".to_string(),
                match_mode: AssertTextMatchMode::Contains,
                timeout_ms: Some(500),
            }),
        },
        ActionConfig::Checkpoint {
            name: "after_login".to_string(),
            screenshot_path: Some("/tmp/after-login.png".to_string()),
        },
    ];

    for config in configs {
        config.validate().expect("config should be valid");
        let json = serde_json::to_string(&config).expect("serialize config");
        let decoded: ActionConfig = serde_json::from_str(&json).expect("deserialize config");

        assert_eq!(decoded, config);
    }
}

#[test]
fn phase_nine_reliability_configs_validate_required_fields() {
    assert_validation_message(
        ActionConfig::FallbackSelector {
            output_name: String::new(),
            xpaths: vec!["//*[@id='save']".to_string()],
            timeout_ms: Some(1000),
        }
        .validate()
        .expect_err("blank fallback output should fail"),
        "output_name",
        "Output name is required",
    );

    assert_validation_message(
        ActionConfig::FallbackSelector {
            output_name: "target_xpath".to_string(),
            xpaths: vec![],
            timeout_ms: Some(1000),
        }
        .validate()
        .expect_err("empty fallback selectors should fail"),
        "xpaths",
        "At least one fallback XPath is required",
    );

    assert_validation_message(
        ActionConfig::RetryStep {
            max_attempts: 0,
            delay_ms: None,
            step: Box::new(ActionConfig::Wait {
                condition: WaitCondition::Duration,
                xpath: None,
                text: None,
                url: None,
                duration_ms: Some(100),
                timeout_ms: None,
            }),
        }
        .validate()
        .expect_err("zero retry step attempts should fail"),
        "max_attempts",
        "Max attempts must be greater than 0",
    );

    assert_validation_message(
        ActionConfig::Checkpoint {
            name: String::new(),
            screenshot_path: None,
        }
        .validate()
        .expect_err("blank checkpoint name should fail"),
        "name",
        "Checkpoint name is required",
    );
}

#[test]
fn phase_eleven_advanced_runtime_configs_validate_and_round_trip() {
    let configs = vec![
        ActionConfig::ExecuteJs {
            script: "return document.title".to_string(),
            output_name: Some("title".to_string()),
            timeout_ms: Some(1000),
        },
        ActionConfig::WaitForRequest {
            url_contains: "/api/orders".to_string(),
            timeout_ms: Some(1000),
        },
        ActionConfig::WaitForResponse {
            url_contains: "/api/orders".to_string(),
            status: Some(200),
            timeout_ms: Some(1000),
        },
        ActionConfig::BlockRequest {
            url_patterns: vec!["analytics".to_string()],
        },
        ActionConfig::MockResponse {
            url_contains: "/api/profile".to_string(),
            status: 200,
            body: "{\"ok\":true}".to_string(),
            content_type: Some("application/json".to_string()),
        },
        ActionConfig::SetLocalStorage {
            key: "token".to_string(),
            value: "local".to_string(),
        },
        ActionConfig::SetSessionStorage {
            key: "token".to_string(),
            value: "session".to_string(),
        },
    ];

    for config in configs {
        config.validate().expect("phase eleven config is valid");
        let json = serde_json::to_string(&config).expect("serialize phase eleven config");
        let decoded: ActionConfig =
            serde_json::from_str(&json).expect("deserialize phase eleven config");
        assert_eq!(decoded, config);
    }
}

#[test]
fn phase_eleven_advanced_runtime_configs_validate_required_fields() {
    assert_eq!(
        ActionConfig::ExecuteJs {
            script: " ".to_string(),
            output_name: None,
            timeout_ms: None,
        }
        .validate()
        .expect_err("blank script rejected")
        .field,
        "script"
    );
    assert_eq!(
        ActionConfig::WaitForRequest {
            url_contains: String::new(),
            timeout_ms: None,
        }
        .validate()
        .expect_err("blank request matcher rejected")
        .field,
        "url_contains"
    );
    assert_eq!(
        ActionConfig::MockResponse {
            url_contains: "/api".to_string(),
            status: 0,
            body: String::new(),
            content_type: None,
        }
        .validate()
        .expect_err("bad status rejected")
        .field,
        "status"
    );
    assert_eq!(
        ActionConfig::SetLocalStorage {
            key: String::new(),
            value: "value".to_string(),
        }
        .validate()
        .expect_err("blank storage key rejected")
        .field,
        "key"
    );
}

#[test]
fn user_action_taxonomy_configs_validate_required_fields() {
    assert_validation_message(
        ActionConfig::Navigate {
            url: " ".to_string(),
            wait_until: None,
            timeout_ms: None,
        }
        .validate()
        .expect_err("blank URL should fail"),
        "url",
        "URL is required",
    );

    assert_validation_message(
        ActionConfig::Wait {
            condition: WaitCondition::Duration,
            xpath: None,
            text: None,
            url: None,
            duration_ms: Some(0),
            timeout_ms: None,
        }
        .validate()
        .expect_err("zero duration should fail"),
        "duration_ms",
        "Duration must be greater than 0",
    );

    assert_validation_message(
        ActionConfig::Wait {
            condition: WaitCondition::ElementVisible,
            xpath: None,
            text: None,
            url: None,
            duration_ms: None,
            timeout_ms: None,
        }
        .validate()
        .expect_err("element wait without XPath should fail"),
        "xpath",
        "XPath is required",
    );

    assert_validation_message(
        ActionConfig::SelectOption {
            xpath: "//*[@name=\"country\"]".to_string(),
            iframe_xpath: None,
            match_by: SelectOptionMatchBy::Label,
            value: " ".to_string(),
            wait_until: None,
            timeout_ms: None,
        }
        .validate()
        .expect_err("blank select option value should fail"),
        "value",
        "Option value is required",
    );

    assert_validation_message(
        ActionConfig::Hotkey { keys: vec![] }
            .validate()
            .expect_err("empty hotkey should fail"),
        "keys",
        "At least one key is required",
    );
}

#[test]
fn new_action_types_have_default_configs() {
    assert_eq!(
        default_config(ActionType::Navigate),
        ActionConfig::Navigate {
            url: String::new(),
            wait_until: None,
            timeout_ms: None,
        }
    );
    assert_eq!(
        default_config(ActionType::Wait),
        ActionConfig::Wait {
            condition: WaitCondition::Duration,
            xpath: None,
            text: None,
            url: None,
            duration_ms: Some(1000),
            timeout_ms: None,
        }
    );
    assert_eq!(
        default_config(ActionType::SetCheckbox).action_type(),
        ActionType::SetCheckbox
    );
    assert_eq!(
        default_config(ActionType::Hotkey).action_type(),
        ActionType::Hotkey
    );
}

#[test]
fn phase_one_human_interaction_configs_validate_and_round_trip() {
    let configs = [
        ActionConfig::DoubleClick {
            xpath: "//*[@id=\"item\"]".to_string(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: Some(3000),
        },
        ActionConfig::RightClick {
            xpath: "//*[@id=\"menu-target\"]".to_string(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: Some(3000),
        },
        ActionConfig::DragAndDrop {
            source_xpath: "//*[@id=\"source\"]".to_string(),
            target_xpath: "//*[@id=\"target\"]".to_string(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: Some(3000),
        },
        ActionConfig::FocusElement {
            xpath: "//*[@name=\"email\"]".to_string(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: Some(3000),
        },
        ActionConfig::BlurElement {
            xpath: "//*[@name=\"email\"]".to_string(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: Some(3000),
        },
        ActionConfig::TypeSequence {
            xpath: "//*[@name=\"search\"]".to_string(),
            iframe_xpath: None,
            text: "abc".to_string(),
            delay_ms: Some(5),
            wait_until: None,
            timeout_ms: Some(3000),
        },
        ActionConfig::SetClipboard {
            text: "paste me".to_string(),
        },
        ActionConfig::PasteClipboard {
            xpath: "//*[@name=\"notes\"]".to_string(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: Some(3000),
        },
        ActionConfig::Check {
            xpath: "//*[@name=\"terms\"]".to_string(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: Some(3000),
        },
        ActionConfig::Uncheck {
            xpath: "//*[@name=\"terms\"]".to_string(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: Some(3000),
        },
        ActionConfig::ToggleCheckbox {
            xpath: "//*[@name=\"terms\"]".to_string(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: Some(3000),
        },
        ActionConfig::SelectRadio {
            xpath: "//*[@value=\"email\"]".to_string(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: Some(3000),
        },
    ];

    for config in configs {
        config.validate().expect("phase one config should be valid");
        let json = serde_json::to_string(&config).expect("serialize config");
        let decoded: ActionConfig = serde_json::from_str(&json).expect("deserialize config");

        assert_eq!(decoded, config);
    }
}

#[test]
fn phase_one_human_interaction_configs_validate_required_fields() {
    assert_validation_message(
        ActionConfig::DoubleClick {
            xpath: String::new(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: None,
        }
        .validate()
        .expect_err("double click requires xpath"),
        "xpath",
        "XPath is required",
    );

    assert_validation_message(
        ActionConfig::DragAndDrop {
            source_xpath: String::new(),
            target_xpath: "//*[@id=\"target\"]".to_string(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: None,
        }
        .validate()
        .expect_err("drag and drop requires source xpath"),
        "source_xpath",
        "Source XPath is required",
    );

    assert_validation_message(
        ActionConfig::DragAndDrop {
            source_xpath: "//*[@id=\"source\"]".to_string(),
            target_xpath: String::new(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: None,
        }
        .validate()
        .expect_err("drag and drop requires target xpath"),
        "target_xpath",
        "Target XPath is required",
    );

    assert_validation_message(
        ActionConfig::TypeSequence {
            xpath: "//*[@name=\"search\"]".to_string(),
            iframe_xpath: None,
            text: String::new(),
            delay_ms: None,
            wait_until: None,
            timeout_ms: None,
        }
        .validate()
        .expect_err("type sequence requires text"),
        "text",
        "Text is required",
    );

    assert_validation_message(
        ActionConfig::SetClipboard {
            text: String::new(),
        }
        .validate()
        .expect_err("set clipboard requires text"),
        "text",
        "Text is required",
    );
}

#[test]
fn phase_one_action_types_have_default_configs() {
    assert_eq!(
        default_config(ActionType::DoubleClick).action_type(),
        ActionType::DoubleClick
    );
    assert_eq!(
        default_config(ActionType::RightClick).action_type(),
        ActionType::RightClick
    );
    assert_eq!(
        default_config(ActionType::DragAndDrop).action_type(),
        ActionType::DragAndDrop
    );
    assert_eq!(
        default_config(ActionType::FocusElement).action_type(),
        ActionType::FocusElement
    );
    assert_eq!(
        default_config(ActionType::BlurElement).action_type(),
        ActionType::BlurElement
    );
    assert_eq!(
        default_config(ActionType::TypeSequence).action_type(),
        ActionType::TypeSequence
    );
    assert_eq!(
        default_config(ActionType::SetClipboard).action_type(),
        ActionType::SetClipboard
    );
    assert_eq!(
        default_config(ActionType::PasteClipboard).action_type(),
        ActionType::PasteClipboard
    );
    assert_eq!(
        default_config(ActionType::Check).action_type(),
        ActionType::Check
    );
    assert_eq!(
        default_config(ActionType::Uncheck).action_type(),
        ActionType::Uncheck
    );
    assert_eq!(
        default_config(ActionType::ToggleCheckbox).action_type(),
        ActionType::ToggleCheckbox
    );
    assert_eq!(
        default_config(ActionType::SelectRadio).action_type(),
        ActionType::SelectRadio
    );
}

#[test]
fn phase_two_form_and_file_configs_validate_and_round_trip() {
    let configs = [
        ActionConfig::UploadFile {
            xpath: "//*[@id=\"file\"]".to_string(),
            iframe_xpath: None,
            files: vec!["/tmp/example.txt".to_string()],
            wait_until: None,
            timeout_ms: Some(3000),
        },
        ActionConfig::SubmitForm {
            xpath: Some("//*[@id=\"login-form\"]".to_string()),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: Some(3000),
        },
        ActionConfig::SelectCustomOption {
            trigger_xpath: "//*[@role=\"combobox\"]".to_string(),
            option_text: "Vietnam".to_string(),
            iframe_xpath: None,
            timeout_ms: Some(3000),
        },
        ActionConfig::SetContenteditable {
            xpath: "//*[@contenteditable=\"true\"]".to_string(),
            iframe_xpath: None,
            text: "Hello editor".to_string(),
            clear_before_input: true,
            wait_until: None,
            timeout_ms: Some(3000),
        },
    ];

    for config in configs {
        config.validate().expect("phase two config should be valid");
        let json = serde_json::to_string(&config).expect("serialize config");
        let decoded: ActionConfig = serde_json::from_str(&json).expect("deserialize config");

        assert_eq!(decoded, config);
    }
}

#[test]
fn phase_two_form_and_file_configs_validate_required_fields() {
    assert_validation_message(
        ActionConfig::UploadFile {
            xpath: String::new(),
            iframe_xpath: None,
            files: vec!["/tmp/example.txt".to_string()],
            wait_until: None,
            timeout_ms: None,
        }
        .validate()
        .expect_err("upload requires xpath"),
        "xpath",
        "XPath is required",
    );

    assert_validation_message(
        ActionConfig::UploadFile {
            xpath: "//*[@id=\"file\"]".to_string(),
            iframe_xpath: None,
            files: vec![],
            wait_until: None,
            timeout_ms: None,
        }
        .validate()
        .expect_err("upload requires files"),
        "files",
        "At least one file is required",
    );

    assert_validation_message(
        ActionConfig::SelectCustomOption {
            trigger_xpath: String::new(),
            option_text: "Vietnam".to_string(),
            iframe_xpath: None,
            timeout_ms: None,
        }
        .validate()
        .expect_err("custom select requires trigger xpath"),
        "trigger_xpath",
        "Trigger XPath is required",
    );

    assert_validation_message(
        ActionConfig::SetContenteditable {
            xpath: "//*[@contenteditable=\"true\"]".to_string(),
            iframe_xpath: None,
            text: String::new(),
            clear_before_input: true,
            wait_until: None,
            timeout_ms: None,
        }
        .validate()
        .expect_err("contenteditable requires text"),
        "text",
        "Text is required",
    );
}

#[test]
fn phase_two_action_types_have_default_configs() {
    assert_eq!(
        default_config(ActionType::UploadFile).action_type(),
        ActionType::UploadFile
    );
    assert_eq!(
        default_config(ActionType::SubmitForm).action_type(),
        ActionType::SubmitForm
    );
    assert_eq!(
        default_config(ActionType::SelectCustomOption).action_type(),
        ActionType::SelectCustomOption
    );
    assert_eq!(
        default_config(ActionType::SetContenteditable).action_type(),
        ActionType::SetContenteditable
    );
}

#[test]
fn scroll_config_supports_advanced_modes_and_backwards_compatibility() {
    let legacy_json = r#"{"type":"scroll","config":{"direction":"down","pixels":300}}"#;
    let legacy: ActionConfig = serde_json::from_str(legacy_json).expect("legacy scroll");

    assert_eq!(
        legacy,
        ActionConfig::Scroll {
            mode: None,
            direction: ScrollDirection::Down,
            pixels: 300,
            xpath: None,
            iframe_xpath: None,
            behavior: None,
            block: None,
            inline: None,
            max_attempts: None,
            wait_ms: None,
        }
    );

    let advanced = ActionConfig::Scroll {
        mode: Some(ScrollMode::UntilVisible),
        direction: ScrollDirection::Right,
        pixels: 250,
        xpath: Some("//*[@id=\"target\"]".to_string()),
        iframe_xpath: Some("//*[@id=\"frame\"]".to_string()),
        behavior: Some(ScrollBehavior::Instant),
        block: Some(ScrollBlock::Center),
        inline: Some(ScrollInline::Nearest),
        max_attempts: Some(8),
        wait_ms: Some(150),
    };

    advanced.validate().expect("advanced scroll is valid");
    let json = serde_json::to_string(&advanced).expect("serialize advanced scroll");
    assert!(json.contains("\"mode\":\"until_visible\""));
    assert!(json.contains("\"direction\":\"right\""));
    assert!(json.contains("\"iframe_xpath\""));
}

#[test]
fn click_config_supports_real_user_options_and_backwards_compatibility() {
    let legacy_json = r#"{"type":"click","config":{"xpath":"//*[@id=\"submit\"]"}}"#;
    let legacy: ActionConfig = serde_json::from_str(legacy_json).expect("legacy click");

    assert_eq!(
        legacy,
        ActionConfig::Click {
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
        }
    );

    let advanced = ActionConfig::Click {
        xpath: "//*[@id=\"submit\"]".to_string(),
        iframe_xpath: Some("//*[@id=\"frame\"]".to_string()),
        mode: Some(ClickMode::Real),
        button: Some(ClickButton::Left),
        click_count: Some(2),
        scroll_into_view: Some(true),
        block: Some(ScrollBlock::Center),
        inline: Some(ScrollInline::Nearest),
        position: Some(ClickPosition::Offset),
        offset_x: Some(12.0),
        offset_y: Some(8.0),
        wait_until: Some(ClickWaitUntil::Clickable),
        timeout_ms: Some(5000),
        retry_interval_ms: Some(100),
        post_click_wait_ms: Some(50),
    };

    advanced.validate().expect("advanced click is valid");
    let json = serde_json::to_string(&advanced).expect("serialize advanced click");
    assert!(json.contains("\"mode\":\"real\""));
    assert!(json.contains("\"click_count\":2"));
    assert!(json.contains("\"iframe_xpath\""));
}

#[test]
fn click_config_validates_real_user_options() {
    assert_validation_message(
        ActionConfig::Click {
            xpath: "//*[@id=\"submit\"]".to_string(),
            iframe_xpath: None,
            mode: None,
            button: None,
            click_count: Some(0),
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
        }
        .validate()
        .expect_err("zero click count should fail"),
        "click_count",
        "Click count must be greater than 0",
    );

    assert_validation_message(
        ActionConfig::Click {
            xpath: "//*[@id=\"submit\"]".to_string(),
            iframe_xpath: None,
            mode: Some(ClickMode::ForceDom),
            button: Some(ClickButton::Right),
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
        }
        .validate()
        .expect_err("force DOM cannot right click"),
        "button",
        "Force DOM click only supports the left button",
    );
}

#[test]
fn scroll_modes_validate_required_xpath_and_attempts() {
    assert_validation_message(
        ActionConfig::Scroll {
            mode: Some(ScrollMode::IntoView),
            direction: ScrollDirection::Down,
            pixels: 300,
            xpath: None,
            iframe_xpath: None,
            behavior: None,
            block: None,
            inline: None,
            max_attempts: None,
            wait_ms: None,
        }
        .validate()
        .expect_err("into view requires xpath"),
        "xpath",
        "XPath is required",
    );

    assert_validation_message(
        ActionConfig::Scroll {
            mode: Some(ScrollMode::UntilVisible),
            direction: ScrollDirection::Down,
            pixels: 300,
            xpath: Some("//*[@id=\"target\"]".to_string()),
            iframe_xpath: None,
            behavior: None,
            block: None,
            inline: None,
            max_attempts: Some(0),
            wait_ms: None,
        }
        .validate()
        .expect_err("until visible requires attempts"),
        "max_attempts",
        "Max attempts must be greater than 0",
    );
}

#[test]
fn workflow_step_uses_action_type_from_config() {
    let step = WorkflowStep::new(
        "workflow-1",
        0,
        ActionConfig::Click {
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
    );

    assert_eq!(step.action_type().as_str(), "click");
    step.validate().expect("step should be valid");
}

#[test]
fn run_status_and_error_are_frontend_safe() {
    let status_json = serde_json::to_string(&RunStatus::Failed).expect("serialize status");
    assert_eq!(status_json, "\"failed\"");

    let error = RunError::new(4, "click", "XPath not found");
    let error_json = serde_json::to_string(&error).expect("serialize run error");

    assert!(error_json.contains("\"step_number\":4"));
    assert!(error_json.contains("\"action_type\":\"click\""));
    assert!(error_json.contains("\"reason\":\"XPath not found\""));
}

fn graph_with_nodes(nodes: Vec<GraphNode>, edges: Vec<GraphEdge>) -> WorkflowGraph {
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
    GraphNode {
        id: id.to_string(),
        node_type: GraphNodeType::Action,
        label: "Wait".to_string(),
        position: GraphPosition { x: 200.0, y: 0.0 },
        config: serde_json::json!({
            "type": "wait",
            "config": {
                "condition": "duration",
                "duration_ms": 100
            }
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

fn loop_node(id: &str) -> GraphNode {
    GraphNode {
        id: id.to_string(),
        node_type: GraphNodeType::RepeatUntil,
        label: "Repeat Until".to_string(),
        position: GraphPosition { x: 200.0, y: 0.0 },
        config: serde_json::json!({
            "condition": {
                "kind": "text_visible",
                "text": "Done"
            }
        }),
        ports: vec![
            GraphPort {
                id: "in".to_string(),
                label: "In".to_string(),
                direction: GraphPortDirection::Input,
            },
            GraphPort {
                id: "loop".to_string(),
                label: "Loop".to_string(),
                direction: GraphPortDirection::Output,
            },
            GraphPort {
                id: "done".to_string(),
                label: "Done".to_string(),
                direction: GraphPortDirection::Output,
            },
        ],
        group_id: None,
    }
}

fn if_node(id: &str) -> GraphNode {
    GraphNode {
        id: id.to_string(),
        node_type: GraphNodeType::If,
        label: "If Logged In".to_string(),
        position: GraphPosition { x: 200.0, y: 0.0 },
        config: serde_json::json!({
            "condition": {
                "kind": "output_equals",
                "name": "logged_in",
                "value": "false"
            }
        }),
        ports: vec![
            GraphPort {
                id: "in".to_string(),
                label: "In".to_string(),
                direction: GraphPortDirection::Input,
            },
            GraphPort {
                id: "true".to_string(),
                label: "True".to_string(),
                direction: GraphPortDirection::Output,
            },
            GraphPort {
                id: "false".to_string(),
                label: "False".to_string(),
                direction: GraphPortDirection::Output,
            },
        ],
        group_id: None,
    }
}

fn repeat_times_node(id: &str) -> GraphNode {
    GraphNode {
        id: id.to_string(),
        node_type: GraphNodeType::RepeatTimes,
        label: "Repeat Twice".to_string(),
        position: GraphPosition { x: 200.0, y: 0.0 },
        config: serde_json::json!({ "times": 2 }),
        ports: vec![
            GraphPort {
                id: "in".to_string(),
                label: "In".to_string(),
                direction: GraphPortDirection::Input,
            },
            GraphPort {
                id: "loop".to_string(),
                label: "Loop".to_string(),
                direction: GraphPortDirection::Output,
            },
            GraphPort {
                id: "done".to_string(),
                label: "Done".to_string(),
                direction: GraphPortDirection::Output,
            },
        ],
        group_id: None,
    }
}

fn repeat_for_each_node(id: &str) -> GraphNode {
    GraphNode {
        id: id.to_string(),
        node_type: GraphNodeType::RepeatForEach,
        label: "Repeat For Each".to_string(),
        position: GraphPosition { x: 200.0, y: 0.0 },
        config: serde_json::json!({
            "item_name": "item",
            "items": ["a", "b"]
        }),
        ports: vec![
            GraphPort {
                id: "in".to_string(),
                label: "In".to_string(),
                direction: GraphPortDirection::Input,
            },
            GraphPort {
                id: "loop".to_string(),
                label: "Loop".to_string(),
                direction: GraphPortDirection::Output,
            },
            GraphPort {
                id: "done".to_string(),
                label: "Done".to_string(),
                direction: GraphPortDirection::Output,
            },
        ],
        group_id: None,
    }
}

fn retry_node(id: &str) -> GraphNode {
    GraphNode {
        id: id.to_string(),
        node_type: GraphNodeType::Retry,
        label: "Retry".to_string(),
        position: GraphPosition { x: 200.0, y: 0.0 },
        config: serde_json::json!({ "max_attempts": 3, "delay_ms": 50 }),
        ports: vec![
            GraphPort {
                id: "in".to_string(),
                label: "In".to_string(),
                direction: GraphPortDirection::Input,
            },
            GraphPort {
                id: "try".to_string(),
                label: "Try".to_string(),
                direction: GraphPortDirection::Output,
            },
            GraphPort {
                id: "failed".to_string(),
                label: "Failed".to_string(),
                direction: GraphPortDirection::Output,
            },
            GraphPort {
                id: "success".to_string(),
                label: "Success".to_string(),
                direction: GraphPortDirection::Output,
            },
        ],
        group_id: None,
    }
}

fn switch_node(id: &str) -> GraphNode {
    GraphNode {
        id: id.to_string(),
        node_type: GraphNodeType::Switch,
        label: "Switch Status".to_string(),
        position: GraphPosition { x: 200.0, y: 0.0 },
        config: serde_json::json!({
            "expression": "status",
            "cases": ["ready"]
        }),
        ports: vec![
            GraphPort {
                id: "in".to_string(),
                label: "In".to_string(),
                direction: GraphPortDirection::Input,
            },
            GraphPort {
                id: "case_1".to_string(),
                label: "Case 1".to_string(),
                direction: GraphPortDirection::Output,
            },
            GraphPort {
                id: "default".to_string(),
                label: "Default".to_string(),
                direction: GraphPortDirection::Output,
            },
        ],
        group_id: None,
    }
}

fn while_node(id: &str) -> GraphNode {
    guarded_loop_node(id, GraphNodeType::While, "While Login")
}

fn repeat_until_node(id: &str) -> GraphNode {
    let mut node = guarded_loop_node(id, GraphNodeType::RepeatUntil, "Repeat Until Ready");
    node.ports.push(GraphPort {
        id: "timeout".to_string(),
        label: "Timeout".to_string(),
        direction: GraphPortDirection::Output,
    });
    node
}

fn guarded_loop_node(id: &str, node_type: GraphNodeType, label: &str) -> GraphNode {
    GraphNode {
        id: id.to_string(),
        node_type,
        label: label.to_string(),
        position: GraphPosition { x: 200.0, y: 0.0 },
        config: serde_json::json!({
            "condition": {
                "kind": "output_equals",
                "name": "ready",
                "value": "true"
            },
            "max_attempts": 3
        }),
        ports: vec![
            GraphPort {
                id: "in".to_string(),
                label: "In".to_string(),
                direction: GraphPortDirection::Input,
            },
            GraphPort {
                id: "loop".to_string(),
                label: "Loop".to_string(),
                direction: GraphPortDirection::Output,
            },
            GraphPort {
                id: "done".to_string(),
                label: "Done".to_string(),
                direction: GraphPortDirection::Output,
            },
        ],
        group_id: None,
    }
}

fn try_catch_node(id: &str) -> GraphNode {
    GraphNode {
        id: id.to_string(),
        node_type: GraphNodeType::TryCatch,
        label: "Try Catch".to_string(),
        position: GraphPosition { x: 200.0, y: 0.0 },
        config: serde_json::json!({}),
        ports: vec![
            GraphPort {
                id: "in".to_string(),
                label: "In".to_string(),
                direction: GraphPortDirection::Input,
            },
            GraphPort {
                id: "try".to_string(),
                label: "Try".to_string(),
                direction: GraphPortDirection::Output,
            },
            GraphPort {
                id: "success".to_string(),
                label: "Success".to_string(),
                direction: GraphPortDirection::Output,
            },
            GraphPort {
                id: "error".to_string(),
                label: "Error".to_string(),
                direction: GraphPortDirection::Output,
            },
            GraphPort {
                id: "finally".to_string(),
                label: "Finally".to_string(),
                direction: GraphPortDirection::Output,
            },
        ],
        group_id: None,
    }
}

fn fallback_node(id: &str) -> GraphNode {
    GraphNode {
        id: id.to_string(),
        node_type: GraphNodeType::Fallback,
        label: "Fallback".to_string(),
        position: GraphPosition { x: 200.0, y: 0.0 },
        config: serde_json::json!({}),
        ports: vec![
            GraphPort {
                id: "in".to_string(),
                label: "In".to_string(),
                direction: GraphPortDirection::Input,
            },
            GraphPort {
                id: "primary".to_string(),
                label: "Primary".to_string(),
                direction: GraphPortDirection::Output,
            },
            GraphPort {
                id: "fallback".to_string(),
                label: "Fallback".to_string(),
                direction: GraphPortDirection::Output,
            },
            GraphPort {
                id: "done".to_string(),
                label: "Done".to_string(),
                direction: GraphPortDirection::Output,
            },
        ],
        group_id: None,
    }
}

fn set_variable_node(id: &str) -> GraphNode {
    single_in_out_node(
        id,
        GraphNodeType::SetVariable,
        "Set Variable",
        serde_json::json!({ "name": "status", "value": "ready" }),
    )
}

fn transform_variable_node(id: &str) -> GraphNode {
    single_in_out_node(
        id,
        GraphNodeType::TransformVariable,
        "Transform Variable",
        serde_json::json!({
            "source_name": "status",
            "target_name": "status_label",
            "expression": "String(value).toUpperCase()"
        }),
    )
}

fn assert_output_node(id: &str) -> GraphNode {
    single_in_out_node(
        id,
        GraphNodeType::AssertOutput,
        "Assert Output",
        serde_json::json!({ "name": "status_label", "match": "equals", "value": "READY" }),
    )
}

fn domain_allowlist_node(id: &str) -> GraphNode {
    single_in_out_node(
        id,
        GraphNodeType::DomainAllowlist,
        "Domain Allowlist",
        serde_json::json!({ "domains": ["example.com"] }),
    )
}

fn break_loop_node(id: &str) -> GraphNode {
    terminal_input_node(
        id,
        GraphNodeType::BreakLoop,
        "Break Loop",
        serde_json::json!({}),
    )
}

fn continue_loop_node(id: &str) -> GraphNode {
    terminal_input_node(
        id,
        GraphNodeType::ContinueLoop,
        "Continue Loop",
        serde_json::json!({}),
    )
}

fn stop_workflow_node(id: &str) -> GraphNode {
    terminal_input_node(
        id,
        GraphNodeType::StopWorkflow,
        "Stop Workflow",
        serde_json::json!({ "status": "success", "reason": "done" }),
    )
}

#[test]
fn workflow_graph_compiles_close_browser_from_terminal_nodes() {
    let graph = WorkflowGraph {
        version: 1,
        nodes: vec![
            start_node(),
            terminal_input_node(
                "end",
                GraphNodeType::EndFailure,
                "End Failure",
                serde_json::json!({
                    "reason": "finished with failure",
                    "close_browser": true
                }),
            ),
        ],
        edges: vec![edge("start", "out", "end", "in")],
        viewport: GraphViewport {
            x: 0.0,
            y: 0.0,
            zoom: 1.0,
        },
    };

    let compiled = graph.compile().expect("terminal node should compile");

    assert_eq!(compiled.steps.len(), 1);
    match &compiled.steps[0].config {
        ActionConfig::StopWorkflow {
            status,
            reason,
            close_browser,
        } => {
            assert_eq!(
                *status,
                workflow_automation_manager_lib::domain::StopWorkflowStatus::Failure
            );
            assert_eq!(reason.as_deref(), Some("finished with failure"));
            assert!(*close_browser);
        }
        config => panic!("expected stop workflow config, got {config:?}"),
    }
}

fn terminal_input_node(
    id: &str,
    node_type: GraphNodeType,
    label: &str,
    config: serde_json::Value,
) -> GraphNode {
    GraphNode {
        id: id.to_string(),
        node_type,
        label: label.to_string(),
        position: GraphPosition { x: 200.0, y: 0.0 },
        config,
        ports: vec![GraphPort {
            id: "in".to_string(),
            label: "In".to_string(),
            direction: GraphPortDirection::Input,
        }],
        group_id: None,
    }
}

fn single_in_out_node(
    id: &str,
    node_type: GraphNodeType,
    label: &str,
    config: serde_json::Value,
) -> GraphNode {
    GraphNode {
        id: id.to_string(),
        node_type,
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

fn edge(
    source_node_id: &str,
    source_port: &str,
    target_node_id: &str,
    target_port: &str,
) -> GraphEdge {
    GraphEdge {
        id: format!("{source_node_id}-{source_port}-{target_node_id}-{target_port}"),
        source_node_id: source_node_id.to_string(),
        source_port: source_port.to_string(),
        target_node_id: target_node_id.to_string(),
        target_port: target_port.to_string(),
        label: Some("next".to_string()),
        condition: None,
    }
}
