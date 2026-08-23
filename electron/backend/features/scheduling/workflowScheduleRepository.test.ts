// @vitest-environment node

import { describe, expect, test } from "vitest";
import { WorkflowRepository } from "../workflows/workflowRepository.js";
import { WorkflowScheduleRepository } from "./workflowScheduleRepository.js";
import { TestDbAdapter } from "../../db/testDbAdapter.js";
import { startOnlyGraph } from "../../testSupport/commands.testHelpers.js";

describe("WorkflowScheduleRepository", () => {
  test("persists schedules with workflow names and schedule events", async () => {
    const { workflowRepository, scheduleRepository } = await createRepositories();
    const workflow = await workflowRepository.createWorkflow("Nightly", startOnlyGraph(2));

    const schedule = await scheduleRepository.createSchedule({
      workflow_id: workflow.id,
      name: "Every hour",
      enabled: true,
      kind: { type: "interval", every_seconds: 3600 },
      next_run_at: "2026-05-17T09:00:00.000Z",
    });
    await scheduleRepository.createEvent({
      schedule_id: schedule.id,
      workflow_id: workflow.id,
      event_type: "started",
      run_id: "run-1",
      scheduled_for: "2026-05-17T09:00:00.000Z",
      created_at: "2026-05-17T09:00:00.000Z",
      reason: null,
      details_json: null,
    });

    const schedulesList = await scheduleRepository.listSchedules();
    expect(schedulesList).toEqual([
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

    const eventsList = await scheduleRepository.listEvents({ schedule_id: schedule.id });
    expect(eventsList).toEqual([
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
    const workflow = await workflowRepository.createWorkflow("Temporary", startOnlyGraph(2));
    const schedule = await scheduleRepository.createSchedule({
      workflow_id: workflow.id,
      name: "Once",
      enabled: false,
      kind: { type: "once_at", timestamp: "2026-05-17T09:00:00.000Z" },
      next_run_at: null,
    });
    await scheduleRepository.createEvent({
      schedule_id: schedule.id,
      workflow_id: workflow.id,
      event_type: "skipped",
      run_id: null,
      scheduled_for: "2026-05-17T09:00:00.000Z",
      created_at: "2026-05-17T09:00:00.000Z",
      reason: "active_run",
      details_json: null,
    });

    await workflowRepository.deleteWorkflow(workflow.id);

    const schedulesList = await scheduleRepository.listSchedules();
    expect(schedulesList).toEqual([]);

    const eventsList = await scheduleRepository.listEvents({ schedule_id: schedule.id });
    expect(eventsList).toEqual([]);
  });
});

async function createRepositories() {
  const database = await TestDbAdapter.create();
  return {
    workflowRepository: new WorkflowRepository(database),
    scheduleRepository: new WorkflowScheduleRepository(database),
  };
}
