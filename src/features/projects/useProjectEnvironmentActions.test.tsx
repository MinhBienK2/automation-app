import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ProjectEnvironment } from "../../types/workflow";
import {
  listProjectEnvironments,
  resetProjectEnvironmentBrowserIdentity,
  updateProjectEnvironment,
} from "../../lib/workflowApi";
import { defaultWorkflowSettings } from "../workflows/lib/workflowSettings";
import { useProjectEnvironmentActions } from "./useProjectEnvironmentActions";

vi.mock("../../lib/workflowApi", () => ({
  listProjectEnvironments: vi.fn(),
  resetProjectEnvironmentBrowserIdentity: vi.fn(),
  updateProjectEnvironment: vi.fn(),
}));

describe("useProjectEnvironmentActions", () => {
  beforeEach(() => {
    vi.mocked(listProjectEnvironments).mockReset();
    vi.mocked(resetProjectEnvironmentBrowserIdentity).mockReset();
    vi.mocked(updateProjectEnvironment).mockReset();
  });

  test("updates a project environment and refreshes the project environment list", async () => {
    const setAppError = vi.fn();
    const setProjectEnvironments = vi.fn();
    const showToast = vi.fn();
    vi.mocked(updateProjectEnvironment).mockResolvedValue(environment("environment-1"));
    vi.mocked(listProjectEnvironments).mockResolvedValue([environment("environment-1")]);
    const { result } = renderHook(() =>
      useProjectEnvironmentActions({
        setAppError,
        setProjectEnvironments,
        showToast,
      }),
    );

    await result.current.updateProjectEnvironment("environment-1", {
      browser_launch: browserLaunch(),
    });

    expect(updateProjectEnvironment).toHaveBeenCalledWith("environment-1", {
      browser_launch: browserLaunch(),
    });
    expect(setProjectEnvironments).toHaveBeenCalledWith([environment("environment-1")]);
    expect(showToast).toHaveBeenCalledWith("Fingerprint seed saved.");
    expect(setAppError).toHaveBeenLastCalledWith("");
  });

  test("resets the project environment identity and refreshes its project environments", async () => {
    const setAppError = vi.fn();
    const setProjectEnvironments = vi.fn();
    const showToast = vi.fn();
    vi.mocked(resetProjectEnvironmentBrowserIdentity).mockResolvedValue(environment("environment-1"));
    vi.mocked(listProjectEnvironments).mockResolvedValue([environment("environment-1")]);
    const { result } = renderHook(() =>
      useProjectEnvironmentActions({
        setAppError,
        setProjectEnvironments,
        showToast,
      }),
    );

    await result.current.resetProjectEnvironmentBrowserIdentity("environment-1");

    expect(resetProjectEnvironmentBrowserIdentity).toHaveBeenCalledWith("environment-1");
    expect(setProjectEnvironments).toHaveBeenCalledWith([environment("environment-1")]);
    expect(showToast).toHaveBeenCalledWith("Project identity regenerated.");
  });
});

function environment(id: string): ProjectEnvironment {
  return {
    id,
    project_id: "project-1",
    name: "Project saved session",
    description: "",
    is_default: true,
    browser_launch: browserLaunch(),
    created_at: "2026-06-01T12:00:00.000Z",
    updated_at: "2026-06-01T12:00:00.000Z",
  };
}

function browserLaunch(): ProjectEnvironment["browser_launch"] {
  return defaultWorkflowSettings({
    workflowId: "workflow-1",
    workflowName: "Workflow",
    createdAt: "2026-06-01T12:00:00.000Z",
    updatedAt: "2026-06-01T12:00:00.000Z",
  }).browser_launch;
}
