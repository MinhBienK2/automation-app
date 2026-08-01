/**
 * Workflow Settings and the browser-profile tree: personas, launch options,
 * environments, graph defaults, validation issues, and diagnostics.
 */

import type { WorkflowBrowserConfig } from "./workflowRecords.js";
import type { VariableAssignment, VariableValueType } from "./workflowRunEnums.js";

export type WorkflowSettingsSectionId =
  | "general"
  | "run_policy"
  | "browser_launch"
  | "graph_defaults"
  | "environment";

export type WorkflowBrowserRetention = "retain" | "close";
export type WorkflowBrowserSessionMode = "temporary" | "persistent_profile";
export type WorkflowRunFromSelectedMode = "selected_only" | "from_selected";
export type WorkflowHumanPreset = "default" | "careful";
export type WorkflowWebRtcPolicy =
  | "default"
  | "auto_proxy_exit_ip"
  | "explicit_ip"
  | "disabled_if_supported";
export type WorkflowPersonaOsBucket =
  | "windows_desktop"
  | "macos_desktop"
  | "linux_desktop";
export type WorkflowPersonaBrowserChannelBucket =
  | "chromium_stable"
  | "chromium_extended_stable";
export type WorkflowPersonaProxyGeoPolicy =
  | "direct"
  | "match_proxy_region"
  | "geoip_from_proxy";
export type WorkflowPersonaDimensions = {
  width: number;
  height: number;
};
export type WorkflowPersonaFontBundle = {
  label: string;
  path?: string | null;
  expected_families: string[];
};
export type WorkflowPersona = {
  id: string;
  label: string;
  rationale: string;
  os_bucket: WorkflowPersonaOsBucket;
  browser_channel_bucket: WorkflowPersonaBrowserChannelBucket;
  viewport: WorkflowPersonaDimensions;
  window: WorkflowPersonaDimensions;
  timezone: string;
  locale: string;
  proxy_geo_policy: WorkflowPersonaProxyGeoPolicy;
  proxy_region?: string | null;
  webrtc_mode: WorkflowWebRtcPolicy;
  font_bundle: WorkflowPersonaFontBundle;
  account_label?: string | null;
  test_account_binding?: string | null;
  behavioral_timing_profile: WorkflowHumanPreset;
};

export type WorkflowSettingsGeneral = {
  name: string;
  description: string;
  tags: string[];
  notes: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type WorkflowSettingsRunPolicy = {
  max_workflow_duration_ms?: number | null;
  browser_retention: WorkflowBrowserRetention;
  execute_js_enabled: boolean;
  run_from_selected_enabled: boolean;
  run_from_selected_mode: WorkflowRunFromSelectedMode;
  batch_concurrency_limit?: number | null;
  batch_headless: boolean;
  batch_stop_on_first_failed_row: boolean;
};

export type WorkflowSettingsBrowserLaunch = Omit<WorkflowBrowserConfig, "workflow_id" | "headless"> & {
  session_mode: WorkflowBrowserSessionMode;
  identity_id: string;
  display_name: string;
  persona_id: string;
  persona: WorkflowPersona;
  profile_dir: string;
  fingerprint_seed: string;
  fingerprint_fonts_dir?: string | null;
  timezone?: string | null;
  locale?: string | null;
  geoip: boolean;
  proxy_bypass?: string | null;
  webrtc_policy: WorkflowWebRtcPolicy;
  webrtc_ip?: string | null;
  headless: boolean;
  humanize: boolean;
  human_preset: WorkflowHumanPreset;
  run_from_selected_enabled?: boolean;
};

export type ProfileVariableAssignment = {
  name: string;
  value_type: VariableValueType;
  value: string;
  persist: boolean;
};

export type ProfileEnvironment = {
  variables: ProfileVariableAssignment[];
};

export type BrowserProfile = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  is_default: boolean;
  browser_launch: WorkflowSettingsBrowserLaunch;
  environment?: ProfileEnvironment;
  created_at: string;
  updated_at: string;
};

export type BrowserProfileInput = {
  name: string;
  description?: string | null;
  is_default?: boolean | null;
  browser_launch?: WorkflowSettingsBrowserLaunch | null;
  environment?: ProfileEnvironment | null;
};

export type WorkflowCreateOptions = {
  project_id?: string | null;
  browser_profile_id?: string | null;
};

export type WorkflowSettingsEnvironment = {
  initial_variables: VariableAssignment[];
};

export type GraphEdgeDelay =
  | {
      type: "fixed";
      duration_ms: number;
    }
  | {
      type: "random";
      min_ms: number;
      max_ms: number;
    };

export type WorkflowSettingsGraphDefaults = {
  default_edge_delay: GraphEdgeDelay | null;
  live_run_enabled: boolean;
  live_run_follow_current: boolean;
};

export type WorkflowSettingsMigrationNote = {
  path: string;
  action: "converted" | "dropped" | "review" | "rotated";
  message: string;
};

export type WorkflowGraphMigrationNote = {
  path: string;
  action: "converted" | "dropped" | "review";
  message: string;
};

export type WorkflowSettings = {
  workflow_id: string;
  version: number;
  general: WorkflowSettingsGeneral;
  run_policy: WorkflowSettingsRunPolicy;
  browser_launch: WorkflowSettingsBrowserLaunch;
  graph_defaults: WorkflowSettingsGraphDefaults;
  environment: WorkflowSettingsEnvironment;
  migration_notes: WorkflowSettingsMigrationNote[];
  created_at?: string | null;
  updated_at?: string | null;
};

export type SettingsValidationIssue = {
  section: WorkflowSettingsSectionId;
  field?: string | null;
  message: string;
  level: "error" | "warning";
};

export type RunValidationIssue = {
  source: "graph" | "settings";
  field?: string | null;
  node_id?: string | null;
  edge_id?: string | null;
  message: string;
  level: "error" | "warning";
};

export type BrowserProfileDiagnostics = {
  profile_dir: string;
  identity_id: string | null;
  display_name: string | null;
  workflow_id: string | null;
  workflow_name: string | null;
  approximate_size_bytes: number;
  last_modified_at: string | null;
  last_run_at: string | null;
  active_session: boolean;
};

export type BrowserProfileCleanupResult = {
  deleted_profiles: string[];
  skipped_profiles: BrowserProfileDiagnostics[];
  reclaimed_bytes: number;
};

export type WorkflowDeleteOptions = {
  deleteBrowserProfile?: boolean;
};

export type CloakBrowserDiagnostics = {
  wrapper_version: string | null;
  binary: {
    version: string | null;
    platform: string | null;
    installed: boolean;
    binary_path: string | null;
    cache_dir: string | null;
    download_url: string | null;
  };
  auto_update_enabled: boolean;
  checksum_skip_enabled: boolean;
  geoip_available: boolean;
  profile_root: string;
  font_checklist: {
    status: "not_configured" | "ok" | "warning" | "error";
    reason: string | null;
    directories: Array<{
      path: string;
      status: "ok" | "warning" | "missing";
      reason: string | null;
      file_count: number;
      total_size_bytes: number;
      normalized_hash: string | null;
      expected_families_present: string[];
      missing_expected_families: string[];
      workflow_ids: string[];
      workflow_names: string[];
    }>;
  };
  last_smoke_result: {
    status: "not_recorded";
    reason: string | null;
  };
  headed_display: {
    available: boolean;
    reason: string | null;
  };
  profiles: BrowserProfileDiagnostics[];
};

