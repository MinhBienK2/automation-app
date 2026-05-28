import { describe, expect, test } from "vitest";
import type {
  EvidenceListItem,
  IdentityLabOverview,
  WorkflowRunSnapshot,
  WorkflowSchedule,
  WorkflowSummary,
} from "../types/workflow";
import {
  buildEvidenceCommandResults,
  buildIdentityCommandResults,
  buildRunCommandResults,
  buildScheduleCommandResults,
  buildWorkflowCommandResults,
  dedupeCommandSearchResults,
  formatCommandResultContext,
  groupCommandSearchResults,
  limitCommandSearchResults,
} from "./commandSearch";

describe("command search helpers", () => {
  const workflow: WorkflowSummary = {
    id: "wf_1",
    name: "Checkout audit",
    step_count: 3,
    created_at: "2026-05-29T00:00:00.000Z",
    updated_at: "2026-05-29T00:00:00.000Z",
  };
  const run: WorkflowRunSnapshot = {
    run_id: "run_1",
    workflow_id: "wf_1",
    workflow_name: "Checkout audit",
    source: "manual",
    started_at: "2026-05-29T00:00:00.000Z",
    status: "running",
    mode: "run_workflow",
    target_step_id: null,
    current_step_id: null,
    current_step_number: 2,
    completed_step_ids: [],
    outputs: {},
    error: null,
    state: {
      status: "running",
      mode: "run_workflow",
      target_step_id: null,
      current_step_id: null,
      current_step_number: 2,
      completed_step_ids: [],
      outputs: {},
      error: null,
    },
  };
  const schedule: WorkflowSchedule = {
    id: "schedule_1",
    workflow_id: "wf_1",
    workflow_name: "Checkout audit",
    name: "Daily checkout",
    enabled: true,
    kind: { type: "calendar", preset: "daily", time: "09:00" },
    next_run_at: null,
    last_event_at: null,
    last_status: null,
    last_reason: null,
    created_at: "2026-05-29T00:00:00.000Z",
    updated_at: "2026-05-29T00:00:00.000Z",
  };
  const evidence: EvidenceListItem = {
    evidence_id: "ev_1",
    kind: "browser_identity",
    label: "Checkout identity evidence",
    created_at: "2026-05-29T00:00:00.000Z",
    run: {
      id: "run_1",
      status: "success",
      source: "manual",
      started_at: "2026-05-29T00:00:00.000Z",
    },
    workflow: { id: "wf_1", name: "Checkout audit" },
    identity: { id: "bi_1", display_name: "QA identity" },
    navigation_targets: { run: true, workflow: true },
  };
  const identities: IdentityLabOverview = {
    generated_at: "2026-05-29T00:00:00.000Z",
    counts: {
      managed_identities: 1,
      active_retained_sessions: 0,
      identities_with_warnings: 0,
      identities_with_recent_failures: 0,
    },
    items: [
      {
        workflow_ref: { id: "wf_1", name: "Checkout audit" },
        identity_ref: { id: "bi_1", display_name: "QA identity" },
        short_identity_id: "bi_1",
        session_mode: "persistent_profile",
        profile_reuse: true,
        retained_session: { active: false },
        configured_posture_summary: [],
        last_run: null,
        recent_failures_24h: 0,
        warning_badges: [],
      },
    ],
    selected: null,
    data_warnings: [],
  };

  test("builds safe local and remote result records", () => {
    expect(buildWorkflowCommandResults([workflow], "checkout")[0]).toMatchObject({
      type: "Workflow",
      label: "Checkout audit",
      target: { type: "workflow", workflow_id: "wf_1" },
    });
    expect(buildRunCommandResults([run], "run_1")[0]).toMatchObject({
      type: "Run",
      context: "running run_1",
    });
    expect(buildScheduleCommandResults([schedule], "daily")[0]).toMatchObject({
      type: "Schedule",
      target: { type: "schedule", schedule_id: "schedule_1" },
    });
    expect(buildEvidenceCommandResults([evidence]).map((result) => result.type))
      .toEqual(["Evidence", "Identity"]);
    expect(buildIdentityCommandResults(identities)[0]).toMatchObject({
      type: "Identity",
      context: "Checkout audit",
    });
  });

  test("groups, dedupes, limits, and formats fallback context", () => {
    const duplicate = buildWorkflowCommandResults([workflow], "checkout")[0];
    const results = dedupeCommandSearchResults([duplicate, duplicate]);
    expect(results).toHaveLength(1);
    expect(groupCommandSearchResults(results)[0]).toMatchObject({
      label: "Workflows",
      results,
    });
    expect(limitCommandSearchResults([duplicate, { ...duplicate, id: "wf_2" }], { total: 1 }))
      .toHaveLength(1);
    expect(formatCommandResultContext("", "Workflow")).toBe("Workflow");
  });
});
