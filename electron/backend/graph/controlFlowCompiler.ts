import type {
  ActionConfig,
  CompiledGraphStep,
  CompileWorkflowGraphOptions,
  GraphNode,
  WorkflowGraph,
} from "../../../src/types/workflow.js";
import { stringField } from "../shared/records.js";
import {
  closeBrowserConfig,
  nodeCondition,
  optionalPositiveInteger,
  positiveInteger,
  randomChoiceGraphConfig,
  requiredString,
  routerGraphConfig,
  stringArray,
  switchGraphConfig,
} from "./nodeConfigReaders.js";

export type CompilerContext = {
  compileNestedConfigs: (
    graph: WorkflowGraph,
    nodeId: string,
    sourcePort: string,
    visited: Set<string>,
    options: CompileWorkflowGraphOptions,
  ) => CompiledGraphStep[];
  compileContinuation: (
    graph: WorkflowGraph,
    nodeId: string,
    sourcePort: string,
    visited: Set<string>,
    steps: CompiledGraphStep[],
    options: CompileWorkflowGraphOptions & { stopAfterCurrentNode?: boolean },
  ) => void;
  step: (
    node: GraphNode,
    config: ActionConfig,
    options: CompileWorkflowGraphOptions,
  ) => CompiledGraphStep;
};

const CONTROL_FLOW_NODE_TYPES: Record<string, true> = {
  end_success: true,
  end_failure: true,
  merge: true,
  router: true,
  random_choice: true,
  if: true,
  switch: true,
  repeat_times: true,
  repeat_for_each: true,
  while: true,
  repeat_until: true,
  retry: true,
  try_catch: true,
  fallback: true,
  break_loop: true,
  continue_loop: true,
  stop_workflow: true,
  quarantined: true,
};

export function isControlFlowNodeType(nodeType: string): boolean {
  return CONTROL_FLOW_NODE_TYPES[nodeType] === true;
}

export function compileControlFlowNode(
  graph: WorkflowGraph,
  node: GraphNode,
  visited: Set<string>,
  steps: CompiledGraphStep[],
  options: CompileWorkflowGraphOptions,
  ctx: CompilerContext,
): boolean {
  switch (node.node_type) {
    case "end_success":
      if (closeBrowserConfig(node.config)) {
        steps.push(ctx.step(node, {
          type: "stop_workflow",
          config: { status: "success", reason: null, close_browser: true },
        }, options));
      }
      return true;

    case "end_failure":
      steps.push(ctx.step(node, {
        type: "stop_workflow",
        config: {
          status: "failure",
          reason: stringField(node.config, "reason") ?? "Graph reached failure end",
          close_browser: closeBrowserConfig(node.config),
        },
      }, options));
      return true;

    case "merge":
      steps.push(ctx.step(node, { type: "graph_noop", config: { kind: "merge" } }, options));
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;

    case "router": {
      const router = routerGraphConfig(node);
      steps.push(ctx.step(node, {
        type: "router_condition",
        config: {
          mode: "first_match",
          cases: router.cases.map((caseValue) => ({
            id: caseValue.id,
            label: caseValue.label,
            condition: caseValue.condition,
            steps: ctx.compileNestedConfigs(graph, node.id, `case_${caseValue.id}`, visited, options),
          })),
          default_steps: ctx.compileNestedConfigs(graph, node.id, "default", visited, options),
        },
      }, options));
      ctx.compileContinuation(graph, node.id, "done", visited, steps, options);
      return true;
    }

    case "random_choice": {
      const randomChoice = randomChoiceGraphConfig(node);
      steps.push(ctx.step(node, {
        type: "random_choice",
        config: {
          output_name: randomChoice.output_name,
          choices: randomChoice.choices.map((choice) => ({
            id: choice.id,
            label: choice.label,
            weight: choice.weight,
            steps: ctx.compileNestedConfigs(graph, node.id, `choice_${choice.id}`, visited, options),
          })),
        },
      }, options));
      ctx.compileContinuation(graph, node.id, "done", visited, steps, options);
      return true;
    }

    case "if": {
      const condition = nodeCondition(node);
      steps.push(ctx.step(node, {
        type: "if_condition",
        config: {
          condition,
          then_steps: ctx.compileNestedConfigs(graph, node.id, "true", visited, options),
          else_steps: ctx.compileNestedConfigs(graph, node.id, "false", visited, options),
        },
      }, options));
      ctx.compileContinuation(graph, node.id, "done", visited, steps, options);
      return true;
    }

    case "switch": {
      const switchConfig = switchGraphConfig(node);
      steps.push(ctx.step(node, {
        type: "switch_condition",
        config: {
          expression: switchConfig.expression,
          cases: switchConfig.cases.map((caseValue) => ({
            value: caseValue.value,
            steps: ctx.compileNestedConfigs(graph, node.id, `case_${caseValue.id}`, visited, options),
          })),
          default_steps: ctx.compileNestedConfigs(graph, node.id, "default", visited, options),
        },
      }, options));
      ctx.compileContinuation(graph, node.id, "done", visited, steps, options);
      return true;
    }

    case "repeat_times": {
      steps.push(ctx.step(node, {
        type: "repeat_times",
        config: {
          times: positiveInteger(node.config, "times", "Repeat times must be greater than 0"),
          steps: ctx.compileNestedConfigs(graph, node.id, "loop", visited, options),
        },
      }, options));
      ctx.compileContinuation(graph, node.id, "done", visited, steps, options);
      return true;
    }

    case "repeat_for_each": {
      const arrayVariable = stringField(node.config, "array_variable");
      const repeatConfig: Record<string, unknown> = {
        item_name: requiredString(node.config, "item_name", "Item name is required"),
        array_variable: arrayVariable,
        items: arrayVariable
          ? []
          : stringArray(node.config, "items", "Items are required"),
        steps: ctx.compileNestedConfigs(graph, node.id, "loop", visited, options),
      };

      const startIndex = stringField(node.config, "start_index");
      if (startIndex) repeatConfig.start_index = startIndex;

      const endIndex = stringField(node.config, "end_index");
      if (endIndex) repeatConfig.end_index = endIndex;

      const maxLoops = stringField(node.config, "max_loops");
      if (maxLoops) repeatConfig.max_loops = maxLoops;

      const minLoops = stringField(node.config, "min_loops");
      if (minLoops) repeatConfig.min_loops = minLoops;

      steps.push(ctx.step(node, {
        type: "repeat_for_each",
        config: repeatConfig as unknown as ActionConfig["config"],
      } as ActionConfig, options));
      ctx.compileContinuation(graph, node.id, "done", visited, steps, options);
      return true;
    }

    case "while": {
      steps.push(ctx.step(node, {
        type: "while_loop",
        config: {
          condition: nodeCondition(node),
          max_attempts: optionalPositiveInteger(node.config, "max_attempts"),
          timeout_ms: optionalPositiveInteger(node.config, "timeout_ms"),
          steps: ctx.compileNestedConfigs(graph, node.id, "loop", visited, options),
        },
      }, options));
      ctx.compileContinuation(graph, node.id, "done", visited, steps, options);
      return true;
    }

    case "repeat_until": {
      steps.push(ctx.step(node, {
        type: "repeat_until",
        config: {
          condition: nodeCondition(node),
          max_attempts: optionalPositiveInteger(node.config, "max_attempts"),
          timeout_ms: optionalPositiveInteger(node.config, "timeout_ms"),
          steps: ctx.compileNestedConfigs(graph, node.id, "loop", visited, options),
          timeout_steps: ctx.compileNestedConfigs(graph, node.id, "timeout", visited, options),
        },
      }, options));
      ctx.compileContinuation(graph, node.id, "done", visited, steps, options);
      return true;
    }

    case "retry": {
      steps.push(ctx.step(node, {
        type: "retry_block",
        config: {
          max_attempts: positiveInteger(node.config, "max_attempts", "Max attempts must be greater than 0"),
          delay_ms: optionalPositiveInteger(node.config, "delay_ms"),
          steps: ctx.compileNestedConfigs(graph, node.id, "try", visited, options),
          failed_steps: ctx.compileNestedConfigs(graph, node.id, "failed", visited, options),
        },
      }, options));
      ctx.compileContinuation(graph, node.id, "success", visited, steps, options);
      return true;
    }

    case "try_catch": {
      steps.push(ctx.step(node, {
        type: "try_catch",
        config: {
          try_steps: ctx.compileNestedConfigs(graph, node.id, "try", visited, options),
          success_steps: ctx.compileNestedConfigs(graph, node.id, "success", visited, options),
          error_steps: ctx.compileNestedConfigs(graph, node.id, "error", visited, options),
          finally_steps: ctx.compileNestedConfigs(graph, node.id, "finally", visited, options),
        },
      }, options));
      ctx.compileContinuation(graph, node.id, "done", visited, steps, options);
      return true;
    }

    case "fallback": {
      steps.push(ctx.step(node, {
        type: "fallback_block",
        config: {
          primary_steps: ctx.compileNestedConfigs(graph, node.id, "primary", visited, options),
          fallback_steps: ctx.compileNestedConfigs(graph, node.id, "fallback", visited, options),
        },
      }, options));
      ctx.compileContinuation(graph, node.id, "done", visited, steps, options);
      return true;
    }

    case "break_loop":
      steps.push(ctx.step(node, { type: "break_loop", config: {} }, options));
      return true;

    case "continue_loop":
      steps.push(ctx.step(node, { type: "continue_loop", config: {} }, options));
      return true;

    case "stop_workflow":
      steps.push(ctx.step(node, {
        type: "stop_workflow",
        config: {
          status: stringField(node.config, "status") === "failure" ? "failure" : "success",
          reason: stringField(node.config, "reason"),
          close_browser: closeBrowserConfig(node.config),
        },
      }, options));
      return true;

    case "quarantined":
      ctx.compileContinuation(graph, node.id, "out", visited, steps, options);
      return true;

    default:
      return false;
  }
}
