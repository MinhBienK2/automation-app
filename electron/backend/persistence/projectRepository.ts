import type { DatabaseSync } from "node:sqlite";
import type {
  Project,
  BrowserProfile,
  BrowserProfileInput,
  WorkflowSummary,
} from "../../../src/types/workflow.js";

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

type WorkflowRow = {
  id: string;
  project_id: string | null;
  browser_profile_id: string | null;
  browser_profile_name?: string | null;
  name: string;
  description: string;
  tags_json: string;
  settings_json: string | null;
  created_at: string;
  updated_at: string;
};

export class ProjectRepository {
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

function rowToSummary(row: WorkflowRow): WorkflowSummary {
  return {
    id: row.id,
    name: row.name,
    project_id: row.project_id,
    browser_profile_id: row.browser_profile_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    step_count: 0,
    browser_profile_name: row.browser_profile_name ?? null,
  };
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}
