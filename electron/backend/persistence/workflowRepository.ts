import type { DatabaseSync } from "node:sqlite";
import type {
  Workflow,
  WorkflowDetail,
  WorkflowGraph,
  WorkflowSettings,
  WorkflowSummary,
} from "../../../src/types/workflow.js";

type WorkflowRow = {
  id: string;
  name: string;
  description: string;
  tags_json: string;
  graph_json: string;
  settings_json: string | null;
  created_at: string;
  updated_at: string;
};

export class WorkflowRepository {
  constructor(private readonly database: DatabaseSync) {}

  createWorkflow(name: string, graph: WorkflowGraph, now = new Date()): Workflow {
    const timestamp = now.toISOString();
    const id = crypto.randomUUID();
    this.database
      .prepare(
        `INSERT INTO workflows (
          id,
          name,
          description,
          tags_json,
          graph_json,
          settings_json,
          created_at,
          updated_at
        ) VALUES (?, ?, '', '[]', ?, NULL, ?, ?)`,
      )
      .run(id, name, JSON.stringify(graph), timestamp, timestamp);

    return {
      id,
      name,
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  listWorkflows(): WorkflowSummary[] {
    return this.database
      .prepare(
        `SELECT id, name, created_at, updated_at
         FROM workflows
         ORDER BY updated_at DESC, name ASC`,
      )
      .all()
      .map((row) => rowToSummary(row as WorkflowRow));
  }

  getWorkflow(id: string): WorkflowDetail | null {
    const row = this.getWorkflowRow(id);
    if (!row) return null;

    return {
      workflow: rowToWorkflow(row),
      steps: [],
    };
  }

  getWorkflowSummary(id: string): WorkflowSummary | null {
    const row = this.getWorkflowRow(id);
    return row ? rowToSummary(row) : null;
  }

  renameWorkflow(id: string, name: string, now = new Date()) {
    this.database
      .prepare("UPDATE workflows SET name = ?, updated_at = ? WHERE id = ?")
      .run(name, now.toISOString(), id);
  }

  deleteWorkflow(id: string) {
    this.database.prepare("DELETE FROM workflows WHERE id = ?").run(id);
  }

  getWorkflowGraph(id: string): WorkflowGraph | null {
    const row = this.getWorkflowRow(id);
    return row ? parseJson<WorkflowGraph>(row.graph_json) : null;
  }

  saveWorkflowGraph(id: string, graph: WorkflowGraph, now = new Date()) {
    this.database
      .prepare("UPDATE workflows SET graph_json = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(graph), now.toISOString(), id);
  }

  getWorkflowSettings(id: string): WorkflowSettings | null {
    const row = this.getWorkflowRow(id);
    if (!row?.settings_json) return null;
    return parseJson<WorkflowSettings>(row.settings_json);
  }

  saveWorkflowSettings(id: string, settings: WorkflowSettings, now = new Date()) {
    const timestamp = now.toISOString();
    this.database
      .prepare(
        `UPDATE workflows
         SET name = ?, description = ?, tags_json = ?, settings_json = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        settings.general.name,
        settings.general.description,
        JSON.stringify(settings.general.tags),
        JSON.stringify(settings),
        timestamp,
        id,
      );
  }

  private getWorkflowRow(id: string): WorkflowRow | null {
    return (
      (this.database
        .prepare(
          `SELECT id, name, description, tags_json, graph_json, settings_json, created_at, updated_at
           FROM workflows
           WHERE id = ?`,
        )
        .get(id) as WorkflowRow | undefined) ?? null
    );
  }
}

function rowToWorkflow(row: WorkflowRow): Workflow {
  return {
    id: row.id,
    name: row.name,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rowToSummary(row: WorkflowRow): WorkflowSummary {
  return {
    ...rowToWorkflow(row),
    step_count: 0,
  };
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}
