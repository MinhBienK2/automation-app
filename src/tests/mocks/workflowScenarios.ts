import type { RunState, WorkflowStep, WorkflowSummary } from "../../types/workflow";
import { workflow } from "./workflowFixtures";

export const idleRunState: RunState = {
  status: "idle",
  mode: "none",
  target_step_id: null,
  current_step_id: null,
  current_step_number: null,
  completed_step_ids: [],
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
  };
}
