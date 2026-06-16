// @vitest-environment node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { executeRegisteredAction } from "../actions/execution.js";
import type { BrowserDriverPage } from "../browser/sessionManager.js";
import {
  createRunnerActionExecutors,
  type RunnerActionExecutorDependencies,
  type RunnerActionRuntime,
} from "./runnerActionExecutors.js";

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

    // 5. update_object_variable
    await executeRegisteredAction(executors, {
      type: "update_object_variable",
      config: { name: "obj", operation: "merge", value: '{"y": {"w": 3}}' },
    } as never);
    expect(runtime.outputs.obj).toEqual({ x: 1, y: { w: 3 } });

    runtime.outputs.obj = { x: 1, y: { z: 2 } };
    await executeRegisteredAction(executors, {
      type: "update_object_variable",
      config: { name: "obj", operation: "deep_merge", value: '{"y": {"w": 3}}' },
    } as never);
    expect(runtime.outputs.obj).toEqual({ x: 1, y: { z: 2, w: 3 } });

    await executeRegisteredAction(executors, {
      type: "update_object_variable",
      config: { name: "obj", operation: "set_key", property_key: "new_key", property_value: "42", property_value_type: "number" },
    } as never);
    expect((runtime.outputs.obj as any).new_key).toBe(42);

    await executeRegisteredAction(executors, {
      type: "update_object_variable",
      config: { name: "obj", operation: "delete_key", property_key: "new_key" },
    } as never);
    expect((runtime.outputs.obj as any).new_key).toBeUndefined();
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
      type: "evaluate_logic",
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
      type: "evaluate_logic",
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
      type: "evaluate_logic",
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
