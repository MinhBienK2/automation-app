import { randomUUID } from "node:crypto";
import type {
  GraphValidationIssue,
  RecordingEvent,
  RecordingGenerateDraftOptions,
  RecordingSaveDraftInput,
  RecordingSession,
  RecordingWorkflowDraft,
  Workflow,
  WorkflowDetail,
  WorkflowGraph,
  WorkflowSettings,
} from "../../../src/types/workflow.js";
import { commandError } from "../commandHelpers.js";
import { validateWorkflowGraph as validateGraphDefault } from "../graph/compiler.js";
import { generateRecordingGraph } from "./graphGenerator.js";
import { reconcileReviewedRecordingSteps } from "./reviewReconciliation.js";
import { normalizeRecordingEvents } from "./timelineNormalizer.js";
import type { DbAdapter } from "../db/dbAdapter.js";

export type RecordingDraftSessionPort = {
  getSession(sessionId: string): RecordingSession | null;
  listEvents(sessionId: string): RecordingEvent[] | null;
  getInternalSettingsSnapshot(sessionId: string): WorkflowSettings | null;
  deleteSession(sessionId: string): void;
};

type RecordingDraftCommandDependencies = {
  database: DbAdapter;
  recorderSessions: RecordingDraftSessionPort;
  drafts?: Map<string, RecordingWorkflowDraft>;
  idFactory?: () => string;
  now?: () => Date;
  validateWorkflowGraph?: (graph: WorkflowGraph) => GraphValidationIssue[];
  createWorkflow(name: string): Promise<Workflow>;
  saveWorkflowGraph(workflowId: string, graph: WorkflowGraph): Promise<void>;
  saveWorkflowSettings(workflowId: string, settings: WorkflowSettings): Promise<WorkflowSettings>;
  getWorkflowDetail(workflowId: string): Promise<WorkflowDetail | null>;
  requireWorkflow(workflowId: string): Promise<Workflow>;
};

export function createRecordingDraftCommands(
  dependencies: RecordingDraftCommandDependencies,
) {
  const drafts = dependencies.drafts ?? new Map<string, RecordingWorkflowDraft>();
  const validateGraph = dependencies.validateWorkflowGraph ?? validateGraphDefault;

  function createRecordingDraft(
    sessionId: string,
    options: RecordingGenerateDraftOptions,
  ): RecordingWorkflowDraft {
    const session = requireRecordingResult(dependencies.recorderSessions.getSession(sessionId));
    if (session.status !== "stopped") {
      throw commandError("Stop recording before generating a draft", "sessionId");
    }
    const includeEventIds = new Set(options.include_event_ids ?? []);
    const events = requireRecordingResult(dependencies.recorderSessions.listEvents(sessionId))
      .filter((event) => !includeEventIds.size || includeEventIds.has(event.id));
    const steps = normalizeRecordingEvents(events);
    if (!steps.some((step) => step.included)) {
      throw commandError("No meaningful actions recorded", "events");
    }
    const graph = generateRecordingGraph(steps, {
      addTerminalSuccess: options.add_terminal_success,
    });
    const validationIssues = validateGraph(graph);
    const draft: RecordingWorkflowDraft = {
      id: dependencies.idFactory?.() ?? `draft_${randomUUID().replace(/-/g, "")}`,
      session_id: session.id,
      workflow_id: session.workflow_id,
      mode: session.mode,
      status: "draft",
      generated_at: (dependencies.now?.() ?? new Date()).toISOString(),
      workflow_settings_snapshot: session.workflow_settings_snapshot,
      steps,
      graph,
      validation_issues: validationIssues,
      warnings: [
        ...session.warnings,
        ...steps.flatMap((step) => step.warnings),
      ],
    };
    drafts.set(draft.id, draft);
    return draft;
  }

  function getRecordingDraft(draftId: string): RecordingWorkflowDraft {
    return requireRecordingResult(
      drafts.get(draftId) ?? null,
      "draftId",
      "Recording draft not found",
    );
  }

  async function saveRecordingDraft(
    draftId: string,
    input: RecordingSaveDraftInput,
  ): Promise<WorkflowDetail> {
    const draft = getRecordingDraft(draftId);
    if (draft.status !== "draft") {
      throw commandError("Recording draft has already been saved", "draftId");
    }
    const reviewedSteps = reconcileReviewedRecordingSteps(draft.steps, input.reviewed_steps ?? []);
    if (!reviewedSteps.some((step) => step.included)) {
      throw commandError("At least one recorded step must be included", "reviewed_steps");
    }
    const graph = generateRecordingGraph(reviewedSteps, {
      addTerminalSuccess: input.add_terminal_success,
    });
    const validationIssues = validateGraph(graph);
    const firstError = validationIssues.find((issue) => issue.level === "error");
    if (firstError) {
      throw commandError(firstError.message, firstError.node_id ?? firstError.edge_id ?? "reviewed_steps");
    }

    const normalizedName = input.workflow_name.trim();
    if (input.save_mode === "create_new" && !normalizedName) {
      throw commandError("Workflow name is required", "workflow_name");
    }
    if (input.save_mode === "replace_graph" && !draft.workflow_id) {
      throw commandError("Recording draft is not linked to a workflow", "draftId");
    }

    return await dependencies.database.transaction(async (_tx) => {
      const detail =
        input.save_mode === "create_new"
          ? await saveRecordingAsNewWorkflow(draft, graph, normalizedName)
          : await replaceRecordingWorkflowGraph(draft, graph);
      drafts.delete(draft.id);
      dependencies.recorderSessions.deleteSession(draft.session_id);
      return detail;
    });
  }

  function discardRecordingDraftsForSession(sessionId: string) {
    for (const [draftId, draft] of drafts) {
      if (draft.session_id === sessionId) {
        drafts.delete(draftId);
      }
    }
  }

  async function saveRecordingAsNewWorkflow(
    draft: RecordingWorkflowDraft,
    graph: WorkflowGraph,
    workflowName: string,
  ): Promise<WorkflowDetail> {
    const workflow = await dependencies.createWorkflow(workflowName);
    await dependencies.saveWorkflowGraph(workflow.id, graph);
    const settingsSnapshot =
      dependencies.recorderSessions.getInternalSettingsSnapshot(draft.session_id) ??
      draft.workflow_settings_snapshot;
    await dependencies.saveWorkflowSettings(workflow.id, {
      ...settingsSnapshot,
      workflow_id: workflow.id,
      general: {
        ...settingsSnapshot.general,
        name: workflowName,
        created_at: workflow.created_at,
        updated_at: workflow.updated_at,
      },
      created_at: workflow.created_at,
      updated_at: workflow.updated_at,
    });
    return (await dependencies.getWorkflowDetail(workflow.id)) ?? { workflow, steps: [] };
  }

  async function replaceRecordingWorkflowGraph(
    draft: RecordingWorkflowDraft,
    graph: WorkflowGraph,
  ): Promise<WorkflowDetail> {
    const workflowId = draft.workflow_id;
    if (!workflowId) {
      throw commandError("Recording draft is not linked to a workflow", "draftId");
    }
    await dependencies.requireWorkflow(workflowId);
    await dependencies.saveWorkflowGraph(workflowId, graph);
    const detail = await dependencies.getWorkflowDetail(workflowId);
    if (!detail) throw commandError("Workflow not found", "workflowId");
    return detail;
  }

  return {
    createRecordingDraft,
    getRecordingDraft,
    saveRecordingDraft,
    discardRecordingDraftsForSession,
  };
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
