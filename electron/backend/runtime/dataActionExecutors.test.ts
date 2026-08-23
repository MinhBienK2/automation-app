// @vitest-environment node

import { describe, expect, test } from "vitest";
import { executeRegisteredAction } from "../actions/execution.js";
import { createDataActionExecutors } from "./dataActionExecutors.js";
import type { DataActionDependencies, VariableScope } from "./actionRuntime.js";
import type { ActionConfig } from "../../../src/types/workflow.js";

/**
 * The point of this file is what it does *not* set up.
 *
 * No page, no browser context, no driver, no temp directory — and no way to
 * add one, because `createDataActionExecutors` takes a `VariableScope`. That
 * is the property #32 exists to create: the majority of executors never
 * referenced a browser, and now they cannot.
 */

function scope(outputs: Record<string, unknown> = {}): VariableScope {
  return {
    runId: "run-1",
    settings: {} as VariableScope["settings"],
    outputs,
    elementRefs: new Map(),
    clipboard: "",
    currentStepNumber: null,
    currentStepId: null,
    currentStepName: null,
    currentActionType: null,
    currentActionSummary: null,
    currentStepMetadata: null,
  };
}

/**
 * Every dependency throws. A data-only executor that reaches for one is a
 * misclassification, and this makes it fail loudly rather than quietly
 * working because a browser happened to be there.
 */
function refusingDependencies(
  overrides: Partial<DataActionDependencies> = {},
): DataActionDependencies {
  const refuse = (name: string) => () => {
    throw new Error(`a data-only action reached for ${name}`);
  };

  return {
    appPaths: {} as DataActionDependencies["appPaths"],
    random: () => 0.5,
    sleep: async () => undefined,
    executeActions: refuse("executeActions"),
    executeLoopBody: refuse("executeLoopBody"),
    executeRetry: refuse("executeRetry"),
    executeLoop: refuse("executeLoop"),
    conditionMatches: refuse("conditionMatches"),
    createLoopControl: (kind) => new Error(kind),
    createRunnerStop: (status, message) => new Error(`${status}: ${message}`),
    ...overrides,
  };
}

async function run(runtime: VariableScope, action: unknown, deps = refusingDependencies()) {
  await executeRegisteredAction(
    createDataActionExecutors(runtime, deps),
    action as ActionConfig,
  );
}

describe("data-only executors need no browser", () => {
  test("arithmetic writes its result to the outputs bag", async () => {
    const runtime = scope({ a: 7 });

    await run(runtime, {
      type: "math_operation",
      config: { operand1: "{{a}}", operation: "multiply", operand2: "6", output_name: "product" },
    });

    expect(runtime.outputs.product).toBe(42);
  });

  test("text actions read and write plain values", async () => {
    const runtime = scope({ greeting: "  hello  " });

    await run(runtime, { type: "trim_text", config: { name: "greeting" } });

    expect(runtime.outputs.greeting).toBe("hello");
  });

  test("list actions work on the outputs bag alone", async () => {
    const runtime = scope({ items: ["b", "a", "c"] });

    await run(runtime, {
      type: "sort_reverse_list",
      config: { source: "items", action: "sort_asc", output_name: "sorted" },
    });

    expect(runtime.outputs.sorted).toEqual(["a", "b", "c"]);
  });

  test("object actions resolve nested paths", async () => {
    const runtime = scope({ user: { profile: { name: "Bo" } } });

    await run(runtime, {
      type: "get_object_property",
      config: { source: "user", property_key: "profile.name", output_name: "name" },
    });

    expect(runtime.outputs.name).toBe("Bo");
  });

  test("a random draw uses the injected source, so the result is fixed", async () => {
    const runtime = scope();

    await run(
      runtime,
      {
        type: "generate_random_number",
        config: { min: "0", max: "100", integer: true, output_name: "roll" },
      },
      refusingDependencies({ random: () => 0 }),
    );

    expect(runtime.outputs.roll).toBe(0);
  });

  test("flow control reaches its injected callback rather than a page", async () => {
    // `if_condition` is data-shaped: it asks the caller whether the condition
    // holds and never resolves anything itself.
    const runtime = scope();
    let asked = false;

    await run(
      runtime,
      {
        type: "if_condition",
        config: { condition: { kind: "always" }, then_steps: [], else_steps: [] },
      },
      refusingDependencies({
        conditionMatches: async () => {
          asked = true;
          return true;
        },
        executeActions: async () => undefined,
      }),
    );

    expect(asked).toBe(true);
  });
});
