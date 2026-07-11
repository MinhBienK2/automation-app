import type {
  OrchestrationSchedule,
  RunValidationIssue,
  ScheduleValidationIssue,
  WorkflowRunSnapshot,
  WorkflowSchedule,
  WorkflowScheduleEvent,
  WorkflowScheduleEventFilter,
  WorkflowScheduleInput,
  WorkflowScheduleUpdate,
} from "../../../../src/types/workflow.js";
import { commandError } from "../../commandHelpers.js";
import {
  calculateNextRunAt,
  processDueSchedules,
  validateScheduleInput,
} from "./scheduler.js";
import type { WorkflowScheduleRepository } from "./workflowScheduleRepository.js";

export async function prepareScheduleInput(
  input: WorkflowScheduleInput,
  {
    requireWorkflow,
    validateWorkflowRun,
    now = new Date(),
  }: {
    requireWorkflow: (workflowId: string) => Promise<unknown> | unknown;
    validateWorkflowRun: (workflowId: string) => Promise<RunValidationIssue[]> | RunValidationIssue[];
    now?: Date;
  },
): Promise<WorkflowScheduleInput & { next_run_at: string | null }> {
  const issues = validateScheduleInput(input);
  const firstError = issues.find((issue) => issue.level === "error");
  if (firstError) {
    throw commandError(firstError.message, firstError.field);
  }
  if (input.enabled) {
    const workflowIssues = await validateWorkflowRun(input.workflow_id);
    const firstWorkflowError = workflowIssues.find((issue) => issue.level === "error");
    if (firstWorkflowError) {
      throw commandError(
        firstWorkflowError.message,
        firstWorkflowError.field ?? firstWorkflowError.node_id ?? "workflow_id",
      );
    }
  } else {
    await requireWorkflow(input.workflow_id);
  }
  return {
    ...input,
    name: input.name.trim(),
    next_run_at: input.enabled ? calculateNextRunAt(input.kind, now) : null,
  };
}

export function createScheduleCommandHandlers({
  scheduleRepository,
  requireWorkflow,
  validateWorkflowRun,
  schedulerConflictReason,
  startWorkflowRun,
}: {
  scheduleRepository: WorkflowScheduleRepository;
  requireWorkflow: (workflowId: string) => Promise<unknown> | unknown;
  validateWorkflowRun: (workflowId: string) => Promise<RunValidationIssue[]> | RunValidationIssue[];
  schedulerConflictReason: (workflowId: string) => Promise<string | null> | string | null;
  startWorkflowRun: (workflowId: string, source: "schedule") => Promise<WorkflowRunSnapshot>;
}) {
  const scheduleInputWithNextRun = async (input: WorkflowScheduleInput) =>
    await prepareScheduleInput(input, { requireWorkflow, validateWorkflowRun });

  return {
    async listSchedules(): Promise<WorkflowSchedule[]> {
      return await scheduleRepository.listSchedules();
    },

    async getSchedule(scheduleId: string): Promise<WorkflowSchedule> {
      const schedule = await scheduleRepository.getSchedule(scheduleId);
      if (!schedule) {
        throw commandError("Schedule not found", "scheduleId");
      }
      return schedule;
    },

    async createSchedule(input: WorkflowScheduleInput): Promise<WorkflowSchedule> {
      const prepared = await scheduleInputWithNextRun(input);
      return await scheduleRepository.createSchedule(prepared);
    },

    async updateSchedule(
      scheduleId: string,
      patch: WorkflowScheduleUpdate,
    ): Promise<WorkflowSchedule> {
      const current = await scheduleRepository.getSchedule(scheduleId);
      if (!current) {
        throw commandError("Schedule not found", "scheduleId");
      }
      const prepared = await scheduleInputWithNextRun({
        workflow_id: patch.workflow_id ?? current.workflow_id,
        name: patch.name ?? current.name,
        enabled: patch.enabled ?? current.enabled,
        kind: patch.kind ?? current.kind,
      });
      return await scheduleRepository.updateSchedule(scheduleId, prepared);
    },

    async deleteSchedule(scheduleId: string): Promise<void> {
      const current = await scheduleRepository.getSchedule(scheduleId);
      if (!current) {
        throw commandError("Schedule not found", "scheduleId");
      }
      await scheduleRepository.deleteSchedule(scheduleId);
    },

    async enableSchedule(scheduleId: string): Promise<WorkflowSchedule> {
      const current = await scheduleRepository.getSchedule(scheduleId);
      if (!current) {
        throw commandError("Schedule not found", "scheduleId");
      }
      const prepared = await scheduleInputWithNextRun({
        workflow_id: current.workflow_id,
        name: current.name,
        enabled: true,
        kind: current.kind,
      });
      return await scheduleRepository.updateSchedule(scheduleId, prepared);
    },

    async disableSchedule(scheduleId: string): Promise<WorkflowSchedule> {
      const current = await scheduleRepository.getSchedule(scheduleId);
      if (!current) {
        throw commandError("Schedule not found", "scheduleId");
      }
      return await scheduleRepository.updateSchedule(scheduleId, {
        workflow_id: current.workflow_id,
        name: current.name,
        enabled: false,
        kind: current.kind,
        next_run_at: null,
      });
    },

    async listScheduleEvents(filter: WorkflowScheduleEventFilter = {}): Promise<WorkflowScheduleEvent[]> {
      return await scheduleRepository.listEvents(filter);
    },

    validateSchedule(schedule: OrchestrationSchedule): ScheduleValidationIssue[] {
      return validateScheduleInput(schedule);
    },

    async runSchedulerTick(now = new Date()) {
      await processDueSchedules({
        now,
        repository: scheduleRepository,
        getRunConflict: schedulerConflictReason,
        validateWorkflow: validateWorkflowRun,
        startWorkflow: async (workflowId) => {
          const result = await startWorkflowRun(workflowId, "schedule");
          return { runId: result.run_id };
        },
      });
    },
  };
}
