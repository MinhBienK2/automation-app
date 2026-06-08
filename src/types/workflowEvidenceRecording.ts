import type {
  ActionConfig,
  CloakBrowserDiagnostics,
  ElementLocatorKind,
  ProjectEnvironment,
  RunMode,
  RunStatus,
  Workflow,
  WorkflowBrowserSessionMode,
  WorkflowHumanPreset,
  WorkflowSettings,
  WorkflowSettingsBrowserLaunch,
  WorkflowSettingsEnvironment,
  WorkflowSettingsGeneral,
  WorkflowSettingsGraphDefaults,
  WorkflowSettingsRunPolicy,
  WorkflowSettingsSectionId,
} from "./workflowCore.js";
import type {
  GraphValidationIssue,
  Subflow,
  WorkflowGraph,
  WorkflowRunSource,
  WorkflowScheduleInput,
  WorkflowStep,
} from "./workflowGraphOps.js";

export type EvidenceKind =
  | "screenshot"
  | "download"
  | "browser_identity"
  | "action_trace"
  | "evidence_manifest";

export type EvidenceFileState = "unchecked" | "available" | "unavailable";

export type EvidenceListRequest = {
  search?: string | null;
  types?: EvidenceKind[] | null;
  run_statuses?: RunStatus[] | null;
  sources?: WorkflowRunSource[] | null;
  workflow_id?: string | null;
  run_id?: string | null;
  identity_id?: string | null;
  time_start_utc?: string | null;
  time_end_utc?: string | null;
  focus_evidence_id?: string | null;
  cursor?: string | null;
  limit?: number | null;
};

export type EvidenceListItem = {
  evidence_id: string;
  kind: EvidenceKind;
  label: string;
  created_at: string;
  run: {
    id: string;
    status: RunStatus;
    source: WorkflowRunSource;
    started_at: string;
    finished_at?: string | null;
  };
  workflow: { id: string; name: string } | null;
  identity: { id: string; display_name?: string | null } | null;
  node_id?: string | null;
  step_number?: number | null;
  relative_path?: string | null;
  file_state?: EvidenceFileState;
  navigation_targets: {
    workflow: boolean;
  };
};

export type EvidencePage = {
  generated_at: string;
  items: EvidenceListItem[];
  next_cursor: string | null;
  has_more: boolean;
  warnings: {
    skipped_artifacts: number;
    skipped_reports: number;
    skipped_traces: number;
    skipped_manifests: number;
  };
};

export type EvidenceDetail =
  | {
      item: EvidenceListItem;
      payload: {
        kind: "screenshot";
        artifact_kind: "screenshot";
        relative_path: string;
        file_state: EvidenceFileState;
      };
    }
  | {
      item: EvidenceListItem;
      payload: {
        kind: "download";
        artifact_kind: "download";
        relative_path: string;
        file_state: EvidenceFileState;
        size_bytes?: number | null;
      };
    }
  | {
      item: EvidenceListItem;
      payload: {
        kind: "browser_identity";
        fields: Array<{ key: string; value: string | number | boolean | null }>;
      };
    }
  | {
      item: EvidenceListItem;
      payload: {
        kind: "action_trace";
        entries: Array<Record<string, unknown>>;
        has_more: boolean;
      };
    }
  | {
      item: EvidenceListItem;
      payload: {
        kind: "evidence_manifest";
        rows: Array<{
          key: string;
          category: string;
          approximate_bytes?: number | null;
          redacted: boolean;
          truncated: boolean;
        }>;
      };
    };

export type EvidenceScreenshotPreview = {
  evidence_id: string;
  mime_type: "image/png";
  base64_data: string;
  file_state: "available";
};

export type EvidenceBundleExportRequest = {
  evidence_ids: string[];
};

export type EvidenceBundleExportResult = {
  bundle_dir: string;
  exported_count: number;
  omitted_file_count: number;
} | null;

export type IdentityLabTarget =
  | { type: "managed"; workflow_id: string; identity_id: string }
  | {
      type: "historical";
      identity_id: string;
      workflow_id?: string | null;
      run_id?: string | null;
      evidence_id?: string | null;
    };

export type IdentityLabOverviewRequest = {
  search?: string | null;
  selected_target?: IdentityLabTarget | null;
  limits?: { identities?: number | null; rotation_history?: number | null } | null;
};

export type ManagedIdentitySummary = {
  workflow_ref: { id: string; name: string };
  identity_ref: { id: string; display_name?: string | null };
  short_identity_id: string;
  persona_id?: string | null;
  persona_label?: string | null;
  session_mode: WorkflowBrowserSessionMode;
  profile_reuse: boolean;
  retained_session: { active: boolean; reason?: string | null };
  configured_posture_summary: string[];
  last_run?: {
    run_id: string;
    status: RunStatus;
    started_at: string;
    finished_at?: string | null;
  } | null;
  recent_failures_24h: number;
  warning_badges: string[];
};

export type IdentityLabManagedDetail = {
  kind: "managed";
  workflow_ref: { id: string; name: string };
  identity_ref: { id: string; display_name?: string | null };
  session: {
    active: boolean;
    profile_name?: string | null;
    reset_blocked_reason?: string | null;
  };
  configured_posture: Array<{ label: string; value: string }>;
  latest_observed?: {
    run_id: string;
    observed_at: string;
    fields: Array<{ key: string; value: string | number | boolean | null }>;
  } | null;
  last_run?: ManagedIdentitySummary["last_run"];
  recent_failures_24h: number;
  evidence_summary: { total: number };
  rotation_history: Array<{
    previous_identity_id?: string | null;
    next_identity_id?: string | null;
    message: string;
  }>;
  diagnostics: {
    binary_installed: boolean;
    wrapper_version?: string | null;
    geoip_available: boolean;
    headed_display_available: boolean;
    profile?: {
      approximate_size_bytes: number;
      active_session: boolean;
    } | null;
    font_status: CloakBrowserDiagnostics["font_checklist"]["status"];
  };
  actions: {
    can_close_retained_session: boolean;
    can_reset_identity: boolean;
    reset_disabled_reason?: string | null;
  };
};

export type IdentityLabHistoricalDetail = {
  kind: "historical";
  identity_ref: { id: string; display_name?: string | null };
  workflow_ref?: { id: string; name: string } | null;
  run_id?: string | null;
  evidence_id?: string | null;
  observed_fields: Array<{ key: string; value: string | number | boolean | null }>;
};

export type IdentityLabDetail = IdentityLabManagedDetail | IdentityLabHistoricalDetail;

export type IdentityLabOverview = {
  generated_at: string;
  items: ManagedIdentitySummary[];
  selected?: IdentityLabDetail | null;
  counts: {
    managed_identities: number;
    active_retained_sessions: number;
    identities_with_warnings: number;
    identities_with_recent_failures: number;
  };
  data_warnings: string[];
};

export type ScheduleValidationIssue = {
  field: string;
  message: string;
  level: "error" | "warning";
};

export type OrchestrationSchedule = WorkflowScheduleInput;

export type BatchRunRequest = {
  rows: Array<Record<string, string>>;
  concurrency_limit?: number | null;
  headless?: boolean | null;
};

export type BatchRunRowResult = {
  row_index: number;
  status: RunStatus;
  error?: string | null;
};

export type BatchRunSummary = {
  total: number;
  succeeded: number;
  failed: number;
  results: BatchRunRowResult[];
};

export type WorkflowExport = {
  version: number;
  workflow: Workflow;
  steps: WorkflowStep[];
  settings?: WorkflowSettings | null;
};

export type WorkflowPackageExportOptions = {
  include_flow: boolean;
  settings_sections: WorkflowSettingsSectionId[];
};

export type WorkflowPackageImportOptions = {
  include_flow: boolean;
  settings_sections: WorkflowSettingsSectionId[];
  target_project_id?: string | null;
};

export type WorkflowPackageSettings = Partial<{
  general: WorkflowSettingsGeneral;
  run_policy: WorkflowSettingsRunPolicy;
  browser_launch: WorkflowSettingsBrowserLaunch;
  graph_defaults: WorkflowSettingsGraphDefaults;
  environment: WorkflowSettingsEnvironment;
}>;

export type WorkflowPackage = {
  kind: "workflow_package";
  version: 2;
  workflow: {
    name: string;
  };
  included_sections: string[];
  omitted_fields: string[];
  flow?: WorkflowGraph | null;
  subflows?: Subflow[] | null;
  settings?: WorkflowPackageSettings | null;
};

export type WorkflowPackagePreview = {
  workflow_name: string;
  includes_flow: boolean;
  subflows: Array<{ id: string; name: string }>;
  settings_sections: WorkflowSettingsSectionId[];
  omitted_fields: string[];
};

export type ProjectPackageWorkflow = {
  id: string;
  project_id?: string | null;
  environment_id?: string | null;
  name: string;
  flow?: WorkflowGraph | null;
  settings?: WorkflowSettings | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ProjectPackage = {
  kind: "project_package";
  version: 1;
  project: {
    name: string;
    description?: string | null;
  };
  included_sections: string[];
  omitted_fields: string[];
  environments: ProjectEnvironment[];
  subflows: Subflow[];
  workflows: ProjectPackageWorkflow[];
};

export type ProjectPackagePreview = {
  project_name: string;
  workflows: Array<{ id: string; name: string }>;
  subflows: Array<{ id: string; name: string }>;
  environments: Array<{ id: string; name: string; is_default: boolean }>;
  omitted_fields: string[];
};

export type RecordingSessionMode = "new_workflow" | "replace_current_graph";
export type RecordingSessionStatus =
  | "starting"
  | "recording"
  | "stopping"
  | "stopped"
  | "failed"
  | "discarded";

export type RecordingWarning = {
  code: string;
  message: string;
  event_id?: string | null;
  severity: "info" | "warning" | "error";
};

export type RecordingLocatorCandidate = {
  kind: ElementLocatorKind;
  value: string;
  name?: string | null;
  role?: string | null;
  attribute?: string | null;
  score: number;
  reason: string;
};

export type RecordingTarget = {
  tag_name: string;
  input_type?: string | null;
  text_sample?: string | null;
  role?: string | null;
  accessible_name?: string | null;
  iframe?: RecordingTarget | null;
  locators: RecordingLocatorCandidate[];
  bounding_box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
};

export type RecordingValue = {
  text?: string | null;
  checked?: boolean | null;
  selected_value?: string | null;
  selected_label?: string | null;
  key?: string | null;
  keys?: string[] | null;
  scroll?: { x: number; y: number } | null;
  file_names?: string[] | null;
};

export type RecordingEventKind =
  | "navigation"
  | "click"
  | "input"
  | "change"
  | "select"
  | "checkbox"
  | "radio"
  | "clipboard"
  | "scroll"
  | "keyboard"
  | "download"
  | "dialog"
  | "tab"
  | "wait_marker";

export type RecordingEvent = {
  id: string;
  session_id: string;
  sequence: number;
  timestamp: string;
  kind: RecordingEventKind;
  frame_url: string | null;
  page_url: string | null;
  target: RecordingTarget | null;
  value: RecordingValue | null;
  raw: Record<string, unknown>;
  confidence: "high" | "medium" | "low";
  warnings: RecordingWarning[];
};

export type RecordingBrowserIdentitySnapshot = {
  identity_id: string;
  display_name: string;
  profile_dir: string | null;
  profile_name?: string | null;
  fingerprint_seed_hash: string;
  persona_id?: string | null;
  persona_label?: string | null;
  humanize: boolean;
  human_preset: WorkflowHumanPreset;
  headless: boolean;
};

export type RecorderStartSessionInput = {
  workflow_id?: string | null;
  workflow_name?: string | null;
  initial_url?: string | null;
  browser_launch_overrides?: Record<string, unknown> | null;
  mode: RecordingSessionMode;
};

export type RecordingSession = {
  id: string;
  workflow_id: string | null;
  mode: RecordingSessionMode;
  status: RecordingSessionStatus;
  started_at: string;
  stopped_at?: string | null;
  browser_identity: RecordingBrowserIdentitySnapshot;
  workflow_settings_snapshot: WorkflowSettings;
  page_url?: string | null;
  event_count: number;
  warnings: RecordingWarning[];
};

export type ReviewedRecordingStep = {
  id: string;
  source_event_ids: string[];
  action: ActionConfig;
  label: string;
  included: boolean;
  timing?: {
    first_event_at: string;
    last_event_at: string;
  } | null;
  locator_confidence?: "high" | "medium" | "low" | null;
  warnings: RecordingWarning[];
};

export type RecordingGenerateDraftOptions = {
  include_event_ids?: string[] | null;
  add_terminal_success: boolean;
};

export type RecordingSaveDraftInput = {
  workflow_name: string;
  save_mode: "create_new" | "replace_graph";
  reviewed_steps: ReviewedRecordingStep[];
  add_terminal_success: boolean;
};

export type RecordingWorkflowDraft = {
  id: string;
  session_id: string;
  workflow_id: string | null;
  mode: RecordingSessionMode;
  status: "draft" | "saving" | "saved" | "discarded";
  generated_at: string;
  workflow_settings_snapshot: WorkflowSettings;
  steps: ReviewedRecordingStep[];
  graph: WorkflowGraph;
  validation_issues: GraphValidationIssue[];
  warnings: RecordingWarning[];
};

export type RunErrorDiagnostics = {
  compiled_step_id?: string | null;
  parent_step_id?: string | null;
  subflow_node_id?: string | null;
  subflow_id?: string | null;
  subflow_name?: string | null;
  subflow_step_number?: number | null;
  subflow_step_count?: number | null;
  label_path?: string[];
  action_summary?: string | null;
};

export type RunState = {
  status: RunStatus;
  mode: RunMode;
  target_step_id: string | null;
  current_step_id: string | null;
  current_step_number: number | null;
  completed_step_ids: string[];
  outputs?: Record<string, unknown>;
  retained_session?: {
    available: boolean;
    workflow_id?: string | null;
    profile_name?: string | null;
    reason?: string | null;
  } | null;
  error: null | {
    step_id?: string | null;
    step_number: number;
    step_name?: string | null;
    action_type: string;
    reason: string;
    diagnostics?: RunErrorDiagnostics | null;
  };
};

export type WorkflowRunSnapshot = RunState & {
  run_id: string;
  workflow_id: string;
  workflow_name: string;
  source: WorkflowRunSource;
  started_at: string;
  state: RunState;
};

export type CommandError = {
  message: string;
  field?: string | null;
};
