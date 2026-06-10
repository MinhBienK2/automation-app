import type { DatabaseSync } from "node:sqlite";
import type {
  Project,
  ProjectEnvironment,
  ProjectEnvironmentInput,
  Subflow,
  SubflowSummary,
  SubflowUsage,
  Workflow,
  WorkflowDetail,
  WorkflowGraph,
  WorkflowSettings,
  WorkflowSummary,
} from "../../../src/types/workflow.js";

type WorkflowRow = {
  id: string;
  project_id: string | null;
  environment_id: string | null;
  environment_name?: string | null;
  name: string;
  description: string;
  tags_json: string;
  graph_json: string;
  settings_json: string | null;
  created_at: string;
  updated_at: string;
};

type ProjectRow = {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

type ProjectEnvironmentRow = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  is_default: number;
  browser_launch_json: string;
  created_at: string;
  updated_at: string;
};

type SubflowRow = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  tags_json: string;
  graph_json: string;
  created_at: string;
  updated_at: string;
};

export class WorkflowRepository {
  constructor(private readonly database: DatabaseSync) {}

  createProject(name: string, description = "", now = new Date()): Project {
    const timestamp = now.toISOString();
    const id = crypto.randomUUID();
    this.database
      .prepare(
        `INSERT INTO projects (id, name, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(id, name, description, timestamp, timestamp);
    return { id, name, description, created_at: timestamp, updated_at: timestamp };
  }

  listProjects(): Project[] {
    return this.database
      .prepare(
        `SELECT id, name, description, created_at, updated_at
         FROM projects
         ORDER BY created_at ASC, name ASC`,
      )
      .all()
      .map((row) => rowToProject(row as ProjectRow));
  }

  getProject(projectId: string): Project | null {
    const row = this.database
      .prepare(
        `SELECT id, name, description, created_at, updated_at
         FROM projects
         WHERE id = ?`,
      )
      .get(projectId) as ProjectRow | undefined;
    return row ? rowToProject(row) : null;
  }

  updateProject(
    projectId: string,
    input: { name?: string; description?: string | null },
    now = new Date(),
  ): Project | null {
    const current = this.getProject(projectId);
    if (!current) return null;
    const timestamp = now.toISOString();
    const next: Project = {
      ...current,
      name: input.name ?? current.name,
      description: input.description ?? current.description,
      updated_at: timestamp,
    };
    this.database
      .prepare(
        `UPDATE projects
         SET name = ?, description = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(next.name, next.description, timestamp, projectId);
    return next;
  }

  deleteProject(projectId: string) {
    this.database.prepare("DELETE FROM workflows WHERE project_id = ?").run(projectId);
    this.database.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
  }

  createProjectEnvironment(
    projectId: string,
    input: ProjectEnvironmentInput & { browser_launch: ProjectEnvironment["browser_launch"] },
    now = new Date(),
  ): ProjectEnvironment {
    const timestamp = now.toISOString();
    const id = crypto.randomUUID();
    if (input.is_default) {
      this.database
        .prepare("UPDATE project_environments SET is_default = 0 WHERE project_id = ?")
        .run(projectId);
    }
    this.database
      .prepare(
        `INSERT INTO project_environments (
          id,
          project_id,
          name,
          description,
          is_default,
          browser_launch_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        projectId,
        input.name,
        input.description ?? "",
        input.is_default ? 1 : 0,
        JSON.stringify(input.browser_launch),
        timestamp,
        timestamp,
      );
    return {
      id,
      project_id: projectId,
      name: input.name,
      description: input.description ?? "",
      is_default: Boolean(input.is_default),
      browser_launch: input.browser_launch,
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  listProjectEnvironments(projectId: string): ProjectEnvironment[] {
    return this.database
      .prepare(
        `SELECT id, project_id, name, description, is_default, browser_launch_json, created_at, updated_at
         FROM project_environments
         WHERE project_id = ?
         ORDER BY is_default DESC, updated_at DESC, name ASC`,
      )
      .all(projectId)
      .map((row) => rowToProjectEnvironment(row as ProjectEnvironmentRow));
  }

  getProjectEnvironment(environmentId: string): ProjectEnvironment | null {
    const row = this.database
      .prepare(
        `SELECT id, project_id, name, description, is_default, browser_launch_json, created_at, updated_at
         FROM project_environments
         WHERE id = ?`,
      )
      .get(environmentId) as ProjectEnvironmentRow | undefined;
    return row ? rowToProjectEnvironment(row) : null;
  }

  getDefaultProjectEnvironment(projectId: string): ProjectEnvironment | null {
    const row = this.database
      .prepare(
        `SELECT id, project_id, name, description, is_default, browser_launch_json, created_at, updated_at
         FROM project_environments
         WHERE project_id = ? AND is_default = 1
         ORDER BY updated_at DESC
         LIMIT 1`,
      )
      .get(projectId) as ProjectEnvironmentRow | undefined;
    return row ? rowToProjectEnvironment(row) : null;
  }

  updateProjectEnvironment(
    environmentId: string,
    input: Partial<ProjectEnvironmentInput>,
    now = new Date(),
  ): ProjectEnvironment | null {
    const current = this.getProjectEnvironment(environmentId);
    if (!current) return null;
    const timestamp = now.toISOString();
    const next: ProjectEnvironment = {
      ...current,
      name: input.name ?? current.name,
      description: input.description ?? current.description,
      is_default: input.is_default ?? current.is_default,
      browser_launch: input.browser_launch ?? current.browser_launch,
      updated_at: timestamp,
    };
    if (next.is_default) {
      this.database
        .prepare("UPDATE project_environments SET is_default = 0 WHERE project_id = ?")
        .run(current.project_id);
    }
    this.database
      .prepare(
        `UPDATE project_environments
         SET name = ?, description = ?, is_default = ?, browser_launch_json = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        next.name,
        next.description,
        next.is_default ? 1 : 0,
        JSON.stringify(next.browser_launch),
        timestamp,
        environmentId,
      );
    return next;
  }

  createWorkflow(
    name: string,
    graph: WorkflowGraph,
    now = new Date(),
    ownership: { projectId?: string | null; environmentId?: string | null } = {},
  ): Workflow {
    const timestamp = now.toISOString();
    const id = crypto.randomUUID();
    this.database
      .prepare(
        `INSERT INTO workflows (
          id,
          project_id,
          environment_id,
          name,
          description,
          tags_json,
          graph_json,
          settings_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, '', '[]', ?, NULL, ?, ?)`,
      )
      .run(
        id,
        ownership.projectId ?? null,
        ownership.environmentId ?? null,
        name,
        JSON.stringify(graph),
        timestamp,
        timestamp,
      );

    return {
      id,
      name,
      project_id: ownership.projectId ?? null,
      environment_id: ownership.environmentId ?? null,
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  listWorkflows(): WorkflowSummary[] {
    return this.database
      .prepare(
        `SELECT workflows.id,
                workflows.project_id,
                workflows.environment_id,
                project_environments.name AS environment_name,
                workflows.name,
                workflows.created_at,
                workflows.updated_at
         FROM workflows
         LEFT JOIN project_environments ON project_environments.id = workflows.environment_id
         ORDER BY workflows.updated_at DESC, workflows.name ASC`,
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

  assignWorkflowProject(
    id: string,
    projectId: string,
    now = new Date(),
  ) {
    this.database
      .prepare(
        "UPDATE workflows SET project_id = ?, environment_id = NULL, updated_at = ? WHERE id = ?",
      )
      .run(projectId, now.toISOString(), id);
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
          graph_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, '[]', ?, ?, ?)`,
      )
      .run(id, projectId, name, description, JSON.stringify(graph), timestamp, timestamp);
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
        `SELECT id, project_id, name, description, tags_json, graph_json, created_at, updated_at
         FROM subflows
         WHERE project_id = ?
         ORDER BY updated_at DESC, name ASC`,
      )
      .all(projectId) as SubflowRow[];
    return rows.map((row) => {
      const subflow = rowToSubflow(row);
      const { graph: _graph, ...summary } = subflow;
      return {
        ...summary,
        used_by_count: this.getSubflowUsage(subflow.id).length,
      };
    });
  }

  getSubflow(subflowId: string): Subflow | null {
    const row = this.getSubflowRow(subflowId);
    return row ? rowToSubflow(row) : null;
  }

  getSubflowGraph(subflowId: string): WorkflowGraph | null {
    const row = this.getSubflowRow(subflowId);
    return row ? parseJson<WorkflowGraph>(row.graph_json) : null;
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

  saveSubflowGraph(subflowId: string, graph: WorkflowGraph, now = new Date()) {
    this.database
      .prepare("UPDATE subflows SET graph_json = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(graph), now.toISOString(), subflowId);
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
    const subflow = this.getSubflow(subflowId);
    if (!subflow) return [];
    return (this.database
      .prepare(
        `SELECT id, name, graph_json
         FROM workflows
         WHERE project_id = ?
         ORDER BY name ASC`,
      )
      .all(subflow.project_id) as Array<Pick<WorkflowRow, "id" | "name" | "graph_json">>)
      .filter((row) => workflowCallsSubflow(row.graph_json, subflowId))
      .map((row) => ({ workflow_id: row.id, workflow_name: row.name }));
  }

  private getWorkflowRow(id: string): WorkflowRow | null {
    return (
      (this.database
        .prepare(
          `SELECT workflows.id,
                  workflows.project_id,
                  workflows.environment_id,
                  project_environments.name AS environment_name,
                  workflows.name,
                  workflows.description,
                  workflows.tags_json,
                  workflows.graph_json,
                  workflows.settings_json,
                  workflows.created_at,
                  workflows.updated_at
           FROM workflows
           LEFT JOIN project_environments ON project_environments.id = workflows.environment_id
           WHERE workflows.id = ?`,
        )
        .get(id) as WorkflowRow | undefined) ?? null
    );
  }

  private getSubflowRow(subflowId: string): SubflowRow | null {
    return (
      (this.database
        .prepare(
          `SELECT id, project_id, name, description, tags_json, graph_json, created_at, updated_at
           FROM subflows
           WHERE id = ?`,
        )
        .get(subflowId) as SubflowRow | undefined) ?? null
    );
  }
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rowToProjectEnvironment(row: ProjectEnvironmentRow): ProjectEnvironment {
  return {
    id: row.id,
    project_id: row.project_id,
    name: row.name,
    description: row.description,
    is_default: Boolean(row.is_default),
    browser_launch: parseJson<ProjectEnvironment["browser_launch"]>(row.browser_launch_json),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rowToWorkflow(row: WorkflowRow): Workflow {
  return {
    id: row.id,
    name: row.name,
    project_id: row.project_id,
    environment_id: row.environment_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rowToSummary(row: WorkflowRow): WorkflowSummary {
  return {
    ...rowToWorkflow(row),
    step_count: 0,
    environment_name: row.environment_name ?? null,
  };
}

function rowToSubflow(row: SubflowRow): Subflow {
  return {
    id: row.id,
    project_id: row.project_id,
    name: row.name,
    description: row.description,
    tags: parseJson<string[]>(row.tags_json),
    graph: parseJson<WorkflowGraph>(row.graph_json),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

function workflowCallsSubflow(graphJson: string, subflowId: string): boolean {
  try {
    const graph = parseJson<WorkflowGraph>(graphJson);
    return graph.nodes.some((node) => {
      if (node.node_type !== "call_subflow") return false;
      const config = node.config as { subflow_id?: unknown };
      return config.subflow_id === subflowId;
    });
  } catch {
    return false;
  }
}
