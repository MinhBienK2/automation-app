import { describe, expect, test } from "vitest";
import type {
  WorkflowRunSnapshot,
  WorkflowSchedule,
  WorkflowSummary,
} from "../../../types/workflow";
import {
  buildActiveRunMap,
  buildScheduledWorkflowSet,
  filterWorkflowLibraryItems,
  getWorkflowActionAvailability,
  getWorkflowFilterOptions,
  selectWorkflowFallback,
  sortWorkflowLibraryItems,
  workflowMatchesSearch,
} from "./workflowLibrary";

describe("workflow library helpers", () => {
  const loginWorkflow: WorkflowSummary = {
    id: "workflow-login",
    name: "Login flow",
    step_count: 3,
    created_at: "2026-05-28T10:00:00.000Z",
    updated_at: "2026-05-29T10:00:00.000Z",
  };
  const supportWorkflow: WorkflowSummary = {
    id: "workflow-support",
    name: "Support flow",
    step_count: 1,
    created_at: "2026-05-28T09:00:00.000Z",
    updated_at: "2026-05-29T09:00:00.000Z",
  };
  const activeRun: WorkflowRunSnapshot = {
    run_id: "run-login",
    workflow_id: loginWorkflow.id,
    workflow_name: loginWorkflow.name,
    source: "manual",
    started_at: "2026-05-29T10:05:00.000Z",
    status: "running",
    mode: "run_workflow",
    target_step_id: null,
    current_step_id: "step-1",
    current_step_number: 2,
    completed_step_ids: [],
    outputs: {},
    error: null,
    state: {
      status: "running",
      mode: "run_workflow",
      target_step_id: null,
      current_step_id: "step-1",
      current_step_number: 2,
      completed_step_ids: [],
      outputs: {},
      error: null,
    },
  };
  const schedule: WorkflowSchedule = {
    id: "schedule-support",
    workflow_id: supportWorkflow.id,
    workflow_name: supportWorkflow.name,
    name: "Daily support",
    enabled: true,
    kind: { type: "calendar", preset: "daily", time: "09:00" },
    next_run_at: null,
    last_event_at: null,
    last_status: null,
    last_reason: null,
    created_at: "2026-05-29T00:00:00.000Z",
    updated_at: "2026-05-29T00:00:00.000Z",
  };

  test("builds active run and scheduled workflow lookup models", () => {
    expect(buildActiveRunMap([activeRun]).get(loginWorkflow.id)?.run_id).toBe("run-login");
    expect(buildScheduledWorkflowSet([schedule]).has(supportWorkflow.id)).toBe(true);
  });

  test("filters by search, active state, and scheduled state without broad detail data", () => {
    const context = {
      activeRunsByWorkflow: buildActiveRunMap([activeRun]),
      scheduledWorkflowIds: buildScheduledWorkflowSet([schedule]),
    };

    expect(workflowMatchesSearch(loginWorkflow, "LOGIN")).toBe(true);
    expect(workflowMatchesSearch(loginWorkflow, "missing")).toBe(false);
    expect(filterWorkflowLibraryItems([loginWorkflow, supportWorkflow], {
      context,
      filter: "active",
      search: "",
      sort: "recent",
    })).toEqual([loginWorkflow]);
    expect(filterWorkflowLibraryItems([loginWorkflow, supportWorkflow], {
      context,
      filter: "scheduled",
      search: "",
      sort: "recent",
    })).toEqual([supportWorkflow]);
  });

  test("sorts by recent, name, and run state", () => {
    const context = {
      activeRunsByWorkflow: buildActiveRunMap([activeRun]),
      scheduledWorkflowIds: buildScheduledWorkflowSet([]),
    };

    expect(sortWorkflowLibraryItems([supportWorkflow, loginWorkflow], "recent", context)[0])
      .toBe(loginWorkflow);
    expect(sortWorkflowLibraryItems([supportWorkflow, loginWorkflow], "name", context)[0])
      .toBe(loginWorkflow);
    expect(sortWorkflowLibraryItems([supportWorkflow, loginWorkflow], "run_state", context)[0])
      .toBe(loginWorkflow);
  });

  test("reports action availability and selected workflow fallback", () => {
    const context = {
      activeRunsByWorkflow: buildActiveRunMap([activeRun]),
      scheduledWorkflowIds: buildScheduledWorkflowSet([]),
    };

    expect(getWorkflowActionAvailability(loginWorkflow, context)).toMatchObject({
      canRun: false,
      canStop: true,
      canDuplicate: false,
      canExport: false,
      canDelete: false,
      disabledReason: "Workflow currently running",
    });
    expect(getWorkflowFilterOptions(context).find((option) => option.id === "draft"))
      .toMatchObject({ disabled: true });
    expect(selectWorkflowFallback("missing", [supportWorkflow, loginWorkflow])?.id)
      .toBe(supportWorkflow.id);
  });
});
