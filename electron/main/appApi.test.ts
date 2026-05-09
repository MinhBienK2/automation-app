// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createAppApi, type AppApi } from "./appApi";
import { createStorageService, type StorageService } from "./storage";
import type { BrowserAutomationAdapter } from "../runner/runnerCore";
import type { RunnerEvent, RunnerResult, StartRunPayload } from "../shared/product";

let appDataDir = "";
let storage: StorageService;
let api: AppApi;

function adapter(): BrowserAutomationAdapter {
  return {
    async launch() {},
    async close() {},
    async navigate() {},
    async click() {},
    async fill() {},
    async wait() {},
    async screenshot() {
      return Buffer.from("api-screenshot");
    },
    async extractText() {
      return "Extracted text";
    },
  };
}

beforeEach(() => {
  appDataDir = mkdtempSync(path.join(tmpdir(), "cloak-app-api-"));
  storage = createStorageService({ appDataDir });
  storage.initialize();
  api = createAppApi({
    storage,
    appDataDir,
    createAdapter: adapter,
  });
});

afterEach(() => {
  storage.close();
  rmSync(appDataDir, { recursive: true, force: true });
});

describe("Electron app API", () => {
  test("exposes workflow and graph operations through the preload-shaped API", async () => {
    const workflow = await api.workflows.create({ name: "Owned smoke flow" });
    const workflows = await api.workflows.list();
    const graph = await api.graphs.loadActive({ workflowId: workflow.id });
    const issues = await api.graphs.validate({ graph });

    expect(workflows).toEqual([
      expect.objectContaining({
        id: workflow.id,
        name: "Owned smoke flow",
        step_count: 0,
      }),
    ]);
    expect(graph.nodes.map((node) => node.node_type)).toEqual(["start", "action"]);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          node_id: graph.nodes[1]?.id,
          message: expect.stringContaining("configured"),
        }),
      ]),
    );
  });

  test("renames, duplicates, and persists workflow settings through the UI facade", async () => {
    const workflow = await api.workflows.create({ name: "Original" });

    await api.workflows.rename({ id: workflow.id, name: "Renamed" });
    const settings = await api.settings.get({ workflowId: workflow.id });
    await api.settings.saveSection({
      workflowId: workflow.id,
      section: "browser",
      sectionValue: { ...settings.browser, headless: true },
    });
    const duplicate = await api.workflows.duplicate({
      workflowId: workflow.id,
      name: "Copy of Renamed",
    });

    expect((await api.workflows.get({ id: workflow.id }))?.workflow.name).toBe("Renamed");
    expect((await api.settings.get({ workflowId: workflow.id })).browser.headless).toBe(true);
    expect(duplicate.workflow.id).not.toBe(workflow.id);
    expect((await api.graphs.loadActive({ workflowId: duplicate.workflow.id })).nodes).toHaveLength(2);
  });

  test("exposes identity profile CRUD and validation through the app facade", async () => {
    const profile = await api.profiles.create({
      name: "Owned desktop",
      description: "Desktop identity for owned systems",
      persistentProfilePath: "owned-desktop-01",
      deviceIdentity: {
        deviceClass: "desktop",
        viewport: { width: 1280, height: 720 },
        mobile: false,
        touch: false,
      },
      locale: { locale: "en-US", timezone: "America/New_York" },
      proxyReference: { label: "owned-egress", secretRef: "secret://proxy/owned" },
      headedPolicy: "allow_headless",
      preflightPolicy: { enabled: false },
    });

    await expect(api.profiles.list()).resolves.toEqual([
      expect.objectContaining({ id: profile.id, name: "Owned desktop" }),
    ]);
    await expect(api.profiles.get({ id: profile.id })).resolves.toMatchObject({
      persistentProfilePath: "owned-desktop-01",
    });
    await expect(
      api.profiles.validate({
        profile: {
          ...profile,
          persistentProfilePath: "../bad",
        },
      }),
    ).resolves.toEqual([expect.objectContaining({ code: "unsafe_profile_path" })]);

    await api.profiles.update({
      id: profile.id,
      profile: { name: "Owned desktop updated" },
    });

    await expect(api.profiles.get({ id: profile.id })).resolves.toMatchObject({
      name: "Owned desktop updated",
    });

    await api.profiles.delete({ id: profile.id });

    await expect(api.profiles.list()).resolves.toEqual([]);
  });

  test("exposes sanitized run evidence through the app facade", async () => {
    const workflow = storage.createWorkflow({ name: "Evidence facade" });
    const run = storage.createRun({
      workflowId: workflow.id,
      graphVersionId: storage.getActiveGraphVersion(workflow.id).id,
      runProfileSnapshot: {},
      identityProfileSnapshot: { id: "idp_1", name: "Owned" },
      environmentSnapshot: {},
      operatorLabel: "local",
    });
    storage.appendRunEvent(run.id, {
      type: "run.started",
      severity: "info",
      payload: { workflowId: workflow.id },
    });
    storage.createEvidenceRecord({
      runId: run.id,
      evidenceType: "identity_snapshot",
      payload: {
        profileId: "idp_1",
        proxy: { label: "owned", password: "raw-password" },
      },
    });

    await expect(api.evidence.listEvents({ runId: run.id })).resolves.toEqual([
      expect.objectContaining({ type: "run.started" }),
    ]);
    await expect(api.evidence.listArtifacts({ runId: run.id })).resolves.toEqual([]);
    await expect(api.evidence.exportRun({ runId: run.id })).resolves.toMatchObject({
      evidence: [
        expect.objectContaining({
          evidenceType: "identity_snapshot",
          payload: {
            profileId: "idp_1",
            proxy: { label: "owned", password: "[redacted]" },
          },
        }),
      ],
    });
  });

  test("exposes workspace policy through the app facade", async () => {
    await expect(api.policy.get()).resolves.toEqual({
      allowedOrigins: [],
      maxConcurrency: 1,
    });

    await expect(
      api.policy.save({
        allowedOrigins: ["https://owned.example.test"],
        maxConcurrency: 1,
      }),
    ).resolves.toEqual({
      allowedOrigins: ["https://owned.example.test"],
      maxConcurrency: 1,
    });
  });

  test("exposes run profile CRUD through the app facade", async () => {
    const workflow = await api.workflows.create({ name: "Run profile facade" });
    const profile = await api.runProfiles.create({
      workflowId: workflow.id,
      name: "Fast retry",
      timeoutPolicy: { runTimeoutMs: 20_000, actionTimeoutMs: 1_000 },
      retryPolicy: { attempts: 2, intervalMs: 50 },
      retentionPolicy: { browserRetention: "close" },
      concurrencyPolicy: { maxConcurrency: 1 },
      evidencePolicy: { screenshots: true },
    });

    await expect(api.runProfiles.list({ workflowId: workflow.id })).resolves.toEqual([
      expect.objectContaining({ id: profile.id, name: "Fast retry" }),
    ]);
    await expect(
      api.runProfiles.update({
        id: profile.id,
        profile: { name: "Fast retry updated" },
      }),
    ).resolves.toMatchObject({ name: "Fast retry updated" });

    await api.runProfiles.delete({ id: profile.id });

    await expect(api.runProfiles.list({ workflowId: workflow.id })).resolves.toEqual([]);
  });

  test("exposes environment CRUD through the app facade", async () => {
    const environment = await api.environments.create({
      name: "Owned env",
      permissions: ["geolocation"],
      headers: { "x-owned-test": "true" },
      initialVariables: { username: "ada" },
    });

    await expect(api.environments.list()).resolves.toEqual([
      expect.objectContaining({ id: environment.id, name: "Owned env" }),
    ]);
    await expect(
      api.environments.update({
        id: environment.id,
        environment: { name: "Owned env updated" },
      }),
    ).resolves.toMatchObject({ name: "Owned env updated" });

    await api.environments.delete({ id: environment.id });

    await expect(api.environments.list()).resolves.toEqual([]);
  });

  test("starts a configured vertical-slice run and persists events plus artifact metadata", async () => {
    const workflow = await api.workflows.create({ name: "Runnable flow" });
    const graph = await api.graphs.loadActive({ workflowId: workflow.id });
    const start = graph.nodes[0];
    const draft = graph.nodes[1];
    if (!start || !draft) throw new Error("Missing draft graph nodes.");
    draft.label = "Screenshot";
    draft.config = { type: "take_screenshot", config: { file_name: "final.png" } };

    await api.graphs.save({ workflowId: workflow.id, graph });
    const runState = await api.runs.start({ workflowId: workflow.id });

    expect(runState).toMatchObject({
      status: "success",
      mode: "run_workflow",
      completed_step_ids: [draft.id],
    });

    const runs = storage.listRunEvents(runState.run_id ?? "");
    expect(runs.map((event) => event.type)).toEqual([
      "run.started",
      "identity.profileResolved",
      "step.started",
      "artifact.created",
      "step.completed",
      "run.completed",
    ]);
    expect(storage.listArtifacts(runState.run_id ?? "")).toEqual([
      expect.objectContaining({
        type: "screenshot",
        relativePath: `runs/${runState.run_id}/screenshots/final.png`,
      }),
    ]);
    expect(storage.getRun(runState.run_id ?? "")).toMatchObject({
      status: "completed",
      terminalReason: null,
    });
  });

  test("uses the supervised runner client when provided and persists streamed events", async () => {
    const workflow = await api.workflows.create({ name: "Process-backed flow" });
    const graph = await api.graphs.loadActive({ workflowId: workflow.id });
    const draft = graph.nodes[1];
    if (!draft) throw new Error("Missing draft graph node.");
    draft.config = { type: "take_screenshot", config: { file_name: "process.png" } };
    await api.graphs.save({ workflowId: workflow.id, graph });

    const startPayloads: StartRunPayload[] = [];
    const processApi = createAppApi({
      storage,
      appDataDir,
      createAdapter: () => {
        throw new Error("in-process adapter should not be used when runner is provided");
      },
      runner: {
        async startRun(payload: StartRunPayload, onEvent: (event: RunnerEvent) => void): Promise<RunnerResult> {
          startPayloads.push(payload);
          onEvent({
            type: "run.started",
            severity: "info",
            runId: payload.runId,
            payload: { workflowId: payload.workflowId },
            createdAt: "2026-05-09T00:00:00.000Z",
          });
          onEvent({
            type: "artifact.created",
            severity: "info",
            runId: payload.runId,
            nodeId: payload.runPlan.steps[0]?.sourceNodeId,
            actionId: payload.runPlan.steps[0]?.id,
            payload: {
              type: "screenshot",
              relativePath: `runs/${payload.runId}/screenshots/process.png`,
              mimeType: "image/png",
              sizeBytes: 10,
              checksum: "sha256:test",
              sanitized: true,
            },
            createdAt: "2026-05-09T00:00:01.000Z",
          });
          onEvent({
            type: "step.completed",
            severity: "info",
            runId: payload.runId,
            nodeId: payload.runPlan.steps[0]?.sourceNodeId,
            actionId: payload.runPlan.steps[0]?.id,
            payload: { actionType: "take_screenshot" },
            createdAt: "2026-05-09T00:00:02.000Z",
          });
          onEvent({
            type: "run.completed",
            severity: "info",
            runId: payload.runId,
            payload: { status: "completed" },
            createdAt: "2026-05-09T00:00:03.000Z",
          });
          return { runId: payload.runId, status: "completed" };
        },
      },
    });

    const runState = await processApi.runs.start({ workflowId: workflow.id });

    expect(startPayloads).toHaveLength(1);
    expect(runState.status).toBe("success");
    expect(storage.listRunEvents(runState.run_id ?? "").map((event) => event.type)).toEqual([
      "run.started",
      "artifact.created",
      "step.completed",
      "run.completed",
    ]);
    expect(storage.listArtifacts(runState.run_id ?? "")).toEqual([
      expect.objectContaining({
        type: "screenshot",
        relativePath: `runs/${runState.run_id}/screenshots/process.png`,
      }),
    ]);
  });

  test("persists preflight verdict runner events as sanitized evidence records", async () => {
    const workflow = await api.workflows.create({ name: "Preflight evidence flow" });
    const graph = await api.graphs.loadActive({ workflowId: workflow.id });
    const draft = graph.nodes[1];
    if (!draft) throw new Error("Missing draft graph node.");
    draft.config = { type: "wait", config: { duration_ms: 1 } };
    await api.graphs.save({ workflowId: workflow.id, graph });
    const processApi = createAppApi({
      storage,
      appDataDir,
      createAdapter: adapter,
      runner: {
        async startRun(payload: StartRunPayload, onEvent: (event: RunnerEvent) => void): Promise<RunnerResult> {
          onEvent({
            type: "preflight.verdictReceived",
            severity: "info",
            runId: payload.runId,
            payload: {
              passed: true,
              verdict: "passed",
              proxy: { label: "owned", password: "raw-password" },
            },
            createdAt: "2026-05-09T00:00:00.000Z",
          });
          onEvent({
            type: "run.completed",
            severity: "info",
            runId: payload.runId,
            payload: { status: "completed" },
            createdAt: "2026-05-09T00:00:01.000Z",
          });
          return { runId: payload.runId, status: "completed" };
        },
      },
    });

    const runState = await processApi.runs.start({ workflowId: workflow.id });

    expect(storage.listEvidenceRecords(runState.run_id ?? "")).toEqual([
      expect.objectContaining({
        evidenceType: "preflight_verdict",
        sanitizedPayload: expect.objectContaining({
          passed: true,
          proxy: { label: "owned", password: "[redacted]" },
        }),
      }),
    ]);
  });

  test("resolves the workflow default identity profile into the runner payload", async () => {
    const workflow = await api.workflows.create({ name: "Identity-backed run" });
    const graph = await api.graphs.loadActive({ workflowId: workflow.id });
    const draft = graph.nodes[1];
    if (!draft) throw new Error("Missing draft graph node.");
    draft.config = { type: "wait", config: { duration_ms: 1 } };
    await api.graphs.save({ workflowId: workflow.id, graph });
    const profile = storage.createIdentityProfile({
      name: "Owned desktop identity",
      persistentProfilePath: "owned-desktop-01",
      deviceIdentity: {
        viewport: { width: 1440, height: 900 },
        userAgent: "Owned UA",
        mobile: false,
        touch: false,
      },
      locale: { locale: "en-US", timezone: "America/New_York" },
      proxyReference: {
        server: "http://owned-proxy.test:8080",
        label: "owned-egress",
        region: "US",
        secretRef: "secret://proxy/owned",
      },
      headedPolicy: "headed_only",
      preflightPolicy: {
        enabled: true,
        probeUrl: "https://owned.example.test/fingerprint",
        allowedOrigins: ["https://owned.example.test"],
      },
    });
    storage.updateWorkflowDefaults(workflow.id, { defaultIdentityProfileId: profile.id });
    const payloads: StartRunPayload[] = [];
    const processApi = createAppApi({
      storage,
      appDataDir,
      createAdapter: adapter,
      runner: {
        async startRun(payload: StartRunPayload): Promise<RunnerResult> {
          payloads.push(payload);
          return { runId: payload.runId, status: "completed" };
        },
      },
    });

    await processApi.runs.start({ workflowId: workflow.id });

    expect(payloads[0]?.identityProfileSnapshot).toMatchObject({
      id: profile.id,
      name: "Owned desktop identity",
      headless: false,
      viewport: { width: 1440, height: 900 },
      userAgent: "Owned UA",
      locale: "en-US",
      timezone: "America/New_York",
      persistentProfilePath: "owned-desktop-01",
      proxy: {
        server: "http://owned-proxy.test:8080",
        label: "owned-egress",
        region: "US",
      },
      preflightPolicy: {
        enabled: true,
        probeUrl: "https://owned.example.test/fingerprint",
      },
    });
    expect(payloads[0]?.identityProfileSnapshot.proxy).not.toHaveProperty("password");
  });

  test("exposes workflow run history through the app facade", async () => {
    const workflow = await api.workflows.create({ name: "Run history facade" });
    const graph = await api.graphs.loadActive({ workflowId: workflow.id });
    const draft = graph.nodes[1];
    if (!draft) throw new Error("Missing draft graph node.");
    draft.config = { type: "wait", config: { duration_ms: 1 } };
    await api.graphs.save({ workflowId: workflow.id, graph });

    const runState = await api.runs.start({ workflowId: workflow.id });
    const history = await api.runs.list({ workflowId: workflow.id });

    expect(history).toEqual([
      expect.objectContaining({
        id: runState.run_id,
        workflowId: workflow.id,
        status: "completed",
      }),
    ]);
  });

  test("streams persisted run events to an app-level subscriber", async () => {
    const workflow = await api.workflows.create({ name: "Streamed run" });
    const graph = await api.graphs.loadActive({ workflowId: workflow.id });
    const draft = graph.nodes[1];
    if (!draft) throw new Error("Missing draft graph node.");
    draft.config = { type: "take_screenshot", config: { file_name: "stream.png" } };
    await api.graphs.save({ workflowId: workflow.id, graph });
    const streamed: RunnerEvent[] = [];
    const streamingApi = createAppApi({
      storage,
      appDataDir,
      createAdapter: adapter,
      onRunEvent: (event) => streamed.push(event),
    });

    await streamingApi.runs.start({ workflowId: workflow.id });

    expect(streamed.map((event) => event.type)).toEqual([
      "run.started",
      "identity.profileResolved",
      "step.started",
      "artifact.created",
      "step.completed",
      "run.completed",
    ]);
  });

  test("forwards stop requests to the active supervised runner", async () => {
    const workflow = await api.workflows.create({ name: "Cancellable run" });
    const graph = await api.graphs.loadActive({ workflowId: workflow.id });
    const draft = graph.nodes[1];
    if (!draft) throw new Error("Missing draft graph node.");
    draft.config = { type: "wait", config: { duration_ms: 60_000 } };
    await api.graphs.save({ workflowId: workflow.id, graph });
    let resolveStarted: (payload: StartRunPayload) => void = () => undefined;
    let resolveRun: (result: RunnerResult) => void = () => undefined;
    const started = new Promise<StartRunPayload>((resolve) => {
      resolveStarted = resolve;
    });
    const runCompletion = new Promise<RunnerResult>((resolve) => {
      resolveRun = resolve;
    });
    const cancelRequests: Array<{ runId: string }> = [];
    const processApi = createAppApi({
      storage,
      appDataDir,
      createAdapter: adapter,
      runner: {
        async startRun(payload: StartRunPayload, onEvent: (event: RunnerEvent) => void) {
          onEvent({
            type: "run.started",
            severity: "info",
            runId: payload.runId,
            payload: { workflowId: payload.workflowId },
            createdAt: "2026-05-09T00:00:00.000Z",
          });
          resolveStarted(payload);
          return runCompletion;
        },
        async cancelRun(input: { runId: string }) {
          cancelRequests.push(input);
          resolveRun({ runId: input.runId, status: "cancelled", reason: "Operator stopped run." });
          return { ok: true };
        },
      },
    });

    const startPromise = processApi.runs.start({ workflowId: workflow.id });
    const payload = await started;
    const stopped = await processApi.runs.stop();
    const finalState = await startPromise;

    expect(cancelRequests).toEqual([{ runId: payload.runId }]);
    expect(stopped.status).toBe("stopped");
    expect(finalState.status).toBe("stopped");
    expect(storage.getRun(payload.runId)).toMatchObject({
      status: "cancelled",
      terminalReason: "Operator stopped run.",
    });
    expect(storage.listEvidenceRecords(payload.runId)).toEqual([
      expect.objectContaining({
        evidenceType: "operator_action",
        sanitizedPayload: expect.objectContaining({
          action: "stop",
          operatorLabel: "local",
        }),
      }),
    ]);
  });

  test("passes workspace allowed origins into the runner policy snapshot", async () => {
    storage.saveWorkspacePolicy({
      allowedOrigins: ["https://owned.example.test"],
      maxConcurrency: 1,
    });
    const workflow = await api.workflows.create({ name: "Allowlisted run" });
    const graph = await api.graphs.loadActive({ workflowId: workflow.id });
    const draft = graph.nodes[1];
    if (!draft) throw new Error("Missing draft graph node.");
    draft.config = {
      type: "navigate",
      config: { url: "https://owned.example.test/login" },
    };
    await api.graphs.save({ workflowId: workflow.id, graph });
    const payloads: StartRunPayload[] = [];
    const processApi = createAppApi({
      storage,
      appDataDir,
      createAdapter: adapter,
      runner: {
        async startRun(payload: StartRunPayload): Promise<RunnerResult> {
          payloads.push(payload);
          return { runId: payload.runId, status: "completed" };
        },
      },
    });

    await processApi.runs.start({ workflowId: workflow.id });

    expect(payloads[0]?.operatorPolicySnapshot).toEqual({
      allowedOrigins: ["https://owned.example.test"],
      maxConcurrency: 1,
    });
  });

  test("resolves workflow default run profile into runner policy and plan defaults", async () => {
    const workflow = await api.workflows.create({ name: "Run-profile-backed run" });
    const graph = await api.graphs.loadActive({ workflowId: workflow.id });
    const draft = graph.nodes[1];
    if (!draft) throw new Error("Missing draft graph node.");
    draft.config = {
      type: "click",
      config: {
        target: { strategy: "text", value: "Continue" },
      },
    };
    await api.graphs.save({ workflowId: workflow.id, graph });
    const profile = storage.createRunProfile({
      workflowId: workflow.id,
      name: "Strict",
      timeoutPolicy: { runTimeoutMs: 45_000, actionTimeoutMs: 5_000 },
      retryPolicy: { attempts: 3, intervalMs: 250 },
      retentionPolicy: { browserRetention: "close" },
      evidencePolicy: { screenshots: true, strict: true },
    });
    storage.updateWorkflowDefaults(workflow.id, { defaultRunProfileId: profile.id });
    const payloads: StartRunPayload[] = [];
    const processApi = createAppApi({
      storage,
      appDataDir,
      createAdapter: adapter,
      runner: {
        async startRun(payload: StartRunPayload): Promise<RunnerResult> {
          payloads.push(payload);
          return { runId: payload.runId, status: "completed" };
        },
      },
    });

    await processApi.runs.start({ workflowId: workflow.id });

    expect(payloads[0]?.runProfileSnapshot).toMatchObject({
      timeoutMs: 45_000,
      evidencePolicy: { screenshots: true, strict: true },
      browserRetention: "close",
    });
    expect(payloads[0]?.runPlan.steps[0]).toMatchObject({
      timeoutMs: 5_000,
      retry: { attempts: 3, intervalMs: 250 },
    });
  });

  test("resolves workflow default environment into the runner payload", async () => {
    const workflow = await api.workflows.create({ name: "Environment-backed run" });
    const graph = await api.graphs.loadActive({ workflowId: workflow.id });
    const draft = graph.nodes[1];
    if (!draft) throw new Error("Missing draft graph node.");
    draft.config = { type: "wait", config: { duration_ms: 1 } };
    await api.graphs.save({ workflowId: workflow.id, graph });
    const environment = storage.createEnvironment({
      name: "Owned staging env",
      permissions: ["geolocation"],
      headers: { "x-owned-test": "true" },
      initialVariables: { username: "ada" },
    });
    storage.updateWorkflowDefaults(workflow.id, { defaultEnvironmentId: environment.id });
    const payloads: StartRunPayload[] = [];
    const processApi = createAppApi({
      storage,
      appDataDir,
      createAdapter: adapter,
      runner: {
        async startRun(payload: StartRunPayload): Promise<RunnerResult> {
          payloads.push(payload);
          return { runId: payload.runId, status: "completed" };
        },
      },
    });

    await processApi.runs.start({ workflowId: workflow.id });

    expect(payloads[0]?.environmentSnapshot).toEqual({
      initialVariables: { username: "ada" },
      permissions: ["geolocation"],
      extraHTTPHeaders: { "x-owned-test": "true" },
    });
  });
});
