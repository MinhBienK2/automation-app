// @vitest-environment node

import { describe, expect, test } from "vitest";
import type {
  RecordingEvent,
  RecordingSession,
  RecordingWorkflowDraft,
  Workflow,
  WorkflowDetail,
  WorkflowGraph,
  WorkflowSettings,
} from "../../../src/types/workflow";
import { defaultWorkflowSettings } from "../services/workflowSettingsService";
import { createRecordingDraftCommands } from "./recordingDraftCommands";

describe("recording draft commands", () => {
  test("generates a draft from stopped recorder events without persisting a workflow", () => {
    const session = recordingSession();
    const commands = createRecordingDraftCommands({
      database: databaseStub(),
      drafts: new Map(),
      idFactory: () => "draft_test",
      now: () => new Date("2026-06-01T12:00:00.000Z"),
      recorderSessions: {
        getSession: () => session,
        listEvents: () => [
          recordingEvent("event-1", 1, "navigation", {
            page_url: "https://fixture.owned.test/form",
            frame_url: "https://fixture.owned.test/form",
          }),
          recordingEvent("event-2", 2, "click", {
            page_url: "https://fixture.owned.test/form",
            frame_url: "https://fixture.owned.test/form",
          }),
        ],
        getInternalSettingsSnapshot: () => settings("recording_draft"),
        deleteSession: () => undefined,
      },
      createWorkflow: () => {
        throw new Error("createWorkflow should not be called");
      },
      saveWorkflowGraph: () => {
        throw new Error("saveWorkflowGraph should not be called");
      },
      saveWorkflowSettings: () => {
        throw new Error("saveWorkflowSettings should not be called");
      },
      getWorkflowDetail: () => null,
      requireWorkflow: () => {
        throw new Error("requireWorkflow should not be called");
      },
    });

    const draft = commands.createRecordingDraft("session-1", {
      include_event_ids: null,
      add_terminal_success: true,
    });

    expect(draft).toMatchObject({
      id: "draft_test",
      session_id: "session-1",
      workflow_id: null,
      mode: "new_workflow",
      generated_at: "2026-06-01T12:00:00.000Z",
      validation_issues: [],
      steps: [
        { action: { type: "navigate" } },
        { action: { type: "click" } },
      ],
    });
    expect(commands.getRecordingDraft("draft_test")).toEqual(draft);
  });

  test("saves a reviewed draft as a new workflow and clears recorder state", async () => {
    const draft = recordingDraft();
    const drafts = new Map([[draft.id, draft]]);
    const transactionStatements: string[] = [];
    const createdWorkflow = workflow("workflow-created", "Reviewed recording");
    let savedGraph: WorkflowGraph | null = null;
    let savedSettings: WorkflowSettings | null = null;
    let deletedSessionId: string | null = null;

    const commands = createRecordingDraftCommands({
      database: databaseStub(transactionStatements),
      drafts,
      recorderSessions: {
        getSession: () => null,
        listEvents: () => null,
        getInternalSettingsSnapshot: () => settings("internal-session-snapshot"),
        deleteSession: (sessionId) => {
          deletedSessionId = sessionId;
        },
      },
      createWorkflow: async () => createdWorkflow,
      saveWorkflowGraph: async (_workflowId, graph) => {
        savedGraph = graph;
      },
      saveWorkflowSettings: async (_workflowId, value) => {
        savedSettings = value;
      },
      getWorkflowDetail: async () => ({ workflow: createdWorkflow, steps: [] }),
      requireWorkflow: async () => createdWorkflow,
    });

    const saved = await commands.saveRecordingDraft(draft.id, {
      workflow_name: "Reviewed recording",
      save_mode: "create_new",
      reviewed_steps: draft.steps.map((step) => ({
        ...step,
        label: "Reviewed click",
      })),
      add_terminal_success: true,
    });

    expect(saved).toEqual({ workflow: createdWorkflow, steps: [] });
    expect(transactionStatements).toEqual(["BEGIN IMMEDIATE", "COMMIT"]);
    expect(drafts.has(draft.id)).toBe(false);
    expect(deletedSessionId).toBe("session-1");
    expect(savedGraph?.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          node_type: "action",
          label: "Reviewed click",
          config: expect.objectContaining({ type: "click" }),
        }),
        expect.objectContaining({ node_type: "end_success" }),
      ]),
    );
    expect(savedSettings).toMatchObject({
      workflow_id: "workflow-created",
      general: {
        name: "Reviewed recording",
        created_at: createdWorkflow.created_at,
        updated_at: createdWorkflow.updated_at,
      },
      browser_launch: {
        identity_id: "internal-session-snapshot",
      },
      created_at: createdWorkflow.created_at,
      updated_at: createdWorkflow.updated_at,
    });
  });
});

function databaseStub(statements: string[] = []) {
  return {
    async transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
      statements.push("BEGIN IMMEDIATE");
      try {
        const result = await callback({
          exec(sql: string) {
            statements.push(sql);
          }
        });
        statements.push("COMMIT");
        return result;
      } catch (e) {
        statements.push("ROLLBACK");
        throw e;
      }
    }
  } as any;
}

function recordingDraft(): RecordingWorkflowDraft {
  return {
    id: "draft-1",
    session_id: "session-1",
    workflow_id: null,
    mode: "new_workflow",
    status: "draft",
    generated_at: "2026-06-01T12:00:00.000Z",
    workflow_settings_snapshot: settings("draft-snapshot"),
    steps: [
      {
        id: "step-1",
        source_event_ids: ["event-1"],
        action: {
          type: "click",
          config: {
            target: {
              locators: [
                {
                  kind: "role",
                  value: "button",
                  name: "Save",
                  score: 0.9,
                  reason: "Accessible role",
                },
              ],
            },
            wait_until: "clickable",
            timeout_ms: 60000,
          },
        },
        label: "Click Save",
        included: true,
        timing: null,
        locator_confidence: "high",
        warnings: [],
      },
    ],
    graph: { version: 2, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
    validation_issues: [],
    warnings: [],
  };
}

function recordingSession(): RecordingSession {
  return {
    id: "session-1",
    workflow_id: null,
    mode: "new_workflow",
    status: "stopped",
    started_at: "2026-06-01T11:00:00.000Z",
    stopped_at: "2026-06-01T12:00:00.000Z",
    browser_identity: {
      identity_id: "recording_draft",
      display_name: "Recording identity",
      profile_dir: "recording_draft",
      fingerprint_seed_hash: "hash",
      humanize: true,
      human_preset: "default",
      headless: false,
    },
    workflow_settings_snapshot: settings("recording_draft"),
    page_url: "https://fixture.owned.test/form",
    event_count: 2,
    warnings: [],
  };
}

function recordingEvent(
  id: string,
  sequence: number,
  kind: RecordingEvent["kind"],
  urls: Pick<RecordingEvent, "page_url" | "frame_url">,
): RecordingEvent {
  return {
    id,
    session_id: "session-1",
    sequence,
    timestamp: "2026-06-01T12:00:00.000Z",
    kind,
    ...urls,
    target: kind === "click"
      ? {
          tag_name: "button",
          accessible_name: "Save",
          locators: [
            {
              kind: "role",
              value: "button",
              name: "Save",
              score: 0.9,
              reason: "Accessible role",
            },
          ],
        }
      : null,
    value: null,
    raw: {},
    confidence: "high",
    warnings: [],
  };
}

function workflow(id: string, name: string): Workflow {
  return {
    id,
    name,
    created_at: "2026-06-01T13:00:00.000Z",
    updated_at: "2026-06-01T13:00:00.000Z",
  };
}

function settings(identityId: string): WorkflowSettings {
  const value = defaultWorkflowSettings(workflow("workflow-source", "Source workflow"));
  return {
    ...value,
    browser_launch: {
      ...value.browser_launch,
      identity_id: identityId,
      profile_dir: identityId,
      profile_name: identityId,
    },
  };
}
