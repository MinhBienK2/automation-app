import type {
  ProjectEnvironment,
  ProjectEnvironmentInput,
} from "../../types/workflow";
import {
  createProjectEnvironment as createProjectEnvironmentCommand,
  deleteProjectEnvironment as deleteProjectEnvironmentCommand,
  listProjectEnvironments,
  resetProjectEnvironmentBrowserIdentity as resetProjectEnvironmentBrowserIdentityCommand,
  updateProjectEnvironment as updateProjectEnvironmentCommand,
} from "../../lib/workflowApi";
import { commandMessage } from "../../lib/workflowUi";

type UseProjectEnvironmentActionsOptions = {
  setAppError: (message: string) => void;
  setProjectEnvironments: (environments: ProjectEnvironment[]) => void;
  showToast: (message: string) => void;
};

export function useProjectEnvironmentActions({
  setAppError,
  setProjectEnvironments,
  showToast,
}: UseProjectEnvironmentActionsOptions) {
  async function createProjectEnvironment(
    projectId: string,
    input: ProjectEnvironmentInput,
  ) {
    setAppError("");
    try {
      const created = await createProjectEnvironmentCommand(projectId, input);
      setProjectEnvironments(await listProjectEnvironments(created.project_id));
      showToast("Browser profile created.");
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function updateProjectEnvironment(
    environmentId: string,
    input: Partial<ProjectEnvironmentInput>,
  ) {
    setAppError("");
    try {
      const updated = await updateProjectEnvironmentCommand(environmentId, input);
      setProjectEnvironments(await listProjectEnvironments(updated.project_id));
      showToast("Project session updated.");
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function deleteProjectEnvironment(environmentId: string, projectId?: string | null) {
    setAppError("");
    try {
      await deleteProjectEnvironmentCommand(environmentId);
      if (projectId) {
        setProjectEnvironments(await listProjectEnvironments(projectId));
      }
      showToast("Browser profile deleted.");
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function resetProjectEnvironmentBrowserIdentity(environmentId: string) {
    setAppError("");
    try {
      const updated = await resetProjectEnvironmentBrowserIdentityCommand(environmentId);
      setProjectEnvironments(await listProjectEnvironments(updated.project_id));
      showToast("Project identity regenerated.");
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  return {
    createProjectEnvironment,
    updateProjectEnvironment,
    deleteProjectEnvironment,
    resetProjectEnvironmentBrowserIdentity,
  };
}
