import type {
  RunState,
  WorkflowSettings,
  WorkflowStep,
  WorkflowSummary,
} from "../../types/workflow";
import { linearGraphFromSteps } from "../../features/workflows/lib/workflowGraph";
import { personaForSeed } from "../../lib/personaCatalog";
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

export function emptyOperationsOverview() {
  return {
    generated_at: "2026-05-27T00:00:00.000Z",
    range: {
      day_start_utc: "2026-05-27T00:00:00.000Z",
      day_end_utc: "2026-05-28T00:00:00.000Z",
      timezone_label: "UTC",
    },
    metrics: {
      active_runs: 0,
      succeeded_today: 0,
      attention_today: 0,
      upcoming_schedules: 0,
    },
    live_runs: { items: [], total: 0, has_more: false },
    attention: { items: [], total: 0, has_more: false },
    activity: [],
    recent_evidence: { items: [], total: 0, has_more: false },
    upcoming_schedules: { items: [], total: 0, has_more: false },
    data_warnings: { evidence_items_skipped: 0 },
  };
}

export function listWorkflowScenario(workflows: WorkflowSummary[] = [workflow]) {
  return {
    list_workflows: workflows,
    get_run_state: idleRunState,
    list_run_states: [],
    get_operations_overview: emptyOperationsOverview(),
  };
}

export function workflowDetailScenario(steps: WorkflowStep[]) {
  const persona = personaForSeed("bi_workflow-1");
  const workflowSettings: WorkflowSettings = {
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
      execute_js_enabled: true,
      run_from_selected_enabled: false,
      run_from_selected_mode: "from_selected",
      batch_concurrency_limit: 1,
      batch_headless: false,
      batch_stop_on_first_failed_row: false,
    },
    browser_launch: {
      session_mode: "persistent_profile",
      identity_id: "bi_workflow-1",
      display_name: `${workflow.name} identity`,
      persona_id: persona.id,
      persona,
      profile_dir: "bi_workflow-1",
      fingerprint_seed: "14523",
      profile_name: "bi_workflow-1",
      fingerprint_fonts_dir: null,
      timezone: null,
      locale: null,
      geoip: false,
      proxy_bypass: null,
      webrtc_policy: "default",
      webrtc_ip: null,
      proxy_enabled: false,
      proxy_server: null,
      proxy_username: null,
      proxy_password: null,
      headless: false,
      humanize: true,
      human_preset: "default",
    },
    graph_defaults: {
      default_edge_delay: null,
      live_run_enabled: true,
      live_run_follow_current: false,
    },
    environment: {
      initial_variables: [],
    },
    migration_notes: [],
    created_at: workflow.created_at,
    updated_at: workflow.updated_at,
  };

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
    get_workflow_settings: workflowSettings,
    get_workflow_graph: linearGraphFromSteps(steps),
  };
}
