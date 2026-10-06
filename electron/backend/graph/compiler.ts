import type {
  ActionConfig,
  CompiledGraphStep,
  CompiledNestedAction,
  CompiledWorkflowGraph,
  GraphEdge,
  GraphNode,
  ProfileEnvironment,
  VariableAssignment,
  WorkflowGraph,
  WorkflowRunFromSelectedMode,
  WorkflowSettings,
} from "../../../src/types/workflow.js";
import {
  validateWorkflowGraph as validateWorkflowGraphModule,
  type WorkflowGraphValidationOptions,
} from "./validateGraph.js";
import { migrateWorkflowGraph } from "./migration.js";
import {
  requiredString,
  unsupportedGraphNodeTypeMessage,
} from "./nodeConfigReaders.js";
import { asRecord, stringField, validationError } from "../shared/records.js";
import { generateLoopPreludeSteps } from "./loopAnalysis.js";
import { forEachNestedActionArray } from "./nestedSteps.js";
import {
  compileControlFlowNode,
  isControlFlowNodeType,
  type CompilerContext,
} from "./controlFlowCompiler.js";
import { compileActionNode } from "./actionNodeCompiler.js";

export { validateActionConfig } from "../actions/validation/index.js";
export { validateWorkflowGraph } from "./validateGraph.js";

type CompileSubflowReference = {
  id: string;
  project_id: string;
  name: string;
  graph: WorkflowGraph;
};

export type CompileWorkflowGraphOptions = Omit<WorkflowGraphValidationOptions, "resolveSubflow"> & {
  workflowLabel?: string | null;
  labelPrefix?: string[];
  nodeIdPrefix?: string;
  resolveSubflow?: (subflowId: string) => CompileSubflowReference | null;
  profileEnvironment?: ProfileEnvironment;
};

export function compileWorkflowGraph(
  graph: WorkflowGraph,
  options: CompileWorkflowGraphOptions = {},
): CompiledWorkflowGraph {
  const normalizedGraph = migrateWorkflowGraph(graph);
  const blocking = validateWorkflowGraphModule(normalizedGraph, options).find((issue) => issue.level === "error");
  if (blocking) {
    throw validationError("graph", blocking.message);
  }

  const start = normalizedGraph.nodes.find((node) => node.node_type === "start");
  if (!start) {
    throw validationError("graph", "Graph must contain exactly one start node");
  }

  const steps: CompiledGraphStep[] = [];
  compileTransition(normalizedGraph, nextTransition(normalizedGraph, start.id, "out"), new Set(), steps, options);
  return { steps };
}

export function compileWorkflowRunPlan(
  graph: WorkflowGraph,
  settings: WorkflowSettings,
  options: CompileWorkflowGraphOptions = {},
): CompiledWorkflowGraph {
  const compiled = compileWorkflowGraph(migrateWorkflowGraph(graph), options).steps.map((stepItem) => ({
    ...stepItem,
    config: applyNestedWaitBetweenNodes(applyExecutionDefaults(stepItem.config)),
  }));
  const withWaits = insertWaitBetweenGraphNodes(compiled);
  const domainPolicy = domainPolicyFromSteps(withWaits);
  return {
    steps: [...settingsPreludeSteps(settings, options.profileEnvironment), ...withWaits],
    domain_policy: domainPolicy,
  };
}

type CompileWorkflowGraphFromNodeOptions = CompileWorkflowGraphOptions & {
  mode?: WorkflowRunFromSelectedMode;
  settings?: WorkflowSettings;
};

export function compileWorkflowGraphFromNode(
  graph: WorkflowGraph,
  startNodeId: string,
  options: CompileWorkflowGraphFromNodeOptions = {},
): CompiledWorkflowGraph {
  const normalizedGraph = migrateWorkflowGraph(graph);
  const blocking = validateWorkflowGraphModule(normalizedGraph, options).find((issue) => issue.level === "error");
  if (blocking) {
    throw validationError("graph", blocking.message);
  }

  const node = normalizedGraph.nodes.find((candidate) => candidate.id === startNodeId);
  if (!node || node.node_type === "start" || node.node_type === "merge") {
    throw validationError("startNodeId", "Run from selected requires an executable graph node");
  }

  const steps: CompiledGraphStep[] = [];
  compilePath(normalizedGraph, startNodeId, new Set(), steps, {
    ...options,
    stopAfterCurrentNode: options.mode === "selected_only",
  });
  const compiled = steps.map((stepValue) => ({
    ...stepValue,
    config: applyNestedWaitBetweenNodes(applyExecutionDefaults(stepValue.config)),
  }));
  const withWaits = insertWaitBetweenGraphNodes(compiled);
  const fullCompiled = compileWorkflowGraph(normalizedGraph, options).steps.map((stepValue) => ({
    ...stepValue,
    config: applyNestedWaitBetweenNodes(applyExecutionDefaults(stepValue.config)),
  }));
  const fullWithWaits = insertWaitBetweenGraphNodes(fullCompiled);

  const loopPrelude = generateLoopPreludeSteps(normalizedGraph, startNodeId);
  const prelude = options.settings
    ? settingsPreludeSteps(options.settings, options.profileEnvironment)
    : [];

  return {
    steps: [...prelude, ...loopPrelude, ...withWaits],
    domain_policy: domainPolicyFromSteps(fullWithWaits),
  };
}

function compilePath(
  graph: WorkflowGraph,
  nodeId: string | null,
  visited: Set<string>,
  steps: CompiledGraphStep[],
  options: CompileWorkflowGraphOptions & { stopAfterCurrentNode?: boolean } = {},
) {
  if (!nodeId) return;
  if (visited.has(nodeId)) {
    throw validationError("graph", `Graph path contains an unsupported cycle at node ${nodeId}`);
  }
  visited.add(nodeId);

  const node = graph.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) {
    throw validationError("graph", "Graph node was not found");
  }

  if (node.node_type === "start") {
    compileContinuation(graph, node.id, "out", visited, steps, options);
    visited.delete(nodeId);
    return;
  }

  if (node.node_type === "call_subflow") {
    compileCallSubflow(node, options, steps);
    compileContinuation(graph, node.id, "out", visited, steps, options);
    visited.delete(nodeId);
    return;
  }

  const ctx: CompilerContext = {
    compileNestedConfigs,
    compileContinuation,
    step,
  };

  if (isControlFlowNodeType(node.node_type)) {
    compileControlFlowNode(graph, node, visited, steps, options, ctx);
    visited.delete(nodeId);
    return;
  }

  if (compileActionNode(graph, node, visited, steps, options, ctx)) {
    visited.delete(nodeId);
    return;
  }

  throw validationError("node_type", unsupportedGraphNodeTypeMessage(node.node_type));
}

function compileContinuation(
  graph: WorkflowGraph,
  nodeId: string,
  sourcePort: string,
  visited: Set<string>,
  steps: CompiledGraphStep[],
  options: CompileWorkflowGraphOptions & { stopAfterCurrentNode?: boolean },
) {
  if (options.stopAfterCurrentNode) return;
  compileTransition(graph, nextTransition(graph, nodeId, sourcePort), visited, steps, options);
}

type GraphTransition = {
  edge: GraphEdge;
  targetNodeId: string;
} | null;

function compileTransition(
  graph: WorkflowGraph,
  transition: GraphTransition,
  visited: Set<string>,
  steps: CompiledGraphStep[],
  options: CompileWorkflowGraphOptions = {},
) {
  if (!transition) return;
  pushEdgeDelayStep(graph, transition.edge, transition.targetNodeId, steps);
  compilePath(graph, transition.targetNodeId, visited, steps, options);
}

function pushEdgeDelayStep(
  graph: WorkflowGraph,
  edge: GraphEdge,
  targetNodeId: string,
  steps: CompiledGraphStep[],
) {
  const delay = edge.delay;
  if (!delay) return;
  const target = graph.nodes.find((node) => node.id === targetNodeId);
  if (delay.type === "fixed") {
    steps.push({
      node_id: `__edge_wait:${edge.id}`,
      label: `Wait before ${target?.label ?? targetNodeId}`,
      config: {
        type: "wait",
        config: {
          condition: "duration",
          duration_ms: delay.duration_ms,
        },
      },
    });
    return;
  }
  steps.push({
    node_id: `__edge_wait:${edge.id}`,
    label: `Wait before ${target?.label ?? targetNodeId}`,
    config: { type: "random_wait", config: { min_ms: delay.min_ms, max_ms: delay.max_ms } },
  });
}

function compileNestedConfigs(
  graph: WorkflowGraph,
  sourceNodeId: string,
  sourcePort: string,
  visited: Set<string>,
  options: CompileWorkflowGraphOptions = {},
): CompiledNestedAction[] {
  const parentNode = graph.nodes.find((n) => n.id === sourceNodeId);
  const parentLabel = parentNode?.label;

  const nestedSteps: CompiledGraphStep[] = [];
  compileTransition(
    graph,
    nextTransition(graph, sourceNodeId, sourcePort),
    new Set(visited),
    nestedSteps,
    {
      ...options,
      labelPrefix: [...(options.labelPrefix ?? []), ...(parentLabel ? [parentLabel] : [])],
    },
  );
  return nestedSteps.map((compiledStep) => ({
    ...compiledStep.config,
    graph_node_id: compiledStep.node_id,
    graph_label: compiledStep.label,
    ...(compiledStep.metadata ? { graph_metadata: compiledStep.metadata } : {}),
  }));
}

function step(
  node: GraphNode,
  config: ActionConfig,
  options: CompileWorkflowGraphOptions = {},
): CompiledGraphStep {
  return {
    node_id: prefixedNodeId(node, options),
    label: prefixedLabel(node.label, options),
    config,
  };
}

function prefixedNodeId(node: GraphNode, options: CompileWorkflowGraphOptions) {
  return `${options.nodeIdPrefix ?? ""}${node.id}`;
}

function prefixedLabel(label: string, options: CompileWorkflowGraphOptions) {
  return [...(options.labelPrefix ?? []), label].filter(Boolean).join(" > ");
}

function compileCallSubflow(
  node: GraphNode,
  options: CompileWorkflowGraphOptions,
  steps: CompiledGraphStep[],
) {
  const subflowId = requiredString(node.config, "subflow_id", "Call Subflow requires a subflow");
  if (!options.resolveSubflow) {
    throw validationError("subflow_id", "Call Subflow cannot be compiled without a subflow resolver");
  }
  const subflow = options.resolveSubflow(subflowId);
  if (!subflow) {
    throw validationError("subflow_id", "Call Subflow references a missing subflow");
  }
  if (options.projectId && subflow.project_id !== options.projectId) {
    throw validationError("subflow_id", "Call Subflow must reference a subflow in the same project");
  }

  const inputMapping = callSubflowInputMapping(node.config);
  if (inputMapping.length > 0) {
    steps.push({
      node_id: `${prefixedNodeId(node, options)}::__inputs`,
      label: prefixedLabel("Inputs", {
        ...options,
        labelPrefix: callSubflowLabelPrefix(options, subflow),
      }),
      config: {
        type: "set_variable",
        config: {
          name: null,
          value: null,
          value_type: null,
          variables: inputMapping.map((mapping) => ({
            name: mapping.input_name,
            value_type: "text" as const,
            value: mapping.value,
          })),
        },
      },
    });
  }

  const compiled = compileWorkflowGraph(subflow.graph, {
    ...options,
    graphKind: "subflow",
    projectId: subflow.project_id,
    nodeIdPrefix: `${prefixedNodeId(node, options)}::`,
    labelPrefix: callSubflowLabelPrefix(options, subflow),
  });
  if (compiled.steps.length === 0) {
    throw validationError("subflow_id", "Referenced subflow has no executable steps");
  }
  steps.push(...compiled.steps.map((compiledStep, index) => ({
    ...compiledStep,
    metadata: {
      ...(compiledStep.metadata ?? {}),
      subflow: {
        id: subflow.id,
        name: subflow.name,
        step_number: index + 1,
        step_count: compiled.steps.length,
      },
    },
  })));
}

function callSubflowLabelPrefix(
  options: CompileWorkflowGraphOptions,
  subflow: CompileSubflowReference,
) {
  return [
    ...(options.workflowLabel ? [options.workflowLabel] : []),
    subflow.name,
  ];
}

function callSubflowInputMapping(config: unknown): Array<{ input_name: string; value: string }> {
  const value = asRecord(config).input_mapping;
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = asRecord(item);
      return {
        input_name: stringField(record, "input_name") ?? "",
        value: typeof record.value === "string" ? record.value : "",
      };
    })
    .filter((item) => item.input_name.trim());
}

function settingsPreludeSteps(
  settings: WorkflowSettings,
  profileEnvironment?: ProfileEnvironment,
): CompiledGraphStep[] {
  const steps: CompiledGraphStep[] = [];
  if (profileEnvironment && profileEnvironment.variables.length > 0) {
    steps.push(settingsStep("profile:variables", "Seed profile inputs and variables", {
      type: "set_variable",
      config: {
        name: null,
        value: null,
        value_type: null,
        variables: profileEnvironment.variables.map((v) => ({
          name: v.name,
          value_type: v.value_type,
          value: v.value,
        })),
      },
    }));
  }
  const variables: VariableAssignment[] = settings.environment.initial_variables;
  if (variables.length > 0) {
    steps.push(settingsStep("inputs:variables", "Seed settings inputs and variables", {
      type: "set_variable",
      config: {
        name: null,
        value: null,
        value_type: null,
        variables,
      },
    }));
  }
  return steps;
}

function settingsStep(id: string, label: string, config: ActionConfig): CompiledGraphStep {
  return { node_id: `__settings:${id}`, label, config };
}

function domainPolicyFromSteps(steps: CompiledGraphStep[]) {
  const domains = new Set<string>();
  for (const stepValue of steps) {
    collectDomainAllowlist(stepValue.config, domains);
  }
  return domains.size > 0 ? { allowed_domains: [...domains] } : null;
}

function collectDomainAllowlist(config: ActionConfig, domains: Set<string>) {
  if (config.type === "domain_allowlist") {
    for (const domain of config.config.domains) {
      const normalized = domain.trim();
      if (normalized) domains.add(normalized);
    }
  }
  forEachNestedActionArray(config, (steps) => {
    for (const stepValue of steps) collectDomainAllowlist(stepValue, domains);
  });
}

function applyExecutionDefaults(config: ActionConfig): ActionConfig {
  try {
    return structuredClone(config);
  } catch {
    return JSON.parse(JSON.stringify(config)) as ActionConfig;
  }
}

function applyNestedWaitBetweenNodes(
  config: ActionConfig,
): ActionConfig {
  return config;
}

function insertWaitBetweenGraphNodes(
  steps: CompiledGraphStep[],
): CompiledGraphStep[] {
  return steps;
}

function nextTransition(
  graph: WorkflowGraph,
  sourceNodeId: string,
  sourcePort: string,
): GraphTransition {
  const edge = [...graph.edges]
    .filter((edgeValue) => edgeValue.source_node_id === sourceNodeId && edgeValue.source_port === sourcePort)
    .sort((left, right) => left.id.localeCompare(right.id))[0] ?? null;
  return edge ? { edge, targetNodeId: edge.target_node_id } : null;
}
