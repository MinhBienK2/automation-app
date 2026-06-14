import type {
  Project,
  BrowserProfile,
  BrowserProfileInput,
  Workflow,
} from "../../../src/types/workflow.js";
import { commandError } from "../commandHelpers.js";
import type { CommandDeps } from "./types.js";
import { randomUUID } from "node:crypto";
import nodeFs from "node:fs";
import path from "node:path";
import { sanitizePathSegment } from "../evidence/artifacts.js";
import { getBrowserProfileKey } from "../projects/projectCommandCascades.js";

export function createProjectCommands(deps: CommandDeps) {
  const {
    repository,
    projectCascades,
    requireProject,
    requireBrowserProfile,
    ensureDefaultBrowserProfile,
    createWorkflow,
    requireWorkflow,
  } = deps;

  function listProjects(): Project[] {
    return repository.listProjects();
  }

  function createProject(input: { name: string; description?: string | null }): Project {
    const name = input.name.trim();
    if (!name) throw commandError("Project name is required", "name");
    deps.context.database.exec("BEGIN IMMEDIATE");
    try {
      const project = repository.createProject(name, input.description?.trim() ?? "");
      ensureDefaultBrowserProfile(project);
      createWorkflow("Main", { project_id: project.id });
      deps.context.database.exec("COMMIT");
      return project;
    } catch (error) {
      deps.context.database.exec("ROLLBACK");
      throw error;
    }
  }

  function updateProject(
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
  }

  function duplicateProject(projectId: string): Project {
    return projectCascades.duplicateProjectCascade(projectId);
  }

  function deleteProject(projectId: string) {
    projectCascades.deleteProjectCascade(projectId);
  }

  function listBrowserProfiles(projectId: string): BrowserProfile[] {
    requireProject(projectId);
    return repository.listBrowserProfiles(projectId);
  }

  function createBrowserProfile(
    projectId: string,
    input: BrowserProfileInput,
  ): BrowserProfile {
    requireProject(projectId);
    const name = input.name.trim();
    if (!name) throw commandError("Profile name is required", "name");
    
    const now = new Date().toISOString();
    const defaultLaunch = deps.settingsService.defaultWorkflowSettings(
      {
        id: `profile-${randomUUID()}`,
        name,
        created_at: now,
        updated_at: now,
      },
      { randomizeIdentity: true },
    ).browser_launch;

    return repository.createBrowserProfile(projectId, {
      name,
      description: input.description?.trim() ?? "",
      is_default: Boolean(input.is_default),
      browser_launch: input.browser_launch ?? defaultLaunch,
    });
  }

  function updateBrowserProfile(
    profileId: string,
    input: Partial<BrowserProfileInput>,
  ): BrowserProfile {
    const current = requireBrowserProfile(profileId);
    if (input.name != null && !input.name.trim()) {
      throw commandError("Profile name is required", "name");
    }
    const updated = repository.updateBrowserProfile(profileId, {
      ...input,
      name: input.name?.trim(),
      description: input.description?.trim(),
    });
    if (!updated) throw commandError("Browser profile not found", "profileId");
    if (!repository.getDefaultBrowserProfile(current.project_id)) {
      repository.updateBrowserProfile(updated.id, { is_default: true });
      return requireBrowserProfile(updated.id);
    }
    return updated;
  }

  function deleteBrowserProfile(profileId: string) {
    const profile = requireBrowserProfile(profileId);
    const usage = repository.listWorkflowsUsingBrowserProfile(profile.id);
    if (usage.length > 0) {
      throw commandError("Browser profile is used by workflows", "profileId");
    }
    const profileDir = getBrowserProfileKey(profile);
    repository.deleteBrowserProfile(profile.id);
    if (profileDir) {
      nodeFs.rmSync(path.join(deps.context.appPaths.browserProfilesDir, sanitizePathSegment(profileDir)), {
        recursive: true,
        force: true,
      });
    }
  }

  function setWorkflowBrowserProfile(
    workflowId: string,
    profileId: string,
  ): Workflow {
    const workflow = requireWorkflow(workflowId);
    const profile = requireBrowserProfile(profileId);
    if (!workflow.project_id || workflow.project_id !== profile.project_id) {
      throw commandError("Browser profile must belong to the workflow project", "profileId");
    }
    const updated = repository.assignWorkflowBrowserProfile(workflow.id, profile.id);
    if (!updated) throw commandError("Workflow not found", "workflowId");
    return updated;
  }

  function resetBrowserProfileIdentity(profileId: string): BrowserProfile {
    return projectCascades.rotateBrowserProfileIdentity(profileId);
  }

  return {
    listProjects,
    createProject,
    updateProject,
    duplicateProject,
    deleteProject,
    listBrowserProfiles,
    createBrowserProfile,
    updateBrowserProfile,
    deleteBrowserProfile,
    setWorkflowBrowserProfile,
    resetBrowserProfileIdentity,
  };
}
