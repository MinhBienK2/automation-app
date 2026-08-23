import { useState } from "react";
import type {
  IdentityLabOverview,
  IdentityLabTarget,
} from "../../types/workflow";
import {
  closeIdentityRetainedSession,
  getIdentityLabOverview,
  resetWorkflowBrowserIdentity,
} from "../../lib/api/workflowApi";
import { commandMessage } from "../../lib/workflowUi";

const toastTimeoutMs = 2200;

type UseIdentityLabWorkspaceOptions = {
  onIdentityReset: () => void | Promise<void>;
  setAppError: (message: string) => void;
  setToastMessage: (message: string) => void;
};

export function useIdentityLabWorkspace({
  onIdentityReset,
  setAppError,
  setToastMessage,
}: UseIdentityLabWorkspaceOptions) {
  const [overview, setOverview] = useState<IdentityLabOverview | null>(null);
  const [target, setTarget] = useState<IdentityLabTarget | null>(null);
  const [loading, setLoading] = useState(false);

  function showToast(message: string) {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(""), toastTimeoutMs);
  }

  async function loadIdentityLabOverview(
    nextTarget: IdentityLabTarget | null = target,
    projectId?: string | null
  ) {
    setLoading(true);
    try {
      const loadedOverview = await getIdentityLabOverview({
        ...(nextTarget ? { selected_target: nextTarget } : {}),
        project_id: projectId ?? null,
      });
      setOverview(loadedOverview);
      setTarget(targetFromOverview(loadedOverview, nextTarget));
      setAppError("");
    } catch (error) {
      setAppError(commandMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function closeIdentitySession(workflowId: string, profileName: string, projectId?: string | null) {
    setAppError("");
    try {
      await closeIdentityRetainedSession(workflowId, profileName);
      await loadIdentityLabOverview(target, projectId);
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function resetIdentityFromLab(workflowId: string, projectId?: string | null) {
    setAppError("");
    try {
      const rotated = await resetWorkflowBrowserIdentity(workflowId);
      const nextTarget: IdentityLabTarget = {
        type: "managed",
        workflow_id: workflowId,
        identity_id: rotated.browser_launch.identity_id,
      };
      await onIdentityReset();
      await loadIdentityLabOverview(nextTarget, projectId);
      showToast("Browser identity reset.");
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  return {
    overview,
    target,
    loading,
    setTarget,
    loadIdentityLabOverview,
    closeIdentitySession,
    resetIdentityFromLab,
  };
}

function targetFromOverview(
  overview: IdentityLabOverview,
  fallbackTarget: IdentityLabTarget | null,
): IdentityLabTarget | null {
  if (overview.selected?.kind === "managed") {
    return {
      type: "managed",
      workflow_id: overview.selected.workflow_ref.id,
      identity_id: overview.selected.identity_ref.id,
    };
  }
  if (overview.selected?.kind === "historical") {
    return {
      type: "historical",
      identity_id: overview.selected.identity_ref.id,
      workflow_id: overview.selected.workflow_ref?.id ?? null,
      run_id: overview.selected.run_id ?? null,
      evidence_id: overview.selected.evidence_id ?? null,
    };
  }
  return fallbackTarget;
}
