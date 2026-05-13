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
    },
    get_workflow_settings: {
      workflow_id: workflow.id,
      version: 2,
      general: {
        name: workflow.name,
        description: "",
        tags: [],
        notes: "",
        created_at: workflow.created_at,
        updated_at: workflow.updated_at,
      },
      run_policy: {
        max_workflow_duration_ms: null,
        browser_retention: "retain",
        batch_concurrency_limit: 1,
        batch_headless: false,
        batch_stop_on_first_failed_row: false,
      },
      browser_launch: {
        session_mode: "temporary",
        profile_name: null,
        proxy_enabled: false,
        proxy_server: null,
        proxy_username: null,
        proxy_password: null,
        headless: false,
      },
      environment: {
        initial_variables: [],
      },
      owned_test_gates: {
        fingerprint_preflight_enabled: false,
        fingerprint_probe_url: null,
        fingerprint_profile_id: null,
        fingerprint_allowed_origins: [],
        fingerprint_proxy_label: null,
        fingerprint_proxy_region: null,
      },
      migration_notes: [],
      created_at: workflow.created_at,
      updated_at: workflow.updated_at,
    },
    get_workflow_graph: linearGraphFromSteps(steps),
  };
}
