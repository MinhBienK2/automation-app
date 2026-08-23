// @vitest-environment node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import { executeRegisteredAction } from "../../actions/execution.js";
import {
  createRunnerActionExecutors,
  type RunnerActionExecutorDependencies,
} from "../runnerActionExecutors.js";
import {
  minimalDependencies,
  minimalRuntime,
} from "../testSupport/executorFixtures.js";
describe("runnerActionExecutors", () => {
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

  test("labels http_request failures caused by timeout", async () => {
    const runtime = minimalRuntime();
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());
    const { promise: pendingFetch, reject } = Promise.withResolvers<unknown>();
    const fetchMock = vi.fn((_url: unknown, init: { signal: AbortSignal }) => {
      init.signal.addEventListener(
        "abort",
        () => reject(new DOMException("This operation was aborted", "AbortError")),
        { once: true },
      );
      return pendingFetch;
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      await expect(
        executeRegisteredAction(executors, {
          type: "http_request",
          config: {
            method: "GET",
            url: "https://owned.test/slow",
            output_name: "http_result",
            timeout_ms: 5,
          },
        } as never),
      ).rejects.toThrow("HTTP Request timed out after 5ms");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
