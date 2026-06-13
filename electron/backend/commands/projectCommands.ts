import type {
  Project,
  ProjectEnvironment,
  ProjectEnvironmentInput,
  Workflow,
} from "../../../src/types/workflow.js";
import { commandError } from "../commandHelpers.js";
import type { CommandDeps } from "./types.js";
import nodeFs from "node:fs";
import path from "node:path";
import { sanitizePathSegment } from "../evidence/artifacts.js";
import { projectEnvironmentProfileKey } from "../projects/projectCommandCascades.js";

export function createProjectCommands(deps: CommandDeps) {
  const {
    repository,
    projectCascades,
    requireProject,
    requireProjectEnvironment,
    ensureDefaultProjectEnvironment,
    createWorkflow,
    requireWorkflow,
  } = deps;

  return {
    listProjects(): Project[] {
      return repository.listProjects();
    },

    createProject(input: { name: string; description?: string | null }): Project {
      const name = input.name.trim();
      if (!name) throw commandError("Project name is required", "name");
      deps.context.database.exec("BEGIN IMMEDIATE");
      try {
        const project = repository.createProject(name, input.description?.trim() ?? "");
        ensureDefaultProjectEnvironment(project);
        createWorkflow("Main", { project_id: project.id });
        deps.context.database.exec("COMMIT");
        return project;
      } catch (error) {
        deps.context.database.exec("ROLLBACK");
        throw error;
      }
    },

    updateProject(
      projectId: string,
      input: { name?: string; description?: string | null },
    ): Project {
      requireProject(projectId);
      if (input.name != null && !input.name.trim()) {
        throw commandError("Project name is required", "name");
      }
      const updated = repository.updateProject(projectId, {
        name: input.name?.trim(),
        description:
          input.description === undefined ? undefined : input.description?.trim() ?? "",
      });
      if (!updated) throw commandError("Project not found", "projectId");
      return updated;
    },

    duplicateProject(projectId: string): Project {
      return projectCascades.duplicateProjectCascade(projectId);
    },

    deleteProject(projectId: string) {
      projectCascades.deleteProjectCascade(projectId);
    },

    listProjectEnvironments(projectId: string): ProjectEnvironment[] {
      requireProject(projectId);
      return repository.listProjectEnvironments(projectId);
    },

    createProjectEnvironment(
      projectId: string,
      input: ProjectEnvironmentInput,
    ): ProjectEnvironment {
      requireProject(projectId);
      const name = input.name.trim();
      if (!name) throw commandError("Profile name is required", "name");
      
      // Note: defaultEnvironmentBrowserLaunch logic is provided by orchestrator/deps
      // via duplicateBrowserProfileLaunch or default settings helper
      const now = new Date().toISOString();
      const defaultLaunch = deps.settingsService.defaultWorkflowSettings(
        {
          id: `environment-${require("node:crypto").randomUUID()}`,
          name,
          created_at: now,
          updated_at: now,
        },
        { randomizeIdentity: true },
      ).browser_launch;

      return repository.createProjectEnvironment(projectId, {
        name,
        description: input.description?.trim() ?? "",
        is_default: Boolean(input.is_default),
        browser_launch: input.browser_launch ?? defaultLaunch,
      });
    },

    updateProjectEnvironment(
      environmentId: string,
      input: Partial<ProjectEnvironmentInput>,
    ): ProjectEnvironment {
      const current = requireProjectEnvironment(environmentId);
      if (input.name != null && !input.name.trim()) {
        throw commandError("Profile name is required", "name");
      }
      const updated = repository.updateProjectEnvironment(environmentId, {
        ...input,
        name: input.name?.trim(),
        description: input.description?.trim(),
      });
      if (!updated) throw commandError("Project environment not found", "environmentId");
      if (!repository.getDefaultProjectEnvironment(current.project_id)) {
        repository.updateProjectEnvironment(updated.id, { is_default: true });
        return requireProjectEnvironment(updated.id);
      }
      return updated;
    },

    deleteProjectEnvironment(environmentId: string) {
      const environment = requireProjectEnvironment(environmentId);
      const usage = repository.listWorkflowsUsingEnvironment(environment.id);
      if (usage.length > 0) {
        throw commandError("Browser profile is used by workflows", "environmentId");
      }
      const profileDir = projectEnvironmentProfileKey(environment);
      repository.deleteProjectEnvironment(environment.id);
      if (profileDir) {
        nodeFs.rmSync(path.join(deps.context.appPaths.browserProfilesDir, sanitizePathSegment(profileDir)), {
          recursive: true,
          force: true,
        });
      }
    },

    setWorkflowProjectEnvironment(
      workflowId: string,
      environmentId: string,
    ): Workflow {
      const workflow = requireWorkflow(workflowId);
      const environment = requireProjectEnvironment(environmentId);
      if (!workflow.project_id || workflow.project_id !== environment.project_id) {
        throw commandError("Browser profile must belong to the workflow project", "environmentId");
      }
      const updated = repository.assignWorkflowProjectEnvironment(workflow.id, environment.id);
      if (!updated) throw commandError("Workflow not found", "workflowId");
      return updated;
    },

    resetProjectEnvironmentBrowserIdentity(environmentId: string): ProjectEnvironment {
      return projectCascades.rotateProjectEnvironmentBrowserIdentity(environmentId);
    },
  };
}
