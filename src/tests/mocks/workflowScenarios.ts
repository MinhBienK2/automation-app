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
        session_mode: "persistent_profile",
        identity_id: "bi_workflow-1",
        display_name: `${workflow.name} identity`,
        profile_dir: "bi_workflow-1",
        fingerprint_seed: "14523",
        profile_name: "bi_workflow-1",
        user_agent: null,
        viewport_width: 1920,
        viewport_height: 947,
        device_scale_factor: 1,
        mobile: false,
        touch: false,
        timezone: null,
        locale: null,
        geoip: false,
        proxy_label: null,
        proxy_region: null,
        webrtc_policy: "default",
        webrtc_ip: null,
        storage_quota_mb: null,
        humanize: true,
        human_preset: "default",
        preflight_enabled: false,
        preflight_probe_url: null,
        preflight_allowed_origins: [],
        proxy_enabled: false,
        proxy_server: null,
        proxy_username: null,
        proxy_password: null,
        headless: false,
        run_from_selected_enabled: false,
      },
      environment: {
        initial_variables: [],
      },
      migration_notes: [],
      created_at: workflow.created_at,
      updated_at: workflow.updated_at,
    },
    get_workflow_graph: linearGraphFromSteps(steps),
  };
}
