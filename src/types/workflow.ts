export type ActionType =
  | "navigate"
  | "wait"
  | "random_wait"
  | "input_text"
  | "clear_input"
  | "click"
  | "scroll"
  | "select_option"
  | "press_key"
  | "hotkey"
  | "hover"
  | "double_click"
  | "right_click"
  | "drag_and_drop"
  | "focus_element"
  | "blur_element"
  | "type_sequence"
  | "set_clipboard"
  | "paste_clipboard"
  | "check"
  | "uncheck"
  | "toggle_checkbox"
  | "select_radio"
  | "upload_file"
  | "submit_form"
  | "select_custom_option"
  | "set_contenteditable"
  | "extract_text"
  | "extract_attribute"
  | "extract_input_value"
  | "extract_table"
  | "extract_list"
  | "take_screenshot"
  | "go_back"
  | "go_forward"
  | "reload"
  | "open_new_tab"
  | "switch_tab"
  | "close_tab"
  | "accept_dialog"
  | "dismiss_dialog"
  | "wait_for_download"
  | "set_variable"
  | "set_json_variables"
  | "assert_element"
  | "assert_text"
  | "graph_noop"
  | "if_condition"
  | "router_condition"
  | "repeat_times"
  | "repeat_for_each"
  | "retry_block"
  | "switch_condition"
  | "while_loop"
  | "repeat_until"
  | "try_catch"
  | "fallback_block"
  | "break_loop"
  | "continue_loop"
  | "stop_workflow"
  | "transform_variable"
  | "assert_output"
  | "domain_allowlist"
  | "set_cookie"
  | "clear_cookies"
  | "set_viewport"
  | "set_geolocation"
  | "set_extra_headers"
  | "grant_permission"
  | "execute_js"
  | "wait_for_request"
  | "wait_for_response"
  | "block_request"
  | "mock_response"
  | "set_local_storage"
  | "set_session_storage";

export type RunStatus = "idle" | "running" | "success" | "failed" | "stopped";
export type RunMode = "none" | "run_workflow" | "test_step";
export type VariableValueType = "text" | "json" | "number" | "boolean";
export type VariableAssignment = {
  name: string;
  value_type: VariableValueType;
  value: string;
};

export type ScrollMode = "page" | "into_view" | "until_visible";
export type ScrollDirection = "up" | "down" | "left" | "right";

export type WorkflowSummary = {
  id: string;
  name: string;
  step_count: number;
  created_at: string;
  updated_at: string;
};

export type Workflow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type WorkflowBrowserConfig = {
  workflow_id: string;
  profile_name?: string | null;
  proxy_enabled: boolean;
  proxy_server?: string | null;
  proxy_username?: string | null;
  proxy_password?: string | null;
  headless?: boolean | null;
};

export type WorkflowSettingsSectionId =
  | "general"
  | "run_policy"
  | "browser_launch"
  | "environment";

export type WorkflowBrowserRetention = "retain" | "close";
export type WorkflowBrowserSessionMode = "temporary" | "persistent_profile";
export type WorkflowFingerprintPlatform = "windows" | "macos" | "linux";
export type WorkflowHumanPreset = "default" | "careful";
export type WorkflowWebRtcPolicy =
  | "default"
  | "auto_proxy_exit_ip"
  | "explicit_ip"
  | "disabled_if_supported";

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
  batch_concurrency_limit?: number | null;
  batch_headless: boolean;
  batch_stop_on_first_failed_row: boolean;
};

export type WorkflowSettingsBrowserLaunch = Omit<WorkflowBrowserConfig, "workflow_id" | "headless"> & {
  session_mode: WorkflowBrowserSessionMode;
  identity_id: string;
  display_name: string;
  profile_dir: string;
  fingerprint_seed: string;
  user_agent?: string | null;
  viewport_width: number;
  viewport_height: number;
  device_scale_factor: number;
  mobile: boolean;
  touch: boolean;
  timezone?: string | null;
  locale?: string | null;
  geoip: boolean;
  proxy_label?: string | null;
  proxy_region?: string | null;
  proxy_provider?: string | null;
  proxy_bypass?: string | null;
  test_account_binding?: string | null;
  webrtc_policy: WorkflowWebRtcPolicy;
  webrtc_ip?: string | null;
  fingerprint_platform?: WorkflowFingerprintPlatform | null;
  hardware_concurrency?: number | null;
  device_memory_gb?: number | null;
  fingerprint_fonts_dir?: string | null;
  storage_quota_mb?: number | null;
  preflight_enabled: boolean;
  preflight_probe_url?: string | null;
  preflight_allowed_origins: string[];
  headless: boolean;
  humanize: boolean;
  human_preset: WorkflowHumanPreset;
  run_from_selected_enabled: boolean;
};

export type WorkflowSettingsEnvironment = {
  initial_variables: VariableAssignment[];
};

export type WorkflowSettingsMigrationNote = {
  path: string;
  action: "converted" | "dropped" | "review";
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
    status: "not_checked";
    reason: string | null;
  };
  last_smoke_result: {
    status: "not_recorded";
    reason: string | null;
  };
  last_preflight_verdict: {
    workflow_id: string;
    workflow_name: string | null;
    run_id: string | null;
    verdict: string;
    passed: boolean;
    risk_score: number | null;
    finished_at: string | null;
  } | null;
  headed_display: {
    available: boolean;
    reason: string | null;
  };
  profiles: BrowserProfileDiagnostics[];
};

export type ActionConfig =
  | {
      type: "navigate";
      config: {
        url: string;
        wait_until?: "load" | "dom_content_loaded" | "network_idle" | null;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "wait";
      config: {
        condition:
          | "duration"
          | "element_visible"
          | "element_hidden"
          | "element_attached"
          | "element_detached"
          | "text_visible"
          | "url_contains"
          | "page_load"
          | "element_enabled"
          | "element_disabled";
        xpath?: string | null;
        text?: string | null;
        url?: string | null;
        duration_ms?: number | null;
        timeout_ms?: number | null;
        target?: ElementTarget | null;
      };
    }
  | {
      type: "random_wait";
      config: {
        min_ms: number;
        max_ms: number;
      };
    }
  | {
      type: "input_text";
      config: {
        xpath?: string | null;
        target?: ElementTarget | null;
        iframe_xpath?: string | null;
        text: string;
        clear_before_input: boolean;
        wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "clear_input";
      config: {
        xpath?: string | null;
        target?: ElementTarget | null;
        iframe_xpath?: string | null;
        wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "click";
      config: {
        xpath?: string | null;
        target?: ElementTarget | null;
        iframe_xpath?: string | null;
        wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "scroll";
      config: {
        mode?: ScrollMode | null;
        direction?: ScrollDirection;
        pixels?: number;
        xpath?: string | null;
        target?: ElementTarget | null;
        iframe_xpath?: string | null;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "select_option";
      config: {
        xpath?: string | null;
        target?: ElementTarget | null;
        iframe_xpath?: string | null;
        match_by: "label" | "value";
        value: string;
        wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
        timeout_ms?: number | null;
      };
    }
  | { type: "press_key"; config: { key: string } }
  | { type: "hotkey"; config: { keys: string[] } }
  | {
      type: "hover";
      config: {
        xpath: string;
        target?: ElementTarget | null;
        iframe_xpath?: string | null;
        wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "double_click";
      config: ElementTargetActionConfig;
    }
  | {
      type: "right_click";
      config: ElementTargetActionConfig;
    }
  | {
      type: "drag_and_drop";
      config: {
        source_xpath?: string | null;
        source_target?: ElementTarget | null;
        target_xpath?: string | null;
        target_target?: ElementTarget | null;
        iframe_xpath?: string | null;
        wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "focus_element";
      config: ElementTargetActionConfig;
    }
  | {
      type: "blur_element";
      config: ElementTargetActionConfig;
    }
  | {
      type: "type_sequence";
      config: {
        xpath?: string | null;
        target?: ElementTarget | null;
        iframe_xpath?: string | null;
        text: string;
        delay_ms?: number | null;
        wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
        timeout_ms?: number | null;
      };
    }
  | { type: "set_clipboard"; config: { text: string } }
  | {
      type: "paste_clipboard";
      config: ElementTargetActionConfig;
    }
  | {
      type: "check";
      config: ElementTargetActionConfig;
    }
  | {
      type: "uncheck";
      config: ElementTargetActionConfig;
    }
  | {
      type: "toggle_checkbox";
      config: ElementTargetActionConfig;
    }
  | {
      type: "select_radio";
      config: ElementTargetActionConfig;
    }
  | {
      type: "upload_file";
      config: {
        xpath?: string | null;
        target?: ElementTarget | null;
        iframe_xpath?: string | null;
        files: string[];
        wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "submit_form";
      config: {
        xpath?: string | null;
        target?: ElementTarget | null;
        iframe_xpath?: string | null;
        wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "select_custom_option";
      config: {
        trigger_xpath?: string | null;
        trigger_target?: ElementTarget | null;
        option_text: string;
        iframe_xpath?: string | null;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "set_contenteditable";
      config: {
        xpath?: string | null;
        target?: ElementTarget | null;
        iframe_xpath?: string | null;
        text: string;
        clear_before_input: boolean;
        wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "extract_text";
      config: DataCaptureElementConfig;
    }
  | {
      type: "extract_attribute";
      config: DataCaptureElementConfig & {
        attribute: string;
      };
    }
  | {
      type: "extract_input_value";
      config: DataCaptureElementConfig;
    }
  | {
      type: "extract_table";
      config: DataCaptureElementConfig;
    }
  | {
      type: "extract_list";
      config: DataCaptureElementConfig;
    }
  | {
      type: "take_screenshot";
      config: {
        path: string;
        output_name?: string | null;
        full_page: boolean;
      };
    }
  | { type: "go_back"; config: Record<string, never> }
  | { type: "go_forward"; config: Record<string, never> }
  | { type: "reload"; config: Record<string, never> }
  | { type: "open_new_tab"; config: { url?: string | null } }
  | { type: "switch_tab"; config: { index: number } }
  | { type: "close_tab"; config: { index?: number | null } }
  | { type: "accept_dialog"; config: { prompt_text?: string | null } }
  | { type: "dismiss_dialog"; config: Record<string, never> }
  | {
      type: "wait_for_download";
      config: { output_name: string; timeout_ms?: number | null };
    }
  | {
      type: "set_variable";
      config: {
        name?: string | null;
        value?: string | null;
        value_type?: VariableValueType | null;
        variables?: VariableAssignment[];
      };
    }
  | { type: "set_json_variables"; config: { json: string } }
  | {
      type: "assert_element";
      config: {
        xpath?: string | null;
        target?: ElementTarget | null;
        iframe_xpath?: string | null;
        state: "attached" | "visible" | "hidden" | "enabled" | "disabled";
        timeout_ms?: number | null;
      };
    }
  | {
      type: "assert_text";
      config: {
        xpath?: string | null;
        target?: ElementTarget | null;
        iframe_xpath?: string | null;
        text: string;
        match_mode: "contains" | "equals";
        timeout_ms?: number | null;
      };
    }
  | {
      type: "graph_noop";
      config: {
        kind: "merge";
      };
    }
  | {
      type: "if_condition";
      config: {
        condition: WorkflowCondition;
        then_steps: CompiledNestedAction[];
        else_steps: CompiledNestedAction[];
      };
    }
  | {
      type: "router_condition";
      config: {
        mode: "first_match";
        cases: Array<{
          id: string;
          label: string;
          condition: WorkflowCondition;
          steps: CompiledNestedAction[];
        }>;
        default_steps: CompiledNestedAction[];
      };
    }
  | { type: "repeat_times"; config: { times: number; steps: CompiledNestedAction[] } }
  | {
      type: "repeat_for_each";
      config: {
        item_name: string;
        array_variable?: string | null;
        items: string[];
        steps: CompiledNestedAction[];
      };
    }
  | {
      type: "retry_block";
      config: {
        max_attempts: number;
        delay_ms?: number | null;
        steps: CompiledNestedAction[];
        failed_steps?: CompiledNestedAction[];
      };
    }
  | {
      type: "switch_condition";
      config: {
        expression: string;
        cases: Array<{ value: string; steps: CompiledNestedAction[] }>;
        default_steps: CompiledNestedAction[];
      };
    }
  | {
      type: "while_loop";
      config: {
        condition: WorkflowCondition;
        max_attempts?: number | null;
        timeout_ms?: number | null;
        steps: CompiledNestedAction[];
      };
    }
  | {
      type: "repeat_until";
      config: {
        condition: WorkflowCondition;
        max_attempts?: number | null;
        timeout_ms?: number | null;
        steps: CompiledNestedAction[];
        timeout_steps: CompiledNestedAction[];
      };
    }
  | {
      type: "try_catch";
      config: {
        try_steps: CompiledNestedAction[];
        success_steps: CompiledNestedAction[];
        error_steps: CompiledNestedAction[];
        finally_steps: CompiledNestedAction[];
      };
    }
  | {
      type: "fallback_block";
      config: {
        primary_steps: CompiledNestedAction[];
        fallback_steps: CompiledNestedAction[];
      };
    }
  | { type: "break_loop"; config: Record<string, never> }
  | { type: "continue_loop"; config: Record<string, never> }
  | {
      type: "stop_workflow";
      config: {
        status: "success" | "failure";
        reason?: string | null;
        close_browser?: boolean | null;
      };
    }
  | {
      type: "transform_variable";
      config: { source_name: string; target_name: string; expression: string };
    }
  | {
      type: "assert_output";
      config: { name: string; match_mode: "contains" | "equals"; value: string };
    }
  | { type: "domain_allowlist"; config: { domains: string[] } }
  | {
      type: "set_cookie";
      config: { name: string; value: string; domain?: string | null; path?: string | null };
    }
  | { type: "clear_cookies"; config: { domain?: string | null } }
  | {
      type: "set_viewport";
      config: {
        width: number;
        height: number;
      };
    }
  | {
      type: "set_geolocation";
      config: { latitude: number; longitude: number; accuracy?: number | null };
    }
  | { type: "set_extra_headers"; config: { headers: HeaderPair[] } }
  | {
      type: "grant_permission";
      config: { origin?: string | null; permissions: string[] };
    }
  | {
      type: "execute_js";
      config: { script: string; output_name?: string | null; timeout_ms?: number | null };
    }
  | {
      type: "wait_for_request";
      config: { url_contains: string; timeout_ms?: number | null };
    }
  | {
      type: "wait_for_response";
      config: { url_contains: string; status?: number | null; timeout_ms?: number | null };
    }
  | {
      type: "block_request";
      config: { url_patterns: string[] };
    }
  | {
      type: "mock_response";
      config: { url_contains: string; status: number; body: string; content_type?: string | null };
    }
  | {
      type: "set_local_storage";
      config: { key: string; value: string };
    }
  | {
      type: "set_session_storage";
      config: { key: string; value: string };
    };

export type HeaderPair = {
  name: string;
  value: string;
};

export type ElementLocatorKind =
  | "test_id"
  | "role"
  | "label"
  | "placeholder"
  | "text"
  | "css"
  | "xpath"
  | "attribute";

export type ElementLocator = {
  kind: ElementLocatorKind;
  value: string;
  role?: string | null;
  attribute?: string | null;
  exact?: boolean | null;
};

export type ElementTargetConstraints = {
  visible?: boolean | null;
  enabled?: boolean | null;
  contains_text?: string | null;
  index?: number | null;
};

export type ElementTarget = {
  locators: ElementLocator[];
  constraints?: ElementTargetConstraints | null;
  iframe?: ElementTarget | null;
};

export type WorkflowCondition =
  | { kind: "output_equals"; name: string; value: string }
  | { kind: "output_contains"; name: string; value: string }
  | { kind: "text_visible"; text: string }
  | { kind: "url_contains"; value: string }
  | { kind: "element_visible"; xpath?: string | null; target?: ElementTarget | null };

export type RouterGraphCase = {
  id: string;
  label: string;
  condition: WorkflowCondition;
};

export type RouterGraphConfig = {
  mode: "first_match";
  cases: RouterGraphCase[];
  default_label?: string | null;
};

type ElementTargetActionConfig = {
  xpath?: string | null;
  target?: ElementTarget | null;
  iframe_xpath?: string | null;
  wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
  timeout_ms?: number | null;
};

type DataCaptureElementConfig = {
  xpath?: string | null;
  target?: ElementTarget | null;
  iframe_xpath?: string | null;
  output_name: string;
  timeout_ms?: number | null;
};

export type WorkflowStep = {
  id: string;
  name: string;
  workflow_id: string;
  order_index: number;
  action_type: ActionType;
  config: ActionConfig;
  created_at: string;
  updated_at: string;
};

export type WorkflowDetail = {
  workflow: Workflow;
  steps: WorkflowStep[];
};

export type GraphNodeType =
  | "start"
  | "end_success"
  | "end_failure"
  | "action"
  | "merge"
  | "router"
  | "if"
  | "switch"
  | "repeat_times"
  | "repeat_for_each"
  | "repeat_until"
  | "while"
  | "retry"
  | "try_catch"
  | "fallback"
  | "break_loop"
  | "continue_loop"
  | "stop_workflow"
  | "set_variable"
  | "set_json_variables"
  | "transform_variable"
  | "assert_output"
  | "domain_allowlist";

export type GraphPortDirection = "input" | "output";
export type GraphValidationLevel = "error" | "warning";

export type GraphPosition = {
  x: number;
  y: number;
};

export type GraphViewport = {
  x: number;
  y: number;
  zoom: number;
};

export type GraphPort = {
  id: string;
  label: string;
  direction: GraphPortDirection;
};

export type GraphNode = {
  id: string;
  node_type: GraphNodeType;
  label: string;
  position: GraphPosition;
  config: unknown;
  ports: GraphPort[];
  group_id?: string | null;
};

export type GraphEdge = {
  id: string;
  source_node_id: string;
  source_port: string;
  target_node_id: string;
  target_port: string;
  label?: string | null;
  condition?: WorkflowCondition | null;
};

export type WorkflowGraph = {
  version: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  viewport: GraphViewport;
  migration_notes?: WorkflowGraphMigrationNote[];
};

export type GraphValidationIssue = {
  level: GraphValidationLevel;
  node_id?: string | null;
  edge_id?: string | null;
  message: string;
};

export type CompiledGraphStep = {
  node_id: string;
  label: string;
  config: ActionConfig;
};

export type CompiledNestedAction = ActionConfig & {
  graph_node_id?: string;
  graph_label?: string;
};

export type CompiledWorkflowGraph = {
  steps: CompiledGraphStep[];
  domain_policy?: {
    allowed_domains: string[];
  } | null;
};

export type WorkflowScheduleKind =
  | { type: "once_at"; timestamp: string }
  | { type: "interval"; every_seconds: number }
  | { type: "calendar"; preset: "daily"; time: string }
  | { type: "calendar"; preset: "weekly"; weekdays: number[]; time: string }
  | { type: "calendar"; preset: "monthly"; day: number; time: string };

export type WorkflowScheduleInput = {
  workflow_id: string;
  name: string;
  enabled: boolean;
  kind: WorkflowScheduleKind;
};

export type WorkflowScheduleUpdate = Partial<WorkflowScheduleInput>;

export type WorkflowScheduleStatus =
  | "started"
  | "skipped"
  | "missed"
  | "failed_to_start"
  | "disabled";

export type WorkflowSchedule = {
  id: string;
  workflow_id: string;
  workflow_name: string;
  name: string;
  enabled: boolean;
  kind: WorkflowScheduleKind;
  next_run_at: string | null;
  last_event_at: string | null;
  last_status: WorkflowScheduleStatus | null;
  last_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkflowScheduleEvent = {
  id: string;
  schedule_id: string;
  workflow_id: string;
  event_type: WorkflowScheduleStatus;
  run_id: string | null;
  scheduled_for: string;
  created_at: string;
  reason: string | null;
  details_json: string | null;
};

export type WorkflowScheduleEventFilter = {
  schedule_id?: string | null;
  workflow_id?: string | null;
  limit?: number | null;
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
};

export type WorkflowPackageSettings = Partial<{
  general: WorkflowSettingsGeneral;
  run_policy: WorkflowSettingsRunPolicy;
  browser_launch: WorkflowSettingsBrowserLaunch;
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
  settings?: WorkflowPackageSettings | null;
};

export type WorkflowPackagePreview = {
  workflow_name: string;
  includes_flow: boolean;
  settings_sections: WorkflowSettingsSectionId[];
  omitted_fields: string[];
};

export type ElementSnapshot = {
  tag: string;
  id?: string | null;
  test_id?: string | null;
  name?: string | null;
  text?: string | null;
  classes: string[];
};

export type SelectorCandidate = {
  selector_type: string;
  selector: string;
  score: number;
  reason: string;
};

export type RecordedEvent =
  | { type: "click"; xpath: string }
  | { type: "input_text"; xpath: string; text: string };

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
  };
};

export type CommandError = {
  message: string;
  field?: string | null;
};
