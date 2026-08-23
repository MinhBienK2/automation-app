// @vitest-environment node

import { describe, expect, test } from "vitest";
import { executeRegisteredAction } from "../../../actions/execution.js";
import { createRunnerActionExecutors } from "../../runnerActionExecutors.js";
import {
  minimalDependencies,
  minimalRuntime,
} from "../../testSupport/executorFixtures.js";
describe("runnerActionExecutors", () => {
  test("updates variables via new specialized update actions", async () => {
    const runtime = minimalRuntime({
      outputs: {
        num: 5,
        txt: "hello",
        flag: true,
        list: [10],
        obj: { x: 1, y: { z: 2 } },
      },
    });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    // 1. update_number_variable
    await executeRegisteredAction(executors, {
      type: "update_number_variable",
      config: { name: "num", operation: "increment" },
    } as never);
    expect(runtime.outputs.num).toBe(6);

    await executeRegisteredAction(executors, {
      type: "update_number_variable",
      config: { name: "num", operation: "add", value: "4" },
    } as never);
    expect(runtime.outputs.num).toBe(10);

    // 2. update_text_variable
    await executeRegisteredAction(executors, {
      type: "update_text_variable",
      config: { name: "txt", operation: "append", value: " world" },
    } as never);
    expect(runtime.outputs.txt).toBe("hello world");

    await executeRegisteredAction(executors, {
      type: "update_text_variable",
      config: { name: "txt", operation: "replace", search_pattern: "world", value: "there" },
    } as never);
    expect(runtime.outputs.txt).toBe("hello there");

    // 3. update_flag_variable
    await executeRegisteredAction(executors, {
      type: "update_flag_variable",
      config: { name: "flag", operation: "toggle" },
    } as never);
    expect(runtime.outputs.flag).toBe(false);

    // 4. update_list_variable
    await executeRegisteredAction(executors, {
      type: "update_list_variable",
      config: { name: "list", operation: "push", value: "20", value_type: "number" },
    } as never);
    expect(runtime.outputs.list).toEqual([10, 20]);

    await executeRegisteredAction(executors, {
      type: "update_list_variable",
      config: { name: "list", operation: "push_unique", value: "20", value_type: "number" },
    } as never);
    expect(runtime.outputs.list).toEqual([10, 20]);

    await executeRegisteredAction(executors, {
      type: "update_list_variable",
      config: { name: "list", operation: "push_unique", value: "30", value_type: "number" },
    } as never);
    expect(runtime.outputs.list).toEqual([10, 20, 30]);

    // 5. granular object actions
    // create_empty_object
    await executeRegisteredAction(executors, {
      type: "create_empty_object",
      config: { output_name: "obj" },
    } as any);
    expect(runtime.outputs.obj).toEqual({});

    // create_object_manual
    await executeRegisteredAction(executors, {
      type: "create_object_manual",
      config: {
        output_name: "obj_manual",
        fields: [
          { key: "a", value_type: "text", value: "hello" },
          { key: "b", value_type: "number", value: "42" },
          { key: "c", value_type: "boolean", value: "true" },
        ],
      },
    } as any);
    expect(runtime.outputs.obj_manual).toEqual({ a: "hello", b: 42, c: true });

    // parse_json_to_object
    await executeRegisteredAction(executors, {
      type: "parse_json_to_object",
      config: { source_text: '{"x": 10, "y": "test"}', output_name: "obj_parsed" },
    } as any);
    expect(runtime.outputs.obj_parsed).toEqual({ x: 10, y: "test" });

    // set_object_property
    runtime.outputs.obj = { profile: { age: 20 } };
    await executeRegisteredAction(executors, {
      type: "set_object_property",
      config: { name: "obj", property_key: "profile.age", value_type: "number", value: "21" },
    } as any);
    expect(runtime.outputs.obj).toEqual({ profile: { age: 21 } });

    // remove_object_property
    runtime.outputs.obj = { profile: { age: 21, name: "bob" } };
    await executeRegisteredAction(executors, {
      type: "remove_object_property",
      config: { name: "obj", property_key: "profile.name" },
    } as any);
    expect(runtime.outputs.obj).toEqual({ profile: { age: 21 } });

    // merge_objects - shallow
    runtime.outputs.obj = { a: 1, b: 2 };
    await executeRegisteredAction(executors, {
      type: "merge_objects",
      config: { name: "obj", value: '{"b": 3, "c": 4}', deep: false },
    } as any);
    expect(runtime.outputs.obj).toEqual({ a: 1, b: 3, c: 4 });

    // merge_objects - deep
    runtime.outputs.obj = { a: 1, b: { x: 10 } };
    await executeRegisteredAction(executors, {
      type: "merge_objects",
      config: { name: "obj", value: '{"b": {"y": 20}}', deep: true },
    } as any);
    expect(runtime.outputs.obj).toEqual({ a: 1, b: { x: 10, y: 20 } });

    // rename_object_property
    runtime.outputs.obj = { firstName: "John", lastName: "Doe" };
    await executeRegisteredAction(executors, {
      type: "rename_object_property",
      config: { name: "obj", old_key: "firstName", new_key: "first_name" },
    } as any);
    expect(runtime.outputs.obj).toEqual({ first_name: "John", lastName: "Doe" });

    // get_object_property
    runtime.outputs.obj = { profile: { age: 21 } };
    await executeRegisteredAction(executors, {
      type: "get_object_property",
      config: { source: "obj", property_key: "profile.age", output_name: "extracted_age" },
    } as any);
    expect(runtime.outputs.extracted_age).toBe(21);

    // get_object_keys
    runtime.outputs.obj = { name: "bob", age: 25 };
    await executeRegisteredAction(executors, {
      type: "get_object_keys",
      config: { source: "obj", output_name: "keys_list" },
    } as any);
    expect(runtime.outputs.keys_list).toEqual(["name", "age"]);

    // get_object_values
    await executeRegisteredAction(executors, {
      type: "get_object_values",
      config: { source: "obj", output_name: "values_list" },
    } as any);
    expect(runtime.outputs.values_list).toEqual(["bob", 25]);

    // stringify_object
    await executeRegisteredAction(executors, {
      type: "stringify_object",
      config: { source: "obj", output_name: "stringified" },
    } as any);
    expect(runtime.outputs.stringified).toBe('{"name":"bob","age":25}');

    // execute_object_script
    let passedArgs: any = null;
    const page = {
      evaluate: async (fn: any, args: any) => {
        passedArgs = args;
        const parsedFn = new Function("obj", `return (${args.scriptText});`);
        return parsedFn(args.obj);
      },
    } as any;
    const runtimeWithPage = minimalRuntime({ page, outputs: { myObj: { age: 25 } } });
    const executorsWithPage = createRunnerActionExecutors(runtimeWithPage, minimalDependencies());
    await executeRegisteredAction(executorsWithPage, {
      type: "execute_object_script",
      config: { source: "myObj", script: "({ ...obj, age: obj.age + 1 })", output_name: "script_out" },
    } as any);
    expect(runtimeWithPage.outputs.script_out).toEqual({ age: 26 });
    expect(passedArgs).toEqual({
      scriptText: "({ ...obj, age: obj.age + 1 })",
      obj: { age: 25 },
    });

    // check_object_key_exists
    runtime.outputs.obj = { profile: { email: "test@example.com" } };
    await executeRegisteredAction(executors, {
      type: "check_object_key_exists",
      config: { source: "obj", property_key: "profile.email", output_name: "email_exists" },
    } as any);
    expect(runtime.outputs.email_exists).toBe(true);

    await executeRegisteredAction(executors, {
      type: "check_object_key_exists",
      config: { source: "obj", property_key: "profile.phone", output_name: "phone_exists" },
    } as any);
    expect(runtime.outputs.phone_exists).toBe(false);

    // check_object_empty
    runtime.outputs.obj = {};
    await executeRegisteredAction(executors, {
      type: "check_object_empty",
      config: { source: "obj", output_name: "is_empty" },
    } as any);
    expect(runtime.outputs.is_empty).toBe(true);

    runtime.outputs.obj = { a: 1 };
    await executeRegisteredAction(executors, {
      type: "check_object_empty",
      config: { source: "obj", output_name: "is_empty_2" },
    } as any);
    expect(runtime.outputs.is_empty_2).toBe(false);
  });
  test("evaluates logic in JS script mode", async () => {
    let scriptPassedArgs: any = null;
    const page = {
      evaluate: async (fn: any, args: any) => {
        scriptPassedArgs = args;
        const parsedFn = new Function("outputs", `return (${args.scriptText});`);
        return parsedFn(args.outputs);
      },
    } as any;
    const runtime = minimalRuntime({ page, outputs: { counter: 10, status: "active" } });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    await executeRegisteredAction(executors, {
      type: "check_conditions",
      config: {
        output_name: "result",
        mode: "script",
        script: "outputs.counter > 5 && outputs.status === 'active'",
      },
    });

    expect(runtime.outputs.result).toBe(true);
    expect(scriptPassedArgs).toEqual({
      scriptText: "outputs.counter > 5 && outputs.status === 'active'",
      outputs: { counter: 10, status: "active", result: true },
    });
  });

  test("evaluates logic in JS script mode with pre-resolved template tokens", async () => {
    const page = {
      evaluate: async (fn: any, args: any) => {
        const parsedFn = new Function("outputs", `return (${args.scriptText});`);
        return parsedFn(args.outputs);
      },
    } as any;
    const runtime = minimalRuntime({ page, outputs: { counter: 10, status: "active" } });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    await executeRegisteredAction(executors, {
      type: "check_conditions",
      config: {
        output_name: "result",
        mode: "script",
        script: "10 > 5 && outputs.status === 'active'",
      },
    });

    expect(runtime.outputs.result).toBe(true);
  });

  test("evaluates logic in visual rules mode", async () => {
    const runtime = minimalRuntime({ outputs: { status: "success", count: "15" } });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    await executeRegisteredAction(executors, {
      type: "check_conditions",
      config: {
        output_name: "result",
        mode: "visual",
        rules_group: {
          operator: "and",
          rules: [
            {
              type: "value_compare",
              left_operand: "{{status}}",
              comparison: "equals",
              right_operand: "success",
            },
            {
              type: "value_compare",
              left_operand: "{{count}}",
              comparison: "greater_than",
              right_operand: "10",
            },
          ],
        },
      },
    });

    expect(runtime.outputs.result).toBe(true);
  });

  test("registers dynamic check_conditions resolver and evaluates lazily when referenced", async () => {
    let scriptCallCount = 0;
    const page = {
      evaluate: async (fn: any, args: any) => {
        scriptCallCount++;
        const parsedFn = new Function("outputs", `return (${args.scriptText});`);
        return parsedFn(args.outputs);
      },
    } as any;
    
    const outputs: Record<string, unknown> = { counter: 10 };
    const resolvers = new Map<string, any>();
    Object.defineProperty(outputs, "__dynamicResolvers", {
      value: resolvers,
      writable: true,
      enumerable: false,
    });
    
    const runtime = minimalRuntime({ page, outputs });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    await executeRegisteredAction(executors, {
      type: "check_conditions",
      config: {
        output_name: "result",
        mode: "script",
        script: "outputs.counter > 5",
        evaluation_type: "dynamic",
      },
    });

    expect(scriptCallCount).toBe(0);
    expect(resolvers.has("result")).toBe(true);

    const { resolveDynamicOutputs } = await import("../../variables.js");
    await resolveDynamicOutputs(runtime.outputs, "{{result}}");

    expect(scriptCallCount).toBe(1);
    expect(runtime.outputs.result).toBe(true);

    runtime.outputs.counter = 3;
    await resolveDynamicOutputs(runtime.outputs, "{{result}}");
    expect(scriptCallCount).toBe(2);
    expect(runtime.outputs.result).toBe(false);
  });

  test("clears dynamic resolver if variable is written statically", async () => {
    const outputs: Record<string, unknown> = {};
    const resolvers = new Map<string, any>();
    Object.defineProperty(outputs, "__dynamicResolvers", {
      value: resolvers,
      writable: true,
      enumerable: false,
    });
    const runtime = minimalRuntime({ outputs });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    await executeRegisteredAction(executors, {
      type: "check_conditions",
      config: {
        output_name: "result",
        mode: "visual",
        evaluation_type: "dynamic",
        rules_group: {
          operator: "and",
          rules: [{ type: "value_compare", left_operand: "1", comparison: "equals", right_operand: "1" }]
        }
      },
    });
    expect(resolvers.has("result")).toBe(true);

    await executeRegisteredAction(executors, {
      type: "check_conditions",
      config: {
        output_name: "result",
        mode: "visual",
        evaluation_type: "static",
        rules_group: {
          operator: "and",
          rules: [{ type: "value_compare", left_operand: "1", comparison: "equals", right_operand: "2" }]
        }
      },
    });
    expect(resolvers.has("result")).toBe(false);
    expect(runtime.outputs.result).toBe(false);
  });

  test("evaluates expression statically and returns raw calculation result", async () => {
    const page = {
      evaluate: async (fn: any, args: any) => {
        const parsedFn = new Function("outputs", `return (${args.scriptText});`);
        return parsedFn(args.outputs);
      },
    } as any;
    const runtime = minimalRuntime({ page, outputs: { A: 10, B: 5 } });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    await executeRegisteredAction(executors, {
      type: "calculate_value",
      config: {
        output_name: "result",
        expression: "outputs.A + outputs.B",
        evaluation_type: "static",
      },
    } as any);

    expect(runtime.outputs.result).toBe(15);
  });

  test("registers dynamic calculate_value resolver and evaluates raw values lazily", async () => {
    let scriptCallCount = 0;
    const page = {
      evaluate: async (fn: any, args: any) => {
        scriptCallCount++;
        const parsedFn = new Function("outputs", `return (${args.scriptText});`);
        return parsedFn(args.outputs);
      },
    } as any;
    
    const outputs: Record<string, unknown> = { A: 10, B: 5 };
    const resolvers = new Map<string, any>();
    Object.defineProperty(outputs, "__dynamicResolvers", {
      value: resolvers,
      writable: true,
      enumerable: false,
    });
    
    const runtime = minimalRuntime({ page, outputs });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    await executeRegisteredAction(executors, {
      type: "calculate_value",
      config: {
        output_name: "result",
        expression: "outputs.A + outputs.B",
        evaluation_type: "dynamic",
      },
    } as any);

    expect(scriptCallCount).toBe(0);
    expect(resolvers.has("result")).toBe(true);

    const { resolveDynamicOutputs } = await import("../../variables.js");
    await resolveDynamicOutputs(runtime.outputs, "{{result}}");

    expect(scriptCallCount).toBe(1);
    expect(runtime.outputs.result).toBe(15);

    runtime.outputs.A = 20;
    await resolveDynamicOutputs(runtime.outputs, "{{result}}");
    expect(scriptCallCount).toBe(2);
    expect(runtime.outputs.result).toBe(25);
  });
});
