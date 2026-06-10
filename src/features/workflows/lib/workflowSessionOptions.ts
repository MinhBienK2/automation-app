import type {
  ProjectEnvironment,
  WorkflowSettingsBrowserLaunch,
  WorkflowSummary,
} from "../../../types/workflow";

export type WorkflowSessionOption = {
  environment_id: string;
  name: string;
  description: string;
  is_default: boolean;
  workflow_ids: string[];
  workflow_names: string[];
  browser_launch: WorkflowSettingsBrowserLaunch;
};

type WorkflowSessionOptionWorkflow = Pick<
  WorkflowSummary,
  "id" | "name" | "environment_id"
>;

export function buildWorkflowSessionOptions({
  activeWorkflow,
  environments,
  workflows,
}: {
  activeWorkflow?: WorkflowSessionOptionWorkflow | null;
  environments: ProjectEnvironment[];
  workflows: WorkflowSessionOptionWorkflow[];
}): WorkflowSessionOption[] {
  const workflowRefs = [...workflows];
  if (
    activeWorkflow &&
    !workflowRefs.some((workflow) => workflow.id === activeWorkflow.id)
  ) {
    workflowRefs.push(activeWorkflow);
  }

  return environments
    .filter((environment) => hasBrowserLaunch(environment))
    .map((environment) => {
      const linkedWorkflows = workflowRefs.filter(
        (workflow) => workflow.environment_id === environment.id,
      );
      return {
        environment_id: environment.id,
        name: environment.name,
        description: environment.description,
        is_default: environment.is_default,
        workflow_ids: linkedWorkflows.map((workflow) => workflow.id),
        workflow_names: linkedWorkflows.map((workflow) => workflow.name),
        browser_launch: environment.browser_launch,
      };
    });
}

function hasBrowserLaunch(
  environment: ProjectEnvironment,
): environment is ProjectEnvironment & {
  browser_launch: WorkflowSettingsBrowserLaunch;
} {
  return Boolean(
    environment.browser_launch && typeof environment.browser_launch === "object",
  );
}
