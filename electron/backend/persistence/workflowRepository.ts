import type { DatabaseSync } from "node:sqlite";
import type {
  Project,
  BrowserProfile,
  BrowserProfileInput,
  Subflow,
  SubflowSummary,
  SubflowUsage,
  Workflow,
  WorkflowDetail,
  WorkflowGraph,
  WorkflowSettings,
  WorkflowSummary,
} from "../../../src/types/workflow.js";
import { processGraphOnLoad } from "./graphLoader.js";

type WorkflowRow = {
  id: string;
  project_id: string | null;
  browser_profile_id: string | null;
  browser_profile_name?: string | null;
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

type BrowserProfileRow = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  is_default: number;
  browser_launch_json: string;
  environment_json: string;
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

  createBrowserProfile(
    projectId: string,
    input: BrowserProfileInput & { browser_launch: BrowserProfile["browser_launch"] },
    now = new Date(),
  ): BrowserProfile {
    const timestamp = now.toISOString();
    const id = crypto.randomUUID();
    if (input.is_default) {
      this.database
        .prepare("UPDATE browser_profiles SET is_default = 0 WHERE project_id = ?")
        .run(projectId);
    }
    // Write to browser_profiles
    this.database
      .prepare(
        `INSERT INTO browser_profiles (
          id,
          project_id,
          name,
          description,
          is_default,
          browser_launch_json,
          environment_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        projectId,
        input.name,
        input.description ?? "",
        input.is_default ? 1 : 0,
        JSON.stringify(input.browser_launch),
        JSON.stringify(input.environment ?? { variables: [] }),
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
      environment: input.environment ?? { variables: [] },
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  listBrowserProfiles(projectId: string): BrowserProfile[] {
    return this.database
      .prepare(
        `SELECT id, project_id, name, description, is_default, browser_launch_json, environment_json, created_at, updated_at
         FROM browser_profiles
         WHERE project_id = ?
         ORDER BY is_default DESC, updated_at DESC, name ASC`,
      )
      .all(projectId)
      .map((row) => rowToBrowserProfile(row as BrowserProfileRow));
  }

  getBrowserProfile(profileId: string): BrowserProfile | null {
    const row = this.database
      .prepare(
        `SELECT id, project_id, name, description, is_default, browser_launch_json, environment_json, created_at, updated_at
         FROM browser_profiles
         WHERE id = ?`,
      )
      .get(profileId) as BrowserProfileRow | undefined;
    return row ? rowToBrowserProfile(row) : null;
  }

  getDefaultBrowserProfile(projectId: string): BrowserProfile | null {
    const row = this.database
      .prepare(
        `SELECT id, project_id, name, description, is_default, browser_launch_json, environment_json, created_at, updated_at
         FROM browser_profiles
         WHERE project_id = ? AND is_default = 1
         ORDER BY updated_at DESC
         LIMIT 1`,
      )
      .get(projectId) as BrowserProfileRow | undefined;
    return row ? rowToBrowserProfile(row) : null;
  }

  updateBrowserProfile(
    profileId: string,
    input: Partial<BrowserProfileInput>,
    now = new Date(),
  ): BrowserProfile | null {
    const current = this.getBrowserProfile(profileId);
    if (!current) return null;
    const timestamp = now.toISOString();
    const next: BrowserProfile = {
      ...current,
      name: input.name ?? current.name,
      description: input.description ?? current.description,
      is_default: input.is_default ?? current.is_default,
      browser_launch: input.browser_launch ?? current.browser_launch,
      environment: input.environment !== undefined ? (input.environment ?? { variables: [] }) : current.environment,
      updated_at: timestamp,
    };
    if (next.is_default) {
      this.database
        .prepare("UPDATE browser_profiles SET is_default = 0 WHERE project_id = ?")
        .run(current.project_id);
    }
    // Update browser_profiles
    this.database
      .prepare(
        `UPDATE browser_profiles
         SET name = ?, description = ?, is_default = ?, browser_launch_json = ?, environment_json = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        next.name,
        next.description,
        next.is_default ? 1 : 0,
        JSON.stringify(next.browser_launch),
        JSON.stringify(next.environment ?? { variables: [] }),
        timestamp,
        profileId,
      );
    return next;
  }

  deleteBrowserProfile(profileId: string) {
    this.database.prepare("DELETE FROM browser_profiles WHERE id = ?").run(profileId);
  }

  listWorkflowsUsingBrowserProfile(profileId: string): WorkflowSummary[] {
    return this.database
      .prepare(
        `SELECT workflows.id,
                workflows.project_id,
                workflows.browser_profile_id,
                browser_profiles.name AS browser_profile_name,
                workflows.name,
                workflows.created_at,
                workflows.updated_at
         FROM workflows
         LEFT JOIN browser_profiles ON browser_profiles.id = workflows.browser_profile_id
         WHERE workflows.browser_profile_id = ?
         ORDER BY workflows.name ASC`,
      )
      .all(profileId)
      .map((row) => rowToSummary(row as WorkflowRow));
  }

  createWorkflow(
    name: string,
    graph: WorkflowGraph,
    now = new Date(),
    ownership: { projectId?: string | null; browserProfileId?: string | null } = {},
  ): Workflow {
    const timestamp = now.toISOString();
    const id = crypto.randomUUID();
    const profileId = ownership.browserProfileId ?? null;
    this.database
      .prepare(
        `INSERT INTO workflows (
          id,
          project_id,
          browser_profile_id,
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
        profileId,
        name,
        JSON.stringify(graph),
        timestamp,
        timestamp,
      );

    return {
      id,
      name,
      project_id: ownership.projectId ?? null,
      browser_profile_id: profileId,
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  listWorkflows(): WorkflowSummary[] {
    return this.database
      .prepare(
        `SELECT workflows.id,
                workflows.project_id,
                workflows.browser_profile_id,
                browser_profiles.name AS browser_profile_name,
                workflows.name,
                workflows.created_at,
                workflows.updated_at
         FROM workflows
         LEFT JOIN browser_profiles ON browser_profiles.id = workflows.browser_profile_id
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
        "UPDATE workflows SET project_id = ?, browser_profile_id = NULL, updated_at = ? WHERE id = ?",
      )
      .run(projectId, now.toISOString(), id);
  }

  assignWorkflowBrowserProfile(
    id: string,
    profileId: string,
    now = new Date(),
  ): Workflow | null {
    const workflow = this.getWorkflow(id)?.workflow ?? null;
    if (!workflow) return null;
    this.database
      .prepare("UPDATE workflows SET browser_profile_id = ?, updated_at = ? WHERE id = ?")
      .run(profileId, now.toISOString(), id);
    return this.getWorkflow(id)?.workflow ?? null;
  }

  deleteWorkflow(id: string) {
    this.database.prepare("DELETE FROM workflows WHERE id = ?").run(id);
  }

  getWorkflowGraph(id: string): WorkflowGraph | null {
    const row = this.getWorkflowRow(id);
    if (!row) return null;
    const result = processGraphOnLoad(parseJson<WorkflowGraph>(row.graph_json));
    if (result.migrationsApplied > 0 && !result.migrationFailed) {
      this.saveWorkflowGraph(id, result.graph);
    }
    return result.graph;
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
    if (!row) return null;
    const result = processGraphOnLoad(parseJson<WorkflowGraph>(row.graph_json));
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
                  workflows.browser_profile_id,
                  browser_profiles.name AS browser_profile_name,
                  workflows.name,
                  workflows.description,
                  workflows.tags_json,
                  workflows.graph_json,
                  workflows.settings_json,
                  workflows.created_at,
                  workflows.updated_at
           FROM workflows
           LEFT JOIN browser_profiles ON browser_profiles.id = workflows.browser_profile_id
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

function rowToBrowserProfile(row: BrowserProfileRow): BrowserProfile {
  return {
    id: row.id,
    project_id: row.project_id,
    name: row.name,
    description: row.description,
    is_default: Boolean(row.is_default),
    browser_launch: parseJson<BrowserProfile["browser_launch"]>(row.browser_launch_json),
    environment: row.environment_json ? parseJson<BrowserProfile["environment"]>(row.environment_json) : { variables: [] },
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rowToWorkflow(row: WorkflowRow): Workflow {
  return {
    id: row.id,
    name: row.name,
    project_id: row.project_id,
    browser_profile_id: row.browser_profile_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rowToSummary(row: WorkflowRow): WorkflowSummary {
  return {
    ...rowToWorkflow(row),
    step_count: 0,
    browser_profile_name: row.browser_profile_name ?? null,
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
