import type {
  RecordingSession,
  RecorderStartSessionInput,
  RecordingEvent,
  RecordingGenerateDraftOptions,
  RecordingWorkflowDraft,
} from "../../../src/types/workflow.js";
import { commandError } from "../commandHelpers.js";
import type { CommandDeps } from "./types.js";
import { RecorderSessionInputError } from "../recording/recorderSessionManager.js";

async function runRecorderCommand<T>(operation: () => T | Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof RecorderSessionInputError) {
      throw commandError(error.message, error.field ?? undefined);
    }
    throw error;
  }
}

function requireRecordingResult<T>(
  value: T | null,
  field = "sessionId",
  message = "Recording session not found",
): T {
  if (value == null) {
    throw commandError(message, field);
  }
  return value;
}

export function createRecordingCommands(deps: CommandDeps) {
  const {
    recorderSessionManager,
    recordingDraftCommands,
    activeRunConflict,
    getSettings,
  } = deps;

  return {
    async startRecordingSession(input: RecorderStartSessionInput): Promise<RecordingSession> {
      return runRecorderCommand(async () => {
        if (input.mode === "replace_current_graph" && input.workflow_id) {
          const settings = await getSettings(input.workflow_id);
          const conflict = activeRunConflict(input.workflow_id, settings);
          if (conflict) throw commandError(conflict.message, conflict.field);
        }
        return recorderSessionManager.startSession(input);
      });
    },

    getRecordingSession(sessionId: string): RecordingSession {
      return requireRecordingResult(recorderSessionManager.getSession(sessionId));
    },

    async stopRecordingSession(sessionId: string): Promise<RecordingSession> {
      return requireRecordingResult(await recorderSessionManager.stopSession(sessionId));
    },

    listRecordingEvents(sessionId: string): RecordingEvent[] {
      return requireRecordingResult(recorderSessionManager.listEvents(sessionId));
    },

    async discardRecordingSession(sessionId: string): Promise<RecordingSession> {
      const discarded = requireRecordingResult(await recorderSessionManager.discardSession(sessionId));
      recordingDraftCommands.discardRecordingDraftsForSession(sessionId);
      return discarded;
    },

    generateRecordingDraft(
      sessionId: string,
      options: RecordingGenerateDraftOptions,
    ): RecordingWorkflowDraft {
      return recordingDraftCommands.createRecordingDraft(sessionId, options);
    },

    getRecordingDraft(draftId: string): RecordingWorkflowDraft {
      return recordingDraftCommands.getRecordingDraft(draftId);
    },

    saveRecordingDraft: recordingDraftCommands.saveRecordingDraft,
  };
}
