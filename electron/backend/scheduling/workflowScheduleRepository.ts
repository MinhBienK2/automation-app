import type { DbAdapter } from "../persistence/dbAdapter.js";
import type {
  WorkflowSchedule,
  WorkflowScheduleEvent,
  WorkflowScheduleEventFilter,
  WorkflowScheduleInput,
  WorkflowScheduleKind,
  WorkflowScheduleStatus,
} from "../../../src/types/workflow.js";

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
  constructor(private readonly database: DbAdapter) {
    if (!this.database.ownerId) {
      throw new Error("WorkflowScheduleRepository requires a DbAdapter with a valid ownerId");
    }
  }

  async listSchedules(): Promise<WorkflowSchedule[]> {
    const rows = await this.database.query(
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
      WHERE schedules.owner_id = $1
      ORDER BY schedules.enabled DESC, schedules.next_run_at IS NULL, schedules.next_run_at ASC, schedules.name ASC`,
      [this.database.ownerId],
    );
    return rows.map((row) => scheduleFromRow(row as ScheduleRow));
  }

  async getSchedule(id: string): Promise<WorkflowSchedule | null> {
    const row = await this.database.queryOne(
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
      WHERE schedules.id = $1 AND schedules.owner_id = $2`,
      [id, this.database.ownerId],
    ) as ScheduleRow | null;
    return row ? scheduleFromRow(row) : null;
  }

  async createSchedule(
    input: WorkflowScheduleInput & { next_run_at?: string | null },
    now = new Date(),
  ): Promise<WorkflowSchedule> {
    const timestamp = now.toISOString();
    const id = crypto.randomUUID();
    await this.database.execute(
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
        updated_at,
        owner_id
      ) VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL, NULL, $7, $8, $9)`,
      [
        id,
        input.workflow_id,
        input.name.trim(),
        input.enabled ? 1 : 0,
        JSON.stringify(input.kind),
        input.next_run_at ?? null,
        timestamp,
        timestamp,
        this.database.ownerId,
      ],
    );
    const created = await this.getSchedule(id);
    if (!created) {
      throw new Error("Failed to create schedule");
    }
    return created;
  }

  async updateSchedule(
    id: string,
    input: WorkflowScheduleInput & { next_run_at?: string | null },
    now = new Date(),
  ): Promise<WorkflowSchedule> {
    await this.database.execute(
      `UPDATE workflow_schedules
       SET workflow_id = $1,
           name = $2,
           enabled = $3,
           kind_json = $4,
           next_run_at = $5,
           updated_at = $6
       WHERE id = $7 AND owner_id = $8`,
      [
        input.workflow_id,
        input.name.trim(),
        input.enabled ? 1 : 0,
        JSON.stringify(input.kind),
        input.next_run_at ?? null,
        now.toISOString(),
        id,
        this.database.ownerId,
      ],
    );
    const updated = await this.getSchedule(id);
    if (!updated) {
      throw new Error("Schedule not found");
    }
    return updated;
  }

  async deleteSchedule(id: string): Promise<void> {
    await this.database.execute(
      "DELETE FROM workflow_schedules WHERE id = $1 AND owner_id = $2",
      [id, this.database.ownerId],
    );
  }

  async listDueSchedules(now: Date): Promise<WorkflowSchedule[]> {
    const rows = await this.database.query(
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
        AND schedules.next_run_at <= $1
        AND schedules.owner_id = $2
      ORDER BY schedules.next_run_at ASC, schedules.created_at ASC`,
      [now.toISOString(), this.database.ownerId],
    );
    return rows.map((row) => scheduleFromRow(row as ScheduleRow));
  }

  async updateScheduleRuntime(
    id: string,
    update: {
      enabled?: boolean;
      next_run_at?: string | null;
      last_status?: string | null;
      last_reason?: string | null;
      last_event_at?: string | null;
    },
    now = new Date(),
  ): Promise<void> {
    const current = await this.getSchedule(id);
    if (!current) return;
    await this.database.execute(
      `UPDATE workflow_schedules
       SET enabled = $1,
           next_run_at = $2,
           last_event_at = $3,
           last_status = $4,
           last_reason = $5,
           updated_at = $6
       WHERE id = $7 AND owner_id = $8`,
      [
        (update.enabled ?? current.enabled) ? 1 : 0,
        update.next_run_at !== undefined ? update.next_run_at : current.next_run_at,
        update.last_event_at !== undefined ? update.last_event_at : current.last_event_at,
        update.last_status !== undefined ? update.last_status : current.last_status,
        update.last_reason !== undefined ? update.last_reason : current.last_reason,
        now.toISOString(),
        id,
        this.database.ownerId,
      ],
    );
  }

  async createEvent(event: Omit<WorkflowScheduleEvent, "id">): Promise<WorkflowScheduleEvent> {
    const id = crypto.randomUUID();
    await this.database.execute(
      `INSERT INTO workflow_schedule_events (
        id,
        schedule_id,
        workflow_id,
        event_type,
        run_id,
        scheduled_for,
        created_at,
        reason,
        details_json,
        owner_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        event.schedule_id,
        event.workflow_id,
        event.event_type,
        event.run_id,
        event.scheduled_for,
        event.created_at,
        event.reason,
        event.details_json,
        this.database.ownerId,
      ],
    );
    return { id, ...event };
  }

  async listEvents(filter: WorkflowScheduleEventFilter = {}): Promise<WorkflowScheduleEvent[]> {
    const conditions: string[] = ["schedules.owner_id = $1"];
    const params: Array<string | number | null> = [this.database.ownerId!];
    let paramIdx = 2;
    if (filter.schedule_id) {
      conditions.push(`events.schedule_id = $${paramIdx}`);
      params.push(filter.schedule_id);
      paramIdx++;
    }
    if (filter.workflow_id) {
      conditions.push(`events.workflow_id = $${paramIdx}`);
      params.push(filter.workflow_id);
      paramIdx++;
    }
    const limit = Math.max(1, Math.min(filter.limit ?? 50, 200));

    const rows = await this.database.query(
      `SELECT events.id, events.schedule_id, events.workflow_id, events.event_type, events.run_id, events.scheduled_for, events.created_at, events.reason, events.details_json
       FROM workflow_schedule_events events
       INNER JOIN workflow_schedules schedules ON schedules.id = events.schedule_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY events.created_at DESC, events.id DESC
       LIMIT $${paramIdx}`,
      [...params, limit],
    );
    return rows.map((row) => eventFromRow(row as EventRow));
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
