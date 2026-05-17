import type { DatabaseSync } from "node:sqlite";
import type {
  WorkflowSchedule,
  WorkflowScheduleEvent,
  WorkflowScheduleEventFilter,
  WorkflowScheduleInput,
  WorkflowScheduleKind,
  WorkflowScheduleStatus,
} from "../../src/types/workflow.js";

type ScheduleRow = {
  id: string;
  workflow_id: string;
  workflow_name: string;
  name: string;
  enabled: number;
  kind_json: string;
  next_run_at: string | null;
  last_event_at: string | null;
  last_status: WorkflowScheduleStatus | null;
  last_reason: string | null;
  created_at: string;
  updated_at: string;
};

type EventRow = {
  id: string;
  schedule_id: string;
  workflow_id: string;
  event_type: WorkflowScheduleStatus;
  run_id: string | null;
  scheduled_for: string;
  created_at: string;
  reason: string | null;
  details_json: string | null;
};

export class WorkflowScheduleRepository {
  constructor(private readonly database: DatabaseSync) {}

  listSchedules(): WorkflowSchedule[] {
    return this.database
      .prepare(
        `SELECT
          schedules.id,
          schedules.workflow_id,
          workflows.name AS workflow_name,
          schedules.name,
          schedules.enabled,
          schedules.kind_json,
          schedules.next_run_at,
          schedules.last_event_at,
          schedules.last_status,
          schedules.last_reason,
          schedules.created_at,
          schedules.updated_at
        FROM workflow_schedules schedules
        INNER JOIN workflows ON workflows.id = schedules.workflow_id
        ORDER BY schedules.enabled DESC, schedules.next_run_at IS NULL, schedules.next_run_at ASC, schedules.name ASC`,
      )
      .all()
      .map((row) => scheduleFromRow(row as ScheduleRow));
  }

  getSchedule(id: string): WorkflowSchedule | null {
    const row = this.database
      .prepare(
        `SELECT
          schedules.id,
          schedules.workflow_id,
          workflows.name AS workflow_name,
          schedules.name,
          schedules.enabled,
          schedules.kind_json,
          schedules.next_run_at,
          schedules.last_event_at,
          schedules.last_status,
          schedules.last_reason,
          schedules.created_at,
          schedules.updated_at
        FROM workflow_schedules schedules
        INNER JOIN workflows ON workflows.id = schedules.workflow_id
        WHERE schedules.id = ?`,
      )
      .get(id) as ScheduleRow | undefined;
    return row ? scheduleFromRow(row) : null;
  }

  createSchedule(
    input: WorkflowScheduleInput & { next_run_at?: string | null },
    now = new Date(),
  ): WorkflowSchedule {
    const timestamp = now.toISOString();
    const id = crypto.randomUUID();
    this.database
      .prepare(
        `INSERT INTO workflow_schedules (
          id,
          workflow_id,
          name,
          enabled,
          kind_json,
          next_run_at,
          last_event_at,
          last_status,
          last_reason,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)`,
      )
      .run(
        id,
        input.workflow_id,
        input.name.trim(),
        input.enabled ? 1 : 0,
        JSON.stringify(input.kind),
        input.next_run_at ?? null,
        timestamp,
        timestamp,
      );
    const created = this.getSchedule(id);
    if (!created) {
      throw new Error("Failed to create schedule");
    }
    return created;
  }

  updateSchedule(
    id: string,
    input: WorkflowScheduleInput & { next_run_at?: string | null },
    now = new Date(),
  ): WorkflowSchedule {
    this.database
      .prepare(
        `UPDATE workflow_schedules
         SET workflow_id = ?,
             name = ?,
             enabled = ?,
             kind_json = ?,
             next_run_at = ?,
             updated_at = ?
         WHERE id = ?`,
      )
      .run(
        input.workflow_id,
        input.name.trim(),
        input.enabled ? 1 : 0,
        JSON.stringify(input.kind),
        input.next_run_at ?? null,
        now.toISOString(),
        id,
      );
    const updated = this.getSchedule(id);
    if (!updated) {
      throw new Error("Schedule not found");
    }
    return updated;
  }

  deleteSchedule(id: string) {
    this.database.prepare("DELETE FROM workflow_schedules WHERE id = ?").run(id);
  }

  listDueSchedules(now: Date): WorkflowSchedule[] {
    return this.database
      .prepare(
        `SELECT
          schedules.id,
          schedules.workflow_id,
          workflows.name AS workflow_name,
          schedules.name,
          schedules.enabled,
          schedules.kind_json,
          schedules.next_run_at,
          schedules.last_event_at,
          schedules.last_status,
          schedules.last_reason,
          schedules.created_at,
          schedules.updated_at
        FROM workflow_schedules schedules
        INNER JOIN workflows ON workflows.id = schedules.workflow_id
        WHERE schedules.enabled = 1
          AND schedules.next_run_at IS NOT NULL
          AND schedules.next_run_at <= ?
        ORDER BY schedules.next_run_at ASC, schedules.created_at ASC`,
      )
      .all(now.toISOString())
      .map((row) => scheduleFromRow(row as ScheduleRow));
  }

  updateScheduleRuntime(
    id: string,
    update: {
      enabled?: boolean;
      next_run_at?: string | null;
      last_status?: string | null;
      last_reason?: string | null;
      last_event_at?: string | null;
    },
    now = new Date(),
  ) {
    const current = this.getSchedule(id);
    if (!current) return;
    this.database
      .prepare(
        `UPDATE workflow_schedules
         SET enabled = ?,
             next_run_at = ?,
             last_event_at = ?,
             last_status = ?,
             last_reason = ?,
             updated_at = ?
         WHERE id = ?`,
      )
      .run(
        (update.enabled ?? current.enabled) ? 1 : 0,
        update.next_run_at !== undefined ? update.next_run_at : current.next_run_at,
        update.last_event_at !== undefined ? update.last_event_at : current.last_event_at,
        update.last_status !== undefined ? update.last_status : current.last_status,
        update.last_reason !== undefined ? update.last_reason : current.last_reason,
        now.toISOString(),
        id,
      );
  }

  createEvent(event: Omit<WorkflowScheduleEvent, "id">): WorkflowScheduleEvent {
    const id = crypto.randomUUID();
    this.database
      .prepare(
        `INSERT INTO workflow_schedule_events (
          id,
          schedule_id,
          workflow_id,
          event_type,
          run_id,
          scheduled_for,
          created_at,
          reason,
          details_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        event.schedule_id,
        event.workflow_id,
        event.event_type,
        event.run_id,
        event.scheduled_for,
        event.created_at,
        event.reason,
        event.details_json,
      );
    return { id, ...event };
  }

  listEvents(filter: WorkflowScheduleEventFilter = {}): WorkflowScheduleEvent[] {
    const conditions: string[] = [];
    const params: Array<string | number | null> = [];
    if (filter.schedule_id) {
      conditions.push("schedule_id = ?");
      params.push(filter.schedule_id);
    }
    if (filter.workflow_id) {
      conditions.push("workflow_id = ?");
      params.push(filter.workflow_id);
    }
    const limit = Math.max(1, Math.min(filter.limit ?? 50, 200));
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    return this.database
      .prepare(
        `SELECT id, schedule_id, workflow_id, event_type, run_id, scheduled_for, created_at, reason, details_json
         FROM workflow_schedule_events
         ${where}
         ORDER BY created_at DESC, rowid DESC
         LIMIT ?`,
      )
      .all(...params, limit)
      .map((row) => eventFromRow(row as EventRow));
  }
}

function scheduleFromRow(row: ScheduleRow): WorkflowSchedule {
  return {
    id: row.id,
    workflow_id: row.workflow_id,
    workflow_name: row.workflow_name,
    name: row.name,
    enabled: Boolean(row.enabled),
    kind: JSON.parse(row.kind_json) as WorkflowScheduleKind,
    next_run_at: row.next_run_at,
    last_event_at: row.last_event_at,
    last_status: row.last_status,
    last_reason: row.last_reason,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function eventFromRow(row: EventRow): WorkflowScheduleEvent {
  return {
    id: row.id,
    schedule_id: row.schedule_id,
    workflow_id: row.workflow_id,
    event_type: row.event_type,
    run_id: row.run_id,
    scheduled_for: row.scheduled_for,
    created_at: row.created_at,
    reason: row.reason,
    details_json: row.details_json,
  };
}
