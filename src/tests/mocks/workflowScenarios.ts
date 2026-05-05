import type { RunState, WorkflowStep, WorkflowSummary } from "../../types/workflow";
import { linearGraphFromSteps } from "../../features/workflows/lib/workflowGraph";
import { workflow } from "./workflowFixtures";

export const idleRunState: RunState = {
  status: "idle",
  mode: "none",
  target_step_id: null,
  current_step_id: null,
  current_step_number: null,
  completed_step_ids: [],
  outputs: {},
  error: null,
};

export function listWorkflowScenario(workflows: WorkflowSummary[] = [workflow]) {
  return {
    list_workflows: workflows,
    get_run_state: idleRunState,
  };
}

export function workflowDetailScenario(steps: WorkflowStep[]) {
  return {
    ...listWorkflowScenario([workflow]),
    get_workflow: { workflow, steps },
    get_workflow_browser_config: {
      workflow_id: workflow.id,
      profile_name: null,
      proxy_enabled: false,
      proxy_server: null,
      proxy_username: null,
      proxy_password: null,
      user_agent: null,
      viewport_width: null,
      viewport_height: null,
      mobile: false,
      touch: false,
      challenge_policy: "none",
    },
    get_workflow_graph: linearGraphFromSteps(steps),
  };
}
