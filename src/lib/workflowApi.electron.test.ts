import { beforeEach, describe, expect, test, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  createWorkflow,
  getWorkflowSettings,
  listWorkflows,
  runWorkflow,
  saveWorkflowSettingsSection,
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
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
