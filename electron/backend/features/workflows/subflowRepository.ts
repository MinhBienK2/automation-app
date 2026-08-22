import type { DbAdapter } from "../../db/dbAdapter.js";
import type {
  Subflow,
  SubflowSummary,
  SubflowUsage,
  WorkflowGraph,
} from "../../../../src/types/workflow.js";
import { processGraphOnLoad } from "../../graph/graphLoader.js";
import { writeGraphToNormalizedTables } from "../../db/migrations/backfillGraphTables.js";
import { assembleSubflowGraphFromTables } from "./normalizedGraphRepository.js";
import { snapshotRevision } from "./revisionRepository.js";
import { parseJson } from "../../shared/records.js";

type SubflowRow = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  tags_json: string;
  created_at: string;
  updated_at: string;
};

export class SubflowRepository {
  constructor(private readonly database: DbAdapter) {}

  async createSubflow(
    projectId: string,
    name: string,
    description: string,
    graph: WorkflowGraph,
    now = new Date(),
  ): Promise<Subflow> {
    const timestamp = now.toISOString();
    const id = crypto.randomUUID();
    await this.database.execute(
      `INSERT INTO subflows (
        id,
        project_id,
        name,
        description,
        tags_json,
        created_at,
        updated_at,
        owner_id
      ) VALUES ($1, $2, $3, $4, '[]', $5, $6, $7)`,
      [id, projectId, name, description, timestamp, timestamp, this.database.ownerId],
    );
    await writeGraphToNormalizedTables(this.database, graph, "subflow", id, timestamp);
    return {
      id,
      project_id: projectId,
      name,
      description,
      tags: [],
      graph,
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  async listSubflows(projectId: string): Promise<SubflowSummary[]> {
    const rows = await this.database.query(
      `SELECT id, project_id, name, description, tags_json, created_at, updated_at
       FROM subflows
       WHERE project_id = $1 AND owner_id = $2
       ORDER BY updated_at DESC, name ASC`,
      [projectId, this.database.ownerId],
    ) as SubflowRow[];
    const summaries: SubflowSummary[] = [];
    for (const row of rows) {
      const subflow = rowToSubflowSummary(row);
      const usages = await this.getSubflowUsage(subflow.id);
      summaries.push({
        ...subflow,
        used_by_count: usages.length,
      });
    }
    return summaries;
  }

  async getSubflow(subflowId: string): Promise<Subflow | null> {
    const row = await this.getSubflowRow(subflowId);
    if (!row) return null;
    const graph = await assembleSubflowGraphFromTables(this.database, subflowId);
    return {
      id: row.id,
      project_id: row.project_id,
      name: row.name,
      description: row.description,
      tags: parseJson<string[]>(row.tags_json),
      graph: graph ?? { version: 2, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async getSubflowGraph(subflowId: string): Promise<WorkflowGraph | null> {
    const fromTables = await assembleSubflowGraphFromTables(this.database, subflowId);
    if (!fromTables) return null;
    const result = processGraphOnLoad(fromTables);
    if (result.migrationsApplied > 0 && !result.migrationFailed) {
      await this.saveSubflowGraph(subflowId, result.graph, { skipRevision: true });
    }
    return result.graph;
  }

  async updateSubflow(
    subflowId: string,
    input: { name?: string; description?: string | null },
    now = new Date(),
  ): Promise<Subflow | null> {
    const subflow = await this.getSubflow(subflowId);
    if (!subflow) return null;
    const timestamp = now.toISOString();
    const name = input.name ?? subflow.name;
    const description =
      input.description === undefined ? subflow.description : input.description ?? "";
    await this.database.execute(
      "UPDATE subflows SET name = $1, description = $2, updated_at = $3 WHERE id = $4 AND owner_id = $5",
      [name, description, timestamp, subflowId, this.database.ownerId],
    );
    return {
      ...subflow,
      name,
      description,
      updated_at: timestamp,
    };
  }

  async saveSubflowGraph(
    subflowId: string,
    graph: WorkflowGraph,
    options: { comment?: string | null; tag?: string | null; skipRevision?: boolean } = {},
    now = new Date(),
  ): Promise<void> {
    const timestamp = now.toISOString();
    await this.database.execute(
      "UPDATE subflows SET updated_at = $1 WHERE id = $2 AND owner_id = $3",
      [timestamp, subflowId, this.database.ownerId],
    );
    await writeGraphToNormalizedTables(this.database, graph, "subflow", subflowId, timestamp);
    if (!options.skipRevision) {
      await snapshotRevision(this.database, "subflow", subflowId, graph, {
        createdAt: timestamp,
        comment: options.comment,
        tag: options.tag,
      });
    }
  }

  async duplicateSubflow(subflowId: string, name: string, now = new Date()): Promise<Subflow | null> {
    const subflow = await this.getSubflow(subflowId);
    if (!subflow) return null;
    return await this.createSubflow(subflow.project_id, name, subflow.description, subflow.graph, now);
  }

  async deleteSubflow(subflowId: string): Promise<void> {
    await this.database.execute(
      "DELETE FROM subflows WHERE id = $1 AND owner_id = $2",
      [subflowId, this.database.ownerId],
    );
  }

  async getSubflowUsage(subflowId: string): Promise<SubflowUsage[]> {
    const rows = await this.database.query(
      `SELECT DISTINCT w.id AS workflow_id, w.name AS workflow_name
       FROM workflow_nodes n
       JOIN workflows w ON w.id = n.workflow_id
       WHERE n.subflow_ref = $1 AND w.owner_id = $2
       ORDER BY w.name ASC`,
      [subflowId, this.database.ownerId],
    );
    return rows as SubflowUsage[];
  }

  async listProjectSubflowUsages(projectId: string): Promise<Record<string, SubflowUsage[]>> {
    const rows = await this.database.query(
      `SELECT DISTINCT n.subflow_ref AS subflow_id, w.id AS workflow_id, w.name AS workflow_name
       FROM workflow_nodes n
       JOIN workflows w ON w.id = n.workflow_id
       WHERE n.subflow_ref IS NOT NULL AND w.owner_id = $1 AND w.project_id = $2
       ORDER BY w.name ASC`,
      [this.database.ownerId, projectId],
    ) as Array<SubflowUsage & { subflow_id: string }>;
    const map: Record<string, SubflowUsage[]> = {};
    for (const row of rows) {
      const { subflow_id, ...usage } = row;
      (map[subflow_id] ||= []).push(usage);
    }
    return map;
  }

  private async getSubflowRow(subflowId: string): Promise<SubflowRow | null> {
    return (
      (await this.database.queryOne(
        `SELECT id, project_id, name, description, tags_json, created_at, updated_at
         FROM subflows
         WHERE id = $1 AND owner_id = $2`,
        [subflowId, this.database.ownerId],
      ) as SubflowRow | null) ?? null
    );
  }
}

function rowToSubflowSummary(row: SubflowRow): SubflowSummary {
  return {
    id: row.id,
    project_id: row.project_id,
    name: row.name,
    description: row.description,
    tags: parseJson<string[]>(row.tags_json),
    used_by_count: 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
