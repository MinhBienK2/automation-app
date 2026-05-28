import { createHash } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type {
  EvidenceBundleExportRequest,
  EvidenceBundleExportResult,
  EvidenceDetail,
  EvidenceFileState,
  EvidenceKind,
  EvidenceListItem,
  EvidenceListRequest,
  EvidencePage,
  EvidenceScreenshotPreview,
  RunStatus,
  WorkflowRunSource,
} from "../../../src/types/workflow.js";
import type { AppPaths } from "../persistence/database.js";

type RunRow = {
  id: string;
  workflow_id: string;
  workflow_name: string;
  source: WorkflowRunSource;
  status: RunStatus;
  started_at: string;
  finished_at: string | null;
  settings_snapshot_json: string | null;
  outputs_json: string | null;
};

type EvidenceWarnings = EvidencePage["warnings"];

type EvidenceBuildResult = {
  items: EvidenceListItem[];
  warnings: EvidenceWarnings;
};

const defaultPageLimit = 50;
const maxPageLimit = 100;
const previewLimitBytes = 10 * 1024 * 1024;

export class EvidenceRepository {
  constructor(
    private readonly options: {
      database: DatabaseSync;
      appPaths: AppPaths;
      revealEvidenceArtifact?: (absolutePath: string) => void | Promise<void>;
      selectEvidenceBundleDirectory?: () => Promise<string | null>;
    },
  ) {}

  listEvidenceItems(request: EvidenceListRequest = {}): EvidencePage {
    const limit = limitValue(request.limit);
    const { items, warnings } = this.buildEvidenceItems(request);
    const sorted = items.sort(compareEvidenceItems);
    const cursor = parseCursor(request.cursor);
    const cursorIndex = cursor
      ? sorted.findIndex(
          (item) =>
            item.created_at === cursor.created_at &&
            item.evidence_id === cursor.evidence_id,
        )
      : -1;
    const startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
    const pageItems = sorted.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < sorted.length;
    const last = pageItems[pageItems.length - 1] ?? null;
    return {
      generated_at: new Date().toISOString(),
      items: pageItems,
      next_cursor: hasMore && last ? encodeCursor(last) : null,
      has_more: hasMore,
      warnings,
    };
  }

  getEvidenceDetail(evidenceId: string): EvidenceDetail {
    const { item, row, outputs } = this.requireEvidence(evidenceId);
    if (item.kind === "screenshot") {
      const state = this.fileState(row.id, item.relative_path ?? "");
      return {
        item: { ...item, file_state: state },
        payload: {
          kind: "screenshot",
          artifact_kind: "screenshot",
          relative_path: item.relative_path ?? "",
          file_state: state,
        },
      };
    }
    if (item.kind === "download") {
      const state = this.fileState(row.id, item.relative_path ?? "");
      return {
        item: { ...item, file_state: state },
        payload: {
          kind: "download",
          artifact_kind: "download",
          relative_path: item.relative_path ?? "",
          file_state: state,
          size_bytes: state === "available" ? this.fileSize(row.id, item.relative_path ?? "") : null,
        },
      };
    }
    if (item.kind === "browser_identity") {
      return {
        item,
        payload: {
          kind: "browser_identity",
          fields: safeFields(parseJsonRecord(outputs.browser_identity)),
        },
      };
    }
    if (item.kind === "action_trace") {
      const traces = Array.isArray(outputs.__action_traces) ? outputs.__action_traces : [];
      return {
        item,
        payload: {
          kind: "action_trace",
          entries: traces.slice(0, 500).map((trace) => sanitizeStructured(trace)),
          has_more: traces.length > 500,
        },
      };
    }
    return {
      item,
      payload: {
        kind: "evidence_manifest",
        rows: manifestRows(outputs.__evidence_model),
      },
    };
  }

  async getEvidenceScreenshotPreview(evidenceId: string): Promise<EvidenceScreenshotPreview> {
    const { item, row } = this.requireEvidence(evidenceId);
    if (item.kind !== "screenshot") {
      throw commandError("Evidence item is not a screenshot", "evidenceId");
    }
    const absolutePath = this.requireArtifactPath(row.id, item.relative_path ?? "");
    const stat = await fsp.stat(absolutePath).catch(() => null);
    if (!stat?.isFile()) throw commandError("Evidence file unavailable", "evidenceId");
    if (stat.size > previewLimitBytes) {
      throw commandError("Screenshot preview is too large", "evidenceId");
    }
    return {
      evidence_id: evidenceId,
      mime_type: "image/png",
      base64_data: (await fsp.readFile(absolutePath)).toString("base64"),
      file_state: "available",
    };
  }

  async revealEvidenceArtifact(evidenceId: string) {
    const { item, row } = this.requireEvidence(evidenceId);
    if (item.kind !== "screenshot" && item.kind !== "download") {
      throw commandError("Evidence item is not a file artifact", "evidenceId");
    }
    const absolutePath = this.requireArtifactPath(row.id, item.relative_path ?? "");
    const stat = await fsp.stat(absolutePath).catch(() => null);
    if (!stat?.isFile()) throw commandError("Evidence file unavailable", "evidenceId");
    await this.options.revealEvidenceArtifact?.(absolutePath);
  }

  async exportEvidenceBundle(
    request: EvidenceBundleExportRequest,
  ): Promise<EvidenceBundleExportResult> {
    const destination = await this.options.selectEvidenceBundleDirectory?.();
    if (!destination) return null;
    const selectedIds = [...new Set(request.evidence_ids)].slice(0, 200);
    const bundleDir = await this.createBundleDirectory(destination);
    const artifactsDir = path.join(bundleDir, "artifacts");
    await fsp.mkdir(artifactsDir, { recursive: true });
    let omittedFileCount = 0;
    const usedNames = new Set<string>();
    const manifestItems = [];

    for (const evidenceId of selectedIds) {
      const detail = this.getEvidenceDetail(evidenceId);
      const manifestItem: Record<string, unknown> = {
        evidence_id: evidenceId,
        kind: detail.item.kind,
        label: detail.item.label,
        run: detail.item.run,
        workflow: detail.item.workflow,
        identity: detail.item.identity,
        node_id: detail.item.node_id ?? null,
        step_number: detail.item.step_number ?? null,
        payload: detail.payload,
      };
      if (
        (detail.item.kind === "screenshot" || detail.item.kind === "download") &&
        detail.item.relative_path
      ) {
        const absolutePath = this.requireArtifactPath(detail.item.run.id, detail.item.relative_path);
        const stat = await fsp.stat(absolutePath).catch(() => null);
        if (stat?.isFile()) {
          const copiedName = uniqueName(path.basename(detail.item.relative_path), usedNames);
          const copiedPath = path.join(artifactsDir, copiedName);
          await fsp.copyFile(absolutePath, copiedPath);
          manifestItem.artifact = {
            relative_path: detail.item.relative_path,
            copied_path: `artifacts/${copiedName}`,
          };
        } else {
          omittedFileCount += 1;
          manifestItem.artifact = {
            relative_path: detail.item.relative_path,
            file_state: "unavailable",
          };
        }
      }
      manifestItems.push(manifestItem);
    }

    await fsp.writeFile(
      path.join(bundleDir, "manifest.json"),
      JSON.stringify(
        {
          schema: "mission-control-evidence-bundle",
          version: 1,
          generated_at: new Date().toISOString(),
          items: manifestItems,
        },
        null,
        2,
      ),
      "utf8",
    );
    return {
      bundle_dir: bundleDir,
      exported_count: selectedIds.length,
      omitted_file_count: omittedFileCount,
    };
  }

  private buildEvidenceItems(request: EvidenceListRequest): EvidenceBuildResult {
    const warnings: EvidenceWarnings = {
      skipped_artifacts: 0,
      skipped_reports: 0,
      skipped_traces: 0,
      skipped_manifests: 0,
    };
    const rows = this.runRows(request);
    const items = rows.flatMap((row) => this.itemsFromRun(row, warnings));
    const filtered = items.filter((item) => matchesEvidenceRequest(item, request));
    return { items: filtered, warnings };
  }

  private runRows(request: EvidenceListRequest): RunRow[] {
    const where: string[] = ["runs.outputs_json IS NOT NULL"];
    const params: string[] = [];
    if (request.workflow_id) {
      where.push("runs.workflow_id = ?");
      params.push(request.workflow_id);
    }
    if (request.run_id) {
      where.push("runs.id = ?");
      params.push(request.run_id);
    }
    if (request.run_statuses?.length) {
      where.push(`runs.status IN (${request.run_statuses.map(() => "?").join(", ")})`);
      params.push(...request.run_statuses);
    }
    if (request.sources?.length) {
      where.push(`runs.source IN (${request.sources.map(() => "?").join(", ")})`);
      params.push(...request.sources);
    }
    const sql = `
      SELECT
        runs.id,
        runs.workflow_id,
        workflows.name AS workflow_name,
        runs.source,
        runs.status,
        runs.started_at,
        runs.finished_at,
        runs.settings_snapshot_json,
        runs.outputs_json
      FROM runs
      INNER JOIN workflows ON workflows.id = runs.workflow_id
      WHERE ${where.join(" AND ")}
      ORDER BY COALESCE(runs.finished_at, runs.started_at) DESC
    `;
    return this.options.database.prepare(sql).all(...params) as RunRow[];
  }

  private itemsFromRun(row: RunRow, warnings: EvidenceWarnings): EvidenceListItem[] {
    const outputs = parseJsonRecord(row.outputs_json) ?? {};
    const identity = identityFrom(row, outputs);
    const base = {
      run: {
        id: row.id,
        status: row.status,
        source: row.source,
        started_at: row.started_at,
        finished_at: row.finished_at,
      },
      workflow: { id: row.workflow_id, name: row.workflow_name },
      identity,
      navigation_targets: { run: true, workflow: true },
    };
    const items: EvidenceListItem[] = [];
    const seenArtifacts = new Set<string>();
    const artifacts = Array.isArray(outputs.__evidence) ? outputs.__evidence : [];
    for (const artifact of artifacts) {
      const record = parseJsonRecord(artifact);
      const kind = stringValue(record?.artifact_kind) ?? stringValue(record?.kind);
      const relativePath = stringValue(record?.path) ?? stringValue(record?.relative_path);
      if (
        (kind !== "screenshot" && kind !== "download") ||
        !relativePath ||
        !safeEvidencePath(row.id, relativePath)
      ) {
        warnings.skipped_artifacts += 1;
        continue;
      }
      const itemEvidenceId = evidenceId(row.id, kind, relativePath);
      if (seenArtifacts.has(itemEvidenceId)) continue;
      seenArtifacts.add(itemEvidenceId);
      items.push({
        ...base,
        evidence_id: itemEvidenceId,
        kind,
        label: path.basename(relativePath),
        created_at: validDate(stringValue(record?.created_at)) ?? row.finished_at ?? row.started_at,
        node_id: stringValue(record?.node_id),
        step_number: numberValue(record?.step_number),
        relative_path: relativePath,
        file_state: "unchecked",
      });
    }
    const structuredCreatedAt = row.finished_at ?? row.started_at;
    if (parseJsonRecord(outputs.browser_identity)) {
      items.push({
        ...base,
        evidence_id: evidenceId(row.id, "browser_identity"),
        kind: "browser_identity",
        label: "Browser identity report",
        created_at: structuredCreatedAt,
      });
    }
    if (Array.isArray(outputs.__action_traces) && outputs.__action_traces.length > 0) {
      items.push({
        ...base,
        evidence_id: evidenceId(row.id, "action_trace"),
        kind: "action_trace",
        label: "Action trace timeline",
        created_at: structuredCreatedAt,
      });
    }
    if (manifestRows(outputs.__evidence_model).length > 0) {
      items.push({
        ...base,
        evidence_id: evidenceId(row.id, "evidence_manifest"),
        kind: "evidence_manifest",
        label: "Evidence manifest",
        created_at: structuredCreatedAt,
      });
    }
    return items;
  }

  private requireEvidence(evidenceIdValue: string) {
    const rows = this.runRows({});
    for (const row of rows) {
      const outputs = parseJsonRecord(row.outputs_json) ?? {};
      const warnings: EvidenceWarnings = {
        skipped_artifacts: 0,
        skipped_reports: 0,
        skipped_traces: 0,
        skipped_manifests: 0,
      };
      const item = this.itemsFromRun(row, warnings).find(
        (candidate) => candidate.evidence_id === evidenceIdValue,
      );
      if (item) return { item, row, outputs };
    }
    throw commandError("Evidence item not found", "evidenceId");
  }

  private requireArtifactPath(runId: string, relativePath: string) {
    if (!safeEvidencePath(runId, relativePath)) {
      throw commandError("Evidence path is outside the run evidence directory", "evidenceId");
    }
    const absolutePath = path.join(this.options.appPaths.evidenceDir, relativePath);
    const relativeToEvidence = path.relative(this.options.appPaths.evidenceDir, absolutePath);
    if (relativeToEvidence.startsWith("..") || path.isAbsolute(relativeToEvidence)) {
      throw commandError("Evidence path is outside the app evidence directory", "evidenceId");
    }
    return absolutePath;
  }

  private fileState(runId: string, relativePath: string): EvidenceFileState {
    try {
      return fs.statSync(this.requireArtifactPath(runId, relativePath)).isFile()
        ? "available"
        : "unavailable";
    } catch {
      return "unavailable";
    }
  }

  private fileSize(runId: string, relativePath: string) {
    try {
      return fs.statSync(this.requireArtifactPath(runId, relativePath)).size;
    } catch {
      return null;
    }
  }

  private async createBundleDirectory(destination: string) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    for (let index = 0; index < 100; index += 1) {
      const suffix = index === 0 ? "" : `-${index + 1}`;
      const candidate = path.join(destination, `evidence-bundle-${stamp}${suffix}`);
      try {
        await fsp.mkdir(candidate, { recursive: false });
        return candidate;
      } catch (error) {
        if ((error as { code?: string }).code !== "EEXIST") throw error;
      }
    }
    throw commandError("Could not create evidence bundle directory");
  }
}

function compareEvidenceItems(left: EvidenceListItem, right: EvidenceListItem) {
  const byDate = right.created_at.localeCompare(left.created_at);
  return byDate || right.evidence_id.localeCompare(left.evidence_id);
}

function matchesEvidenceRequest(item: EvidenceListItem, request: EvidenceListRequest) {
  if (request.focus_evidence_id && item.evidence_id !== request.focus_evidence_id) {
    return false;
  }
  if (request.types?.length && !request.types.includes(item.kind)) return false;
  if (request.identity_id && item.identity?.id !== request.identity_id) return false;
  if (request.time_start_utc && item.created_at < new Date(request.time_start_utc).toISOString()) {
    return false;
  }
  if (request.time_end_utc && item.created_at >= new Date(request.time_end_utc).toISOString()) {
    return false;
  }
  const search = request.search?.trim().toLowerCase();
  if (!search) return true;
  return [
    item.evidence_id,
    item.kind,
    item.label,
    item.run.id,
    item.workflow?.name,
    item.identity?.id,
    item.identity?.display_name,
    item.node_id,
    item.relative_path,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(search));
}

function limitValue(value: number | null | undefined) {
  if (!Number.isFinite(value ?? NaN)) return defaultPageLimit;
  return Math.max(1, Math.min(Math.floor(value as number), maxPageLimit));
}

function encodeCursor(item: EvidenceListItem) {
  return Buffer.from(
    JSON.stringify({ created_at: item.created_at, evidence_id: item.evidence_id }),
    "utf8",
  ).toString("base64url");
}

function parseCursor(value: string | null | undefined) {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      created_at: string;
      evidence_id: string;
    };
  } catch {
    return null;
  }
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

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function validDate(value: string | null) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function identityFrom(row: RunRow, outputs: Record<string, unknown>) {
  const settings = parseJsonRecord(row.settings_snapshot_json);
  const launch = parseJsonRecord(settings?.browser_launch);
  const outputIdentity = parseJsonRecord(outputs.browser_identity);
  const id =
    stringValue(launch?.identity_id) ??
    stringValue(outputIdentity?.identity_id) ??
    stringValue(outputIdentity?.id);
  if (!id) return null;
  return {
    id,
    display_name:
      stringValue(launch?.display_name) ?? stringValue(outputIdentity?.display_name),
  };
}

function safeEvidencePath(runId: string, relativePath: string) {
  return (
    !path.isAbsolute(relativePath) &&
    !relativePath.split(/[\\/]/).includes("..") &&
    relativePath.startsWith(`runs/${runId}/`)
  );
}

function evidenceId(runId: string, kind: EvidenceKind | string, value = "") {
  return createHash("sha256")
    .update(`${runId}\0${kind}\0${value}`)
    .digest("hex")
    .slice(0, 24);
}

function safeFields(record: Record<string, unknown> | null) {
  if (!record) return [];
  return Object.entries(record)
    .filter(([key, value]) => !isSensitiveKey(key) && isScalar(value))
    .map(([key, value]) => ({ key, value: value as string | number | boolean | null }));
}

function sanitizeStructured(value: unknown): Record<string, unknown> {
  const record = parseJsonRecord(value);
  if (!record) return {};
  return Object.fromEntries(
    Object.entries(record)
      .filter(([key]) => !isSensitiveKey(key))
      .map(([key, item]) => [key, isScalar(item) || Array.isArray(item) ? item : sanitizeStructured(item)]),
  );
}

function manifestRows(value: unknown) {
  const manifest = parseJsonRecord(value);
  const outputs = Array.isArray(manifest?.outputs) ? manifest.outputs : [];
  return outputs.flatMap((item) => {
    const record = parseJsonRecord(item);
    const key = stringValue(record?.key);
    const category = stringValue(record?.category);
    if (!key || !category) return [];
    return [
      {
        key,
        category,
        approximate_bytes: numberValue(record?.approximate_bytes),
        redacted: record?.redacted === true,
        truncated: record?.truncated === true,
      },
    ];
  });
}

function isScalar(value: unknown) {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function isSensitiveKey(key: string) {
  return /password|secret|token|cookie|credential|authorization/i.test(key);
}

function uniqueName(baseName: string, usedNames: Set<string>) {
  const parsed = path.parse(baseName);
  let candidate = baseName;
  for (let index = 2; usedNames.has(candidate); index += 1) {
    candidate = `${parsed.name}-${index}${parsed.ext}`;
  }
  usedNames.add(candidate);
  return candidate;
}

function commandError(message: string, field?: string) {
  return { message, field };
}
