import type {
  ProjectEnvironment,
  ProjectEnvironmentInput,
} from "../../types/workflow";
import {
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
    updateProjectEnvironment,
    resetProjectEnvironmentBrowserIdentity,
  };
}
