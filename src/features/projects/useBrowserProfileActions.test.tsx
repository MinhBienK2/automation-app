import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { BrowserProfile } from "../../types/workflow";
import {
  listBrowserProfiles,
  resetBrowserProfileIdentity,
  updateBrowserProfile,
} from "../../lib/workflowApi";
import { defaultWorkflowSettings } from "../workflows/lib/workflowSettings";
import { useBrowserProfileActions } from "./useBrowserProfileActions";

vi.mock("../../lib/workflowApi", () => ({
  listBrowserProfiles: vi.fn(),
  resetBrowserProfileIdentity: vi.fn(),
  updateBrowserProfile: vi.fn(),
}));

describe("useBrowserProfileActions", () => {
  beforeEach(() => {
    vi.mocked(listBrowserProfiles).mockReset();
    vi.mocked(resetBrowserProfileIdentity).mockReset();
    vi.mocked(updateBrowserProfile).mockReset();
  });

  test("updates a browser profile and refreshes the browser profile list", async () => {
    const setAppError = vi.fn();
    const setBrowserProfiles = vi.fn();
    const showToast = vi.fn();
    vi.mocked(updateBrowserProfile).mockResolvedValue(profile("profile-1"));
    vi.mocked(listBrowserProfiles).mockResolvedValue([profile("profile-1")]);
    const { result } = renderHook(() =>
      useBrowserProfileActions({
        setAppError,
        setBrowserProfiles,
        showToast,
      }),
    );

    await result.current.updateBrowserProfile("profile-1", {
      browser_launch: browserLaunch(),
    });

    expect(updateBrowserProfile).toHaveBeenCalledWith("profile-1", {
      browser_launch: browserLaunch(),
    });
    expect(setBrowserProfiles).toHaveBeenCalledWith([profile("profile-1")]);
    expect(showToast).toHaveBeenCalledWith("Browser profile updated.");
    expect(setAppError).toHaveBeenLastCalledWith("");
  });

  test("resets the browser profile identity and refreshes browser profiles", async () => {
    const setAppError = vi.fn();
    const setBrowserProfiles = vi.fn();
    const showToast = vi.fn();
    vi.mocked(resetBrowserProfileIdentity).mockResolvedValue(profile("profile-1"));
    vi.mocked(listBrowserProfiles).mockResolvedValue([profile("profile-1")]);
    const { result } = renderHook(() =>
      useBrowserProfileActions({
        setAppError,
        setBrowserProfiles,
        showToast,
      }),
    );

    await result.current.resetBrowserProfileIdentity("profile-1");

    expect(resetBrowserProfileIdentity).toHaveBeenCalledWith("profile-1");
    expect(setBrowserProfiles).toHaveBeenCalledWith([profile("profile-1")]);
    expect(showToast).toHaveBeenCalledWith("Browser profile identity regenerated.");
  });
});

function profile(id: string): BrowserProfile {
  return {
    id,
    project_id: "project-1",
    name: "Project browser profile",
    description: "",
    is_default: true,
    browser_launch: browserLaunch(),
    created_at: "2026-06-01T12:00:00.000Z",
    updated_at: "2026-06-01T12:00:00.000Z",
  };
}

function browserLaunch(): BrowserProfile["browser_launch"] {
  return defaultWorkflowSettings({
    workflowId: "workflow-1",
    workflowName: "Workflow",
    createdAt: "2026-06-01T12:00:00.000Z",
    updatedAt: "2026-06-01T12:00:00.000Z",
  }).browser_launch;
}
