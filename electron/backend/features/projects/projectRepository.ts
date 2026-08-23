import type { DbAdapter } from "../../db/dbAdapter.js";
import type {
  Project,
  BrowserProfile,
  BrowserProfileInput,
  WorkflowSummary,
} from "../../../../src/types/workflow.js";

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
  surface?: string | null;
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
  constructor(private readonly database: DbAdapter) {}

  async createProject(name: string, description = "", now = new Date()): Promise<Project> {
    const timestamp = now.toISOString();
    const id = crypto.randomUUID();
    await this.database.execute(
      `INSERT INTO projects (id, name, description, created_at, updated_at, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, name, description, timestamp, timestamp, this.database.ownerId],
    );
    return { id, name, description, created_at: timestamp, updated_at: timestamp };
  }

  async listProjects(): Promise<Project[]> {
    const rows = await this.database.query(
      `SELECT id, name, description, created_at, updated_at
       FROM projects
       WHERE owner_id = $1
       ORDER BY created_at ASC, name ASC`,
      [this.database.ownerId],
    );
    return rows.map((row) => rowToProject(row as ProjectRow));
  }

  async getProject(projectId: string): Promise<Project | null> {
    const row = await this.database.queryOne(
      `SELECT id, name, description, created_at, updated_at
       FROM projects
       WHERE id = $1 AND owner_id = $2`,
      [projectId, this.database.ownerId],
    ) as ProjectRow | null;
    return row ? rowToProject(row) : null;
  }

  async updateProject(
    projectId: string,
    input: { name?: string; description?: string | null },
    now = new Date(),
  ): Promise<Project | null> {
    const current = await this.getProject(projectId);
    if (!current) return null;
    const timestamp = now.toISOString();
    const next: Project = {
      ...current,
      name: input.name ?? current.name,
      description: input.description ?? current.description,
      updated_at: timestamp,
    };
    await this.database.execute(
      `UPDATE projects
       SET name = $1, description = $2, updated_at = $3
       WHERE id = $4 AND owner_id = $5`,
      [next.name, next.description, timestamp, projectId, this.database.ownerId],
    );
    return next;
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.database.transaction(async (tx) => {
      await tx.execute(
        "DELETE FROM workflows WHERE project_id = $1 AND owner_id = $2",
        [projectId, tx.ownerId],
      );
      await tx.execute(
        "DELETE FROM projects WHERE id = $1 AND owner_id = $2",
        [projectId, tx.ownerId],
      );
    });
  }

  async createBrowserProfile(
    projectId: string,
    input: BrowserProfileInput & { browser_launch: BrowserProfile["browser_launch"] },
    now = new Date(),
  ): Promise<BrowserProfile> {
    const timestamp = now.toISOString();
    const id = crypto.randomUUID();
    
    await this.database.transaction(async (tx) => {
      if (input.is_default) {
        await tx.execute(
          "UPDATE browser_profiles SET is_default = 0 WHERE project_id = $1 AND owner_id = $2",
          [projectId, tx.ownerId],
        );
      }
      await tx.execute(
        `INSERT INTO browser_profiles (
          id,
          project_id,
          name,
          description,
          is_default,
          browser_launch_json,
          environment_json,
          created_at,
          updated_at,
          owner_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          id,
          projectId,
          input.name,
          input.description ?? "",
          input.is_default ? 1 : 0,
          JSON.stringify(input.browser_launch),
          JSON.stringify(input.environment ?? { variables: [] }),
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
      is_default: Boolean(input.is_default),
      browser_launch: input.browser_launch,
      environment: input.environment ?? { variables: [] },
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  async listBrowserProfiles(projectId: string): Promise<BrowserProfile[]> {
    const rows = await this.database.query(
      `SELECT id, project_id, name, description, is_default, browser_launch_json, environment_json, created_at, updated_at
       FROM browser_profiles
       WHERE project_id = $1 AND owner_id = $2
       ORDER BY is_default DESC, updated_at DESC, name ASC`,
      [projectId, this.database.ownerId],
    );
    return rows.map((row) => rowToBrowserProfile(row as BrowserProfileRow));
  }

  async getBrowserProfile(profileId: string): Promise<BrowserProfile | null> {
    const row = await this.database.queryOne(
      `SELECT id, project_id, name, description, is_default, browser_launch_json, environment_json, created_at, updated_at
       FROM browser_profiles
       WHERE id = $1 AND owner_id = $2`,
      [profileId, this.database.ownerId],
    ) as BrowserProfileRow | null;
    return row ? rowToBrowserProfile(row) : null;
  }

  async getDefaultBrowserProfile(projectId: string): Promise<BrowserProfile | null> {
    const row = await this.database.queryOne(
      `SELECT id, project_id, name, description, is_default, browser_launch_json, environment_json, created_at, updated_at
       FROM browser_profiles
       WHERE project_id = $1 AND is_default = 1 AND owner_id = $2
       ORDER BY updated_at DESC
       LIMIT 1`,
      [projectId, this.database.ownerId],
    ) as BrowserProfileRow | null;
    return row ? rowToBrowserProfile(row) : null;
  }

  async updateBrowserProfile(
    profileId: string,
    input: Partial<BrowserProfileInput>,
    now = new Date(),
  ): Promise<BrowserProfile | null> {
    const current = await this.getBrowserProfile(profileId);
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

    await this.database.transaction(async (tx) => {
      if (next.is_default) {
        await tx.execute(
          "UPDATE browser_profiles SET is_default = 0 WHERE project_id = $1 AND owner_id = $2",
          [current.project_id, tx.ownerId],
        );
      }
      await tx.execute(
        `UPDATE browser_profiles
         SET name = $1, description = $2, is_default = $3, browser_launch_json = $4, environment_json = $5, updated_at = $6
         WHERE id = $7 AND owner_id = $8`,
        [
          next.name,
          next.description,
          next.is_default ? 1 : 0,
          JSON.stringify(next.browser_launch),
          JSON.stringify(next.environment ?? { variables: [] }),
          timestamp,
          profileId,
          tx.ownerId,
        ],
      );
    });

    return next;
  }

  async deleteBrowserProfile(profileId: string): Promise<void> {
    await this.database.execute(
      "DELETE FROM browser_profiles WHERE id = $1 AND owner_id = $2",
      [profileId, this.database.ownerId],
    );
  }

  async listWorkflowsUsingBrowserProfile(profileId: string): Promise<WorkflowSummary[]> {
    const rows = await this.database.query(
      `SELECT workflows.id,
              workflows.project_id,
              workflows.browser_profile_id,
              browser_profiles.name AS browser_profile_name,
              workflows.name,
              workflows.surface,
              workflows.created_at,
              workflows.updated_at
       FROM workflows
       LEFT JOIN browser_profiles ON browser_profiles.id = workflows.browser_profile_id
       WHERE workflows.browser_profile_id = $1 AND workflows.owner_id = $2
       ORDER BY workflows.name ASC`,
      [profileId, this.database.ownerId],
    );
    return rows.map((row) => rowToSummary(row as WorkflowRow));
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
    surface: row.surface === "desktop" ? "desktop" : "web",
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
