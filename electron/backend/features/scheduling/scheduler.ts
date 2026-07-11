import type {
  RunValidationIssue,
  ScheduleValidationIssue,
  WorkflowSchedule,
  WorkflowScheduleEvent,
  WorkflowScheduleInput,
  WorkflowScheduleKind,
  WorkflowScheduleStatus,
} from "../../../../src/types/workflow.js";

export type ScheduleRepositoryPort = {
  listDueSchedules(now: Date): Promise<WorkflowSchedule[]> | WorkflowSchedule[];
  updateScheduleRuntime(
    scheduleId: string,
    update: {
      enabled?: boolean;
      next_run_at?: string | null;
      last_status?: WorkflowScheduleStatus | null;
      last_reason?: string | null;
      last_event_at?: string | null;
    },
  ): Promise<void> | void;
  createEvent(event: Omit<WorkflowScheduleEvent, "id">): Promise<WorkflowScheduleEvent> | WorkflowScheduleEvent;
};

type ProcessDueSchedulesOptions = {
  now: Date;
  missedWindowMs?: number;
  repository: ScheduleRepositoryPort;
  getRunConflict: (workflowId: string) => Promise<string | null> | string | null;
  validateWorkflow: (workflowId: string) => Promise<RunValidationIssue[]> | RunValidationIssue[];
  startWorkflow: (workflowId: string) => Promise<{ runId?: string | null } | void>;
};

const defaultMissedWindowMs = 5 * 60 * 1000;
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function calculateNextRunAt(
  kind: WorkflowScheduleKind,
  from: Date,
): string | null {
  if (kind.type === "once_at") {
    return new Date(kind.timestamp).getTime() > from.getTime()
      ? new Date(kind.timestamp).toISOString()
      : null;
  }

  if (kind.type === "interval") {
    return new Date(from.getTime() + kind.every_seconds * 1000).toISOString();
  }

  const [hour, minute] = parseTime(kind.time);
  if (kind.preset === "daily") {
    const candidate = localCandidate(from, hour, minute);
    if (candidate.getTime() <= from.getTime()) {
      candidate.setDate(candidate.getDate() + 1);
    }
    return candidate.toISOString();
  }

  if (kind.preset === "weekly") {
    const weekdays = [...new Set(kind.weekdays)].sort((left, right) => left - right);
    for (let offset = 0; offset <= 7; offset += 1) {
      const candidate = localCandidate(from, hour, minute);
      candidate.setDate(candidate.getDate() + offset);
      if (
        weekdays.includes(candidate.getDay()) &&
        candidate.getTime() > from.getTime()
      ) {
        return candidate.toISOString();
      }
    }
    return null;
  }

  for (let monthOffset = 0; monthOffset < 24; monthOffset += 1) {
    const candidate = new Date(
      from.getFullYear(),
      from.getMonth() + monthOffset,
      kind.day,
      hour,
      minute,
      0,
      0,
    );
    if (candidate.getDate() !== kind.day) continue;
    if (candidate.getTime() > from.getTime()) return candidate.toISOString();
  }

  return null;
}

export function validateScheduleInput(
  input: WorkflowScheduleInput,
  now = new Date(),
): ScheduleValidationIssue[] {
  const issues: ScheduleValidationIssue[] = [];
  if (!input.workflow_id?.trim()) {
    issues.push({
      field: "workflow_id",
      message: "Workflow is required",
      level: "error",
    });
  }
  if (!input.name?.trim()) {
    issues.push({
      field: "name",
      message: "Schedule name is required",
      level: "error",
    });
  }

  if (input.kind.type === "once_at") {
    const timestamp = new Date(input.kind.timestamp);
    if (Number.isNaN(timestamp.getTime())) {
      issues.push({
        field: "kind.timestamp",
        message: "Use a valid date and time",
        level: "error",
      });
    } else if (input.enabled && timestamp.getTime() <= now.getTime()) {
      issues.push({
        field: "kind.timestamp",
        message: "One-time schedule must be in the future",
        level: "error",
      });
    }
  } else if (input.kind.type === "interval") {
    if (!Number.isFinite(input.kind.every_seconds) || input.kind.every_seconds < 60) {
      issues.push({
        field: "kind.every_seconds",
        message: "Interval must be at least 60 seconds",
        level: "error",
      });
    }
  } else {
    if (input.kind.preset === "weekly" && input.kind.weekdays.length === 0) {
      issues.push({
        field: "kind.weekdays",
        message: "Select at least one weekday",
        level: "error",
      });
    }
    if (input.kind.preset === "monthly") {
      if (!Number.isInteger(input.kind.day) || input.kind.day < 1 || input.kind.day > 31) {
        issues.push({
          field: "kind.day",
          message: "Use a day from 1 to 31",
          level: "error",
        });
      }
    }
    if (!timePattern.test(input.kind.time)) {
      issues.push({
        field: "kind.time",
        message: "Use a valid HH:mm time",
        level: "error",
      });
    }
  }

  return issues;
}

export async function processDueSchedules({
  now,
  missedWindowMs = defaultMissedWindowMs,
  repository,
  getRunConflict,
  validateWorkflow,
  startWorkflow,
}: ProcessDueSchedulesOptions) {
  const dueSchedules = await repository.listDueSchedules(now);
  for (const schedule of dueSchedules) {
    const scheduledFor = schedule.next_run_at;
    if (!scheduledFor) continue;
    const scheduledDate = new Date(scheduledFor);
    const isOneTime = schedule.kind.type === "once_at";

    if (now.getTime() - scheduledDate.getTime() > missedWindowMs) {
      await recordEvent(repository, schedule, "missed", scheduledFor, now, {
        reason: "missed_window",
      });
      await updateAfterOccurrence(repository, schedule, scheduledDate, now, {
        status: "missed",
        reason: "missed_window",
      });
      continue;
    }

    const conflictReason = await getRunConflict(schedule.workflow_id);
    if (conflictReason) {
      await recordEvent(repository, schedule, "skipped", scheduledFor, now, {
        reason: conflictReason,
      });
      if (isOneTime) {
        await disableOneTime(repository, schedule, scheduledFor, now);
      } else {
        await updateAfterOccurrence(repository, schedule, scheduledDate, now, {
          status: "skipped",
          reason: conflictReason,
        });
      }
      continue;
    }

    const validationIssues = await validateWorkflow(schedule.workflow_id);
    const firstError = validationIssues.find((issue) => issue.level === "error");
    if (firstError) {
      await recordEvent(repository, schedule, "failed_to_start", scheduledFor, now, {
        reason: "validation_failed",
        detailsJson: JSON.stringify({ issues: validationIssues }),
      });
      if (isOneTime) {
        await disableOneTime(repository, schedule, scheduledFor, now);
      } else {
        await updateAfterOccurrence(repository, schedule, scheduledDate, now, {
          status: "failed_to_start",
          reason: "validation_failed",
        });
      }
      continue;
    }

    try {
      const result = await startWorkflow(schedule.workflow_id);
      await recordEvent(repository, schedule, "started", scheduledFor, now, {
        runId: result?.runId ?? null,
      });
      if (isOneTime) {
        await disableOneTime(repository, schedule, scheduledFor, now);
      } else {
        await updateAfterOccurrence(repository, schedule, scheduledDate, now, {
          status: "started",
          reason: null,
        });
      }
    } catch (error) {
      await recordEvent(repository, schedule, "failed_to_start", scheduledFor, now, {
        reason: "start_failed",
        detailsJson: JSON.stringify({
          message: error instanceof Error ? error.message : String(error),
        }),
      });
      if (isOneTime) {
        await disableOneTime(repository, schedule, scheduledFor, now);
      } else {
        await updateAfterOccurrence(repository, schedule, scheduledDate, now, {
          status: "failed_to_start",
          reason: "start_failed",
        });
      }
    }
  }
}

async function updateAfterOccurrence(
  repository: ScheduleRepositoryPort,
  schedule: WorkflowSchedule,
  scheduledDate: Date,
  now: Date,
  update: { status: WorkflowScheduleStatus; reason: string | null },
) {
  await repository.updateScheduleRuntime(schedule.id, {
    next_run_at: calculateNextRunAt(schedule.kind, scheduledDate),
    last_event_at: now.toISOString(),
    last_status: update.status,
    last_reason: update.reason,
  });
}

async function disableOneTime(
  repository: ScheduleRepositoryPort,
  schedule: WorkflowSchedule,
  scheduledFor: string,
  now: Date,
) {
  await recordEvent(repository, schedule, "disabled", scheduledFor, now, {
    reason: "one_time_elapsed",
  });
  await repository.updateScheduleRuntime(schedule.id, {
    enabled: false,
    next_run_at: null,
    last_event_at: now.toISOString(),
    last_status: "disabled",
    last_reason: "one_time_elapsed",
  });
}

async function recordEvent(
  repository: ScheduleRepositoryPort,
  schedule: WorkflowSchedule,
  eventType: WorkflowScheduleStatus,
  scheduledFor: string,
  now: Date,
  options: {
    reason?: string | null;
    runId?: string | null;
    detailsJson?: string | null;
  } = {},
) {
  await repository.createEvent({
    schedule_id: schedule.id,
    workflow_id: schedule.workflow_id,
    event_type: eventType,
    run_id: options.runId ?? null,
    scheduled_for: scheduledFor,
    created_at: now.toISOString(),
    reason: options.reason ?? null,
    details_json: options.detailsJson ?? null,
  });
}

function localCandidate(from: Date, hour: number, minute: number) {
  return new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate(),
    hour,
    minute,
    0,
    0,
  );
}

function parseTime(value: string) {
  const match = value.match(timePattern);
  if (!match) return [0, 0] as const;
  return [Number(match[1]), Number(match[2])] as const;
}
