import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { createDraftGraph, type ElectronWorkflowGraph } from "./graph.js";
import type { ArtifactRecordInput } from "../shared/product.js";

export type StorageServiceOptions = {
  appDataDir: string;
};

export type WorkflowRecord = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  notes: string;
  defaultRunProfileId: string | null;
  defaultIdentityProfileId: string | null;
  defaultEnvironmentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GraphVersionRecord = {
  id: string;
  workflowId: string;
  schemaVersion: number;
  graph: ElectronWorkflowGraph;
  createdAt: string;
  createdBy: string;
  active: boolean;
};

export type RunRecord = {
  id: string;
  workflowId: string;
  graphVersionId: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  terminalReason: string | null;
  operatorLabel: string;
};

export type WorkspacePolicy = {
  allowedOrigins: string[];
  maxConcurrency: number;
};

export type RunEventRecord = {
  id: string;
  runId: string;
  sequence: number;
  type: string;
  severity: string;
  nodeId: string | null;
  actionId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type ArtifactRecord = ArtifactRecordInput & {
  id: string;
  createdAt: string;
};

export type IdentityProfileRecord = {
  id: string;
  name: string;
  description: string;
  browserEngine: "cloakbrowser";
  persistentProfilePath: string | null;
  deviceIdentity: Record<string, unknown>;
  locale: Record<string, unknown>;
  proxyReference: Record<string, unknown>;
  headedPolicy: string;
  preflightPolicy: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type IdentityProfileInput = {
  name: string;
  description?: string;
  browserEngine?: "cloakbrowser";
  persistentProfilePath?: string | null;
  deviceIdentity?: Record<string, unknown>;
  locale?: Record<string, unknown>;
  proxyReference?: Record<string, unknown>;
  headedPolicy?: string;
  preflightPolicy?: Record<string, unknown>;
};

export type IdentityProfileValidationIssue = {
  code: string;
  field: string;
  message: string;
  level: "error" | "warning";
};

export type EvidenceRecordInput = {
  runId: string;
  evidenceType: string;
  payload: Record<string, unknown>;
  sanitizedPayload?: Record<string, unknown> | null;
  exportable?: boolean;
};

export type EvidenceRecord = {
  id: string;
  runId: string;
  evidenceType: string;
  payload: Record<string, unknown>;
  sanitizedPayload: Record<string, unknown> | null;
  exportable: boolean;
  createdAt: string;
};

export type RunEvidenceExport = {
  runId: string;
  events: RunEventRecord[];
  artifacts: ArtifactRecord[];
  evidence: Array<{
    id: string;
    evidenceType: string;
    payload: Record<string, unknown>;
    createdAt: string;
  }>;
};

export type StorageService = ReturnType<typeof createStorageService>;

type Row = Record<string, unknown>;

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function workflowFromRow(row: Row): WorkflowRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description ?? ""),
    tags: parseJson<string[]>(row.tags_json, []),
    notes: String(row.notes ?? ""),
    defaultRunProfileId: row.default_run_profile_id ? String(row.default_run_profile_id) : null,
    defaultIdentityProfileId: row.default_identity_profile_id
      ? String(row.default_identity_profile_id)
      : null,
    defaultEnvironmentId: row.default_environment_id ? String(row.default_environment_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function graphVersionFromRow(row: Row): GraphVersionRecord {
  return {
    id: String(row.id),
    workflowId: String(row.workflow_id),
    schemaVersion: Number(row.schema_version),
    graph: parseJson<ElectronWorkflowGraph>(row.graph_json, createDraftGraph("invalid")),
    createdAt: String(row.created_at),
    createdBy: String(row.created_by),
    active: Number(row.active) === 1,
  };
}

function runEventFromRow(row: Row): RunEventRecord {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    sequence: Number(row.sequence),
    type: String(row.event_type),
    severity: String(row.severity),
    nodeId: row.node_id ? String(row.node_id) : null,
    actionId: row.action_id ? String(row.action_id) : null,
    payload: parseJson<Record<string, unknown>>(row.payload_json, {}),
    createdAt: String(row.created_at),
  };
}

function artifactFromRow(row: Row): ArtifactRecord {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    eventId: row.event_id ? String(row.event_id) : null,
    type: String(row.artifact_type),
    relativePath: String(row.relative_path),
    mimeType: String(row.mime_type),
    sizeBytes: Number(row.size_bytes),
    checksum: String(row.checksum),
    sanitized: Number(row.sanitized) === 1,
    createdAt: String(row.created_at),
  };
}

function runFromRow(row: Row): RunRecord {
  return {
    id: String(row.id),
    workflowId: String(row.workflow_id),
    graphVersionId: String(row.graph_version_id),
    status: String(row.status),
    startedAt: String(row.started_at),
    endedAt: row.ended_at ? String(row.ended_at) : null,
    terminalReason: row.terminal_reason ? String(row.terminal_reason) : null,
    operatorLabel: String(row.operator_label),
  };
}

function normalizeWorkspacePolicy(value: unknown): WorkspacePolicy {
  const policy = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    allowedOrigins: Array.isArray(policy.allowedOrigins) ? policy.allowedOrigins.map(String) : [],
    maxConcurrency:
      typeof policy.maxConcurrency === "number" && policy.maxConcurrency > 0
        ? Math.floor(policy.maxConcurrency)
        : 1,
  };
}

function identityProfileFromRow(row: Row): IdentityProfileRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description ?? ""),
    browserEngine: "cloakbrowser",
    persistentProfilePath: row.persistent_profile_path ? String(row.persistent_profile_path) : null,
    deviceIdentity: parseJson<Record<string, unknown>>(row.device_identity_json, {}),
    locale: parseJson<Record<string, unknown>>(row.locale_json, {}),
    proxyReference: parseJson<Record<string, unknown>>(row.proxy_reference_json, {}),
    headedPolicy: String(row.headed_policy),
    preflightPolicy: parseJson<Record<string, unknown>>(row.preflight_policy_json, {}),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function evidenceRecordFromRow(row: Row): EvidenceRecord {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    evidenceType: String(row.evidence_type),
    payload: parseJson<Record<string, unknown>>(row.payload_json, {}),
    sanitizedPayload:
      typeof row.sanitized_payload_json === "string"
        ? parseJson<Record<string, unknown>>(row.sanitized_payload_json, {})
        : null,
    exportable: Number(row.exportable) === 1,
    createdAt: String(row.created_at),
  };
}

const sensitiveEvidenceKeys = new Set([
  "password",
  "proxyPassword",
  "rawPassword",
  "token",
  "accessToken",
  "refreshToken",
  "authorization",
  "apiKey",
  "cookie",
  "cookies",
  "localStorage",
  "sessionStorage",
]);

function sanitizeEvidenceValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeEvidenceValue(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
      key,
      sensitiveEvidenceKeys.has(key) ? "[redacted]" : sanitizeEvidenceValue(nestedValue),
    ]),
  );
}

function sanitizeEvidencePayload(payload: Record<string, unknown>) {
  return sanitizeEvidenceValue(payload) as Record<string, unknown>;
}

function hasRawProxySecret(proxyReference: Record<string, unknown>) {
  return ["password", "proxyPassword", "rawPassword"].some(
    (key) => typeof proxyReference[key] === "string" && String(proxyReference[key]).length > 0,
  );
}

function isSafeProfilePath(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value) && !value.includes("..");
}

function validateIdentityProfileRecord(
  profile: IdentityProfileRecord | IdentityProfileInput,
): IdentityProfileValidationIssue[] {
  const issues: IdentityProfileValidationIssue[] = [];
  const name = typeof profile.name === "string" ? profile.name.trim() : "";
  const browserEngine = profile.browserEngine ?? "cloakbrowser";
  const persistentProfilePath = profile.persistentProfilePath;
  const deviceIdentity = profile.deviceIdentity ?? {};
  const proxyReference = profile.proxyReference ?? {};
  const mobile = deviceIdentity.mobile === true || deviceIdentity.deviceClass === "mobile";
  const viewport = deviceIdentity.viewport as { width?: unknown; height?: unknown } | undefined;

  if (!name) {
    issues.push({
      code: "missing_name",
      field: "name",
      level: "error",
      message: "Identity profile name is required.",
    });
  }

  if (browserEngine !== "cloakbrowser") {
    issues.push({
      code: "unsupported_browser_engine",
      field: "browserEngine",
      level: "error",
      message: "Identity profiles must use the CloakBrowser engine.",
    });
  }

  if (persistentProfilePath && !isSafeProfilePath(persistentProfilePath)) {
    issues.push({
      code: "unsafe_profile_path",
      field: "persistentProfilePath",
      level: "error",
      message: "Persistent profile path must be a filesystem-safe slug.",
    });
  }

  if (mobile && typeof viewport?.width === "number" && viewport.width > 900) {
    issues.push({
      code: "mobile_viewport_mismatch",
      field: "deviceIdentity.viewport.width",
      level: "error",
      message: "Mobile identity profiles must not use desktop viewport widths.",
    });
  }

  if (mobile && deviceIdentity.touch !== true) {
    issues.push({
      code: "mobile_touch_mismatch",
      field: "deviceIdentity.touch",
      level: "error",
      message: "Mobile identity profiles must enable touch input.",
    });
  }

  if (hasRawProxySecret(proxyReference)) {
    issues.push({
      code: "raw_proxy_secret",
      field: "proxyReference",
      level: "error",
      message: "Identity profiles must store proxy credentials by secret reference, not raw password.",
    });
  }

  return issues;
}

export function createStorageService(options: StorageServiceOptions) {
  let db: DatabaseSync | null = null;
  const databasePath = path.join(options.appDataDir, "workspace.db");

  function database() {
    if (!db) {
      if (!existsSync(options.appDataDir)) {
        mkdirSync(options.appDataDir, { recursive: true });
      }
      db = new DatabaseSync(databasePath);
      db.exec("PRAGMA foreign_keys = ON");
    }
    return db;
  }

  return {
    initialize() {
      const current = database();
      current.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          applied_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS workspaces (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS app_preferences (
          key TEXT PRIMARY KEY,
          value_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS workspace_policies (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id),
          policy_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS workflows (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          tags_json TEXT NOT NULL DEFAULT '[]',
          notes TEXT NOT NULL DEFAULT '',
          default_run_profile_id TEXT,
          default_identity_profile_id TEXT,
          default_environment_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS workflow_graph_versions (
          id TEXT PRIMARY KEY,
          workflow_id TEXT NOT NULL REFERENCES workflows(id),
          schema_version INTEGER NOT NULL,
          graph_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          created_by TEXT NOT NULL,
          active INTEGER NOT NULL DEFAULT 0
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_graph_one_active
          ON workflow_graph_versions(workflow_id)
          WHERE active = 1;

        CREATE TABLE IF NOT EXISTS run_profiles (
          id TEXT PRIMARY KEY,
          workflow_id TEXT REFERENCES workflows(id),
          name TEXT NOT NULL,
          timeout_policy_json TEXT NOT NULL,
          retry_policy_json TEXT NOT NULL,
          retention_policy_json TEXT NOT NULL,
          concurrency_policy_json TEXT NOT NULL,
          evidence_policy_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS identity_profiles (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          browser_engine TEXT NOT NULL,
          persistent_profile_path TEXT,
          device_identity_json TEXT NOT NULL,
          locale_json TEXT NOT NULL,
          proxy_reference_json TEXT NOT NULL,
          headed_policy TEXT NOT NULL,
          preflight_policy_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS environments (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          permissions_json TEXT NOT NULL,
          headers_json TEXT NOT NULL,
          cookies_json TEXT NOT NULL,
          local_storage_json TEXT NOT NULL,
          session_storage_json TEXT NOT NULL,
          download_policy_json TEXT NOT NULL,
          initial_variables_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS runs (
          id TEXT PRIMARY KEY,
          workflow_id TEXT NOT NULL REFERENCES workflows(id),
          graph_version_id TEXT NOT NULL REFERENCES workflow_graph_versions(id),
          run_profile_snapshot_json TEXT NOT NULL,
          identity_profile_snapshot_json TEXT NOT NULL,
          environment_snapshot_json TEXT NOT NULL,
          status TEXT NOT NULL,
          started_at TEXT NOT NULL,
          ended_at TEXT,
          terminal_reason TEXT,
          operator_label TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS run_events (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL REFERENCES runs(id),
          sequence INTEGER NOT NULL,
          event_type TEXT NOT NULL,
          severity TEXT NOT NULL,
          node_id TEXT,
          action_id TEXT,
          payload_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          UNIQUE(run_id, sequence)
        );

        CREATE TABLE IF NOT EXISTS artifacts (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL REFERENCES runs(id),
          event_id TEXT REFERENCES run_events(id),
          artifact_type TEXT NOT NULL,
          relative_path TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          checksum TEXT NOT NULL,
          sanitized INTEGER NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS evidence_records (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL REFERENCES runs(id),
          evidence_type TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          sanitized_payload_json TEXT,
          exportable INTEGER NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS workflow_settings_snapshots (
          workflow_id TEXT PRIMARY KEY REFERENCES workflows(id),
          settings_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      const timestamp = nowIso();
      current
        .prepare("INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (1, ?)")
        .run(timestamp);
      current
        .prepare(
          "INSERT OR IGNORE INTO workspaces (id, name, created_at, updated_at) VALUES ('local', 'Local Workspace', ?, ?)",
        )
        .run(timestamp, timestamp);
    },

    getDiagnostics() {
      const rows = database()
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all() as Row[];
      const migration = database()
        .prepare("SELECT MAX(version) AS version FROM schema_migrations")
        .get() as Row | undefined;

      return {
        databasePath,
        schemaVersion: Number(migration?.version ?? 0),
        tables: rows.map((row) => String(row.name)),
      };
    },

    getWorkspace() {
      const row = database().prepare("SELECT * FROM workspaces WHERE id = 'local'").get() as
        | Row
        | undefined;
      if (!row) throw new Error("Default workspace has not been initialized.");
      return {
        id: String(row.id),
        name: String(row.name),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      };
    },

    getWorkspacePolicy(): WorkspacePolicy {
      const row = database()
        .prepare("SELECT policy_json FROM workspace_policies WHERE id = 'local_policy'")
        .get() as Row | undefined;
      return normalizeWorkspacePolicy(row ? parseJson(row.policy_json, {}) : {});
    },

    saveWorkspacePolicy(policy: WorkspacePolicy): WorkspacePolicy {
      const normalized = normalizeWorkspacePolicy(policy);
      const timestamp = nowIso();
      database()
        .prepare(
          `INSERT INTO workspace_policies (id, workspace_id, policy_json, updated_at)
           VALUES ('local_policy', 'local', ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             policy_json = excluded.policy_json,
             updated_at = excluded.updated_at`,
        )
        .run(JSON.stringify(normalized), timestamp);
      return this.getWorkspacePolicy();
    },

    createWorkflow(input: {
      name: string;
      description?: string;
      tags?: string[];
      notes?: string;
    }): WorkflowRecord {
      const workflowId = id("wf");
      const timestamp = nowIso();
      database()
        .prepare(
          `INSERT INTO workflows
            (id, name, description, tags_json, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          workflowId,
          input.name.trim(),
          input.description ?? "",
          JSON.stringify(input.tags ?? []),
          input.notes ?? "",
          timestamp,
          timestamp,
        );

      this.saveActiveGraph(workflowId, createDraftGraph(workflowId), "workflow_create");
      return this.getWorkflow(workflowId);
    },

    getWorkflow(workflowId: string): WorkflowRecord {
      const row = database()
        .prepare("SELECT * FROM workflows WHERE id = ? AND deleted_at IS NULL")
        .get(workflowId) as Row | undefined;
      if (!row) throw new Error(`Workflow '${workflowId}' not found.`);
      return workflowFromRow(row);
    },

    listWorkflows(): WorkflowRecord[] {
      return (
        database()
          .prepare("SELECT * FROM workflows WHERE deleted_at IS NULL ORDER BY updated_at DESC, name ASC")
          .all() as Row[]
      ).map(workflowFromRow);
    },

    softDeleteWorkflow(workflowId: string) {
      database()
        .prepare("UPDATE workflows SET deleted_at = ?, updated_at = ? WHERE id = ?")
        .run(nowIso(), nowIso(), workflowId);
    },

    updateWorkflow(
      workflowId: string,
      input: Partial<{
        name: string;
        description: string;
        tags: string[];
        notes: string;
      }>,
    ): WorkflowRecord {
      const current = this.getWorkflow(workflowId);
      const timestamp = nowIso();
      database()
        .prepare(
          `UPDATE workflows
           SET name = ?, description = ?, tags_json = ?, notes = ?, updated_at = ?
           WHERE id = ? AND deleted_at IS NULL`,
        )
        .run(
          input.name?.trim() || current.name,
          input.description ?? current.description,
          JSON.stringify(input.tags ?? current.tags),
          input.notes ?? current.notes,
          timestamp,
          workflowId,
        );
      return this.getWorkflow(workflowId);
    },

    updateWorkflowDefaults(
      workflowId: string,
      input: Partial<{
        defaultRunProfileId: string | null;
        defaultIdentityProfileId: string | null;
        defaultEnvironmentId: string | null;
      }>,
    ): WorkflowRecord {
      const current = this.getWorkflow(workflowId);
      const timestamp = nowIso();
      database()
        .prepare(
          `UPDATE workflows
           SET default_run_profile_id = ?, default_identity_profile_id = ?,
               default_environment_id = ?, updated_at = ?
           WHERE id = ? AND deleted_at IS NULL`,
        )
        .run(
          input.defaultRunProfileId === undefined
            ? current.defaultRunProfileId
            : input.defaultRunProfileId,
          input.defaultIdentityProfileId === undefined
            ? current.defaultIdentityProfileId
            : input.defaultIdentityProfileId,
          input.defaultEnvironmentId === undefined
            ? current.defaultEnvironmentId
            : input.defaultEnvironmentId,
          timestamp,
          workflowId,
        );
      return this.getWorkflow(workflowId);
    },

    duplicateWorkflow(workflowId: string, name: string): WorkflowRecord {
      const source = this.getWorkflow(workflowId);
      const duplicate = this.createWorkflow({
        name,
        description: source.description,
        tags: [...source.tags],
        notes: source.notes,
      });
      const graph = this.loadActiveGraph(workflowId);
      if (graph) {
        this.saveActiveGraph(duplicate.id, graph, "duplicate");
      }
      const settings = this.loadWorkflowSettings(workflowId);
      if (settings) {
        this.saveWorkflowSettings(duplicate.id, {
          ...settings,
          workflow_id: duplicate.id,
          general:
            settings.general && typeof settings.general === "object"
              ? { ...(settings.general as Record<string, unknown>), name }
              : settings.general,
        });
      }
      return duplicate;
    },

    saveActiveGraph(workflowId: string, graph: ElectronWorkflowGraph, createdBy: string) {
      const graphVersionId = id("gv");
      const timestamp = nowIso();
      const current = database();
      current.exec("BEGIN IMMEDIATE");
      try {
        current
          .prepare("UPDATE workflow_graph_versions SET active = 0 WHERE workflow_id = ?")
          .run(workflowId);
        current
          .prepare(
            `INSERT INTO workflow_graph_versions
              (id, workflow_id, schema_version, graph_json, created_at, created_by, active)
             VALUES (?, ?, ?, ?, ?, ?, 1)`,
          )
          .run(
            graphVersionId,
            workflowId,
            graph.schemaVersion,
            JSON.stringify(graph),
            timestamp,
            createdBy,
          );
        current.prepare("UPDATE workflows SET updated_at = ? WHERE id = ?").run(timestamp, workflowId);
        current.exec("COMMIT");
      } catch (error) {
        current.exec("ROLLBACK");
        throw error;
      }
    },

    loadActiveGraph(workflowId: string): ElectronWorkflowGraph | null {
      const row = database()
        .prepare("SELECT * FROM workflow_graph_versions WHERE workflow_id = ? AND active = 1")
        .get(workflowId) as Row | undefined;
      return row ? graphVersionFromRow(row).graph : null;
    },

    getActiveGraphVersion(workflowId: string): GraphVersionRecord {
      const row = database()
        .prepare("SELECT * FROM workflow_graph_versions WHERE workflow_id = ? AND active = 1")
        .get(workflowId) as Row | undefined;
      if (!row) throw new Error(`Workflow '${workflowId}' has no active graph version.`);
      return graphVersionFromRow(row);
    },

    listGraphVersions(workflowId: string): GraphVersionRecord[] {
      return (
        database()
          .prepare(
            "SELECT * FROM workflow_graph_versions WHERE workflow_id = ? ORDER BY created_at DESC",
          )
          .all(workflowId) as Row[]
      ).map(graphVersionFromRow);
    },

    createRun(input: {
      workflowId: string;
      graphVersionId: string;
      runProfileSnapshot: Record<string, unknown>;
      identityProfileSnapshot: Record<string, unknown>;
      environmentSnapshot: Record<string, unknown>;
      operatorLabel: string;
    }): RunRecord {
      const runId = id("run");
      const timestamp = nowIso();
      database()
        .prepare(
          `INSERT INTO runs
            (id, workflow_id, graph_version_id, run_profile_snapshot_json,
             identity_profile_snapshot_json, environment_snapshot_json, status,
             started_at, operator_label)
           VALUES (?, ?, ?, ?, ?, ?, 'running', ?, ?)`,
        )
        .run(
          runId,
          input.workflowId,
          input.graphVersionId,
          JSON.stringify(input.runProfileSnapshot),
          JSON.stringify(input.identityProfileSnapshot),
          JSON.stringify(input.environmentSnapshot),
          timestamp,
          input.operatorLabel,
        );
      return {
        id: runId,
        workflowId: input.workflowId,
        graphVersionId: input.graphVersionId,
        status: "running",
        startedAt: timestamp,
        endedAt: null,
        terminalReason: null,
        operatorLabel: input.operatorLabel,
      };
    },

    getRun(runId: string): RunRecord {
      const row = database().prepare("SELECT * FROM runs WHERE id = ?").get(runId) as
        | Row
        | undefined;
      if (!row) throw new Error(`Run '${runId}' not found.`);
      return runFromRow(row);
    },

    finishRun(inputRunId: string, input: { status: string; terminalReason?: string | null }): RunRecord {
      const timestamp = nowIso();
      database()
        .prepare("UPDATE runs SET status = ?, ended_at = ?, terminal_reason = ? WHERE id = ?")
        .run(input.status, timestamp, input.terminalReason ?? null, inputRunId);
      return this.getRun(inputRunId);
    },

    listRuns(input: { workflowId?: string; limit?: number } = {}): RunRecord[] {
      const limit = Math.max(1, Math.min(input.limit ?? 100, 500));
      const rows = input.workflowId
        ? (database()
            .prepare(
              `SELECT * FROM runs
               WHERE workflow_id = ?
               ORDER BY started_at DESC, id DESC
               LIMIT ?`,
            )
            .all(input.workflowId, limit) as Row[])
        : (database()
            .prepare(
              `SELECT * FROM runs
               ORDER BY started_at DESC, id DESC
               LIMIT ?`,
            )
            .all(limit) as Row[]);
      return rows.map(runFromRow);
    },

    appendRunEvent(
      runId: string,
      input: {
        type: string;
        severity: string;
        nodeId?: string | null;
        actionId?: string | null;
        payload: Record<string, unknown>;
      },
    ): RunEventRecord {
      const row = database()
        .prepare("SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence FROM run_events WHERE run_id = ?")
        .get(runId) as Row;
      const sequence = Number(row.sequence);
      const eventId = id("evt");
      const timestamp = nowIso();
      database()
        .prepare(
          `INSERT INTO run_events
            (id, run_id, sequence, event_type, severity, node_id, action_id, payload_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          eventId,
          runId,
          sequence,
          input.type,
          input.severity,
          input.nodeId ?? null,
          input.actionId ?? null,
          JSON.stringify(input.payload),
          timestamp,
        );
      return {
        id: eventId,
        runId,
        sequence,
        type: input.type,
        severity: input.severity,
        nodeId: input.nodeId ?? null,
        actionId: input.actionId ?? null,
        payload: input.payload,
        createdAt: timestamp,
      };
    },

    listRunEvents(runId: string): RunEventRecord[] {
      return (
        database()
          .prepare("SELECT * FROM run_events WHERE run_id = ? ORDER BY sequence ASC")
          .all(runId) as Row[]
      ).map(runEventFromRow);
    },

    registerArtifact(input: ArtifactRecordInput): ArtifactRecord {
      const artifactId = id("art");
      const timestamp = nowIso();
      database()
        .prepare(
          `INSERT INTO artifacts
            (id, run_id, event_id, artifact_type, relative_path, mime_type, size_bytes,
             checksum, sanitized, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          artifactId,
          input.runId,
          input.eventId ?? null,
          input.type,
          input.relativePath,
          input.mimeType,
          input.sizeBytes,
          input.checksum,
          input.sanitized ? 1 : 0,
          timestamp,
        );
      return { ...input, id: artifactId, eventId: input.eventId ?? null, createdAt: timestamp };
    },

    listArtifacts(runId: string): ArtifactRecord[] {
      return (
        database()
          .prepare("SELECT * FROM artifacts WHERE run_id = ? ORDER BY created_at ASC")
          .all(runId) as Row[]
      ).map(artifactFromRow);
    },

    createIdentityProfile(input: IdentityProfileInput): IdentityProfileRecord {
      const normalized: IdentityProfileInput = {
        browserEngine: "cloakbrowser",
        description: "",
        persistentProfilePath: null,
        deviceIdentity: {},
        locale: {},
        proxyReference: {},
        headedPolicy: "allow_headless",
        preflightPolicy: { enabled: false },
        ...input,
        name: input.name.trim(),
      };
      const issues = validateIdentityProfileRecord(normalized);
      if (issues.some((issue) => issue.level === "error")) {
        throw new Error(`Invalid identity profile: ${issues[0]?.message ?? "validation failed"}`);
      }

      const profileId = id("idp");
      const timestamp = nowIso();
      const browserEngine = normalized.browserEngine ?? "cloakbrowser";
      database()
        .prepare(
          `INSERT INTO identity_profiles
            (id, name, description, browser_engine, persistent_profile_path,
             device_identity_json, locale_json, proxy_reference_json, headed_policy,
             preflight_policy_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          profileId,
          normalized.name,
          normalized.description ?? "",
          browserEngine,
          normalized.persistentProfilePath ?? null,
          JSON.stringify(normalized.deviceIdentity ?? {}),
          JSON.stringify(normalized.locale ?? {}),
          JSON.stringify(normalized.proxyReference ?? {}),
          normalized.headedPolicy ?? "allow_headless",
          JSON.stringify(normalized.preflightPolicy ?? { enabled: false }),
          timestamp,
          timestamp,
        );
      return this.getIdentityProfile(profileId);
    },

    getIdentityProfile(profileId: string): IdentityProfileRecord {
      const row = database()
        .prepare("SELECT * FROM identity_profiles WHERE id = ?")
        .get(profileId) as Row | undefined;
      if (!row) throw new Error(`Identity profile '${profileId}' not found.`);
      return identityProfileFromRow(row);
    },

    listIdentityProfiles(): IdentityProfileRecord[] {
      return (
        database()
          .prepare("SELECT * FROM identity_profiles ORDER BY updated_at DESC, name ASC")
          .all() as Row[]
      ).map(identityProfileFromRow);
    },

    updateIdentityProfile(
      profileId: string,
      input: Partial<IdentityProfileInput>,
    ): IdentityProfileRecord {
      const current = this.getIdentityProfile(profileId);
      const next: IdentityProfileRecord = {
        ...current,
        ...input,
        id: current.id,
        name: input.name?.trim() || current.name,
        browserEngine: input.browserEngine ?? current.browserEngine,
        persistentProfilePath:
          input.persistentProfilePath === undefined
            ? current.persistentProfilePath
            : input.persistentProfilePath,
        deviceIdentity: input.deviceIdentity ?? current.deviceIdentity,
        locale: input.locale ?? current.locale,
        proxyReference: input.proxyReference ?? current.proxyReference,
        headedPolicy: input.headedPolicy ?? current.headedPolicy,
        preflightPolicy: input.preflightPolicy ?? current.preflightPolicy,
      };
      const issues = validateIdentityProfileRecord(next);
      if (issues.some((issue) => issue.level === "error")) {
        throw new Error(`Invalid identity profile: ${issues[0]?.message ?? "validation failed"}`);
      }

      const timestamp = nowIso();
      database()
        .prepare(
          `UPDATE identity_profiles
           SET name = ?, description = ?, browser_engine = ?, persistent_profile_path = ?,
               device_identity_json = ?, locale_json = ?, proxy_reference_json = ?,
               headed_policy = ?, preflight_policy_json = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(
          next.name,
          next.description,
          next.browserEngine,
          next.persistentProfilePath,
          JSON.stringify(next.deviceIdentity),
          JSON.stringify(next.locale),
          JSON.stringify(next.proxyReference),
          next.headedPolicy,
          JSON.stringify(next.preflightPolicy),
          timestamp,
          profileId,
        );
      return this.getIdentityProfile(profileId);
    },

    deleteIdentityProfile(profileId: string) {
      database().prepare("DELETE FROM identity_profiles WHERE id = ?").run(profileId);
    },

    validateIdentityProfile(
      profile: IdentityProfileRecord | IdentityProfileInput,
    ): IdentityProfileValidationIssue[] {
      return validateIdentityProfileRecord(profile);
    },

    sanitizeEvidencePayload(payload: Record<string, unknown>) {
      return sanitizeEvidencePayload(payload);
    },

    createEvidenceRecord(input: EvidenceRecordInput): EvidenceRecord {
      const evidenceId = id("evd");
      const timestamp = nowIso();
      const sanitizedPayload = input.sanitizedPayload ?? sanitizeEvidencePayload(input.payload);
      database()
        .prepare(
          `INSERT INTO evidence_records
            (id, run_id, evidence_type, payload_json, sanitized_payload_json, exportable, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          evidenceId,
          input.runId,
          input.evidenceType,
          JSON.stringify(input.payload),
          JSON.stringify(sanitizedPayload),
          input.exportable === false ? 0 : 1,
          timestamp,
        );
      return {
        id: evidenceId,
        runId: input.runId,
        evidenceType: input.evidenceType,
        payload: input.payload,
        sanitizedPayload,
        exportable: input.exportable !== false,
        createdAt: timestamp,
      };
    },

    listEvidenceRecords(runId: string): EvidenceRecord[] {
      return (
        database()
          .prepare("SELECT * FROM evidence_records WHERE run_id = ? ORDER BY created_at ASC")
          .all(runId) as Row[]
      ).map(evidenceRecordFromRow);
    },

    exportRunEvidence(runId: string): RunEvidenceExport {
      return {
        runId,
        events: this.listRunEvents(runId),
        artifacts: this.listArtifacts(runId).filter((artifact) => artifact.sanitized),
        evidence: this.listEvidenceRecords(runId)
          .filter((record) => record.exportable)
          .map((record) => ({
            id: record.id,
            evidenceType: record.evidenceType,
            payload: record.sanitizedPayload ?? sanitizeEvidencePayload(record.payload),
            createdAt: record.createdAt,
          })),
      };
    },

    saveWorkflowSettings(workflowId: string, settings: Record<string, unknown>) {
      const timestamp = nowIso();
      database()
        .prepare(
          `INSERT INTO workflow_settings_snapshots (workflow_id, settings_json, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(workflow_id) DO UPDATE SET
             settings_json = excluded.settings_json,
             updated_at = excluded.updated_at`,
        )
        .run(workflowId, JSON.stringify(settings), timestamp);
      database().prepare("UPDATE workflows SET updated_at = ? WHERE id = ?").run(timestamp, workflowId);
    },

    loadWorkflowSettings(workflowId: string): Record<string, unknown> | null {
      const row = database()
        .prepare("SELECT settings_json FROM workflow_settings_snapshots WHERE workflow_id = ?")
        .get(workflowId) as Row | undefined;
      return row ? parseJson<Record<string, unknown>>(row.settings_json, {}) : null;
    },

    close() {
      db?.close();
      db = null;
    },
  };
}
