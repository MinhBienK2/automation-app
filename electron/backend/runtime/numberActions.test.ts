// @vitest-environment node

import { describe, expect, test } from "vitest";
import { executeRegisteredAction } from "../actions/execution.js";
import {
  createRunnerActionExecutors,
  type RunnerActionExecutorDependencies,
  type RunnerActionRuntime,
} from "../browser/BrowserActionExecutors.js";

function minimalRuntime(overrides: Partial<RunnerActionRuntime> = {}): RunnerActionRuntime {
  const page = overrides.page ?? {
    goto: async () => undefined,
    locator: () => {
      throw new Error("not used");
    },
    evaluate: async () => "",
  };
  return {
    runId: "run-1",
    settings: {
      run_policy: { execute_js_enabled: true },
    } as RunnerActionRuntime["settings"],
    context: {
      pages: () => [page],
      newPage: async () => page,
      close: async () => undefined,
    },
    page,
    domainPolicy: null,
    outputs: {},
    elementRefs: new Map(),
    traces: [],
    evidence: [],
    currentStepNumber: null,
    currentStepId: null,
    currentStepName: null,
    currentActionType: null,
    currentActionSummary: null,
    currentStepMetadata: null,
    liveState: {
      status: "running",
      mode: "run_workflow",
      target_step_id: null,
      current_step_id: null,
      current_step_number: null,
      completed_step_ids: [],
      outputs: {},
      retained_session: null,
      error: null,
    },
    clipboard: "",
    signal: undefined,
    ...overrides,
  };
}

function minimalDependencies(
  overrides: Partial<RunnerActionExecutorDependencies> = {},
): RunnerActionExecutorDependencies {
  return {
    appPaths: { evidenceDir: "/tmp/evidence" } as RunnerActionExecutorDependencies["appPaths"],
    random: () => 0.5,
    sleep: async () => undefined,
    enforceNavigationPolicy: async () => undefined,
    executeWait: async () => undefined,
    locatorForAction: async () => {
      throw new Error("locatorForAction not configured");
    },
    executeFindElement: async () => undefined,
    executeDragAndDrop: async () => undefined,
    executeScroll: async () => undefined,
    pressKeyHuman: async () => undefined,
    pressHotkeyHuman: async () => undefined,
    executePasteClipboard: async () => undefined,
    locatorForCustomSelectTrigger: async () => {
      throw new Error("locatorForCustomSelectTrigger not configured");
    },
    registerDialogHandler: () => undefined,
    waitForDownload: async () => "download",
    executeActions: async () => undefined,
    executeLoopBody: async () => "completed",
    executeRetry: async () => undefined,
    executeLoop: async () => "predicate_false",
    conditionMatches: async () => false,
    recordEvidence: () => undefined,
    createLoopControl: (kind) => new Error(kind),
    createRunnerStop: (_status, message) => new Error(message),
    ...overrides,
  };
}

describe("number actions execution", () => {
  test("set_number_variable", async () => {
    const runtime = minimalRuntime({
      outputs: {
        other_var: 42,
      },
    });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    // Static value
    await executeRegisteredAction(executors, {
      type: "set_number_variable",
      config: { output_name: "num1", value: "10.5" },
    } as any);
    expect(runtime.outputs.num1).toBe(10.5);

    // Template value
    await executeRegisteredAction(executors, {
      type: "set_number_variable",
      config: { output_name: "num2", value: "{{other_var}}" },
    } as any);
    expect(runtime.outputs.num2).toBe(42);
  });

  test("generate_random_number", async () => {
    const runtime = minimalRuntime();
    // mock random returns 0.5
    const executors = createRunnerActionExecutors(
      runtime,
      minimalDependencies({ random: () => 0.5 }),
    );

    // Integer only
    await executeRegisteredAction(executors, {
      type: "generate_random_number",
      config: { output_name: "rand_int", min: "1", max: "10", integer: true },
    } as any);
    // min + floor(0.5 * (10 - 1 + 1)) = 1 + floor(5) = 6
    expect(runtime.outputs.rand_int).toBe(6);

    // Float/Decimal
    await executeRegisteredAction(executors, {
      type: "generate_random_number",
      config: { output_name: "rand_float", min: "1.5", max: "3.5", integer: false },
    } as any);
    // min + 0.5 * (max - min) = 1.5 + 0.5 * 2.0 = 2.5
    expect(runtime.outputs.rand_float).toBe(2.5);
  });

  test("parse_text_to_number", async () => {
    const runtime = minimalRuntime({
      outputs: {
        raw_text: "  123.45  ",
        invalid_text: "abc",
      },
    });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    // Valid float parsing
    await executeRegisteredAction(executors, {
      type: "parse_text_to_number",
      config: { source: "{{raw_text}}", fallback: "0", output_name: "parsed1" },
    } as any);
    expect(runtime.outputs.parsed1).toBe(123.45);

    // Invalid text with fallback
    await executeRegisteredAction(executors, {
      type: "parse_text_to_number",
      config: { source: "{{invalid_text}}", fallback: "99.9", output_name: "parsed2" },
    } as any);
    expect(runtime.outputs.parsed2).toBe(99.9);
  });

  test("math_operation", async () => {
    const runtime = minimalRuntime({
      outputs: {
        val1: 5,
        val2: 3,
      },
    });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    const testMath = async (op: string, expected: number, op2?: string) => {
      await executeRegisteredAction(executors, {
        type: "math_operation",
        config: {
          operand1: "{{val1}}",
          operation: op,
          operand2: op2 ?? "{{val2}}",
          output_name: "math_res",
        },
      } as any);
      expect(runtime.outputs.math_res).toBe(expected);
    };

    await testMath("add", 8);
    await testMath("subtract", 2);
    await testMath("multiply", 15);
    await testMath("divide", 5 / 3);
    await testMath("modulo", 2);
    await testMath("power", 125);
    await testMath("abs", 5, ""); // Unary abs(5)
    
    // Test abs with negative
    runtime.outputs.val1 = -10;
    await testMath("abs", 10, "");

    // Test sqrt
    runtime.outputs.val1 = 16;
    await testMath("sqrt", 4, "");

    // Test min
    runtime.outputs.val1 = 12;
    await testMath("min", 3);

    // Test max
    await testMath("max", 12);
  });

  test("round_number", async () => {
    const runtime = minimalRuntime();
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    // Round mode round (nearest)
    await executeRegisteredAction(executors, {
      type: "round_number",
      config: { source: "1.55", mode: "round", decimals: "1", output_name: "res" },
    } as any);
    expect(runtime.outputs.res).toBe(1.6);

    // Round mode floor
    await executeRegisteredAction(executors, {
      type: "round_number",
      config: { source: "1.55", mode: "floor", decimals: "1", output_name: "res" },
    } as any);
    expect(runtime.outputs.res).toBe(1.5);

    // Round mode ceil
    await executeRegisteredAction(executors, {
      type: "round_number",
      config: { source: "1.51", mode: "ceil", decimals: "1", output_name: "res" },
    } as any);
    expect(runtime.outputs.res).toBe(1.6);
  });

  test("format_number", async () => {
    const runtime = minimalRuntime();
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    // Style decimal
    await executeRegisteredAction(executors, {
      type: "format_number",
      config: {
        source: "1234.567",
        format: "decimal",
        decimals: "2",
        locale: "en-US",
        output_name: "res",
      },
    } as any);
    expect(runtime.outputs.res).toBe("1,234.57");

    // Style currency
    await executeRegisteredAction(executors, {
      type: "format_number",
      config: {
        source: "1234.56",
        format: "currency",
        currency_code: "USD",
        locale: "en-US",
        output_name: "res",
      },
    } as any);
    expect(runtime.outputs.res).toBe("$1,234.56");

    // Style percent
    await executeRegisteredAction(executors, {
      type: "format_number",
      config: {
        source: "0.123",
        format: "percent",
        decimals: "0",
        locale: "en-US",
        output_name: "res",
      },
    } as any);
    expect(runtime.outputs.res).toBe("12%");
  });

  test("compare_numbers", async () => {
    const runtime = minimalRuntime();
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    const testCompare = async (op: string, expected: boolean) => {
      await executeRegisteredAction(executors, {
        type: "compare_numbers",
        config: { operand1: "10", operator: op, operand2: "5", output_name: "res" },
      } as any);
      expect(runtime.outputs.res).toBe(expected);
    };

    await testCompare("gt", true);
    await testCompare("gte", true);
    await testCompare("lt", false);
    await testCompare("lte", false);
    await testCompare("eq", false);
    await testCompare("neq", true);
  });

  test("check_number_range", async () => {
    const runtime = minimalRuntime();
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    // Inclusive - value equals min
    await executeRegisteredAction(executors, {
      type: "check_number_range",
      config: { value: "5", min: "5", max: "10", inclusive: true, output_name: "res" },
    } as any);
    expect(runtime.outputs.res).toBe(true);

    // Exclusive - value equals min
    await executeRegisteredAction(executors, {
      type: "check_number_range",
      config: { value: "5", min: "5", max: "10", inclusive: false, output_name: "res" },
    } as any);
    expect(runtime.outputs.res).toBe(false);

    // Outside range
    await executeRegisteredAction(executors, {
      type: "check_number_range",
      config: { value: "11", min: "5", max: "10", inclusive: true, output_name: "res" },
    } as any);
    expect(runtime.outputs.res).toBe(false);
  });

  test("check_number_property", async () => {
    const runtime = minimalRuntime();
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    const testProperty = async (val: string, prop: string, expected: boolean) => {
      await executeRegisteredAction(executors, {
        type: "check_number_property",
        config: { value: val, property: prop, output_name: "res" },
      } as any);
      expect(runtime.outputs.res).toBe(expected);
    };

    await testProperty("4", "even", true);
    await testProperty("5", "even", false);
    await testProperty("5", "odd", true);
    await testProperty("4.5", "integer", false);
    await testProperty("4.0", "integer", true);
    await testProperty("0.1", "positive", true);
    await testProperty("-1", "positive", false);
    await testProperty("-5", "negative", true);
  });
});
