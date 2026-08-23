// @vitest-environment node

import { describe, expect, test } from "vitest";
import { executeRegisteredAction } from "../../../actions/execution.js";
import { createRunnerActionExecutors } from "../../runnerActionExecutors.js";
import {
  minimalDependencies,
  minimalRuntime,
} from "../../testSupport/executorFixtures.js";
describe("runnerActionExecutors", () => {
  test("executes new granular boolean processing actions", async () => {
    const runtime = minimalRuntime({
      outputs: {
        flag_true: true,
        flag_false: false,
      },
    });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    // set_boolean_variable
    await executeRegisteredAction(executors, {
      type: "set_boolean_variable",
      config: { output_name: "bool_val", value: "true" },
    } as any);
    expect(runtime.outputs.bool_val).toBe(true);

    await executeRegisteredAction(executors, {
      type: "set_boolean_variable",
      config: { output_name: "bool_val_2", value: "false" },
    } as any);
    expect(runtime.outputs.bool_val_2).toBe(false);

    // generate_random_boolean
    let randomVal = 0.6;
    const customDeps = minimalDependencies({
      random: () => randomVal,
    });
    const executorsWithRandom = createRunnerActionExecutors(runtime, customDeps);
    
    await executeRegisteredAction(executorsWithRandom, {
      type: "generate_random_boolean",
      config: { output_name: "rand_bool", probability: "0.5" },
    } as any);
    expect(runtime.outputs.rand_bool).toBe(false);

    randomVal = 0.3;
    await executeRegisteredAction(executorsWithRandom, {
      type: "generate_random_boolean",
      config: { output_name: "rand_bool", probability: "0.5" },
    } as any);
    expect(runtime.outputs.rand_bool).toBe(true);

    // parse_to_boolean
    await executeRegisteredAction(executors, {
      type: "parse_to_boolean",
      config: { source: "true", output_name: "parsed" },
    } as any);
    expect(runtime.outputs.parsed).toBe(true);

    await executeRegisteredAction(executors, {
      type: "parse_to_boolean",
      config: { source: "0", output_name: "parsed" },
    } as any);
    expect(runtime.outputs.parsed).toBe(false);

    // boolean_logical_op - and
    await executeRegisteredAction(executors, {
      type: "boolean_logical_op",
      config: { operand1: "{{flag_true}}", operation: "and", operand2: "{{flag_false}}", output_name: "op_res" },
    } as any);
    expect(runtime.outputs.op_res).toBe(false);

    // boolean_logical_op - or
    await executeRegisteredAction(executors, {
      type: "boolean_logical_op",
      config: { operand1: "{{flag_true}}", operation: "or", operand2: "{{flag_false}}", output_name: "op_res" },
    } as any);
    expect(runtime.outputs.op_res).toBe(true);

    // boolean_logical_op - not
    await executeRegisteredAction(executors, {
      type: "boolean_logical_op",
      config: { operand1: "{{flag_true}}", operation: "not", output_name: "op_res" },
    } as any);
    expect(runtime.outputs.op_res).toBe(false);

    // boolean_logical_op - xor
    await executeRegisteredAction(executors, {
      type: "boolean_logical_op",
      config: { operand1: "{{flag_true}}", operation: "xor", operand2: "{{flag_false}}", output_name: "op_res" },
    } as any);
    expect(runtime.outputs.op_res).toBe(true);

    // compare_booleans
    await executeRegisteredAction(executors, {
      type: "compare_booleans",
      config: { operand1: "{{flag_true}}", operator: "eq", operand2: "{{flag_true}}", output_name: "comp_res" },
    } as any);
    expect(runtime.outputs.comp_res).toBe(true);

    await executeRegisteredAction(executors, {
      type: "compare_booleans",
      config: { operand1: "{{flag_true}}", operator: "neq", operand2: "{{flag_false}}", output_name: "comp_res" },
    } as any);
    expect(runtime.outputs.comp_res).toBe(true);

    // check_boolean_property
    await executeRegisteredAction(executors, {
      type: "check_boolean_property",
      config: { source: "{{flag_true}}", property: "is_true", output_name: "prop_res" },
    } as any);
    expect(runtime.outputs.prop_res).toBe(true);

    await executeRegisteredAction(executors, {
      type: "check_boolean_property",
      config: { source: "{{flag_true}}", property: "is_false", output_name: "prop_res" },
    } as any);
    expect(runtime.outputs.prop_res).toBe(false);
  });
});
