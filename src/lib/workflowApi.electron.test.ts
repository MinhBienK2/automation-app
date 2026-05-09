import { beforeEach, describe, expect, test, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  createWorkflow,
  exportRunEvidence,
  getWorkspacePolicy,
  getWorkflowSettings,
  checkIdentityProfileAvailability,
  listEnvironments,
  listRunProfiles,
  listWorkflows,
  listIdentityProfiles,
  listRuns,
  onRunEvent,
  runWorkflow,
  saveWorkflowSettingsSection,
  saveWorkspacePolicy,
  validateWorkflowRun,
} from "./workflowApi";

const invokeMock = vi.mocked(invoke);
const browserSettings = {
  profile_name: null,
  proxy_enabled: false,
  proxy_server: null,
  proxy_username: null,
  proxy_password: null,
  user_agent: null,
  viewport_width: null,
  viewport_height: null,
  mobile: false,
  touch: false,
  challenge_policy: "none" as const,
  headless: false,
};

describe("workflowApi Electron bridge", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    Reflect.deleteProperty(window, "cloakBrowser");
  });

  test("uses the preload API when Electron exposes it", async () => {
    const api = {
      workflows: {
        list: vi.fn().mockResolvedValue([{ id: "wf_1", name: "Flow", step_count: 0 }]),
        create: vi.fn().mockResolvedValue({ id: "wf_2", name: "New" }),
      },
      settings: {
        get: vi.fn().mockResolvedValue({ workflow_id: "wf_2", browser: { headless: true } }),
        saveSection: vi.fn().mockResolvedValue({ workflow_id: "wf_2", browser: browserSettings }),
        validateRun: vi.fn().mockResolvedValue([]),
      },
      runs: {
        start: vi.fn().mockResolvedValue({ status: "running" }),
        list: vi.fn().mockResolvedValue([{ id: "run_1", status: "completed" }]),
        onEvent: vi.fn().mockReturnValue(() => undefined),
      },
      profiles: {
        list: vi.fn().mockResolvedValue([{ id: "idp_1", name: "Owned profile" }]),
        checkAvailability: vi.fn().mockResolvedValue({
          profileId: "idp_1",
          persistentProfilePath: "owned-profile",
          available: true,
          locked: false,
          reason: null,
        }),
      },
      evidence: {
        exportRun: vi.fn().mockResolvedValue({
          runId: "run_1",
          events: [],
          artifacts: [],
          evidence: [],
        }),
      },
      policy: {
        get: vi.fn().mockResolvedValue({ allowedOrigins: [], maxConcurrency: 1 }),
        save: vi
          .fn()
          .mockResolvedValue({ allowedOrigins: ["https://owned.example.test"], maxConcurrency: 1 }),
      },
      runProfiles: {
        list: vi.fn().mockResolvedValue([{ id: "rp_1", name: "Strict" }]),
      },
      environments: {
        list: vi.fn().mockResolvedValue([{ id: "env_1", name: "Owned env" }]),
      },
    };
    Object.defineProperty(window, "cloakBrowser", {
      configurable: true,
      value: api,
    });

    await expect(listWorkflows()).resolves.toEqual([{ id: "wf_1", name: "Flow", step_count: 0 }]);
    await expect(createWorkflow("New")).resolves.toEqual({ id: "wf_2", name: "New" });
    await expect(getWorkflowSettings("wf_2")).resolves.toEqual({
      workflow_id: "wf_2",
      browser: { headless: true },
    });
    await expect(saveWorkflowSettingsSection("wf_2", "browser", browserSettings)).resolves.toEqual({
      workflow_id: "wf_2",
      browser: browserSettings,
    });
    await expect(validateWorkflowRun("wf_2")).resolves.toEqual([]);
    await expect(runWorkflow("wf_2")).resolves.toEqual({ status: "running" });
    await expect(listRuns({ workflowId: "wf_2" })).resolves.toEqual([
      { id: "run_1", status: "completed" },
    ]);
    const unsubscribe = onRunEvent(vi.fn());
    unsubscribe();
    await expect(listIdentityProfiles()).resolves.toEqual([{ id: "idp_1", name: "Owned profile" }]);
    await expect(checkIdentityProfileAvailability("idp_1")).resolves.toEqual({
      profileId: "idp_1",
      persistentProfilePath: "owned-profile",
      available: true,
      locked: false,
      reason: null,
    });
    await expect(exportRunEvidence("run_1")).resolves.toEqual({
      runId: "run_1",
      events: [],
      artifacts: [],
      evidence: [],
    });
    await expect(getWorkspacePolicy()).resolves.toEqual({ allowedOrigins: [], maxConcurrency: 1 });
    await expect(
      saveWorkspacePolicy({
        allowedOrigins: ["https://owned.example.test"],
        maxConcurrency: 1,
      }),
    ).resolves.toEqual({ allowedOrigins: ["https://owned.example.test"], maxConcurrency: 1 });
    await expect(listRunProfiles({ workflowId: "wf_2" })).resolves.toEqual([
      { id: "rp_1", name: "Strict" },
    ]);
    await expect(listEnvironments()).resolves.toEqual([{ id: "env_1", name: "Owned env" }]);

    expect(api.workflows.list).toHaveBeenCalledTimes(1);
    expect(api.workflows.create).toHaveBeenCalledWith({ name: "New" });
    expect(api.settings.get).toHaveBeenCalledWith({ workflowId: "wf_2" });
    expect(api.settings.saveSection).toHaveBeenCalledWith({
      workflowId: "wf_2",
      section: "browser",
      sectionValue: browserSettings,
    });
    expect(api.settings.validateRun).toHaveBeenCalledWith({ workflowId: "wf_2" });
    expect(api.runs.start).toHaveBeenCalledWith({ workflowId: "wf_2" });
    expect(api.runs.list).toHaveBeenCalledWith({ workflowId: "wf_2" });
    expect(api.runs.onEvent).toHaveBeenCalledTimes(1);
    expect(api.profiles.list).toHaveBeenCalledTimes(1);
    expect(api.profiles.checkAvailability).toHaveBeenCalledWith({ id: "idp_1" });
    expect(api.evidence.exportRun).toHaveBeenCalledWith({ runId: "run_1" });
    expect(api.policy.get).toHaveBeenCalledTimes(1);
    expect(api.policy.save).toHaveBeenCalledWith({
      allowedOrigins: ["https://owned.example.test"],
      maxConcurrency: 1,
    });
    expect(api.runProfiles.list).toHaveBeenCalledWith({ workflowId: "wf_2" });
    expect(api.environments.list).toHaveBeenCalledTimes(1);
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
