use std::{collections::BTreeSet, future::Future, pin::Pin};

use crate::{
    app_state::{AppState, RunStateDto},
    domain::{
        ActionConfig, CompiledGraphStep, CompiledWorkflowGraph, GraphValidationIssue, RunMode,
        ValidationError, WorkflowGraph,
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

    let browser_config = state
        .repository()
        .get_workflow_browser_config(workflow_id)
        .await
        .map_err(CommandError::from)?;
    if let Some(config) = &browser_config {
        config.validate().map_err(CommandError::validation)?;
    }

    start_background_run(state, steps, RunMode::RunWorkflow, None, browser_config).await
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
