import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type {
  IdentityLabOverview,
  IdentityLabTarget,
  WorkflowSettings,
} from "../../types/workflow";
import { defaultWorkflowSettings } from "../workflows/lib/workflowSettings";
import {
  closeIdentityRetainedSession,
  getIdentityLabOverview,
  resetWorkflowBrowserIdentity,
} from "../../lib/workflowApi";
import { useIdentityLabWorkspace } from "./useIdentityLabWorkspace";

vi.mock("../../lib/workflowApi", () => ({
  closeIdentityRetainedSession: vi.fn(),
  getIdentityLabOverview: vi.fn(),
  resetWorkflowBrowserIdentity: vi.fn(),
}));

describe("useIdentityLabWorkspace", () => {
  beforeEach(() => {
    vi.mocked(closeIdentityRetainedSession).mockReset();
    vi.mocked(getIdentityLabOverview).mockReset();
    vi.mocked(resetWorkflowBrowserIdentity).mockReset();
  });

  test("loads overview and normalizes the selected managed identity target", async () => {
    const requestedTarget: IdentityLabTarget = {
      type: "managed",
      workflow_id: "workflow-1",
      identity_id: "identity-old",
    };
    vi.mocked(getIdentityLabOverview).mockResolvedValue(
      identityOverview("identity-selected"),
    );
    const { result } = renderHook(() =>
      useIdentityLabWorkspace({
        setAppError: vi.fn(),
        setToastMessage: vi.fn(),
        onIdentityReset: vi.fn(async () => undefined),
      }),
    );

    await act(async () => {
      await result.current.loadIdentityLabOverview(requestedTarget);
    });

    expect(getIdentityLabOverview).toHaveBeenCalledWith({
      selected_target: requestedTarget,
    });
    expect(result.current.overview?.selected?.identity_ref.id).toBe("identity-selected");
    expect(result.current.target).toEqual({
      type: "managed",
      workflow_id: "workflow-1",
      identity_id: "identity-selected",
    });
    expect(result.current.loading).toBe(false);
  });

  test("resets a managed identity, refreshes workflows, and reloads the selected target", async () => {
    const setToastMessage = vi.fn();
    const onIdentityReset = vi.fn(async () => undefined);
    vi.mocked(resetWorkflowBrowserIdentity).mockResolvedValue(settings("identity-new"));
    vi.mocked(getIdentityLabOverview).mockResolvedValue(identityOverview("identity-new"));
    const { result } = renderHook(() =>
      useIdentityLabWorkspace({
        setAppError: vi.fn(),
        setToastMessage,
        onIdentityReset,
      }),
    );

    await act(async () => {
      await result.current.resetIdentityFromLab("workflow-1");
    });

    expect(resetWorkflowBrowserIdentity).toHaveBeenCalledWith("workflow-1");
    expect(onIdentityReset).toHaveBeenCalledOnce();
    expect(getIdentityLabOverview).toHaveBeenCalledWith({
      selected_target: {
        type: "managed",
        workflow_id: "workflow-1",
        identity_id: "identity-new",
      },
    });
    expect(setToastMessage).toHaveBeenCalledWith("Browser identity reset.");
    expect(result.current.target?.identity_id).toBe("identity-new");
  });
});

function identityOverview(identityId: string): IdentityLabOverview {
  return {
    generated_at: "2026-06-01T12:00:00.000Z",
    items: [],
    selected: {
      kind: "managed",
      workflow_ref: { id: "workflow-1", name: "Workflow" },
      identity_ref: { id: identityId, display_name: "Identity" },
      session: { active: false, profile_name: "profile-1" },
      configured_posture: [],
      latest_observed: null,
      last_run: null,
      recent_failures_24h: 0,
      evidence_summary: { total: 0 },
      rotation_history: [],
      diagnostics: {
        binary_installed: true,
        wrapper_version: "1.0.0",
        geoip_available: true,
        headed_display_available: true,
        profile: null,
        font_status: "ok",
      },
      actions: {
        can_close_retained_session: false,
        can_reset_identity: true,
      },
    },
    counts: {
      managed_identities: 1,
      active_retained_sessions: 0,
      identities_with_warnings: 0,
      identities_with_recent_failures: 0,
    },
    data_warnings: [],
  };
}

function settings(identityId: string): WorkflowSettings {
  const value = defaultWorkflowSettings({
    workflowId: "workflow-1",
    workflowName: "Workflow",
    createdAt: "2026-06-01T12:00:00.000Z",
    updatedAt: "2026-06-01T12:00:00.000Z",
  });
  return {
    ...value,
    browser_launch: {
      ...value.browser_launch,
      identity_id: identityId,
    },
  };
}
