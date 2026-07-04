import { createHash, randomUUID } from "node:crypto";
import type { DbAdapter } from "../persistence/dbAdapter.js";
import type {
  OperationsOverview,
  OperationsOverviewRequest,
  OverviewActivityBucket,
  OverviewAttentionItem,
  OverviewEvidenceItem,
  OverviewLiveRun,
  OverviewUpcomingSchedule,
  RunStatus,
  RunValidationIssue,
  WorkflowRunSnapshot,
  WorkflowScheduleStatus,
  WorkflowSummary,
} from "../../../src/types/workflow.js";

type RunRow = {
  id: string;
  workflow_id: string;
  workflow_name: string;
  status: RunStatus;
  started_at: string;
  finished_at: string | null;
  settings_snapshot_json: string | null;
  outputs_json: string | null;
  error_json: string | null;
};

type AttentionEventRow = {
  id: string;
  event_type: string;
  source: string;
  workflow_id: string;
  workflow_name: string;
  created_at: string;
  severity: "warning" | "failure";
  summary: string;
  details_json: string | null;
};

type ScheduleEventRow = {
  id: string;
  schedule_id: string;
  workflow_id: string;
  workflow_name: string;
  event_type: WorkflowScheduleStatus;
  run_id: string | null;
  scheduled_for: string;
  created_at: string;
  reason: string | null;
};

type ScheduleRow = {
  id: string;
  workflow_id: string;
  workflow_name: string;
  name: string;
  next_run_at: string | null;
  last_status: WorkflowScheduleStatus | null;
  last_reason: string | null;
};

const defaultLimits = {
  live_runs: 8,
  attention: 12,
  recent_evidence: 12,
  upcoming_schedules: 8,
};
const maxDashboardLimit = 50;
const maxOverviewRangeMs = 48 * 60 * 60 * 1000;

export class OperationsRepository {
  constructor(private readonly database: DbAdapter) {}

  async recordLaunchBlocked(input: {
    workflow: WorkflowSummary;
    issues: RunValidationIssue[];
    now?: Date;
  }): Promise<void> {
    const firstError = input.issues.find((issue) => issue.level === "error");
    if (!firstError) return;
    await this.database.execute(
      `INSERT INTO operational_attention_events (
        id, event_type, source, workflow_id, created_at, severity, summary, details_json, owner_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        randomUUID(),
        "launch_blocked",
        "manual",
        input.workflow.id,
        (input.now ?? new Date()).toISOString(),
        "failure",
        sanitizeSummary(firstError.message),
        JSON.stringify({
          issues: input.issues.slice(0, 20).map((issue) => ({
            source: issue.source,
            field: issue.field ?? null,
            node_id: issue.node_id ?? null,
            edge_id: issue.edge_id ?? null,
            level: issue.level,
            message: sanitizeSummary(issue.message),
          })),
        }),
        this.database.ownerId,
      ],
    );
  }

  async getOverview(
    request: OperationsOverviewRequest,
    liveSnapshots: WorkflowRunSnapshot[],
  ): Promise<OperationsOverview> {
    const range = validateRange(request);
    const limits = dashboardLimits(request);
    const activeSnapshots = liveSnapshots.filter((snapshot) => snapshot.state.status === "running");
    
    // Asynchronously call all helpers
    const liveRunsPromises = Promise.all(activeSnapshots.map(async (snapshot) => await this.liveRunFromSnapshot(snapshot)));
    const runFailuresPromise = this.failedRunAttention(range.day_start_utc, range.day_end_utc);
    const launchBlocksPromise = this.launchBlockedAttention(range.day_start_utc, range.day_end_utc);
    const scheduleAttentionPromise = this.scheduleAttention(range.day_start_utc, range.day_end_utc);
    const upcomingSchedulesPromise = this.upcomingSchedules();
    const succeededRunCountPromise = this.succeededRunCount(range.day_start_utc, range.day_end_utc);
    const succeededRunTimesPromise = this.succeededRunTimes(range.day_start_utc, range.day_end_utc);
    
    const [
      liveRuns,
      runFailures,
      launchBlocks,
      scheduleAttention,
      upcomingSchedules,
      succeededToday,
      succeededTimes,
    ] = await Promise.all([
      liveRunsPromises,
      runFailuresPromise,
      launchBlocksPromise,
      scheduleAttentionPromise,
      upcomingSchedulesPromise,
      succeededRunCountPromise,
      succeededRunTimesPromise,
    ]);

    const allAttention = [...runFailures, ...launchBlocks, ...scheduleAttention]
      .filter((item) => attentionMatchesFilter(item, request))
      .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at));
    const unfilteredAttentionCount = runFailures.length + launchBlocks.length + scheduleAttention.length;
    
    evidenceSkippedCount = 0;
    const evidence = await this.recentEvidence(limits.recent_evidence);
    const activity = this.activityBuckets(range.day_start_utc, range.day_end_utc, {
      succeededRuns: succeededTimes,
      failedRuns: runFailures.map((item) => item.occurred_at),
      blocked: launchBlocks.map((item) => item.occurred_at),
      scheduleAttention: scheduleAttention.map((item) => item.occurred_at),
    });

    return {
      generated_at: new Date().toISOString(),
      range,
      metrics: {
        active_runs: activeSnapshots.length,
        succeeded_today: succeededToday,
        attention_today: unfilteredAttentionCount,
        upcoming_schedules: upcomingSchedules.length,
      },
      live_runs: bounded(liveRuns, limits.live_runs),
      attention: bounded(allAttention, limits.attention),
      activity,
      recent_evidence: evidence,
      upcoming_schedules: bounded(upcomingSchedules, limits.upcoming_schedules),
      data_warnings: { evidence_items_skipped: evidenceSkippedCount },
    };
  }

  private async liveRunFromSnapshot(snapshot: WorkflowRunSnapshot): Promise<OverviewLiveRun> {
    const identityName = await this.identityDisplayName(snapshot.run_id, snapshot.workflow_id);
    return {
      run_id: snapshot.run_id,
      workflow_id: snapshot.workflow_id,
      workflow_name: snapshot.workflow_name,
      source: snapshot.source,
      status: snapshot.state.status,
      current_step_id: snapshot.state.current_step_id,
      current_step_number: snapshot.state.current_step_number,
      started_at: snapshot.started_at,
      identity_display_name: identityName,
      navigation_target: { type: "workflow", workflow_id: snapshot.workflow_id },
    };
  }

  private async identityDisplayName(runId: string, workflowId: string): Promise<string | null> {
    const row = await this.database.queryOne(
      `SELECT
        runs.settings_snapshot_json,
        workflows.settings_json
       FROM workflows
       LEFT JOIN runs ON runs.id = $1 AND runs.owner_id = $2
       WHERE workflows.id = $3 AND workflows.owner_id = $2`,
      [runId, this.database.ownerId, workflowId],
    ) as
      | { settings_snapshot_json?: string | null; settings_json?: string | null }
      | null;
    const settings = parseJsonRecord(row?.settings_snapshot_json) ?? parseJsonRecord(row?.settings_json);
    const browserLaunch = parseJsonRecord(settings?.browser_launch);
    return stringValue(browserLaunch?.display_name) ?? stringValue(browserLaunch?.identity_id);
  }

  private async succeededRunCount(start: string, end: string): Promise<number> {
    const row = await this.database.queryOne(
      `SELECT COUNT(*) AS count
       FROM runs
       WHERE status = 'success'
         AND finished_at >= $1
         AND finished_at < $2
         AND owner_id = $3`,
      [start, end, this.database.ownerId],
    ) as { count: number | string } | null;
    return row ? Number(row.count) : 0;
  }

  private async succeededRunTimes(start: string, end: string): Promise<string[]> {
    const rows = await this.database.query(
      `SELECT finished_at
       FROM runs
       WHERE status = 'success'
         AND finished_at >= $1
         AND finished_at < $2
         AND owner_id = $3`,
      [start, end, this.database.ownerId],
    ) as Array<{ finished_at: string }>;
    return rows.map((row) => row.finished_at);
  }

  private async failedRunAttention(start: string, end: string): Promise<OverviewAttentionItem[]> {
    const rows = await this.database.query(
      `SELECT
        runs.id,
        runs.workflow_id,
        workflows.name AS workflow_name,
        runs.status,
        runs.started_at,
        runs.finished_at,
        runs.settings_snapshot_json,
        runs.outputs_json,
        runs.error_json
       FROM runs
       INNER JOIN workflows ON workflows.id = runs.workflow_id
       WHERE runs.status = 'failed'
         AND COALESCE(runs.finished_at, runs.started_at) >= $1
         AND COALESCE(runs.finished_at, runs.started_at) < $2
         AND runs.owner_id = $3
       ORDER BY COALESCE(runs.finished_at, runs.started_at) DESC`,
      [start, end, this.database.ownerId],
    ) as RunRow[];
    return rows.map((row) => ({
      id: `run:${row.id}`,
      source_kind: "run_failed",
      severity: "failure",
      occurred_at: row.finished_at ?? row.started_at,
      title: "Run failed",
      summary: errorSummary(row.error_json) ?? "Workflow run failed",
      workflow: { id: row.workflow_id, name: row.workflow_name },
      run_id: row.id,
      navigation_target: { type: "workflow", workflow_id: row.workflow_id },
    }));
  }

  private async launchBlockedAttention(start: string, end: string): Promise<OverviewAttentionItem[]> {
    const rows = await this.database.query(
      `SELECT
        events.id,
        events.event_type,
        events.source,
        events.workflow_id,
        workflows.name AS workflow_name,
        events.created_at,
        events.severity,
        events.summary,
        events.details_json
       FROM operational_attention_events events
       INNER JOIN workflows ON workflows.id = events.workflow_id
       WHERE events.created_at >= $1
         AND events.created_at < $2
         AND events.owner_id = $3
       ORDER BY events.created_at DESC`,
      [start, end, this.database.ownerId],
    ) as AttentionEventRow[];
    return rows.map((row) => ({
      id: row.id,
      source_kind: "launch_blocked",
      severity: row.severity,
      occurred_at: row.created_at,
      title: "Launch blocked",
      summary: row.summary,
      workflow: { id: row.workflow_id, name: row.workflow_name },
      navigation_target: { type: "workflow", workflow_id: row.workflow_id },
    }));
  }

  private async scheduleAttention(start: string, end: string): Promise<OverviewAttentionItem[]> {
    const rows = await this.database.query(
      `SELECT
        events.id,
        events.schedule_id,
        events.workflow_id,
        workflows.name AS workflow_name,
        events.event_type,
        events.run_id,
        events.scheduled_for,
        events.created_at,
        events.reason
       FROM workflow_schedule_events events
       INNER JOIN workflows ON workflows.id = events.workflow_id
       WHERE events.event_type IN ('failed_to_start', 'skipped')
         AND events.created_at >= $1
         AND events.created_at < $2
         AND events.owner_id = $3
       ORDER BY events.created_at DESC`,
      [start, end, this.database.ownerId],
    ) as ScheduleEventRow[];
    return rows.map((row) => ({
      id: `schedule:${row.id}`,
      source_kind: "schedule_event",
      severity: row.event_type === "failed_to_start" ? "failure" : "warning",
      occurred_at: row.created_at,
      title: row.event_type === "failed_to_start" ? "Schedule failed to start" : "Schedule skipped",
      summary: sanitizeSummary(row.reason ?? row.event_type),
      workflow: { id: row.workflow_id, name: row.workflow_name },
      run_id: row.run_id,
      schedule_id: row.schedule_id,
      schedule_event_type: row.event_type,
      navigation_target: { type: "schedule", schedule_id: row.schedule_id },
    }));
  }

  private async upcomingSchedules(): Promise<OverviewUpcomingSchedule[]> {
    const rows = await this.database.query(
      `SELECT
        schedules.id,
        schedules.workflow_id,
        workflows.name AS workflow_name,
        schedules.name,
        schedules.next_run_at,
        schedules.last_status,
        schedules.last_reason
       FROM workflow_schedules schedules
       INNER JOIN workflows ON workflows.id = schedules.workflow_id
       WHERE schedules.enabled = 1
         AND schedules.next_run_at IS NOT NULL
         AND schedules.owner_id = $1
       ORDER BY schedules.next_run_at ASC, schedules.name ASC
       LIMIT 51`,
      [this.database.ownerId],
    ) as ScheduleRow[];
    return rows.map((row) => ({
      schedule_id: row.id,
      workflow_id: row.workflow_id,
      workflow_name: row.workflow_name,
      schedule_name: row.name,
      next_run_at: row.next_run_at ?? "",
      last_status: row.last_status,
      last_reason: row.last_reason,
      navigation_target: { type: "schedule", schedule_id: row.id },
    }));
  }

  private async recentEvidence(limit: number): Promise<{ items: OverviewEvidenceItem[]; total: number; has_more: boolean }> {
    const rows = await this.database.query(
      `SELECT
        runs.id,
        runs.workflow_id,
        workflows.name AS workflow_name,
        runs.status,
        runs.started_at,
        runs.finished_at,
        runs.settings_snapshot_json,
        runs.outputs_json,
        runs.error_json
       FROM runs
       INNER JOIN workflows ON workflows.id = runs.workflow_id
       WHERE runs.outputs_json IS NOT NULL
         AND runs.outputs_json LIKE '%"__evidence"%'
         AND runs.owner_id = $1
       ORDER BY COALESCE(runs.finished_at, runs.started_at) DESC`,
      [this.database.ownerId],
    ) as RunRow[];
    const items = rows.flatMap((row) => evidenceItemsFromRun(row, limit + 1).items);
    items.sort((left, right) => (right.created_at ?? "").localeCompare(left.created_at ?? ""));
    return bounded(items, limit);
  }

  private activityBuckets(
    start: string,
    end: string,
    events: {
      succeededRuns: string[];
      failedRuns: string[];
      blocked: string[];
      scheduleAttention: string[];
    },
  ): OverviewActivityBucket[] {
    const startTime = Date.parse(start);
    const endTime = Date.parse(end);
    const buckets: OverviewActivityBucket[] = [];
    for (let cursor = startTime; cursor < endTime; cursor += 60 * 60 * 1000) {
      buckets.push({
        bucket_start_utc: new Date(cursor).toISOString(),
        bucket_end_utc: new Date(Math.min(cursor + 60 * 60 * 1000, endTime)).toISOString(),
        succeeded: 0,
        failed: 0,
        blocked: 0,
        schedule_attention: 0,
      });
    }
    const increment = (value: string, key: "succeeded" | "failed" | "blocked" | "schedule_attention") => {
      const time = Date.parse(value);
      const index = Math.floor((time - startTime) / (60 * 60 * 1000));
      if (index >= 0 && index < buckets.length) {
        buckets[index][key] += 1;
      }
    };
    events.succeededRuns.forEach((value) => increment(value, "succeeded"));
    events.failedRuns.forEach((value) => increment(value, "failed"));
    events.blocked.forEach((value) => increment(value, "blocked"));
    events.scheduleAttention.forEach((value) => increment(value, "schedule_attention"));
    return buckets;
  }
}

let evidenceSkippedCount = 0;

function evidenceItemsFromRun(row: RunRow, limit: number) {
  const outputs = parseJsonRecord(row.outputs_json);
  const evidence = outputs?.__evidence;
  if (!Array.isArray(evidence)) return { items: [] as OverviewEvidenceItem[], total: 0 };
  const items: OverviewEvidenceItem[] = [];
  for (const item of evidence) {
    const record = parseJsonRecord(item);
    const path = stringValue(record?.path) ?? stringValue(record?.relative_path) ?? stringValue(record?.label);
    const artifactKind = stringValue(record?.artifact_kind) ?? stringValue(record?.kind);
    if (!path || !artifactKind || !safeRelativeEvidenceReference(path)) {
      evidenceSkippedCount += 1;
      continue;
    }
    items.push({
      evidence_id: evidenceId(row.id, artifactKind, path),
      artifact_kind: artifactKind,
      relative_path_or_label: path,
      created_at: stringValue(record?.created_at) ?? row.finished_at ?? row.started_at,
      run_id: row.id,
      workflow: { id: row.workflow_id, name: row.workflow_name },
      node_id: stringValue(record?.node_id),
      navigation_targets: {
        workflow: { type: "workflow", workflow_id: row.workflow_id },
      },
    });
    if (items.length >= limit) break;
  }
  return { items, total: evidence.length };
}

function validateRange(request: OperationsOverviewRequest) {
  const start = Date.parse(request.day_start_utc);
  const end = Date.parse(request.day_end_utc);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw { message: "Invalid operations overview range", field: "day_start_utc" };
  }
  if (end - start > maxOverviewRangeMs) {
    throw { message: "Operations overview range cannot exceed 48 hours", field: "day_end_utc" };
  }
  return {
    day_start_utc: new Date(start).toISOString(),
    day_end_utc: new Date(end).toISOString(),
    timezone_label: request.timezone_label?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone || "Local",
  };
}

function dashboardLimits(request: OperationsOverviewRequest) {
  return {
    live_runs: limitValue(request.limits?.live_runs, defaultLimits.live_runs),
    attention: limitValue(request.limits?.attention, defaultLimits.attention),
    recent_evidence: limitValue(request.limits?.recent_evidence, defaultLimits.recent_evidence),
    upcoming_schedules: limitValue(request.limits?.upcoming_schedules, defaultLimits.upcoming_schedules),
  };
}

function limitValue(value: number | null | undefined, fallback: number) {
  if (!Number.isFinite(value ?? NaN)) return fallback;
  return Math.max(1, Math.min(Math.floor(value as number), maxDashboardLimit));
}

function bounded<T>(items: T[], limit: number) {
  return {
    items: items.slice(0, limit),
    total: items.length,
    has_more: items.length > limit,
  };
}

function attentionMatchesFilter(item: OverviewAttentionItem, request: OperationsOverviewRequest) {
  const sourceFilter = request.attention_filter?.source_kind;
  const severityFilter = request.attention_filter?.severity;
  if (sourceFilter?.length && !sourceFilter.includes(item.source_kind)) return false;
  if (severityFilter?.length && !severityFilter.includes(item.severity)) return false;
  return true;
}

function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function safeRelativeEvidenceReference(value: string) {
  if (
    value.startsWith("/") ||
    value.startsWith("\\") ||
    /^[A-Za-z]:/.test(value)
  ) {
    return false;
  }
  return !value.split(/[\\/]+/).includes("..");
}

function sanitizeSummary(value: string) {
  const firstLine = value.split("\n")[0] ?? value;
  return firstLine.length > 240 ? `${firstLine.slice(0, 237)}...` : firstLine;
}

function errorSummary(errorJson: string | null) {
  const error = parseJsonRecord(errorJson);
  return stringValue(error?.reason) ?? stringValue(error?.message) ?? null;
}

function evidenceId(runId: string, kind: string, path: string) {
  return createHash("sha256").update(`${runId}\0${kind}\0${path}`).digest("hex").slice(0, 24);
}
