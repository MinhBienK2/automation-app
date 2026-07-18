// @vitest-environment node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { executeRegisteredAction } from "../actions/execution.js";
import type { BrowserDriverPage } from "./sessionManager.js";
import {
  createRunnerActionExecutors,
  type RunnerActionExecutorDependencies,
  type RunnerActionRuntime,
} from "./BrowserActionExecutors.js";

describe("runnerActionExecutors", () => {
  test("renders navigation templates and delegates allowlist enforcement before goto", async () => {
    const calls: string[] = [];
    const page = {
      goto: async (url: string, options?: Record<string, unknown>) => {
        calls.push(`goto:${url}:${options?.waitUntil}`);
      },
      locator: () => {
        throw new Error("not used");
      },
      evaluate: async () => "",
    } satisfies BrowserDriverPage;
    const runtime = minimalRuntime({ page, outputs: { host: "owned.test" } });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies({
      enforceNavigationPolicy: async (_runtime, url) => {
        calls.push(`policy:${url}`);
      },
    }));

    await executeRegisteredAction(executors, {
      type: "navigate",
      config: {
        url: "https://{{ host }}/dashboard",
        wait_until: "dom_content_loaded",
      },
    });

    expect(calls).toEqual([
      "policy:https://owned.test/dashboard",
      "goto:https://owned.test/dashboard:domcontentloaded",
    ]);
  });

  test("extracts regex matches from an output and appends deduped values", async () => {
    const runtime = minimalRuntime({
      outputs: {
        post_text:
          "Follow https://www.tiktok.com/@alice and @bob then https://www.tiktok.com/@alice",
        tiktok_targets: ["https://www.tiktok.com/@existing"],
      },
    });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    await executeRegisteredAction(executors, {
      type: "extract_regex_matches",
      config: {
        source_name: "post_text",
        pattern: "(?:https?:\\/\\/)?(?:www\\.)?tiktok\\.com\\/@[A-Za-z0-9._-]+|@[A-Za-z0-9._-]+",
        flags: "gi",
        output_name: "tiktok_targets",
        append: true,
        dedupe: true,
      },
    } as never);

    expect(runtime.outputs.tiktok_targets).toEqual([
      "https://www.tiktok.com/@existing",
      "https://www.tiktok.com/@alice",
      "@bob",
    ]);
  });

  test("writes output values to a run-scoped text artifact", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "wam-text-artifact-"));
    const runtime = minimalRuntime({
      outputs: {
        tiktok_targets: ["https://www.tiktok.com/@alice", "https://www.tiktok.com/@bob"],
      },
      currentStepId: "write-results",
      currentStepNumber: 7,
      currentActionType: "write_text_file",
    });
    const evidence: Array<{
      actionType: string;
      artifactKind: "screenshot" | "download";
      relativePath: string;
    }> = [];
    const executors = createRunnerActionExecutors(runtime, minimalDependencies({
      appPaths: {
        evidenceDir: path.join(tempDir, "evidence"),
      } as RunnerActionExecutorDependencies["appPaths"],
      recordEvidence: (_runtime, artifact) => evidence.push(artifact),
    }));

    await executeRegisteredAction(executors, {
      type: "write_text_file",
      config: {
        source_name: "tiktok_targets",
        path: "tiktok-usernames.txt",
        output_name: "tiktok_username_file",
      },
    } as never);

    expect(runtime.outputs.tiktok_username_file).toBe(
      "runs/run-1/downloads/007-write-results-tiktok-usernames.txt",
    );
    await expect(
      fs.readFile(
        path.join(
          tempDir,
          "evidence",
          "runs/run-1/downloads/007-write-results-tiktok-usernames.txt",
        ),
        "utf8",
      ),
    ).resolves.toBe("https://www.tiktok.com/@alice\nhttps://www.tiktok.com/@bob\n");
    expect(evidence).toEqual([
      {
        actionType: "write_text_file",
        artifactKind: "download",
        relativePath: "runs/run-1/downloads/007-write-results-tiktok-usernames.txt",
      },
    ]);
  });

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

  test("executes new granular text processing actions", async () => {
    const runtime = minimalRuntime({
      outputs: {
        txt: "hello",
        empty_var: "",
      },
    });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    // set_text_variable
    await executeRegisteredAction(executors, {
      type: "set_text_variable",
      config: { output_name: "my_str", value: "hello {{txt}}" },
    } as any);
    expect(runtime.outputs.my_str).toBe("hello hello");

    // append_text
    await executeRegisteredAction(executors, {
      type: "append_text",
      config: { name: "my_str", value: " world" },
    } as any);
    expect(runtime.outputs.my_str).toBe("hello hello world");

    // prepend_text
    await executeRegisteredAction(executors, {
      type: "prepend_text",
      config: { name: "my_str", value: "start: " },
    } as any);
    expect(runtime.outputs.my_str).toBe("start: hello hello world");

    // replace_text
    await executeRegisteredAction(executors, {
      type: "replace_text",
      config: { name: "my_str", search_pattern: "hello", replacement: "hi" },
    } as any);
    expect(runtime.outputs.my_str).toBe("start: hi hi world");

    // trim_text
    runtime.outputs.my_str = "  some text  ";
    await executeRegisteredAction(executors, {
      type: "trim_text",
      config: { name: "my_str" },
    } as any);
    expect(runtime.outputs.my_str).toBe("some text");

    // change_text_case - upper
    await executeRegisteredAction(executors, {
      type: "change_text_case",
      config: { name: "my_str", to_case: "upper" },
    } as any);
    expect(runtime.outputs.my_str).toBe("SOME TEXT");

    // change_text_case - lower
    await executeRegisteredAction(executors, {
      type: "change_text_case",
      config: { name: "my_str", to_case: "lower" },
    } as any);
    expect(runtime.outputs.my_str).toBe("some text");

    // slice_text
    await executeRegisteredAction(executors, {
      type: "slice_text",
      config: { source: "my_str", start: 0, end: 4, output_name: "sliced" },
    } as any);
    expect(runtime.outputs.sliced).toBe("some");

    // regex_extract
    runtime.outputs.my_str = "user ID: 12345";
    await executeRegisteredAction(executors, {
      type: "regex_extract",
      config: { source: "my_str", pattern: "ID: (\\d+)", group_index: 1, output_name: "extracted" },
    } as any);
    expect(runtime.outputs.extracted).toBe("12345");

    // get_text_length
    runtime.outputs.my_str = "abc";
    await executeRegisteredAction(executors, {
      type: "get_text_length",
      config: { source: "my_str", output_name: "len" },
    } as any);
    expect(runtime.outputs.len).toBe(3);

    // check_text_empty
    await executeRegisteredAction(executors, {
      type: "check_text_empty",
      config: { source: "empty_var", output_name: "is_empty" },
    } as any);
    expect(runtime.outputs.is_empty).toBe(true);

    await executeRegisteredAction(executors, {
      type: "check_text_empty",
      config: { source: "txt", output_name: "is_empty_2" },
    } as any);
    expect(runtime.outputs.is_empty_2).toBe(false);

    // check_text_contains
    await executeRegisteredAction(executors, {
      type: "check_text_contains",
      config: { source: "txt", substring: "ell", output_name: "contains_ell" },
    } as any);
    expect(runtime.outputs.contains_ell).toBe(true);

    await executeRegisteredAction(executors, {
      type: "check_text_contains",
      config: { source: "txt", substring: "world", output_name: "contains_world" },
    } as any);
    expect(runtime.outputs.contains_world).toBe(false);

    // check_text_regex_matches
    await executeRegisteredAction(executors, {
      type: "check_text_regex_matches",
      config: { source: "txt", pattern: "^h.*o$", output_name: "matches_regex" },
    } as any);
    expect(runtime.outputs.matches_regex).toBe(true);
  });

  test("updates list variable via merge and merge_unique operations", async () => {
    const runtime = minimalRuntime({
      outputs: {
        listA: [1, 2],
        listB: [2, 3],
      },
    });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    // 1. Merge A and B (with duplicates)
    await executeRegisteredAction(executors, {
      type: "update_list_variable",
      config: { name: "listA", operation: "merge", value: "{{listB}}" },
    } as never);
    expect(runtime.outputs.listA).toEqual([1, 2, 2, 3]);

    // Reset listA
    runtime.outputs.listA = [1, 2];

    // 2. Merge A and B uniquely
    await executeRegisteredAction(executors, {
      type: "update_list_variable",
      config: { name: "listA", operation: "merge_unique", value: "{{listB}}" },
    } as never);
    expect(runtime.outputs.listA).toEqual([1, 2, 3]);

    // 3. Merge with inline JSON array
    await executeRegisteredAction(executors, {
      type: "update_list_variable",
      config: { name: "listA", operation: "merge", value: "[4, 5]", value_type: "json" },
    } as never);
    expect(runtime.outputs.listA).toEqual([1, 2, 3, 4, 5]);

    // 4. Merge unique with inline JSON array and objects
    runtime.outputs.listA = [{ id: 1 }, { id: 2 }];
    await executeRegisteredAction(executors, {
      type: "update_list_variable",
      config: { name: "listA", operation: "merge_unique", value: '[{"id": 2}, {"id": 3}]', value_type: "json" },
    } as never);
    expect(runtime.outputs.listA).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
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

    const { resolveDynamicOutputs } = await import("../runtime/variables");
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

    const { resolveDynamicOutputs } = await import("../runtime/variables");
    await resolveDynamicOutputs(runtime.outputs, "{{result}}");

    expect(scriptCallCount).toBe(1);
    expect(runtime.outputs.result).toBe(15);

    runtime.outputs.A = 20;
    await resolveDynamicOutputs(runtime.outputs, "{{result}}");
    expect(scriptCallCount).toBe(2);
    expect(runtime.outputs.result).toBe(25);
  });

  test("extract_text extracts plain textContent without separator", async () => {
    const runtime = minimalRuntime();
    const mockLocator = {
      textContent: async () => "Plain text",
    } as any;

    const executors = createRunnerActionExecutors(runtime, minimalDependencies({
      locatorForAction: async () => mockLocator,
    }));

    await executeRegisteredAction(executors, {
      type: "extract_text",
      config: {
        output_name: "result",
      },
    } as any);

    expect(runtime.outputs.result).toBe("Plain text");
  });

  test("extract_text joins child nodes with custom separator", async () => {
    const runtime = minimalRuntime();
    const mockLocator = {
      evaluate: async (fn: any, separator: any) => {
        const mockChildNodes = [
          { textContent: "Hello" },
          { textContent: "" },
          { textContent: "World" },
        ];
        return mockChildNodes
          .map(node => node.textContent?.trim() || '')
          .filter(Boolean)
          .join(separator);
      },
    } as any;

    const executors = createRunnerActionExecutors(runtime, minimalDependencies({
      locatorForAction: async () => mockLocator,
    }));

    await executeRegisteredAction(executors, {
      type: "extract_text",
      config: {
        output_name: "result",
        separator: " - ",
      },
    } as any);

    expect(runtime.outputs.result).toBe("Hello - World");
  });

  test("extract_list joins child nodes within each element and joins the list as a single string", async () => {
    const runtime = minimalRuntime();
    const element1 = {
      evaluate: async (fn: any, separator: any) => {
        return ["Item", "1"].join(separator);
      },
      textContent: async () => "Item1",
    } as any;
    const element2 = {
      evaluate: async (fn: any, separator: any) => {
        return ["Item", "2"].join(separator);
      },
      textContent: async () => "Item2",
    } as any;

    const mockLocator = {
      count: async () => 2,
      nth: (index: number) => {
        return index === 0 ? element1 : element2;
      },
    } as any;

    const executors = createRunnerActionExecutors(runtime, minimalDependencies({
      locatorForAction: async () => mockLocator,
    }));

    await executeRegisteredAction(executors, {
      type: "extract_list",
      config: {
        output_name: "result_list",
        separator: " / ",
      },
    } as any);
    expect(runtime.outputs.result_list).toEqual(["Item / 1", "Item / 2"]);

    await executeRegisteredAction(executors, {
      type: "extract_list",
      config: {
        output_name: "result_joined",
        separator: " / ",
        join_list: true,
        join_separator: ", ",
      },
    } as any);
    expect(runtime.outputs.result_joined).toBe("Item / 1, Item / 2");
  });

  test("new list actions - List: Create", async () => {
    const runtime = minimalRuntime();
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    // create_empty_list
    await executeRegisteredAction(executors, {
      type: "create_empty_list",
      config: { output_name: "empty" },
    } as any);
    expect(runtime.outputs.empty).toEqual([]);

    // create_list_manual
    await executeRegisteredAction(executors, {
      type: "create_list_manual",
      config: { output_name: "manual_text", value_type: "text", items: ["hello", "world"] },
    } as any);
    expect(runtime.outputs.manual_text).toEqual(["hello", "world"]);

    await executeRegisteredAction(executors, {
      type: "create_list_manual",
      config: { output_name: "manual_num", value_type: "number", items: ["10", "20.5"] },
    } as any);
    expect(runtime.outputs.manual_num).toEqual([10, 20.5]);

    // split_text_to_list
    runtime.outputs.raw_text = "apple,banana,cherry";
    await executeRegisteredAction(executors, {
      type: "split_text_to_list",
      config: { output_name: "fruits", source_text: "{{raw_text}}", delimiter: "," },
    } as any);
    expect(runtime.outputs.fruits).toEqual(["apple", "banana", "cherry"]);

    // generate_number_range
    await executeRegisteredAction(executors, {
      type: "generate_number_range",
      config: { output_name: "range", start: 1, end: 5, step: 1 },
    } as any);
    expect(runtime.outputs.range).toEqual([1, 2, 3, 4, 5]);

    await executeRegisteredAction(executors, {
      type: "generate_number_range",
      config: { output_name: "range_step", start: 2, end: 8, step: 2 },
    } as any);
    expect(runtime.outputs.range_step).toEqual([2, 4, 6, 8]);
  });

  test("new list actions - List: Update", async () => {
    const runtime = minimalRuntime({
      outputs: {
        my_list: [1, 2, 3],
      },
    });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    // add_to_list - end
    await executeRegisteredAction(executors, {
      type: "add_to_list",
      config: { name: "my_list", position: "end", value_type: "number", value: "4" },
    } as any);
    expect(runtime.outputs.my_list).toEqual([1, 2, 3, 4]);

    // add_to_list - start
    await executeRegisteredAction(executors, {
      type: "add_to_list",
      config: { name: "my_list", position: "start", value_type: "number", value: "0" },
    } as any);
    expect(runtime.outputs.my_list).toEqual([0, 1, 2, 3, 4]);

    // add_to_list - unique_end
    await executeRegisteredAction(executors, {
      type: "add_to_list",
      config: { name: "my_list", position: "unique_end", value_type: "number", value: "3" },
    } as any);
    expect(runtime.outputs.my_list).toEqual([0, 1, 2, 3, 4]);

    // remove_from_list_by_index
    await executeRegisteredAction(executors, {
      type: "remove_from_list_by_index",
      config: { name: "my_list", index: 1 },
    } as any);
    expect(runtime.outputs.my_list).toEqual([0, 2, 3, 4]);

    // remove_from_list_by_value
    await executeRegisteredAction(executors, {
      type: "remove_from_list_by_value",
      config: { name: "my_list", value_type: "number", value: "3" },
    } as any);
    expect(runtime.outputs.my_list).toEqual([0, 2, 4]);

    // merge_lists
    runtime.outputs.other_list = [5, 6, 2];
    await executeRegisteredAction(executors, {
      type: "merge_lists",
      config: { name: "my_list", value: "{{other_list}}", unique: false },
    } as any);
    expect(runtime.outputs.my_list).toEqual([0, 2, 4, 5, 6, 2]);

    await executeRegisteredAction(executors, {
      type: "merge_lists",
      config: { name: "my_list", value: "[6, 7]", unique: true },
    } as any);
    expect(runtime.outputs.my_list).toEqual([0, 2, 4, 5, 6, 2, 7]);
  });

  test("new list actions - List: Process", async () => {
    const page = {
      evaluate: async (fn: any, args: any) => {
        const { scriptText, list } = args;
        const parsedFn = new Function("list", `return (${scriptText});`);
        return parsedFn(list);
      },
    } as any;

    const runtime = minimalRuntime({
      page,
      outputs: {
        my_list: ["a", "b", "c"],
        obj_list: [{ id: 1, v: "x" }, { id: 2, v: "y" }],
      },
    });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    // get_list_item - first
    await executeRegisteredAction(executors, {
      type: "get_list_item",
      config: { source: "my_list", position: "first", output_name: "item_first" },
    } as any);
    expect(runtime.outputs.item_first).toBe("a");

    // get_list_item - last
    await executeRegisteredAction(executors, {
      type: "get_list_item",
      config: { source: "my_list", position: "last", output_name: "item_last" },
    } as any);
    expect(runtime.outputs.item_last).toBe("c");

    // get_list_item - index
    await executeRegisteredAction(executors, {
      type: "get_list_item",
      config: { source: "my_list", position: "index", index: 1, output_name: "item_index" },
    } as any);
    expect(runtime.outputs.item_index).toBe("b");

    // get_list_length
    await executeRegisteredAction(executors, {
      type: "get_list_length",
      config: { source: "my_list", output_name: "len" },
    } as any);
    expect(runtime.outputs.len).toBe(3);

    // slice_list
    await executeRegisteredAction(executors, {
      type: "slice_list",
      config: { source: "my_list", start: 1, end: 3, output_name: "sliced" },
    } as any);
    expect(runtime.outputs.sliced).toEqual(["b", "c"]);

    // join_list
    await executeRegisteredAction(executors, {
      type: "join_list",
      config: { source: "my_list", separator: "-", output_name: "joined" },
    } as any);
    expect(runtime.outputs.joined).toBe("a-b-c");

    // map_list_property
    await executeRegisteredAction(executors, {
      type: "map_list_property",
      config: { source: "obj_list", property_key: "v", output_name: "mapped" },
    } as any);
    expect(runtime.outputs.mapped).toEqual(["x", "y"]);

    // sort_reverse_list - reverse
    await executeRegisteredAction(executors, {
      type: "sort_reverse_list",
      config: { source: "my_list", action: "reverse", output_name: "reversed" },
    } as any);
    expect(runtime.outputs.reversed).toEqual(["c", "b", "a"]);

    // sort_reverse_list - sort_asc
    runtime.outputs.unsorted = [3, 1, 2];
    await executeRegisteredAction(executors, {
      type: "sort_reverse_list",
      config: { source: "unsorted", action: "sort_asc", output_name: "sorted_asc" },
    } as any);
    expect(runtime.outputs.sorted_asc).toEqual([1, 2, 3]);

    // execute_list_script
    await executeRegisteredAction(executors, {
      type: "execute_list_script",
      config: { source: "my_list", script: "list.map(x => x.toUpperCase())", output_name: "script_res" },
    } as any);
    expect(runtime.outputs.script_res).toEqual(["A", "B", "C"]);
  });

  test("get_list_item fallback during run from selected loop prelude step", async () => {
    const runtime = minimalRuntime({
      outputs: {},
    });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    // Normal behavior: non-existent list returns undefined
    await executeRegisteredAction(executors, {
      type: "get_list_item",
      config: { source: "missing_list", position: "first", output_name: "link_var" },
    } as any);
    expect(runtime.outputs.link_var).toBeUndefined();

    // Prelude behavior: missing list gets fallback mock value based on variable name
    runtime.currentStepId = "__prelude:loop_item:loop-1";
    
    // Link/URL variable name
    await executeRegisteredAction(executors, {
      type: "get_list_item",
      config: { source: "missing_list", position: "first", output_name: "link_var" },
    } as any);
    expect(runtime.outputs.link_var).toBe("https://www.tiktok.com/@tiktok");

    // Video variable name
    await executeRegisteredAction(executors, {
      type: "get_list_item",
      config: { source: "missing_list", position: "first", output_name: "video_url" },
    } as any);
    expect(runtime.outputs.video_url).toBe("https://www.tiktok.com/@tiktok/video/7350000000000000000");

    // Username/user variable name
    await executeRegisteredAction(executors, {
      type: "get_list_item",
      config: { source: "missing_list", position: "first", output_name: "username" },
    } as any);
    expect(runtime.outputs.username).toBe("tiktok");

    // ID variable name
    await executeRegisteredAction(executors, {
      type: "get_list_item",
      config: { source: "missing_list", position: "first", output_name: "some_id" },
    } as any);
    expect(runtime.outputs.some_id).toBe("1234567890");

    // Count/index variable name
    await executeRegisteredAction(executors, {
      type: "get_list_item",
      config: { source: "missing_list", position: "first", output_name: "loop_index" },
    } as any);
    expect(runtime.outputs.loop_index).toBe("1");

    // Other/unknown variable name
    await executeRegisteredAction(executors, {
      type: "get_list_item",
      config: { source: "missing_list", position: "first", output_name: "other_field" },
    } as any);
    expect(runtime.outputs.other_field).toBe("mock_other_field");

    // Empty list also gets fallback mock value
    runtime.outputs.empty_list = [];
    await executeRegisteredAction(executors, {
      type: "get_list_item",
      config: { source: "empty_list", position: "first", output_name: "empty_link" },
    } as any);
    expect(runtime.outputs.empty_link).toBe("https://www.tiktok.com/@tiktok");
  });


  test("new list actions - List: Conditions", async () => {
    const runtime = minimalRuntime({
      outputs: {
        empty_list: [],
        non_empty: [10, 20, 30],
      },
    });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    // check_list_empty - empty
    await executeRegisteredAction(executors, {
      type: "check_list_empty",
      config: { source: "empty_list", output_name: "is_empty" },
    } as any);
    expect(runtime.outputs.is_empty).toBe(true);

    // check_list_empty - non_empty
    await executeRegisteredAction(executors, {
      type: "check_list_empty",
      config: { source: "non_empty", output_name: "is_empty_2" },
    } as any);
    expect(runtime.outputs.is_empty_2).toBe(false);

    // check_list_contains
    await executeRegisteredAction(executors, {
      type: "check_list_contains",
      config: { source: "non_empty", value_type: "number", value: "20", output_name: "contains_20" },
    } as any);
    expect(runtime.outputs.contains_20).toBe(true);

    await executeRegisteredAction(executors, {
      type: "check_list_contains",
      config: { source: "non_empty", value_type: "number", value: "40", output_name: "contains_40" },
    } as any);
    expect(runtime.outputs.contains_40).toBe(false);
  });

  test("new list actions - List: Conditions with Match Rules", async () => {
    const runtime = minimalRuntime({
      outputs: {
        users: [
          { name: "alice", age: 25 },
          { name: "bob", age: 35 },
        ],
      },
    });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    // check_list_any_match - any user age > 30 (should be true because of bob)
    await executeRegisteredAction(executors, {
      type: "check_list_any_match",
      config: {
        source: "users",
        output_name: "has_old_user",
        rules_group: {
          operator: "and",
          rules: [
            {
              type: "value_compare",
              left_operand: "{{item.age}}",
              comparison: "greater_than",
              right_operand: "30",
            },
          ],
        },
      },
    } as any);
    expect(runtime.outputs.has_old_user).toBe(true);

    // check_list_all_match - all users age > 30 (should be false because of alice)
    await executeRegisteredAction(executors, {
      type: "check_list_all_match",
      config: {
        source: "users",
        output_name: "all_old_users",
        rules_group: {
          operator: "and",
          rules: [
            {
              type: "value_compare",
              left_operand: "{{item.age}}",
              comparison: "greater_than",
              right_operand: "30",
            },
          ],
        },
      },
    } as any);
    expect(runtime.outputs.all_old_users).toBe(false);

    // filter_list - filter users age > 30 (should return array with bob only)
    await executeRegisteredAction(executors, {
      type: "filter_list",
      config: {
        source: "users",
        output_name: "old_users_filtered",
        rules_group: {
          operator: "and",
          rules: [
            {
              type: "value_compare",
              left_operand: "{{item.age}}",
              comparison: "greater_than",
              right_operand: "30",
            },
          ],
        },
      },
    } as any);
    expect(runtime.outputs.old_users_filtered).toEqual([{ name: "bob", age: 35 }]);
  });

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

  test("extract_text_content, extract_inner_html, extract_outer_html, extract_computed_style, extract_all_attributes work correctly", async () => {
    const runtime = minimalRuntime();
    const mockLocator = {
      textContent: async () => "Plain text",
      innerHTML: async () => "<span>HTML</span>",
      evaluate: async (fn: any, arg?: any) => {
        const mockEl = {
          innerHTML: "<span>HTML</span>",
          outerHTML: "<div>Outer</div>",
          attributes: [
            { name: "class", value: "test-class" },
            { name: "data-id", value: "123" },
          ],
        };
        if (arg === "background-color") {
          return "rgb(255, 0, 0)";
        }
        return fn(mockEl, arg);
      },
    } as any;

    const executors = createRunnerActionExecutors(runtime, minimalDependencies({
      locatorForAction: async () => mockLocator,
    }));

    await executeRegisteredAction(executors, {
      type: "extract_text_content",
      config: { output_name: "text" },
    } as any);
    expect(runtime.outputs.text).toBe("Plain text");

    await executeRegisteredAction(executors, {
      type: "extract_inner_html",
      config: { output_name: "inner" },
    } as any);
    expect(runtime.outputs.inner).toBe("<span>HTML</span>");

    await executeRegisteredAction(executors, {
      type: "extract_outer_html",
      config: { output_name: "outer" },
    } as any);
    expect(runtime.outputs.outer).toBe("<div>Outer</div>");

    await executeRegisteredAction(executors, {
      type: "extract_computed_style",
      config: { property: "background-color", output_name: "color" },
    } as any);
    expect(runtime.outputs.color).toBe("rgb(255, 0, 0)");

    await executeRegisteredAction(executors, {
      type: "extract_all_attributes",
      config: { output_name: "attrs" },
    } as any);
    expect(runtime.outputs.attrs).toEqual({
      class: "test-class",
      "data-id": "123",
    });
  });

  test("extract_numbers, extract_urls, extract_emails pattern extractors work correctly", async () => {
    const runtime = minimalRuntime();
    runtime.outputs.source = "Call me at +1 234-567-8900 or email at test@example.com. Visit https://google.com.";

    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    await executeRegisteredAction(executors, {
      type: "extract_numbers",
      config: { source_name: "source", output_name: "numbers" },
    } as any);
    expect(runtime.outputs.numbers).toEqual([1, 234, -567, -8900]);

    await executeRegisteredAction(executors, {
      type: "extract_urls",
      config: { source_name: "source", output_name: "urls" },
    } as any);
    expect(runtime.outputs.urls).toEqual(["https://google.com."]);

    await executeRegisteredAction(executors, {
      type: "extract_emails",
      config: { source_name: "source", output_name: "emails" },
    } as any);
    expect(runtime.outputs.emails).toEqual(["test@example.com"]);
  });

function minimalDependencies(
  overrides: Partial<RunnerActionExecutorDependencies> = {},
): RunnerActionExecutorDependencies {
  return {
    appPaths: { evidenceDir: "/tmp/evidence" } as RunnerActionExecutorDependencies["appPaths"],
    random: () => 0,
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
