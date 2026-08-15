/**
 * Persistence for Desktop Targets.
 *
 * A sibling of the Browser Profile half of `projectRepository.ts`, in its own
 * file rather than appended to it, because the two share a relationship to a
 * project and nothing else. A Browser Profile owns a user-data directory; a
 * Desktop Target owns no storage at all, which is the reason it is not called a
 * profile — see `docs/domain/desktop/desktop-target.md`.
 *
 * `pid` and `window_id` are deliberately absent. They are a Window Binding,
 * resolved fresh every run; storing them would let a workflow act on a window
 * that closed days ago.
 */

import type { DbAdapter } from "../../db/dbAdapter.js";
import type {
  AccessibilityHints,
  CapabilityTier,
  DesktopLaunchSpec,
  DesktopTarget,
  DesktopTargetInput,
  WindowSelector,
} from "../../../../src/types/desktopTargets.js";

type DesktopTargetRow = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  is_default: number;
  launch_json: string;
  window_json: string;
  accessibility_json: string | null;
  observed_tier: string | null;
  created_at: string;
  updated_at: string;
};

const COLUMNS =
  "id, project_id, name, description, is_default, launch_json, window_json, accessibility_json, observed_tier, created_at, updated_at";

export class DesktopTargetRepository {
  constructor(private readonly database: DbAdapter) {}

  async createDesktopTarget(
    projectId: string,
    input: DesktopTargetInput,
    now = new Date(),
  ): Promise<DesktopTarget> {
    const timestamp = now.toISOString();
    const id = crypto.randomUUID();

    await this.database.transaction(async (tx) => {
      if (input.is_default) {
        await tx.execute(
          "UPDATE desktop_targets SET is_default = 0 WHERE project_id = $1 AND owner_id = $2",
          [projectId, tx.ownerId],
        );
      }
      await tx.execute(
        `INSERT INTO desktop_targets (
          id, project_id, name, description, is_default,
          launch_json, window_json, accessibility_json, observed_tier,
          created_at, updated_at, owner_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          id,
          projectId,
          input.name,
          input.description ?? "",
          input.is_default ? 1 : 0,
          JSON.stringify(input.launch),
          JSON.stringify(input.window ?? {}),
          input.accessibility ? JSON.stringify(input.accessibility) : null,
          null,
          timestamp,
          timestamp,
          tx.ownerId,
        ],
      );
    });

    return {
      id,
      project_id: projectId,
      name: input.name,
      description: input.description ?? "",
      is_default: input.is_default === true,
      launch: input.launch,
      window: input.window ?? {},
      ...(input.accessibility ? { accessibility: input.accessibility } : {}),
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  /** Defaults first, so a picker opens on the likely choice. */
  async listDesktopTargets(projectId: string): Promise<DesktopTarget[]> {
    const rows = await this.database.query(
      `SELECT ${COLUMNS}
       FROM desktop_targets
       WHERE project_id = $1 AND owner_id = $2
       ORDER BY is_default DESC, updated_at DESC, name ASC`,
      [projectId, this.database.ownerId],
    );
    return rows.map((row) => rowToDesktopTarget(row as DesktopTargetRow));
  }

  async getDesktopTarget(targetId: string): Promise<DesktopTarget | null> {
    const row = (await this.database.queryOne(
      `SELECT ${COLUMNS} FROM desktop_targets WHERE id = $1 AND owner_id = $2`,
      [targetId, this.database.ownerId],
    )) as DesktopTargetRow | null;
    return row ? rowToDesktopTarget(row) : null;
  }

  async getDefaultDesktopTarget(projectId: string): Promise<DesktopTarget | null> {
    const row = (await this.database.queryOne(
      `SELECT ${COLUMNS}
       FROM desktop_targets
       WHERE project_id = $1 AND is_default = 1 AND owner_id = $2
       ORDER BY updated_at DESC
       LIMIT 1`,
      [projectId, this.database.ownerId],
    )) as DesktopTargetRow | null;
    return row ? rowToDesktopTarget(row) : null;
  }

  async updateDesktopTarget(
    targetId: string,
    input: Partial<DesktopTargetInput>,
    now = new Date(),
  ): Promise<DesktopTarget | null> {
    const current = await this.getDesktopTarget(targetId);
    if (!current) return null;

    const timestamp = now.toISOString();
    const next: DesktopTarget = {
      ...current,
      name: input.name ?? current.name,
      description: input.description ?? current.description,
      is_default: input.is_default ?? current.is_default,
      launch: input.launch ?? current.launch,
      window: input.window ?? current.window,
      accessibility: input.accessibility ?? current.accessibility,
      updated_at: timestamp,
    };

    await this.database.transaction(async (tx) => {
      if (next.is_default && !current.is_default) {
        await tx.execute(
          "UPDATE desktop_targets SET is_default = 0 WHERE project_id = $1 AND owner_id = $2",
          [current.project_id, tx.ownerId],
        );
      }
      await tx.execute(
        `UPDATE desktop_targets
         SET name = $1, description = $2, is_default = $3, launch_json = $4,
             window_json = $5, accessibility_json = $6, updated_at = $7
         WHERE id = $8 AND owner_id = $9`,
        [
          next.name,
          next.description,
          next.is_default ? 1 : 0,
          JSON.stringify(next.launch),
          JSON.stringify(next.window),
          next.accessibility ? JSON.stringify(next.accessibility) : null,
          timestamp,
          targetId,
          tx.ownerId,
        ],
      );
    });

    return next;
  }

  /**
   * The tier is advisory and re-probed every run, so this writes nothing else —
   * a run finishing must not quietly overwrite an edit the operator made while
   * it was running.
   */
  async recordObservedTier(targetId: string, tier: CapabilityTier): Promise<void> {
    await this.database.execute(
      "UPDATE desktop_targets SET observed_tier = $1 WHERE id = $2 AND owner_id = $3",
      [tier, targetId, this.database.ownerId],
    );
  }

  /**
   * Clears the reference before deleting the row.
   *
   * A workflow left pointing at a deleted target would fail at launch, deep in
   * a run. Cleared, it fails at authoring time with an empty picker — the same
   * problem, reported where the operator can fix it.
   */
  async deleteDesktopTarget(targetId: string): Promise<void> {
    await this.database.transaction(async (tx) => {
      await tx.execute(
        "UPDATE workflows SET desktop_target_id = NULL WHERE desktop_target_id = $1 AND owner_id = $2",
        [targetId, tx.ownerId],
      );
      await tx.execute("DELETE FROM desktop_targets WHERE id = $1 AND owner_id = $2", [
        targetId,
        tx.ownerId,
      ]);
    });
  }
}

function rowToDesktopTarget(row: DesktopTargetRow): DesktopTarget {
  const accessibility = parseJson<AccessibilityHints>(row.accessibility_json, undefined);

  return {
    id: row.id,
    project_id: row.project_id,
    name: row.name,
    description: row.description,
    is_default: row.is_default === 1,
    // A corrupt column reads as an unusable target rather than throwing: a
    // hand-edited database or a half-finished restore must not take out the
    // whole Projects screen. An empty `value` fails at launch, where the error
    // can name the target.
    launch: parseJson<DesktopLaunchSpec>(row.launch_json, { kind: "app_id", value: "" }),
    window: parseJson<WindowSelector>(row.window_json, {}),
    ...(accessibility ? { accessibility } : {}),
    ...(isCapabilityTier(row.observed_tier) ? { observed_tier: row.observed_tier } : {}),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

function isCapabilityTier(value: string | null): value is CapabilityTier {
  return value === "element" || value === "chrome" || value === "pixel";
}
