import type { DatabaseSync } from "node:sqlite";
import type {
  Subflow,
  SubflowSummary,
  SubflowUsage,
  WorkflowGraph,
} from "../../../src/types/workflow.js";
import { processGraphOnLoad } from "./graphLoader.js";
import { writeGraphToNormalizedTables } from "./backfillGraphTables.js";
import { assembleSubflowGraphFromTables } from "./normalizedGraphRepository.js";
import { snapshotRevision } from "./revisionRepository.js";

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
  constructor(private readonly database: DatabaseSync) {}

  createSubflow(
    projectId: string,
    name: string,
    description: string,
    graph: WorkflowGraph,
    now = new Date(),
  ): Subflow {
    const timestamp = now.toISOString();
    const id = crypto.randomUUID();
    this.database
      .prepare(
        `INSERT INTO subflows (
          id,
          project_id,
          name,
          description,
          tags_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, '[]', ?, ?)`,
      )
      .run(id, projectId, name, description, timestamp, timestamp);
    writeGraphToNormalizedTables(this.database, graph, "subflow", id, timestamp);
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

  listSubflows(projectId: string): SubflowSummary[] {
    const rows = this.database
      .prepare(
        `SELECT id, project_id, name, description, tags_json, created_at, updated_at
         FROM subflows
         WHERE project_id = ?
         ORDER BY updated_at DESC, name ASC`,
      )
      .all(projectId) as SubflowRow[];
    return rows.map((row) => {
      const subflow = rowToSubflowSummary(row);
      return {
        ...subflow,
        used_by_count: this.getSubflowUsage(subflow.id).length,
      };
    });
  }

  getSubflow(subflowId: string): Subflow | null {
    const row = this.getSubflowRow(subflowId);
    if (!row) return null;
    const graph = assembleSubflowGraphFromTables(this.database, subflowId);
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

  getSubflowGraph(subflowId: string): WorkflowGraph | null {
    const fromTables = assembleSubflowGraphFromTables(this.database, subflowId);
    if (!fromTables) return null;
    const result = processGraphOnLoad(fromTables);
    if (result.migrationsApplied > 0 && !result.migrationFailed) {
      this.saveSubflowGraph(subflowId, result.graph);
    }
    return result.graph;
  }

  updateSubflow(
    subflowId: string,
    input: { name?: string; description?: string | null },
    now = new Date(),
  ): Subflow | null {
    const subflow = this.getSubflow(subflowId);
    if (!subflow) return null;
    const timestamp = now.toISOString();
    const name = input.name ?? subflow.name;
    const description =
      input.description === undefined ? subflow.description : input.description ?? "";
    this.database
      .prepare("UPDATE subflows SET name = ?, description = ?, updated_at = ? WHERE id = ?")
      .run(name, description, timestamp, subflowId);
    return {
      ...subflow,
      name,
      description,
      updated_at: timestamp,
    };
  }

  saveSubflowGraph(
    subflowId: string,
    graph: WorkflowGraph,
    options: { comment?: string | null; tag?: string | null } = {},
    now = new Date(),
  ) {
    const timestamp = now.toISOString();
    this.database
      .prepare("UPDATE subflows SET updated_at = ? WHERE id = ?")
      .run(timestamp, subflowId);
    writeGraphToNormalizedTables(this.database, graph, "subflow", subflowId, timestamp);
    snapshotRevision(this.database, "subflow", subflowId, graph, {
      createdAt: timestamp,
      comment: options.comment,
      tag: options.tag,
    });
  }

  duplicateSubflow(subflowId: string, name: string, now = new Date()): Subflow | null {
    const subflow = this.getSubflow(subflowId);
    if (!subflow) return null;
    return this.createSubflow(subflow.project_id, name, subflow.description, subflow.graph, now);
  }

  deleteSubflow(subflowId: string) {
    this.database.prepare("DELETE FROM subflows WHERE id = ?").run(subflowId);
  }

  getSubflowUsage(subflowId: string): SubflowUsage[] {
    return (
      this.database
        .prepare(
          `SELECT DISTINCT w.id AS workflow_id, w.name AS workflow_name
           FROM workflow_nodes n
           JOIN workflows w ON w.id = n.workflow_id
           WHERE n.subflow_ref = ?
           ORDER BY w.name ASC`,
        )
        .all(subflowId) as SubflowUsage[]
    );
  }

  private getSubflowRow(subflowId: string): SubflowRow | null {
    return (
      (this.database
        .prepare(
          `SELECT id, project_id, name, description, tags_json, created_at, updated_at
           FROM subflows
           WHERE id = ?`,
        )
        .get(subflowId) as SubflowRow | undefined) ?? null
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

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}
