import { useState, useCallback } from "react";
import type {
  RecordingWorkspaceAPI,
} from "../../../shared/types/workspaceContracts";
import type {
  RecordingSession,
  RecordingWorkflowDraft,
  ReviewedRecordingStep,
} from "../../../types/workflow";
import {
  startRecordingSession,
  stopRecordingSession,
  discardRecordingSession,
  generateRecordingDraft,
  saveRecordingDraft,
} from "../../../lib/api/workflowApi";
import { commandMessage } from "../../../lib/workflowUi";

export interface RecordingWorkspaceDeps {
  setAppError: (error: string) => void;
  loadWorkflows: () => Promise<void>;
  openWorkflow: (id: string) => Promise<void>;
}

export function useRecordingWorkspace(deps: RecordingWorkspaceDeps): RecordingWorkspaceAPI {
  const { setAppError, loadWorkflows, openWorkflow } = deps;

  const [recordingSession, setRecordingSession] = useState<RecordingSession | null>(null);
  const [recordingDraft, setRecordingDraft] = useState<RecordingWorkflowDraft | null>(null);
  const [recordingWorkflowName, setRecordingWorkflowName] = useState("Recorded workflow");
  const [recordingBusy, setRecordingBusy] = useState(false);

  const startWorkflowRecording = useCallback(async () => {
    setAppError("");
    setRecordingDraft(null);
    setRecordingWorkflowName("Recorded workflow");
    setRecordingBusy(true);

    try {
      const session = await startRecordingSession({
        mode: "new_workflow",
        workflow_name: "Recorded workflow",
      });
      setRecordingSession(session);
    } catch (error) {
      setAppError(commandMessage(error));
    } finally {
      setRecordingBusy(false);
    }
  }, [setAppError]);

  const stopWorkflowRecording = useCallback(async () => {
    if (!recordingSession) return;
    setAppError("");
    setRecordingBusy(true);

    try {
      const stopped = await stopRecordingSession(recordingSession.id);
      setRecordingSession(stopped);
      const draft = await generateRecordingDraft(stopped.id, {
        include_event_ids: null,
        add_terminal_success: true,
      });
      setRecordingDraft(draft);
      setRecordingWorkflowName(
        draft.workflow_settings_snapshot.general.name || "Recorded workflow",
      );
    } catch (error) {
      setAppError(commandMessage(error));
    } finally {
      setRecordingBusy(false);
    }
  }, [recordingSession, setAppError]);

  const discardWorkflowRecording = useCallback(async () => {
    const sessionId = recordingSession?.id ?? recordingDraft?.session_id ?? null;
    setAppError("");
    setRecordingBusy(true);
    try {
      if (sessionId) {
        await discardRecordingSession(sessionId);
      }
    } catch (error) {
      setAppError(commandMessage(error));
    } finally {
      setRecordingSession(null);
      setRecordingDraft(null);
      setRecordingWorkflowName("Recorded workflow");
      setRecordingBusy(false);
    }
  }, [recordingSession, recordingDraft, setAppError]);

  const updateRecordingStep = useCallback((step: ReviewedRecordingStep) => {
    setRecordingDraft((current) =>
      current
        ? {
            ...current,
            steps: current.steps.map((candidate) =>
              candidate.id === step.id ? step : candidate,
            ),
          }
        : current,
    );
  }, []);

  const saveReviewedRecording = useCallback(async (input: { workflow_name: string; add_terminal_success: boolean; save_mode: "create_new" | "replace_graph" }) => {
    if (!recordingDraft) return;
    setAppError("");
    setRecordingBusy(true);

    try {
      const saved = await saveRecordingDraft(recordingDraft.id, {
        workflow_name: input.workflow_name || recordingWorkflowName,
        save_mode: input.save_mode,
        reviewed_steps: recordingDraft.steps,
        add_terminal_success: input.add_terminal_success,
      });
      setRecordingSession(null);
      setRecordingDraft(null);
      setRecordingWorkflowName("Recorded workflow");
      await loadWorkflows();
      await openWorkflow(saved.workflow.id);
    } catch (error) {
      setAppError(commandMessage(error));
    } finally {
      setRecordingBusy(false);
    }
  }, [recordingDraft, recordingWorkflowName, loadWorkflows, openWorkflow, setAppError]);

  return {
    recordingSession,
    recordingDraft,
    recordingWorkflowName,
    recordingBusy,
    setRecordingSession,
    setRecordingDraft,
    setRecordingWorkflowName,
    setRecordingBusy,
    startWorkflowRecording,
    stopWorkflowRecording,
    discardWorkflowRecording,
    updateRecordingStep,
    saveReviewedRecording,
  };
}
