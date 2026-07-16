import { beforeEach, describe, expect, test, vi } from "vitest";
import type { WorkflowGraph, WorkflowRunSnapshot } from "../types/workflow";
import { initialRunState } from "./workflowUi";
import {
  cloneWorkflowSettings,
  formatMaintenanceBytes,
  graphEditableContentKey,
  graphSaveStatusLabel,
  hasEditableGraphChange,
  latestRunForWorkflow,
  readGraphAutosaveEnabled,
  settingsSaveStatuses,
  todayOperationsRange,
  writeGraphAutosaveEnabled,
} from "./appState";
import { defaultWorkflowSettings } from "../features/workflows/lib/workflowSettings";

const graph: WorkflowGraph = {
  version: 2,
  nodes: [],
  edges: [],
  viewport: { x: 50, y: 60, zoom: 1.5 },
};

describe("appState helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
  });

  test("persists graph autosave preference with a safe default", () => {
    expect(readGraphAutosaveEnabled()).toBe(true);

    writeGraphAutosaveEnabled(false);

    expect(readGraphAutosaveEnabled()).toBe(false);
  });

  test("labels graph save states and hashes only editable graph content", () => {
    expect(graphSaveStatusLabel("failed")).toBe("Autosave failed");
    expect(graphSaveStatusLabel("pending")).toBe("Pending");
    expect(graphEditableContentKey(graph)).toBe(
      JSON.stringify({
        version: 2,
        nodes: [],
        edges: [],
        migration_notes: [],
      }),
    );
  });

  test("detects editable graph changes without treating viewport-only updates as edits", () => {
    expect(hasEditableGraphChange(graph, { ...graph, viewport: { x: 12, y: 24, zoom: 0.8 } }))
      .toBe(false);
    expect(hasEditableGraphChange(graph, { ...graph, nodes: [...graph.nodes] })).toBe(false);
    expect(
      hasEditableGraphChange(graph, {
        ...graph,
        nodes: [
          {
            id: "node-1",
            node_type: "action",
            label: "Node",
            position: { x: 0, y: 0 },
            config: null,
            ports: [],
            group_id: null,
          },
        ],
      }),
    ).toBe(true);
  });

  test("selects the latest run snapshot for a workflow", () => {
    const snapshots: WorkflowRunSnapshot[] = [
      {
        ...initialRunState,
        run_id: "older",
        workflow_id: "workflow-1",
        workflow_name: "Login",
        source: "manual",
        started_at: "2026-05-27T10:00:00.000Z",
        state: initialRunState,
      },
      {
        ...initialRunState,
        run_id: "newer",
        workflow_id: "workflow-1",
        workflow_name: "Login",
        source: "manual",
        started_at: "2026-05-27T11:00:00.000Z",
        state: initialRunState,
      },
    ];

    expect(latestRunForWorkflow(snapshots, "workflow-1")?.run_id).toBe("newer");
  });

  test("formats maintenance byte counts and today's operations range", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-27T14:30:00.000Z"));

    expect(formatMaintenanceBytes(1536)).toBe("1.5 KiB");
    const range = todayOperationsRange();
    expect(Date.parse(range.day_end_utc) - Date.parse(range.day_start_utc))
      .toBe(24 * 60 * 60 * 1000);
    expect(range.timezone_label).toBeTruthy();
  });

  test("creates immutable workflow settings snapshots and section save statuses", () => {
    const settings = defaultWorkflowSettings({
      workflowId: "workflow-1",
      workflowName: "Login",
    });
    const clone = cloneWorkflowSettings(settings);

    expect(clone).toEqual(settings);
    expect(clone).not.toBe(settings);
    expect(settingsSaveStatuses("saving")).toEqual({
      general: "saving",
      run_policy: "saving",
      browser_launch: "saving",
      desktop_launch: "saving",
      graph_defaults: "saving",
      environment: "saving",
    });
  });
});
