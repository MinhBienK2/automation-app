// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { runPlan, type BrowserAutomationAdapter, type RunnerEvent } from "./runnerCore";
import type { RunPlan, StartRunPayload } from "../shared/product";

let artifactDir = "";

beforeEach(() => {
  artifactDir = mkdtempSync(path.join(tmpdir(), "cloak-runner-"));
});

afterEach(() => {
  rmSync(artifactDir, { recursive: true, force: true });
});

function basePlan(steps: RunPlan["steps"]): RunPlan {
  return {
    schemaVersion: 1,
    workflowId: "wf_1",
    graphVersionId: "gv_1",
    steps,
    nodeMap: Object.fromEntries(steps.map((step) => [step.sourceNodeId, step.id])),
  };
}

function payload(plan: RunPlan): StartRunPayload {
  return {
    protocolVersion: 1,
    runId: "run_1",
    workflowId: "wf_1",
    runPlan: plan,
    runProfileSnapshot: { timeoutMs: 30_000, evidencePolicy: { screenshots: true } },
    identityProfileSnapshot: {
      id: "id_default",
      name: "Default CloakBrowser",
      browserEngine: "cloakbrowser",
      headless: true,
      viewport: { width: 1280, height: 720 },
      profileReuseEnabled: false,
    },
    environmentSnapshot: { initialVariables: { username: "ada" } },
    artifactDirectories: {
      root: artifactDir,
      screenshots: path.join(artifactDir, "screenshots"),
      downloads: path.join(artifactDir, "downloads"),
      traces: path.join(artifactDir, "traces"),
      evidence: path.join(artifactDir, "evidence"),
    },
    operatorPolicySnapshot: {
      allowedOrigins: ["https://owned.example.test"],
      maxConcurrency: 1,
    },
  };
}

function fakeAdapter(): BrowserAutomationAdapter {
  return {
    async launch() {},
    async close() {},
    async navigate() {},
    async click() {},
    async fill() {},
    async wait() {},
    async screenshot({ path: screenshotPath }) {
      return Buffer.from(`screenshot:${screenshotPath}`);
    },
    async extractText() {
      return "Welcome Ada";
    },
  };
}

describe("CloakRunner core", () => {
  test("emits deterministic events and registers screenshot artifacts", async () => {
    const events: RunnerEvent[] = [];
    const plan = basePlan([
      {
        id: "step_nav",
        sourceNodeId: "nav",
        actionType: "navigate",
        label: "Navigate",
        config: { type: "navigate", url: "https://owned.example.test/login" },
      },
      {
        id: "step_shot",
        sourceNodeId: "shot",
        actionType: "take_screenshot",
        label: "Screenshot",
        config: { type: "take_screenshot", fileName: "final.png" },
      },
    ]);

    const result = await runPlan(payload(plan), fakeAdapter(), {
      emit: (event) => events.push(event),
    });

    expect(result.status).toBe("completed");
    expect(events.map((event) => event.type)).toEqual([
      "run.started",
      "identity.profileResolved",
      "step.started",
      "step.completed",
      "step.started",
      "artifact.created",
      "step.completed",
      "run.completed",
    ]);
    expect(events.find((event) => event.type === "artifact.created")).toMatchObject({
      payload: expect.objectContaining({
        type: "screenshot",
        relativePath: "runs/run_1/screenshots/final.png",
        sanitized: true,
      }),
    });
    expect(readFileSync(path.join(artifactDir, "screenshots", "final.png"), "utf8")).toContain(
      "screenshot:",
    );
  });

  test("continues after screenshot artifact write failure when evidence policy is not strict", async () => {
    const events: RunnerEvent[] = [];
    const plan = basePlan([
      {
        id: "step_shot",
        sourceNodeId: "shot",
        actionType: "take_screenshot",
        label: "Screenshot",
        config: { type: "take_screenshot", fileName: "missing/final.png" },
      },
    ]);
    const runPayload = payload(plan);
    runPayload.runProfileSnapshot.evidencePolicy = { screenshots: true, strict: false };

    const result = await runPlan(runPayload, fakeAdapter(), {
      emit: (event) => events.push(event),
    });

    expect(result.status).toBe("completed");
    expect(events.map((event) => event.type)).toEqual([
      "run.started",
      "identity.profileResolved",
      "step.started",
      "issue.created",
      "step.completed",
      "run.completed",
    ]);
    expect(events.find((event) => event.type === "issue.created")).toMatchObject({
      severity: "warning",
      payload: expect.objectContaining({
        category: "system",
        artifactType: "screenshot",
      }),
    });
  });

  test("fails screenshot artifact write failures when evidence policy is strict", async () => {
    const events: RunnerEvent[] = [];
    const plan = basePlan([
      {
        id: "step_shot",
        sourceNodeId: "shot",
        actionType: "take_screenshot",
        label: "Screenshot",
        config: { type: "take_screenshot", fileName: "missing/final.png" },
      },
    ]);
    const runPayload = payload(plan);
    runPayload.runProfileSnapshot.evidencePolicy = { screenshots: true, strict: true };

    const result = await runPlan(runPayload, fakeAdapter(), {
      emit: (event) => events.push(event),
    });

    expect(result.status).toBe("failed");
    expect(events.map((event) => event.type)).toEqual([
      "run.started",
      "identity.profileResolved",
      "step.started",
      "issue.created",
      "step.failed",
      "run.failed",
    ]);
    expect(events.find((event) => event.type === "issue.created")).toMatchObject({
      severity: "error",
      payload: expect.objectContaining({ category: "system" }),
    });
    expect(events.find((event) => event.type === "run.failed")).toMatchObject({
      payload: expect.objectContaining({ category: "system" }),
    });
  });

  test("blocks navigation outside the operator allowlist before page action", async () => {
    const events: RunnerEvent[] = [];
    const plan = basePlan([
      {
        id: "step_nav",
        sourceNodeId: "nav",
        actionType: "navigate",
        label: "Navigate outside",
        config: { type: "navigate", url: "https://outside.example.test" },
      },
    ]);

    const result = await runPlan(payload(plan), fakeAdapter(), {
      emit: (event) => events.push(event),
    });

    expect(result.status).toBe("failed");
    expect(events.map((event) => event.type)).toEqual([
      "run.started",
      "identity.profileResolved",
      "step.started",
      "issue.created",
      "step.failed",
      "run.failed",
    ]);
    expect(events.find((event) => event.type === "issue.created")).toMatchObject({
      severity: "error",
      payload: expect.objectContaining({ category: "policy" }),
    });
  });

  test("emits one terminal cancellation event when cancelled between actions", async () => {
    const events: RunnerEvent[] = [];
    let cancelled = false;
    const plan = basePlan([
      {
        id: "step_wait",
        sourceNodeId: "wait",
        actionType: "wait",
        label: "Wait",
        config: { type: "wait", durationMs: 5 },
      },
      {
        id: "step_click",
        sourceNodeId: "click",
        actionType: "click",
        label: "Click",
        config: {
          type: "click",
          locator: { strategy: "text", value: "Continue", filters: { visible: true }, fallbacks: [] },
        },
      },
    ]);

    const result = await runPlan(payload(plan), fakeAdapter(), {
      emit: (event) => {
        events.push(event);
        if (event.type === "step.completed") {
          cancelled = true;
        }
      },
      isCancelled: () => cancelled,
    });

    expect(result.status).toBe("cancelled");
    expect(events.filter((event) => event.type === "run.cancelled")).toHaveLength(1);
    expect(events.some((event) => event.type === "run.completed")).toBe(false);
  });

  test("blocks workflow actions when owned fingerprint preflight returns a blocking verdict", async () => {
    const events: RunnerEvent[] = [];
    let clickExecuted = false;
    const adapter = fakeAdapter();
    adapter.extractText = async () =>
      JSON.stringify({
        passed: false,
        verdict: "blocked",
        risk_score: 92,
        run_id: "probe-run-1",
        profile_id: "id_default",
        mismatches: [{ field: "timezone", severity: "error" }],
        evidence: { families: ["browser", "network"] },
      });
    adapter.click = async () => {
      clickExecuted = true;
    };
    const plan = basePlan([
      {
        id: "step_click",
        sourceNodeId: "click",
        actionType: "click",
        label: "Click",
        config: {
          type: "click",
          locator: { strategy: "text", value: "Continue", filters: { visible: true }, fallbacks: [] },
        },
      },
    ]);
    const runPayload = payload(plan);
    runPayload.identityProfileSnapshot.preflightPolicy = {
      enabled: true,
      probeUrl: "https://owned.example.test/fingerprint",
      allowedOrigins: ["https://owned.example.test"],
    };

    const result = await runPlan(runPayload, adapter, {
      emit: (event) => events.push(event),
    });

    expect(result.status).toBe("failed");
    expect(clickExecuted).toBe(false);
    expect(events.map((event) => event.type)).toEqual([
      "run.started",
      "identity.profileResolved",
      "preflight.started",
      "preflight.verdictReceived",
      "issue.created",
      "preflight.failed",
      "run.failed",
    ]);
    expect(events.find((event) => event.type === "preflight.verdictReceived")).toMatchObject({
      payload: expect.objectContaining({
        verdict: "blocked",
        passed: false,
        profile_id: "id_default",
      }),
    });
  });

  test("retries failed actions and emits retry events before succeeding", async () => {
    const events: RunnerEvent[] = [];
    let attempts = 0;
    const adapter = fakeAdapter();
    adapter.click = async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("temporary actionability failure");
      }
    };
    const plan = basePlan([
      {
        id: "step_click",
        sourceNodeId: "click",
        actionType: "click",
        label: "Click",
        config: {
          type: "click",
          locator: { strategy: "text", value: "Continue", filters: { visible: true }, fallbacks: [] },
        },
        retry: { attempts: 2, intervalMs: 0 },
      },
    ]);

    const result = await runPlan(payload(plan), adapter, {
      emit: (event) => events.push(event),
    });

    expect(result.status).toBe("completed");
    expect(attempts).toBe(2);
    expect(events.map((event) => event.type)).toEqual([
      "run.started",
      "identity.profileResolved",
      "step.started",
      "action.retrying",
      "step.completed",
      "run.completed",
    ]);
    expect(events.find((event) => event.type === "action.retrying")).toMatchObject({
      payload: expect.objectContaining({
        attempt: 1,
        nextAttempt: 2,
        maxAttempts: 2,
        reason: "temporary actionability failure",
      }),
    });
  });

  test("fails an action once when its runner timeout expires", async () => {
    const events: RunnerEvent[] = [];
    const adapter = fakeAdapter();
    adapter.wait = () => new Promise(() => undefined);
    const plan = basePlan([
      {
        id: "step_wait",
        sourceNodeId: "wait",
        actionType: "wait",
        label: "Wait forever",
        config: { type: "wait", durationMs: 60_000 },
        timeoutMs: 5,
      },
    ]);

    const result = await runPlan(payload(plan), adapter, {
      emit: (event) => events.push(event),
    });

    expect(result.status).toBe("failed");
    expect(events.map((event) => event.type)).toEqual([
      "run.started",
      "identity.profileResolved",
      "step.started",
      "action.timeout",
      "issue.created",
      "step.failed",
      "run.failed",
    ]);
    expect(events.find((event) => event.type === "action.timeout")).toMatchObject({
      payload: expect.objectContaining({
        timeoutMs: 5,
      }),
    });
    expect(events.filter((event) => event.type === "run.failed")).toHaveLength(1);
  });
});
