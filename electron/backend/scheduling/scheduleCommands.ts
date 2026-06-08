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
} from "../../../src/types/workflow.js";
import { commandError } from "../commandHelpers.js";
import {
  calculateNextRunAt,
  processDueSchedules,
  validateScheduleInput,
} from "./scheduler.js";
import type { WorkflowScheduleRepository } from "./workflowScheduleRepository.js";

export function prepareScheduleInput(
  input: WorkflowScheduleInput,
  {
    requireWorkflow,
    validateWorkflowRun,
    now = new Date(),
  }: {
    requireWorkflow: (workflowId: string) => unknown;
    validateWorkflowRun: (workflowId: string) => RunValidationIssue[];
    now?: Date;
  },
): WorkflowScheduleInput & { next_run_at: string | null } {
  const issues = validateScheduleInput(input);
  const firstError = issues.find((issue) => issue.level === "error");
  if (firstError) {
    throw commandError(firstError.message, firstError.field);
  }
  if (input.enabled) {
    const workflowIssues = validateWorkflowRun(input.workflow_id);
    const firstWorkflowError = workflowIssues.find((issue) => issue.level === "error");
    if (firstWorkflowError) {
      throw commandError(
        firstWorkflowError.message,
        firstWorkflowError.field ?? firstWorkflowError.node_id ?? "workflow_id",
      );
    }
  } else {
    requireWorkflow(input.workflow_id);
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
  requireWorkflow: (workflowId: string) => unknown;
  validateWorkflowRun: (workflowId: string) => RunValidationIssue[];
  schedulerConflictReason: (workflowId: string) => string | null;
  startWorkflowRun: (workflowId: string, source: "schedule") => Promise<WorkflowRunSnapshot>;
}) {
  const scheduleInputWithNextRun = (input: WorkflowScheduleInput) =>
    prepareScheduleInput(input, { requireWorkflow, validateWorkflowRun });

  return {
    listSchedules(): WorkflowSchedule[] {
      return scheduleRepository.listSchedules();
    },

    getSchedule(scheduleId: string): WorkflowSchedule {
      const schedule = scheduleRepository.getSchedule(scheduleId);
      if (!schedule) {
        throw commandError("Schedule not found", "scheduleId");
      }
      return schedule;
    },

    createSchedule(input: WorkflowScheduleInput): WorkflowSchedule {
      return scheduleRepository.createSchedule(scheduleInputWithNextRun(input));
    },

    updateSchedule(
      scheduleId: string,
      patch: WorkflowScheduleUpdate,
    ): WorkflowSchedule {
      const current = scheduleRepository.getSchedule(scheduleId);
      if (!current) {
        throw commandError("Schedule not found", "scheduleId");
      }
      return scheduleRepository.updateSchedule(
        scheduleId,
        scheduleInputWithNextRun({
          workflow_id: patch.workflow_id ?? current.workflow_id,
          name: patch.name ?? current.name,
          enabled: patch.enabled ?? current.enabled,
          kind: patch.kind ?? current.kind,
        }),
      );
    },

    deleteSchedule(scheduleId: string) {
      if (!scheduleRepository.getSchedule(scheduleId)) {
        throw commandError("Schedule not found", "scheduleId");
      }
      scheduleRepository.deleteSchedule(scheduleId);
    },

    enableSchedule(scheduleId: string): WorkflowSchedule {
      const current = scheduleRepository.getSchedule(scheduleId);
      if (!current) {
        throw commandError("Schedule not found", "scheduleId");
      }
      return scheduleRepository.updateSchedule(
        scheduleId,
        scheduleInputWithNextRun({
          workflow_id: current.workflow_id,
          name: current.name,
          enabled: true,
          kind: current.kind,
        }),
      );
    },

    disableSchedule(scheduleId: string): WorkflowSchedule {
      const current = scheduleRepository.getSchedule(scheduleId);
      if (!current) {
        throw commandError("Schedule not found", "scheduleId");
      }
      return scheduleRepository.updateSchedule(scheduleId, {
        workflow_id: current.workflow_id,
        name: current.name,
        enabled: false,
        kind: current.kind,
        next_run_at: null,
      });
    },

    listScheduleEvents(filter: WorkflowScheduleEventFilter = {}): WorkflowScheduleEvent[] {
      return scheduleRepository.listEvents(filter);
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
