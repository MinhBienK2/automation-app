use std::{collections::BTreeSet, future::Future, pin::Pin};

use serde_json::Value;

use crate::{
    app_state::{AppState, RunStateDto},
    domain::{
        ActionConfig, CompiledGraphStep, CompiledWorkflowGraph, GraphValidationIssue,
        GraphValidationLevel, RunMode, RunValidationIssue, RunValidationIssueSource,
        ValidationError, VariableAssignment, VariableValueType, WaitCondition, WorkflowGraph,
        WorkflowInputValueType, WorkflowSettings, WorkflowSettingsIssueLevel,
        WorkflowSettingsSection,
    },
    services::run_service::start_background_run,
};

use super::CommandError;

pub async fn get_workflow_graph_impl(
    state: &AppState,
    workflow_id: &str,
) -> Result<WorkflowGraph, CommandError> {
    if let Some(graph) = state
        .repository()
        .get_workflow_graph(workflow_id)
        .await
        .map_err(CommandError::from)?
    {
        return Ok(graph);
    }

    let detail = state
        .repository()
        .get_workflow(workflow_id)
        .await
        .map_err(CommandError::from)?
        .ok_or_else(|| CommandError::message("Workflow not found"))?;

    Ok(WorkflowGraph::from_steps(&detail.steps))
}

pub async fn save_workflow_graph_impl(
    state: &AppState,
    workflow_id: &str,
    graph: WorkflowGraph,
) -> Result<(), CommandError> {
    state
        .repository()
        .save_workflow_graph(workflow_id, graph)
        .await
        .map_err(CommandError::from)
}

pub async fn validate_workflow_graph_impl(
    graph: WorkflowGraph,
) -> Result<Vec<GraphValidationIssue>, CommandError> {
    Ok(graph.validation_issues())
}

pub async fn compile_workflow_graph_impl(
    graph: WorkflowGraph,
) -> Result<CompiledWorkflowGraph, CommandError> {
    graph.compile().map_err(CommandError::validation)
}

pub async fn validate_workflow_run_impl(
    state: &AppState,
    workflow_id: &str,
) -> Result<Vec<RunValidationIssue>, CommandError> {
    let graph = get_workflow_graph_impl(state, workflow_id).await?;
    let settings = super::get_workflow_settings_impl(state, workflow_id).await?;
    let mut issues = graph
        .validation_issues()
        .into_iter()
        .map(|issue| RunValidationIssue {
            source: RunValidationIssueSource::Graph,
            field: Some("graph".to_string()),
            node_id: issue.node_id,
            edge_id: issue.edge_id,
            message: issue.message,
            level: match issue.level {
                GraphValidationLevel::Error => WorkflowSettingsIssueLevel::Error,
                GraphValidationLevel::Warning => WorkflowSettingsIssueLevel::Warning,
            },
        })
        .collect::<Vec<_>>();

    issues.extend(settings.validation_issues().into_iter().map(|issue| {
        RunValidationIssue {
            source: RunValidationIssueSource::Settings,
            field: issue
                .field
                .map(|field| format!("{}.{}", settings_section_prefix(issue.section), field)),
            node_id: None,
            edge_id: None,
            message: issue.message,
            level: issue.level,
        }
    }));
    issues.extend(run_settings_issues(&settings));

    Ok(issues)
}

pub async fn run_workflow_graph_impl(
    state: &AppState,
    workflow_id: &str,
) -> Result<RunStateDto, CommandError> {
    let graph = get_workflow_graph_impl(state, workflow_id).await?;
    let compiled = graph.compile().map_err(CommandError::validation)?;
    let compiled_steps = expand_compiled_steps(
        state,
        compiled.steps,
        &mut BTreeSet::from([workflow_id.to_string()]),
    )
    .await?;
    if compiled_steps.is_empty() {
        return Err(CommandError::validation(ValidationError::new(
            "graph",
            "Add at least one executable node before running.",
        )));
    }
    let settings = super::get_workflow_settings_impl(state, workflow_id).await?;
    settings.validate().map_err(CommandError::validation)?;
    validate_run_settings(&settings)?;

    let compiled_steps = compiled_steps
        .into_iter()
        .map(|mut step| {
            step.config = apply_execution_defaults(step.config, &settings);
            step.config = apply_nested_wait_between_nodes(step.config, &settings);
            step
        })
        .collect::<Vec<_>>();
    let mut compiled_steps = insert_wait_between_graph_nodes(compiled_steps, &settings);
    let mut settings_steps = settings_prelude_steps(&settings);
    settings_steps.append(&mut compiled_steps);
    let compiled_steps = settings_steps;

    let steps = compiled_steps
        .into_iter()
        .enumerate()
        .map(|(index, compiled_step)| {
            let action_type = compiled_step.config.action_type();
            crate::domain::WorkflowStep {
                id: compiled_step.node_id,
                name: compiled_step.label,
                workflow_id: workflow_id.to_string(),
                order_index: index as i64,
                action_type,
                config: compiled_step.config,
                created_at: String::new(),
                updated_at: String::new(),
            }
        })
        .collect::<Vec<_>>();

    let browser_config = Some(settings.browser.to_browser_config(workflow_id));
    if let Some(config) = &browser_config {
        config.validate().map_err(CommandError::validation)?;
    }

    start_background_run(state, steps, RunMode::RunWorkflow, None, browser_config).await
}

fn insert_wait_between_graph_nodes(
    steps: Vec<CompiledGraphStep>,
    settings: &WorkflowSettings,
) -> Vec<CompiledGraphStep> {
    if !settings.execution.wait_between_nodes_enabled || steps.len() < 2 {
        return steps;
    }

    let mut with_waits = Vec::with_capacity(steps.len().saturating_mul(2));
    let mut iter = steps.into_iter().peekable();
    while let Some(step) = iter.next() {
        let should_insert = iter
            .peek()
            .is_some_and(|next| !is_wait_override(&step.config) && !is_wait_override(&next.config));
        with_waits.push(step);
        if should_insert {
            let index = with_waits.len();
            with_waits.push(global_wait_step(settings, index));
        }
    }

    with_waits
}

fn global_wait_step(settings: &WorkflowSettings, index: usize) -> CompiledGraphStep {
    let config = if settings.execution.wait_between_nodes_random {
        ActionConfig::RandomWait {
            min_ms: settings.execution.wait_between_nodes_min_ms.unwrap_or(1000),
            max_ms: settings.execution.wait_between_nodes_max_ms.unwrap_or(1000),
        }
    } else {
        ActionConfig::Wait {
            condition: WaitCondition::Duration,
            xpath: None,
            text: None,
            url: None,
            duration_ms: Some(settings.execution.wait_between_nodes_ms.unwrap_or(1000)),
            timeout_ms: None,
        }
    };

    CompiledGraphStep {
        node_id: format!("__settings:execution:wait-between-nodes:{index}"),
        label: "Wait between nodes".to_string(),
        config,
    }
}

fn apply_nested_wait_between_nodes(
    config: ActionConfig,
    settings: &WorkflowSettings,
) -> ActionConfig {
    if !settings.execution.wait_between_nodes_enabled {
        return config;
    }

    let original = config.clone();
    let Ok(mut value) = serde_json::to_value(config) else {
        return original;
    };
    apply_nested_wait_between_nodes_value(&mut value, settings);
    serde_json::from_value(value).unwrap_or(original)
}

fn apply_nested_wait_between_nodes_value(value: &mut Value, settings: &WorkflowSettings) {
    let Some(config) = value.get_mut("config").and_then(Value::as_object_mut) else {
        return;
    };

    for key in [
        "then_steps",
        "else_steps",
        "steps",
        "failed_steps",
        "default_steps",
        "try_steps",
        "success_steps",
        "error_steps",
        "finally_steps",
        "primary_steps",
        "fallback_steps",
        "timeout_steps",
    ] {
        if let Some(Value::Array(steps)) = config.get_mut(key) {
            insert_wait_between_action_values(steps, settings);
        }
    }

    if let Some(Value::Array(cases)) = config.get_mut("cases") {
        for case in cases {
            if let Some(Value::Array(steps)) = case.get_mut("steps") {
                insert_wait_between_action_values(steps, settings);
            }
        }
    }

    if let Some(step) = config.get_mut("step") {
        apply_nested_wait_between_nodes_value(step, settings);
    }
}

fn insert_wait_between_action_values(steps: &mut Vec<Value>, settings: &WorkflowSettings) {
    for step in steps.iter_mut() {
        apply_nested_wait_between_nodes_value(step, settings);
    }

    if steps.len() < 2 {
        return;
    }

    let mut index = 1;
    while index < steps.len() {
        let previous_overrides = action_value_is_wait_override(&steps[index - 1]);
        let next_overrides = action_value_is_wait_override(&steps[index]);
        if !previous_overrides && !next_overrides {
            steps.insert(index, global_wait_action_value(settings));
            index += 1;
        }
        index += 1;
    }
}

fn global_wait_action_value(settings: &WorkflowSettings) -> Value {
    if settings.execution.wait_between_nodes_random {
        serde_json::json!({
            "type": "random_wait",
            "config": {
                "min_ms": settings.execution.wait_between_nodes_min_ms.unwrap_or(1000),
                "max_ms": settings.execution.wait_between_nodes_max_ms.unwrap_or(1000)
            }
        })
    } else {
        serde_json::json!({
            "type": "wait",
            "config": {
                "condition": "duration",
                "duration_ms": settings.execution.wait_between_nodes_ms.unwrap_or(1000)
            }
        })
    }
}

fn action_value_is_wait_override(value: &Value) -> bool {
    value
        .get("type")
        .and_then(Value::as_str)
        .is_some_and(|action_type| matches!(action_type, "wait" | "random_wait"))
}

fn is_wait_override(config: &ActionConfig) -> bool {
    matches!(
        config,
        ActionConfig::Wait { .. } | ActionConfig::RandomWait { .. }
    )
}

fn validate_run_settings(settings: &WorkflowSettings) -> Result<(), CommandError> {
    if let Some(issue) = run_settings_issues(settings).into_iter().find(|issue| {
        issue.source == RunValidationIssueSource::Settings
            && issue.level == WorkflowSettingsIssueLevel::Error
    }) {
        return Err(CommandError::validation(ValidationError::new(
            issue.field.unwrap_or_else(|| "settings".to_string()),
            issue.message,
        )));
    }

    Ok(())
}

fn run_settings_issues(settings: &WorkflowSettings) -> Vec<RunValidationIssue> {
    settings
        .inputs
        .input_schema
        .iter()
        .filter(|input| {
            input.required
                && input
                    .default_value
                    .as_deref()
                    .is_none_or(|value| value.trim().is_empty())
        })
        .map(|input| RunValidationIssue {
            source: RunValidationIssueSource::Settings,
            field: Some("inputs.input_schema".to_string()),
            node_id: None,
            edge_id: None,
            message: format!(
                "Input \"{}\" is required but no default, batch mapping, or run value was provided.",
                input.name
            ),
            level: WorkflowSettingsIssueLevel::Error,
        })
        .collect()
}

fn settings_section_prefix(section: WorkflowSettingsSection) -> &'static str {
    match section {
        WorkflowSettingsSection::General => "general",
        WorkflowSettingsSection::Execution => "execution",
        WorkflowSettingsSection::Browser => "browser",
        WorkflowSettingsSection::Environment => "environment",
        WorkflowSettingsSection::Inputs => "inputs",
        WorkflowSettingsSection::Triggers => "triggers",
        WorkflowSettingsSection::Advanced => "advanced",
    }
}

fn settings_prelude_steps(settings: &WorkflowSettings) -> Vec<CompiledGraphStep> {
    let mut steps = Vec::new();

    if let Some(geolocation) = &settings.environment.geolocation {
        steps.push(settings_step(
            "environment:geolocation",
            "Apply settings geolocation",
            ActionConfig::SetGeolocation {
                latitude: geolocation.latitude,
                longitude: geolocation.longitude,
                accuracy: geolocation.accuracy,
            },
        ));
    }

    if !settings.environment.permissions.is_empty() {
        steps.push(settings_step(
            "environment:permissions",
            "Apply settings permissions",
            ActionConfig::GrantPermission {
                origin: None,
                permissions: settings.environment.permissions.clone(),
            },
        ));
    }

    if !settings.environment.extra_http_headers.is_empty() {
        steps.push(settings_step(
            "environment:headers",
            "Apply settings headers",
            ActionConfig::SetExtraHeaders {
                headers: settings.environment.extra_http_headers.clone(),
            },
        ));
    }

    if let Some(download_directory) = settings.environment.download_directory.as_deref() {
        steps.push(settings_step(
            "environment:downloads",
            "Apply settings download directory",
            ActionConfig::SetDownloadDirectory {
                path: download_directory.to_string(),
            },
        ));
    }

    for (index, cookie) in settings.environment.cookies.iter().enumerate() {
        steps.push(settings_step(
            format!("environment:cookie:{index}"),
            "Apply settings cookie",
            ActionConfig::SetCookie {
                name: cookie.name.clone(),
                value: cookie.value.clone(),
                domain: cookie.domain.clone(),
                path: cookie.path.clone(),
            },
        ));
    }

    for (index, entry) in settings.environment.local_storage.iter().enumerate() {
        steps.push(settings_step(
            format!("environment:local-storage:{index}"),
            "Apply settings localStorage",
            ActionConfig::SetLocalStorage {
                key: entry.key.clone(),
                value: entry.value.clone(),
            },
        ));
    }

    for (index, entry) in settings.environment.session_storage.iter().enumerate() {
        steps.push(settings_step(
            format!("environment:session-storage:{index}"),
            "Apply settings sessionStorage",
            ActionConfig::SetSessionStorage {
                key: entry.key.clone(),
                value: entry.value.clone(),
            },
        ));
    }

    let mut variables = settings
        .inputs
        .input_schema
        .iter()
        .filter_map(|input| {
            input
                .default_value
                .as_ref()
                .map(|value| VariableAssignment {
                    name: input.name.clone(),
                    value_type: input_value_type_to_variable_type(input.value_type),
                    value: value.clone(),
                })
        })
        .collect::<Vec<_>>();
    variables.extend(settings.inputs.initial_variables.clone());

    if !variables.is_empty() {
        steps.push(settings_step(
            "inputs:variables",
            "Seed settings inputs and variables",
            ActionConfig::SetVariable {
                name: None,
                value: None,
                value_type: None,
                variables,
            },
        ));
    }

    steps
}

fn settings_step(
    id: impl Into<String>,
    label: impl Into<String>,
    config: ActionConfig,
) -> CompiledGraphStep {
    CompiledGraphStep {
        node_id: format!("__settings:{}", id.into()),
        label: label.into(),
        config,
    }
}

fn input_value_type_to_variable_type(value_type: WorkflowInputValueType) -> VariableValueType {
    match value_type {
        WorkflowInputValueType::Json
        | WorkflowInputValueType::Array
        | WorkflowInputValueType::Object => VariableValueType::Json,
        WorkflowInputValueType::Number => VariableValueType::Number,
        WorkflowInputValueType::Boolean => VariableValueType::Boolean,
        WorkflowInputValueType::Text | WorkflowInputValueType::SecretRef => VariableValueType::Text,
    }
}

fn apply_execution_defaults(config: ActionConfig, settings: &WorkflowSettings) -> ActionConfig {
    let Some(timeout_ms) = settings.execution.default_action_timeout_ms else {
        return config;
    };

    let original = config.clone();
    let Ok(mut value) = serde_json::to_value(config) else {
        return original;
    };
    apply_default_timeout_to_action_value(&mut value, timeout_ms);
    serde_json::from_value(value).unwrap_or(original)
}

fn apply_default_timeout_to_action_value(value: &mut Value, timeout_ms: u64) {
    let Some(config) = value.get_mut("config").and_then(Value::as_object_mut) else {
        return;
    };

    config
        .entry("timeout_ms".to_string())
        .or_insert(Value::Number(timeout_ms.into()));

    for key in [
        "then_steps",
        "else_steps",
        "steps",
        "failed_steps",
        "default_steps",
        "try_steps",
        "success_steps",
        "error_steps",
        "finally_steps",
        "primary_steps",
        "fallback_steps",
        "timeout_steps",
    ] {
        if let Some(Value::Array(steps)) = config.get_mut(key) {
            for step in steps {
                apply_default_timeout_to_action_value(step, timeout_ms);
            }
        }
    }

    if let Some(Value::Array(cases)) = config.get_mut("cases") {
        for case in cases {
            if let Some(Value::Array(steps)) = case.get_mut("steps") {
                for step in steps {
                    apply_default_timeout_to_action_value(step, timeout_ms);
                }
            }
        }
    }

    if let Some(step) = config.get_mut("step") {
        apply_default_timeout_to_action_value(step, timeout_ms);
    }
}

fn expand_compiled_steps<'a>(
    state: &'a AppState,
    steps: Vec<CompiledGraphStep>,
    workflow_stack: &'a mut BTreeSet<String>,
) -> Pin<Box<dyn Future<Output = Result<Vec<CompiledGraphStep>, CommandError>> + Send + 'a>> {
    Box::pin(async move {
        let mut expanded = Vec::new();
        for step in steps {
            let CompiledGraphStep {
                node_id,
                label,
                config,
            } = step;
            match config {
                ActionConfig::RunSubworkflow {
                    workflow_id,
                    input_mapping,
                    output_mapping,
                } => {
                    if !workflow_stack.insert(workflow_id.clone()) {
                        return Err(CommandError::message(format!(
                            "Subworkflow cycle detected at {workflow_id}"
                        )));
                    }

                    for mapping in input_mapping {
                        expanded.push(CompiledGraphStep {
                            node_id: format!("{}:input:{}", node_id, mapping.target),
                            label: format!("Map {} to {}", mapping.source, mapping.target),
                            config: ActionConfig::TransformVariable {
                                source_name: mapping.source,
                                target_name: mapping.target,
                                expression: String::new(),
                            },
                        });
                    }

                    let child_graph = get_workflow_graph_impl(state, &workflow_id).await?;
                    let child_compiled = child_graph.compile().map_err(CommandError::validation)?;
                    let child_steps =
                        expand_compiled_steps(state, child_compiled.steps, workflow_stack).await?;
                    expanded.extend(child_steps.into_iter().map(|mut child_step| {
                        child_step.node_id = format!("{}/{}", node_id, child_step.node_id);
                        child_step.label = format!("{} / {}", label, child_step.label);
                        child_step
                    }));

                    for mapping in output_mapping {
                        expanded.push(CompiledGraphStep {
                            node_id: format!("{}:output:{}", node_id, mapping.target),
                            label: format!("Map {} to {}", mapping.source, mapping.target),
                            config: ActionConfig::TransformVariable {
                                source_name: mapping.source,
                                target_name: mapping.target,
                                expression: String::new(),
                            },
                        });
                    }

                    workflow_stack.remove(&workflow_id);
                }
                config => {
                    expanded.push(CompiledGraphStep {
                        node_id,
                        label,
                        config: expand_subworkflow_configs(state, config, workflow_stack).await?,
                    });
                }
            }
        }

        Ok(expanded)
    })
}

fn expand_subworkflow_configs<'a>(
    state: &'a AppState,
    config: ActionConfig,
    workflow_stack: &'a mut BTreeSet<String>,
) -> Pin<Box<dyn Future<Output = Result<ActionConfig, CommandError>> + Send + 'a>> {
    Box::pin(async move {
        Ok(match config {
            ActionConfig::IfCondition {
                condition,
                then_steps,
                else_steps,
            } => ActionConfig::IfCondition {
                condition,
                then_steps: expand_action_config_list(state, then_steps, workflow_stack).await?,
                else_steps: expand_action_config_list(state, else_steps, workflow_stack).await?,
            },
            ActionConfig::RepeatTimes { times, steps } => ActionConfig::RepeatTimes {
                times,
                steps: expand_action_config_list(state, steps, workflow_stack).await?,
            },
            ActionConfig::RepeatForEach {
                item_name,
                array_variable,
                items,
                steps,
            } => ActionConfig::RepeatForEach {
                item_name,
                array_variable,
                items,
                steps: expand_action_config_list(state, steps, workflow_stack).await?,
            },
            ActionConfig::RetryBlock {
                max_attempts,
                delay_ms,
                steps,
                failed_steps,
            } => ActionConfig::RetryBlock {
                max_attempts,
                delay_ms,
                steps: expand_action_config_list(state, steps, workflow_stack).await?,
                failed_steps: expand_action_config_list(state, failed_steps, workflow_stack)
                    .await?,
            },
            ActionConfig::SwitchCondition {
                expression,
                cases,
                default_steps,
            } => {
                let mut expanded_cases = Vec::with_capacity(cases.len());
                for case in cases {
                    expanded_cases.push(crate::domain::SwitchCase {
                        value: case.value,
                        steps: expand_action_config_list(state, case.steps, workflow_stack).await?,
                    });
                }
                ActionConfig::SwitchCondition {
                    expression,
                    cases: expanded_cases,
                    default_steps: expand_action_config_list(state, default_steps, workflow_stack)
                        .await?,
                }
            }
            ActionConfig::WhileLoop {
                condition,
                max_attempts,
                timeout_ms,
                steps,
            } => ActionConfig::WhileLoop {
                condition,
                max_attempts,
                timeout_ms,
                steps: expand_action_config_list(state, steps, workflow_stack).await?,
            },
            ActionConfig::RepeatUntil {
                condition,
                max_attempts,
                timeout_ms,
                steps,
                timeout_steps,
            } => ActionConfig::RepeatUntil {
                condition,
                max_attempts,
                timeout_ms,
                steps: expand_action_config_list(state, steps, workflow_stack).await?,
                timeout_steps: expand_action_config_list(state, timeout_steps, workflow_stack)
                    .await?,
            },
            ActionConfig::TryCatch {
                try_steps,
                success_steps,
                error_steps,
                finally_steps,
            } => ActionConfig::TryCatch {
                try_steps: expand_action_config_list(state, try_steps, workflow_stack).await?,
                success_steps: expand_action_config_list(state, success_steps, workflow_stack)
                    .await?,
                error_steps: expand_action_config_list(state, error_steps, workflow_stack).await?,
                finally_steps: expand_action_config_list(state, finally_steps, workflow_stack)
                    .await?,
            },
            ActionConfig::FallbackBlock {
                primary_steps,
                fallback_steps,
            } => ActionConfig::FallbackBlock {
                primary_steps: expand_action_config_list(state, primary_steps, workflow_stack)
                    .await?,
                fallback_steps: expand_action_config_list(state, fallback_steps, workflow_stack)
                    .await?,
            },
            ActionConfig::RetryStep {
                max_attempts,
                delay_ms,
                step,
            } => ActionConfig::RetryStep {
                max_attempts,
                delay_ms,
                step: Box::new(expand_subworkflow_configs(state, *step, workflow_stack).await?),
            },
            other => other,
        })
    })
}

fn expand_action_config_list<'a>(
    state: &'a AppState,
    configs: Vec<ActionConfig>,
    workflow_stack: &'a mut BTreeSet<String>,
) -> Pin<Box<dyn Future<Output = Result<Vec<ActionConfig>, CommandError>> + Send + 'a>> {
    Box::pin(async move {
        let steps = configs
            .into_iter()
            .enumerate()
            .map(|(index, config)| CompiledGraphStep {
                node_id: format!("inline-{index}"),
                label: "Inline step".to_string(),
                config,
            })
            .collect::<Vec<_>>();
        Ok(expand_compiled_steps(state, steps, workflow_stack)
            .await?
            .into_iter()
            .map(|step| step.config)
            .collect())
    })
}
