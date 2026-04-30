use std::collections::{BTreeMap, BTreeSet, VecDeque};

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::{
    ActionConfig, AssertOutputMatchMode, StopWorkflowStatus, SwitchCase, ValidationError,
    VariableMapping, WaitCondition, WorkflowCondition, WorkflowStep,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GraphNodeType {
    Start,
    EndSuccess,
    EndFailure,
    Action,
    If,
    Switch,
    RepeatTimes,
    RepeatForEach,
    RepeatUntil,
    While,
    Retry,
    TryCatch,
    Fallback,
    BreakLoop,
    ContinueLoop,
    StopWorkflow,
    SetVariable,
    TransformVariable,
    AssertOutput,
    RunSubworkflow,
    ManualApproval,
    RateLimit,
    DomainAllowlist,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GraphPortDirection {
    Input,
    Output,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GraphValidationLevel {
    Error,
    Warning,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GraphPosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GraphViewport {
    pub x: f64,
    pub y: f64,
    pub zoom: f64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GraphPort {
    pub id: String,
    pub label: String,
    pub direction: GraphPortDirection,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GraphNode {
    pub id: String,
    pub node_type: GraphNodeType,
    pub label: String,
    pub position: GraphPosition,
    #[serde(default)]
    pub config: Value,
    #[serde(default)]
    pub ports: Vec<GraphPort>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub group_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GraphEdge {
    pub id: String,
    pub source_node_id: String,
    pub source_port: String,
    pub target_node_id: String,
    pub target_port: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub condition: Option<WorkflowCondition>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WorkflowGraph {
    pub version: u32,
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
    pub viewport: GraphViewport,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GraphValidationIssue {
    pub level: GraphValidationLevel,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub node_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub edge_id: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CompiledGraphStep {
    pub node_id: String,
    pub label: String,
    pub config: ActionConfig,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CompiledWorkflowGraph {
    pub steps: Vec<CompiledGraphStep>,
}

impl WorkflowGraph {
    pub fn from_steps(steps: &[WorkflowStep]) -> Self {
        let mut nodes = Vec::with_capacity(steps.len() + 2);
        let mut edges = Vec::with_capacity(steps.len() + 1);

        nodes.push(GraphNode {
            id: "start".to_string(),
            node_type: GraphNodeType::Start,
            label: "Start".to_string(),
            position: GraphPosition { x: 0.0, y: 0.0 },
            config: Value::Object(Default::default()),
            ports: vec![output_port("out", "Out")],
            group_id: None,
        });

        if steps.is_empty() {
            return Self {
                version: 1,
                nodes,
                edges,
                viewport: GraphViewport {
                    x: 0.0,
                    y: 0.0,
                    zoom: 1.0,
                },
            };
        }

        let mut previous_node_id = "start".to_string();
        let mut previous_port = "out".to_string();
        for (index, step) in steps.iter().enumerate() {
            let node_id = step.id.clone();
            nodes.push(GraphNode {
                id: node_id.clone(),
                node_type: GraphNodeType::Action,
                label: step.name.clone(),
                position: GraphPosition {
                    x: 220.0 * ((index + 1) as f64),
                    y: 0.0,
                },
                config: serde_json::to_value(&step.config).unwrap_or(Value::Null),
                ports: vec![input_port("in", "In"), output_port("out", "Out")],
                group_id: None,
            });
            edges.push(GraphEdge {
                id: format!("edge-{previous_node_id}-{node_id}"),
                source_node_id: previous_node_id,
                source_port: previous_port,
                target_node_id: node_id.clone(),
                target_port: "in".to_string(),
                label: Some("next".to_string()),
                condition: None,
            });
            previous_node_id = node_id;
            previous_port = "out".to_string();
        }

        nodes.push(GraphNode {
            id: "end_success".to_string(),
            node_type: GraphNodeType::EndSuccess,
            label: "End Success".to_string(),
            position: GraphPosition {
                x: 220.0 * ((steps.len() + 1) as f64),
                y: 0.0,
            },
            config: Value::Object(Default::default()),
            ports: vec![input_port("in", "In")],
            group_id: None,
        });
        edges.push(GraphEdge {
            id: format!("edge-{previous_node_id}-end_success"),
            source_node_id: previous_node_id,
            source_port: previous_port,
            target_node_id: "end_success".to_string(),
            target_port: "in".to_string(),
            label: Some("next".to_string()),
            condition: None,
        });

        Self {
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

    pub fn validation_issues(&self) -> Vec<GraphValidationIssue> {
        let mut issues = Vec::new();
        if self.version != 1 {
            issues.push(error(None, None, "Unsupported graph version"));
        }

        let start_count = self
            .nodes
            .iter()
            .filter(|node| node.node_type == GraphNodeType::Start)
            .count();
        if start_count != 1 {
            issues.push(error(
                None,
                None,
                "Graph must contain exactly one start node",
            ));
        }

        let node_by_id = self
            .nodes
            .iter()
            .map(|node| (node.id.as_str(), node))
            .collect::<BTreeMap<_, _>>();
        let mut duplicate_node_ids = BTreeSet::new();
        let mut seen_node_ids = BTreeSet::new();
        for node in &self.nodes {
            if node.id.trim().is_empty() {
                issues.push(error(None, None, "Graph node id is required"));
            }
            if !seen_node_ids.insert(node.id.as_str()) {
                duplicate_node_ids.insert(node.id.clone());
            }
        }
        for node_id in duplicate_node_ids {
            issues.push(error(Some(node_id), None, "Graph node id must be unique"));
        }

        for edge in &self.edges {
            match node_by_id.get(edge.source_node_id.as_str()) {
                Some(source)
                    if !source.ports.iter().any(|port| {
                        port.id == edge.source_port && port.direction == GraphPortDirection::Output
                    }) =>
                {
                    issues.push(error(
                        Some(source.id.clone()),
                        Some(edge.id.clone()),
                        format!("Edge {} source port does not exist", edge.id),
                    ));
                }
                Some(_) => {}
                None => {
                    issues.push(error(
                        None,
                        Some(edge.id.clone()),
                        format!("Edge {} source node does not exist", edge.id),
                    ));
                }
            }

            match node_by_id.get(edge.target_node_id.as_str()) {
                Some(target)
                    if !target.ports.iter().any(|port| {
                        port.id == edge.target_port && port.direction == GraphPortDirection::Input
                    }) =>
                {
                    issues.push(error(
                        Some(target.id.clone()),
                        Some(edge.id.clone()),
                        format!("Edge {} target port does not exist", edge.id),
                    ));
                }
                Some(_) => {}
                None => {
                    issues.push(error(
                        None,
                        Some(edge.id.clone()),
                        format!("Edge {} target node does not exist", edge.id),
                    ));
                }
            }
        }

        for node in &self.nodes {
            if matches!(
                node.node_type,
                GraphNodeType::RepeatUntil | GraphNodeType::While
            ) && !has_positive_number(&node.config, "max_attempts")
                && !has_positive_number(&node.config, "timeout_ms")
            {
                issues.push(error(
                    Some(node.id.clone()),
                    None,
                    "Loop nodes require max attempts or timeout",
                ));
            }
        }

        if start_count == 1 {
            let reachable = self.reachable_node_ids();
            for node in &self.nodes {
                if !reachable.contains(node.id.as_str())
                    && !matches!(node.node_type, GraphNodeType::Start)
                {
                    issues.push(error(
                        Some(node.id.clone()),
                        None,
                        format!("Node {} is unreachable", node.label),
                    ));
                }
            }
        }

        issues
    }

    pub fn compile(&self) -> Result<CompiledWorkflowGraph, ValidationError> {
        let blocking = self
            .validation_issues()
            .into_iter()
            .find(|issue| issue.level == GraphValidationLevel::Error);
        if let Some(issue) = blocking {
            return Err(ValidationError::new("graph", issue.message));
        }

        let start = self
            .nodes
            .iter()
            .find(|node| node.node_type == GraphNodeType::Start)
            .ok_or_else(|| {
                ValidationError::new("graph", "Graph must contain exactly one start node")
            })?;
        let mut steps = Vec::new();
        let mut visited = BTreeSet::new();
        let next_node_id = self.next_target(&start.id, "out");
        self.compile_path(next_node_id.as_deref(), &mut visited, &mut steps)?;

        Ok(CompiledWorkflowGraph { steps })
    }

    fn compile_path(
        &self,
        node_id: Option<&str>,
        visited: &mut BTreeSet<String>,
        steps: &mut Vec<CompiledGraphStep>,
    ) -> Result<(), ValidationError> {
        let Some(node_id) = node_id else {
            return Ok(());
        };
        if !visited.insert(node_id.to_string()) {
            return Err(ValidationError::new(
                "graph",
                format!("Graph path contains an unsupported cycle at node {node_id}"),
            ));
        }
        let Some(node) = self.nodes.iter().find(|node| node.id == node_id) else {
            return Err(ValidationError::new("graph", "Graph node was not found"));
        };

        match node.node_type {
            GraphNodeType::EndSuccess => return Ok(()),
            GraphNodeType::EndFailure => {
                let reason = node
                    .config
                    .get("reason")
                    .and_then(Value::as_str)
                    .filter(|value| !value.trim().is_empty())
                    .unwrap_or("Graph reached failure end")
                    .to_string();
                steps.push(CompiledGraphStep {
                    node_id: node.id.clone(),
                    label: node.label.clone(),
                    config: ActionConfig::StopWorkflow {
                        status: StopWorkflowStatus::Failure,
                        reason: Some(reason),
                    },
                });
                return Ok(());
            }
            GraphNodeType::Action => {
                let config: ActionConfig =
                    serde_json::from_value(node.config.clone()).map_err(|error| {
                        ValidationError::new(
                            "config",
                            format!("Node {} has invalid action config: {error}", node.label),
                        )
                    })?;
                config.validate()?;
                steps.push(CompiledGraphStep {
                    node_id: node.id.clone(),
                    label: node.label.clone(),
                    config,
                });
                let next = self.next_target(&node.id, "out");
                self.compile_path(next.as_deref(), visited, steps)?;
            }
            GraphNodeType::If => {
                let condition = node_condition(node)?;
                let then_steps = self.compile_nested_configs(&node.id, "true", visited)?;
                let else_steps = self.compile_nested_configs(&node.id, "false", visited)?;
                steps.push(CompiledGraphStep {
                    node_id: node.id.clone(),
                    label: node.label.clone(),
                    config: ActionConfig::IfCondition {
                        condition,
                        then_steps,
                        else_steps,
                    },
                });
            }
            GraphNodeType::RepeatTimes => {
                let times =
                    positive_u32(&node.config, "times", "Repeat times must be greater than 0")?;
                let loop_steps = self.compile_nested_configs(&node.id, "loop", visited)?;
                steps.push(CompiledGraphStep {
                    node_id: node.id.clone(),
                    label: node.label.clone(),
                    config: ActionConfig::RepeatTimes {
                        times,
                        steps: loop_steps,
                    },
                });
                let next = self.next_target(&node.id, "done");
                self.compile_path(next.as_deref(), visited, steps)?;
            }
            GraphNodeType::RepeatForEach => {
                let item_name = node
                    .config
                    .get("item_name")
                    .and_then(Value::as_str)
                    .filter(|value| !value.trim().is_empty())
                    .ok_or_else(|| ValidationError::new("item_name", "Item name is required"))?
                    .to_string();
                let items = node
                    .config
                    .get("items")
                    .and_then(Value::as_array)
                    .ok_or_else(|| ValidationError::new("items", "Items are required"))?
                    .iter()
                    .filter_map(Value::as_str)
                    .map(ToString::to_string)
                    .collect::<Vec<_>>();
                if items.is_empty() {
                    return Err(ValidationError::new("items", "Items are required"));
                }
                let loop_steps = self.compile_nested_configs(&node.id, "loop", visited)?;
                steps.push(CompiledGraphStep {
                    node_id: node.id.clone(),
                    label: node.label.clone(),
                    config: ActionConfig::RepeatForEach {
                        item_name,
                        items,
                        steps: loop_steps,
                    },
                });
                let next = self.next_target(&node.id, "done");
                self.compile_path(next.as_deref(), visited, steps)?;
            }
            GraphNodeType::Retry => {
                let max_attempts = positive_u32(
                    &node.config,
                    "max_attempts",
                    "Max attempts must be greater than 0",
                )?;
                let delay_ms = node.config.get("delay_ms").and_then(Value::as_u64);
                let retry_steps = self.compile_nested_configs(&node.id, "try", visited)?;
                let failed_steps = self.compile_nested_configs(&node.id, "failed", visited)?;
                steps.push(CompiledGraphStep {
                    node_id: node.id.clone(),
                    label: node.label.clone(),
                    config: ActionConfig::RetryBlock {
                        max_attempts,
                        delay_ms,
                        steps: retry_steps,
                        failed_steps,
                    },
                });
                let next = self.next_target(&node.id, "success");
                self.compile_path(next.as_deref(), visited, steps)?;
            }
            GraphNodeType::Switch => {
                let expression =
                    required_string(&node.config, "expression", "Switch expression is required")?;
                let case_values = string_array(&node.config, "cases", "Switch cases are required")?;
                let cases = case_values
                    .into_iter()
                    .enumerate()
                    .map(|(index, value)| {
                        let port = format!("case_{}", index + 1);
                        let steps = self.compile_nested_configs(&node.id, &port, visited)?;
                        Ok(SwitchCase { value, steps })
                    })
                    .collect::<Result<Vec<_>, ValidationError>>()?;
                let default_steps = self.compile_nested_configs(&node.id, "default", visited)?;
                steps.push(CompiledGraphStep {
                    node_id: node.id.clone(),
                    label: node.label.clone(),
                    config: ActionConfig::SwitchCondition {
                        expression,
                        cases,
                        default_steps,
                    },
                });
            }
            GraphNodeType::While => {
                let condition = node_condition(node)?;
                let max_attempts = optional_positive_u32(&node.config, "max_attempts")?;
                let timeout_ms = optional_positive_u64(&node.config, "timeout_ms")?;
                let loop_steps = self.compile_nested_configs(&node.id, "loop", visited)?;
                steps.push(CompiledGraphStep {
                    node_id: node.id.clone(),
                    label: node.label.clone(),
                    config: ActionConfig::WhileLoop {
                        condition,
                        max_attempts,
                        timeout_ms,
                        steps: loop_steps,
                    },
                });
                let next = self.next_target(&node.id, "done");
                self.compile_path(next.as_deref(), visited, steps)?;
            }
            GraphNodeType::RepeatUntil => {
                let condition = node_condition(node)?;
                let max_attempts = optional_positive_u32(&node.config, "max_attempts")?;
                let timeout_ms = optional_positive_u64(&node.config, "timeout_ms")?;
                let loop_steps = self.compile_nested_configs(&node.id, "loop", visited)?;
                let timeout_steps = self.compile_nested_configs(&node.id, "timeout", visited)?;
                steps.push(CompiledGraphStep {
                    node_id: node.id.clone(),
                    label: node.label.clone(),
                    config: ActionConfig::RepeatUntil {
                        condition,
                        max_attempts,
                        timeout_ms,
                        steps: loop_steps,
                        timeout_steps,
                    },
                });
                let next = self.next_target(&node.id, "done");
                self.compile_path(next.as_deref(), visited, steps)?;
            }
            GraphNodeType::TryCatch => {
                let try_steps = self.compile_nested_configs(&node.id, "try", visited)?;
                let success_steps = self.compile_nested_configs(&node.id, "success", visited)?;
                let error_steps = self.compile_nested_configs(&node.id, "error", visited)?;
                let finally_steps = self.compile_nested_configs(&node.id, "finally", visited)?;
                steps.push(CompiledGraphStep {
                    node_id: node.id.clone(),
                    label: node.label.clone(),
                    config: ActionConfig::TryCatch {
                        try_steps,
                        success_steps,
                        error_steps,
                        finally_steps,
                    },
                });
            }
            GraphNodeType::Fallback => {
                let primary_steps = self.compile_nested_configs(&node.id, "primary", visited)?;
                let fallback_steps = self.compile_nested_configs(&node.id, "fallback", visited)?;
                steps.push(CompiledGraphStep {
                    node_id: node.id.clone(),
                    label: node.label.clone(),
                    config: ActionConfig::FallbackBlock {
                        primary_steps,
                        fallback_steps,
                    },
                });
                let next = self.next_target(&node.id, "done");
                self.compile_path(next.as_deref(), visited, steps)?;
            }
            GraphNodeType::BreakLoop => {
                steps.push(CompiledGraphStep {
                    node_id: node.id.clone(),
                    label: node.label.clone(),
                    config: ActionConfig::BreakLoop {},
                });
                return Ok(());
            }
            GraphNodeType::ContinueLoop => {
                steps.push(CompiledGraphStep {
                    node_id: node.id.clone(),
                    label: node.label.clone(),
                    config: ActionConfig::ContinueLoop {},
                });
                return Ok(());
            }
            GraphNodeType::StopWorkflow => {
                let status = match node.config.get("status").and_then(Value::as_str) {
                    Some("failure") => StopWorkflowStatus::Failure,
                    _ => StopWorkflowStatus::Success,
                };
                let reason = optional_string(&node.config, "reason");
                steps.push(CompiledGraphStep {
                    node_id: node.id.clone(),
                    label: node.label.clone(),
                    config: ActionConfig::StopWorkflow { status, reason },
                });
                return Ok(());
            }
            GraphNodeType::SetVariable => {
                let name = required_string(&node.config, "name", "Variable name is required")?;
                let value = node
                    .config
                    .get("value")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string();
                steps.push(CompiledGraphStep {
                    node_id: node.id.clone(),
                    label: node.label.clone(),
                    config: ActionConfig::SetVariable { name, value },
                });
                let next = self.next_target(&node.id, "out");
                self.compile_path(next.as_deref(), visited, steps)?;
            }
            GraphNodeType::TransformVariable => {
                let source_name =
                    required_string(&node.config, "source_name", "Source output is required")?;
                let target_name =
                    required_string(&node.config, "target_name", "Target output is required")?;
                let expression = node
                    .config
                    .get("expression")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string();
                steps.push(CompiledGraphStep {
                    node_id: node.id.clone(),
                    label: node.label.clone(),
                    config: ActionConfig::TransformVariable {
                        source_name,
                        target_name,
                        expression,
                    },
                });
                let next = self.next_target(&node.id, "out");
                self.compile_path(next.as_deref(), visited, steps)?;
            }
            GraphNodeType::AssertOutput => {
                let name = required_string(&node.config, "name", "Output name is required")?;
                let value =
                    required_string(&node.config, "value", "Expected output value is required")?;
                let match_mode = match node.config.get("match").and_then(Value::as_str) {
                    Some("contains") => AssertOutputMatchMode::Contains,
                    _ => AssertOutputMatchMode::Equals,
                };
                steps.push(CompiledGraphStep {
                    node_id: node.id.clone(),
                    label: node.label.clone(),
                    config: ActionConfig::AssertOutput {
                        name,
                        match_mode,
                        value,
                    },
                });
                let next = self.next_target(&node.id, "out");
                self.compile_path(next.as_deref(), visited, steps)?;
            }
            GraphNodeType::RunSubworkflow => {
                let workflow_id =
                    required_string(&node.config, "workflow_id", "Workflow id is required")?;
                let input_mapping = variable_mappings(&node.config, "input_mapping")?;
                let output_mapping = variable_mappings(&node.config, "output_mapping")?;
                steps.push(CompiledGraphStep {
                    node_id: node.id.clone(),
                    label: node.label.clone(),
                    config: ActionConfig::RunSubworkflow {
                        workflow_id,
                        input_mapping,
                        output_mapping,
                    },
                });
                let next = self.next_target(&node.id, "out");
                self.compile_path(next.as_deref(), visited, steps)?;
            }
            GraphNodeType::DomainAllowlist => {
                let domains =
                    string_array(&node.config, "domains", "Allowed domains are required")?;
                steps.push(CompiledGraphStep {
                    node_id: node.id.clone(),
                    label: node.label.clone(),
                    config: ActionConfig::DomainAllowlist { domains },
                });
                let next = self.next_target(&node.id, "out");
                self.compile_path(next.as_deref(), visited, steps)?;
            }
            GraphNodeType::ManualApproval => {
                let reason = node
                    .config
                    .get("reason")
                    .and_then(Value::as_str)
                    .filter(|value| !value.trim().is_empty())
                    .unwrap_or("Manual approval required")
                    .to_string();
                let timeout_ms = node.config.get("timeout_ms").and_then(Value::as_u64);
                steps.push(CompiledGraphStep {
                    node_id: node.id.clone(),
                    label: node.label.clone(),
                    config: ActionConfig::PauseForHuman { reason, timeout_ms },
                });
                let next = self.next_target(&node.id, "out");
                self.compile_path(next.as_deref(), visited, steps)?;
            }
            GraphNodeType::RateLimit => {
                let duration_ms = node
                    .config
                    .get("delay_ms")
                    .and_then(Value::as_u64)
                    .unwrap_or(1000);
                steps.push(CompiledGraphStep {
                    node_id: node.id.clone(),
                    label: node.label.clone(),
                    config: ActionConfig::Wait {
                        condition: WaitCondition::Duration,
                        xpath: None,
                        text: None,
                        url: None,
                        duration_ms: Some(duration_ms),
                        timeout_ms: None,
                    },
                });
                let next = self.next_target(&node.id, "out");
                self.compile_path(next.as_deref(), visited, steps)?;
            }
            _ => {
                return Err(ValidationError::new(
                    "graph",
                    format!("Node {} is not executable yet", node.label),
                ));
            }
        }

        visited.remove(node_id);
        Ok(())
    }

    fn compile_nested_configs(
        &self,
        source_node_id: &str,
        source_port: &str,
        visited: &BTreeSet<String>,
    ) -> Result<Vec<ActionConfig>, ValidationError> {
        let mut nested_steps = Vec::new();
        let mut branch_visited = visited.clone();
        let next = self.next_target(source_node_id, source_port);
        self.compile_path(next.as_deref(), &mut branch_visited, &mut nested_steps)?;

        Ok(nested_steps
            .into_iter()
            .map(|compiled_step| compiled_step.config)
            .collect())
    }

    fn reachable_node_ids(&self) -> BTreeSet<&str> {
        let mut reachable = BTreeSet::new();
        let Some(start) = self
            .nodes
            .iter()
            .find(|node| node.node_type == GraphNodeType::Start)
        else {
            return reachable;
        };

        let mut queue = VecDeque::from([start.id.as_str()]);
        while let Some(node_id) = queue.pop_front() {
            if !reachable.insert(node_id) {
                continue;
            }
            for edge in self
                .edges
                .iter()
                .filter(|edge| edge.source_node_id == node_id)
            {
                queue.push_back(edge.target_node_id.as_str());
            }
        }

        reachable
    }

    fn next_target(&self, source_node_id: &str, source_port: &str) -> Option<String> {
        self.edges
            .iter()
            .filter(|edge| edge.source_node_id == source_node_id && edge.source_port == source_port)
            .min_by(|left, right| left.id.cmp(&right.id))
            .map(|edge| edge.target_node_id.clone())
    }
}

fn input_port(id: &str, label: &str) -> GraphPort {
    GraphPort {
        id: id.to_string(),
        label: label.to_string(),
        direction: GraphPortDirection::Input,
    }
}

fn output_port(id: &str, label: &str) -> GraphPort {
    GraphPort {
        id: id.to_string(),
        label: label.to_string(),
        direction: GraphPortDirection::Output,
    }
}

fn error(
    node_id: Option<String>,
    edge_id: Option<String>,
    message: impl Into<String>,
) -> GraphValidationIssue {
    GraphValidationIssue {
        level: GraphValidationLevel::Error,
        node_id,
        edge_id,
        message: message.into(),
    }
}

fn has_positive_number(config: &Value, field: &str) -> bool {
    config
        .get(field)
        .and_then(Value::as_u64)
        .is_some_and(|value| value > 0)
}

fn node_condition(node: &GraphNode) -> Result<WorkflowCondition, ValidationError> {
    let value = node
        .config
        .get("condition")
        .cloned()
        .ok_or_else(|| ValidationError::new("condition", "Condition is required"))?;

    serde_json::from_value(value).map_err(|error| {
        ValidationError::new(
            "condition",
            format!("Node {} has invalid condition: {error}", node.label),
        )
    })
}

fn positive_u32(config: &Value, field: &str, message: &str) -> Result<u32, ValidationError> {
    let value = config.get(field).and_then(Value::as_u64).unwrap_or(0);
    if value == 0 || value > u64::from(u32::MAX) {
        return Err(ValidationError::new(field, message));
    }

    Ok(value as u32)
}

fn optional_positive_u32(config: &Value, field: &str) -> Result<Option<u32>, ValidationError> {
    let Some(value) = config.get(field).and_then(Value::as_u64) else {
        return Ok(None);
    };
    if value == 0 || value > u64::from(u32::MAX) {
        return Err(ValidationError::new(field, "Value must be greater than 0"));
    }
    Ok(Some(value as u32))
}

fn optional_positive_u64(config: &Value, field: &str) -> Result<Option<u64>, ValidationError> {
    let Some(value) = config.get(field).and_then(Value::as_u64) else {
        return Ok(None);
    };
    if value == 0 {
        return Err(ValidationError::new(field, "Value must be greater than 0"));
    }
    Ok(Some(value))
}

fn required_string(config: &Value, field: &str, message: &str) -> Result<String, ValidationError> {
    config
        .get(field)
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToString::to_string)
        .ok_or_else(|| ValidationError::new(field, message))
}

fn optional_string(config: &Value, field: &str) -> Option<String> {
    config
        .get(field)
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToString::to_string)
}

fn string_array(
    config: &Value,
    field: &str,
    message: &str,
) -> Result<Vec<String>, ValidationError> {
    let values = config
        .get(field)
        .and_then(Value::as_array)
        .ok_or_else(|| ValidationError::new(field, message))?
        .iter()
        .filter_map(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
        .collect::<Vec<_>>();

    if values.is_empty() {
        return Err(ValidationError::new(field, message));
    }

    Ok(values)
}

fn variable_mappings(config: &Value, field: &str) -> Result<Vec<VariableMapping>, ValidationError> {
    let Some(values) = config.get(field).and_then(Value::as_array) else {
        return Ok(Vec::new());
    };

    values
        .iter()
        .map(|value| {
            let source = required_string(value, "source", "Mapping source is required")?;
            let target = required_string(value, "target", "Mapping target is required")?;
            Ok(VariableMapping { source, target })
        })
        .collect()
}
