// @vitest-environment node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { createAppPaths, initializeDatabase } from "../persistence/database";
import { WorkflowRepository } from "../persistence/workflowRepository";
import { WorkflowScheduleRepository } from "./workflowScheduleRepository";

const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await fs.rm(root, { recursive: true, force: true });
  }
});

describe("WorkflowScheduleRepository", () => {
  test("persists schedules with workflow names and schedule events", async () => {
    const { workflowRepository, scheduleRepository } = await createRepositories();
    const workflow = workflowRepository.createWorkflow("Nightly", draftGraph());

    const schedule = scheduleRepository.createSchedule({
      workflow_id: workflow.id,
      name: "Every hour",
      enabled: true,
      kind: { type: "interval", every_seconds: 3600 },
      next_run_at: "2026-05-17T09:00:00.000Z",
    });
    scheduleRepository.createEvent({
      schedule_id: schedule.id,
      workflow_id: workflow.id,
      event_type: "started",
      run_id: "run-1",
      scheduled_for: "2026-05-17T09:00:00.000Z",
      created_at: "2026-05-17T09:00:00.000Z",
      reason: null,
      details_json: null,
    });

    expect(scheduleRepository.listSchedules()).toEqual([
      expect.objectContaining({
        id: schedule.id,
        workflow_id: workflow.id,
        workflow_name: "Nightly",
        name: "Every hour",
        enabled: true,
        kind: { type: "interval", every_seconds: 3600 },
        next_run_at: "2026-05-17T09:00:00.000Z",
      }),
    ]);
    expect(scheduleRepository.listEvents({ schedule_id: schedule.id })).toEqual([
      expect.objectContaining({
        schedule_id: schedule.id,
        workflow_id: workflow.id,
        event_type: "started",
        run_id: "run-1",
      }),
    ]);
  });

  test("cascades schedules and events when a workflow is deleted", async () => {
    const { workflowRepository, scheduleRepository } = await createRepositories();
    const workflow = workflowRepository.createWorkflow("Temporary", draftGraph());
    const schedule = scheduleRepository.createSchedule({
      workflow_id: workflow.id,
      name: "Once",
      enabled: false,
      kind: { type: "once_at", timestamp: "2026-05-17T09:00:00.000Z" },
      next_run_at: null,
    });
    scheduleRepository.createEvent({
      schedule_id: schedule.id,
      workflow_id: workflow.id,
      event_type: "skipped",
      run_id: null,
      scheduled_for: "2026-05-17T09:00:00.000Z",
      created_at: "2026-05-17T09:00:00.000Z",
      reason: "active_run",
      details_json: null,
    });

    workflowRepository.deleteWorkflow(workflow.id);

    expect(scheduleRepository.listSchedules()).toEqual([]);
    expect(scheduleRepository.listEvents({ schedule_id: schedule.id })).toEqual([]);
  });
});

async function createRepositories() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "schedule-repo-"));
  tempRoots.push(tempRoot);
  const database = await initializeDatabase(createAppPaths(tempRoot));
  return {
    workflowRepository: new WorkflowRepository(database),
    scheduleRepository: new WorkflowScheduleRepository(database),
  };
}

function draftGraph() {
  return {
    version: 2,
    nodes: [
      {
        id: "start",
        node_type: "start" as const,
        label: "Start",
        position: { x: 0, y: 0 },
        config: null,
        ports: [{ id: "out", label: "Out", direction: "output" as const }],
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}
