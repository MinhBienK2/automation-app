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

  test("updates variables via push and merge operations", async () => {
    const runtime = minimalRuntime({
      outputs: {
        existing_array: [1, 2],
        existing_obj: { a: 1 },
      },
    });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    // 1. push text into existing array
    await executeRegisteredAction(executors, {
      type: "update_variable",
      config: {
        name: "existing_array",
        operation: "push",
        value: "three",
        value_type: "text",
      },
    } as never);

    expect(runtime.outputs.existing_array).toEqual([1, 2, "three"]);

    // 2. push json object into existing array
    await executeRegisteredAction(executors, {
      type: "update_variable",
      config: {
        name: "existing_array",
        operation: "push",
        value: '{"ok": true}',
        value_type: "json",
      },
    } as never);

    expect(runtime.outputs.existing_array).toEqual([1, 2, "three", { ok: true }]);

    // 3. push to non-existent array (should initialize to empty first)
    await executeRegisteredAction(executors, {
      type: "update_variable",
      config: {
        name: "new_array",
        operation: "push",
        value: "42",
        value_type: "number",
      },
    } as never);

    expect(runtime.outputs.new_array).toEqual([42]);

    // 4. merge json object into existing object
    await executeRegisteredAction(executors, {
      type: "update_variable",
      config: {
        name: "existing_obj",
        operation: "merge",
        value: '{"b": 2, "c": "=1 + 2"}',
      },
    } as never);

    expect(runtime.outputs.existing_obj).toEqual({ a: 1, b: 2, c: 3 });
    // Dotted paths should be flattened
    expect(runtime.outputs["existing_obj.a"]).toBe(1);
    expect(runtime.outputs["existing_obj.b"]).toBe(2);
    expect(runtime.outputs["existing_obj.c"]).toBe(3);

    // 5. merge json object into non-existent object (should initialize to empty first)
    await executeRegisteredAction(executors, {
      type: "update_variable",
      config: {
        name: "new_obj",
        operation: "merge",
        value: '{"hello": "world"}',
      },
    } as never);

    expect(runtime.outputs.new_obj).toEqual({ hello: "world" });
    expect(runtime.outputs["new_obj.hello"]).toBe("world");
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
