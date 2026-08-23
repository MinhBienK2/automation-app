import type {
  ActionExecutorMap,
  RunnerActionExecutorDependencies,
  RunnerActionRuntime,
} from "../runnerActionExecutors.js";
import { withLoopScope } from "../loopScope.js";
import { assertRuntimeEnumValue, weightedRandomChoice } from "../runtimeHelpers.js";
import { renderTemplate, writeVariableValue } from "../variables.js";

export type FlowControlExecutors = Pick<
  ActionExecutorMap,
  | "graph_noop" | "if_condition" | "router_condition" | "random_choice"
  | "repeat_times" | "repeat_for_each" | "retry_block" | "switch_condition"
  | "while_loop" | "repeat_until" | "try_catch" | "fallback_block"
  | "break_loop" | "continue_loop" | "stop_workflow" | "quarantined"
  | "assert_output"
>;

export function createFlowControlExecutors<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
  deps: RunnerActionExecutorDependencies<Runtime>,
): FlowControlExecutors {
  return {
    graph_noop: async () => undefined,
    if_condition: async (action) => {
      await deps.executeActions(
        runtime,
        await deps.conditionMatches(runtime, action.config.condition)
          ? action.config.then_steps
          : action.config.else_steps,
      );
    },
    router_condition: async (action) => {
      for (const caseValue of action.config.cases) {
        let matched = false;
        try {
          matched = await deps.conditionMatches(runtime, caseValue.condition);
        } catch (error) {
          throw new Error(
            `Router ${runtime.currentStepId ?? "unknown"} case "${caseValue.label}" condition failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
        if (matched) {
          await deps.executeActions(runtime, caseValue.steps);
          return;
        }
      }
      await deps.executeActions(runtime, action.config.default_steps);
    },
    random_choice: async (action) => {
      const choice = weightedRandomChoice(action.config.choices, deps.random);
      if (action.config.output_name?.trim()) {
        runtime.outputs[action.config.output_name] = choice.id;
      }
      await deps.executeActions(runtime, choice.steps);
    },
    repeat_times: async (action) => {
      await withLoopScope(runtime.outputs, async (iteration) => {
        for (let index = 0; index < action.config.times; index += 1) {
          iteration(index);
          const control = await deps.executeLoopBody(runtime, action.config.steps);
          if (control === "break") break;
        }
      });
    },
    repeat_for_each: async (action) => {
      const items = action.config.array_variable
        ? (runtime.outputs[action.config.array_variable] as unknown[])
        : action.config.items;
      if (!Array.isArray(items)) throw new Error("repeat_for_each source is not an array");

      let processedItems = [...items];

      // 1. Range Slicing
      let start = 0;
      if (action.config.start_index) {
        const renderedStart = renderTemplate(action.config.start_index, runtime.outputs);
        const parsedStart = parseInt(renderedStart, 10);
        if (!isNaN(parsedStart)) {
          start = parsedStart;
        }
      }

      let end: number | undefined;
      if (action.config.end_index) {
        const renderedEnd = renderTemplate(action.config.end_index, runtime.outputs);
        const parsedEnd = parseInt(renderedEnd, 10);
        if (!isNaN(parsedEnd)) {
          end = parsedEnd;
        }
      }

      if (end !== undefined) {
        processedItems = processedItems.slice(start, end);
      } else {
        processedItems = processedItems.slice(start);
      }

      // 2. Max loops (limit)
      if (action.config.max_loops) {
        const renderedMax = renderTemplate(action.config.max_loops, runtime.outputs);
        const parsedMax = parseInt(renderedMax, 10);
        if (!isNaN(parsedMax) && parsedMax >= 0) {
          processedItems = processedItems.slice(0, parsedMax);
        }
      }

      // 3. Min loops (padding)
      if (action.config.min_loops) {
        const renderedMin = renderTemplate(action.config.min_loops, runtime.outputs);
        const parsedMin = parseInt(renderedMin, 10);
        if (!isNaN(parsedMin) && parsedMin > 0) {
          while (processedItems.length < parsedMin) {
            processedItems.push(null);
          }
        }
      }

      await withLoopScope(runtime.outputs, async (iteration) => {
        let index = 0;
        for (const item of processedItems) {
          writeVariableValue(runtime.outputs, action.config.item_name, item);
          iteration(index);
          const control = await deps.executeLoopBody(runtime, action.config.steps);
          index += 1;
          if (control === "break") break;
        }
      });
    },
    retry_block: async (action) => {
      await deps.executeRetry(runtime, action.config.max_attempts, action.config.delay_ms ?? 0, action.config.steps, action.config.failed_steps ?? []);
    },
    switch_condition: async (action) => {
      const value = String(runtime.outputs[action.config.expression] ?? action.config.expression);
      const branch = action.config.cases.find((candidate) => candidate.value === value);
      await deps.executeActions(runtime, branch?.steps ?? action.config.default_steps);
    },
    while_loop: async (action) => {
      await deps.executeLoop(
        runtime,
        action.config.steps,
        action.config.max_attempts ?? 100,
        () => deps.conditionMatches(runtime, action.config.condition),
        action.config.timeout_ms ?? null,
      );
    },
    repeat_until: async (action) => {
      const result = await deps.executeLoop(
        runtime,
        action.config.steps,
        action.config.max_attempts ?? 100,
        async () => !(await deps.conditionMatches(runtime, action.config.condition)),
        action.config.timeout_ms ?? null,
      );
      if (
        (result === "max_attempts" || result === "timeout") &&
        !(await deps.conditionMatches(runtime, action.config.condition))
      ) {
        await deps.executeActions(runtime, action.config.timeout_steps);
      }
    },
    try_catch: async (action) => {
      try {
        await deps.executeActions(runtime, action.config.try_steps);
        await deps.executeActions(runtime, action.config.success_steps);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        runtime.outputs["last_error"] = message;
        runtime.outputs["system.last_error"] = message;
        if (action.config.error_steps.length === 0) throw error;
        await deps.executeActions(runtime, action.config.error_steps);
      } finally {
        await deps.executeActions(runtime, action.config.finally_steps);
      }
    },
    fallback_block: async (action) => {
      try {
        await deps.executeActions(runtime, action.config.primary_steps);
      } catch (error) {
        if (action.config.fallback_steps.length === 0) throw error;
        await deps.executeActions(runtime, action.config.fallback_steps);
      }
    },
    break_loop: async () => {
      throw deps.createLoopControl("break");
    },
    continue_loop: async () => {
      throw deps.createLoopControl("continue");
    },
    stop_workflow: async (action) => {
      throw deps.createRunnerStop(
        action.config.status === "success" ? "success" : "failure",
        action.config.reason ?? "Workflow stopped",
        Boolean(action.config.close_browser),
      );
    },
    assert_output: async (action) => {
      assertRuntimeEnumValue(
        action.config.match_mode,
        ["contains", "equals"],
        "Match mode must be contains or equals",
      );
      const actual = String(runtime.outputs[action.config.name] ?? "");
      if (action.config.match_mode === "equals" && actual !== action.config.value) {
        throw new Error(`Output ${action.config.name} did not equal ${action.config.value}`);
      }
      if (action.config.match_mode === "contains" && !actual.includes(action.config.value)) {
        throw new Error(`Output ${action.config.name} did not contain ${action.config.value}`);
      }
    },
    quarantined: async () => {
      // No-op: quarantined nodes are skipped at compile time.
      // This executor exists only to satisfy the registry coverage assertion.
    },
  };
}
