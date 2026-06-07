export type ActionType =
  | "navigate"
  | "wait"
  | "random_wait"
  | "input_text"
  | "clear_input"
  | "click"
  | "find_element"
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
  | "random_choice"
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

export type ScrollMode = "page" | "into_view" | "until_element_visible";
export type ScrollDirection = "up" | "down" | "left" | "right";
export type ScrollStyle = "human_like" | "smooth_single";
export type DragTargetPosition =
  | { mode: "center" }
  | { mode: "percent"; x_percent: number; y_percent: number }
  | { mode: "offset"; x_px: number; y_px: number };

export type Project = {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

export type WorkflowSummary = {
  id: string;
  name: string;
  step_count: number;
  project_id?: string | null;
  environment_id?: string | null;
  environment_name?: string | null;
  created_at: string;
  updated_at: string;
};

export type Workflow = {
  id: string;
  name: string;
  project_id?: string | null;
  environment_id?: string | null;
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

export type ProjectEnvironment = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  is_default: boolean;
  browser_launch: WorkflowSettingsBrowserLaunch;
  created_at: string;
  updated_at: string;
};

export type ProjectEnvironmentInput = {
  name: string;
  description?: string | null;
  is_default?: boolean | null;
  browser_launch?: WorkflowSettingsBrowserLaunch | null;
};

export type WorkflowEnvironmentSelection =
  | { mode: "project_default" }
  | { mode: "existing"; environment_id: string }
  | { mode: "isolated"; name?: string | null };

export type WorkflowCreateOptions = {
  project_id?: string | null;
  environment?: WorkflowEnvironmentSelection | null;
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
        target_ref?: string | null;
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
        target_ref?: string | null;
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
        target_ref?: string | null;
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
        target_ref?: string | null;
        iframe_xpath?: string | null;
        wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "find_element";
      config: {
        xpath?: string | null;
        target?: ElementTarget | null;
        iframe_xpath?: string | null;
        output_name: string;
        filter?: FindElementFilter | null;
        rank?: FindElementRank | null;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "scroll";
      config: {
        mode?: ScrollMode | null;
        direction?: ScrollDirection;
        pixels?: number;
        scroll_style?: ScrollStyle | null;
        xpath?: string | null;
        target?: ElementTarget | null;
        target_ref?: string | null;
        iframe_xpath?: string | null;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "select_option";
      config: {
        xpath?: string | null;
        target?: ElementTarget | null;
        target_ref?: string | null;
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
      config: ElementTargetActionConfig;
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
        source_ref?: string | null;
        target_xpath?: string | null;
        target_target?: ElementTarget | null;
        target_ref?: string | null;
        target_position?: DragTargetPosition | null;
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
        target_ref?: string | null;
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
        target_ref?: string | null;
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
        target_ref?: string | null;
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
        target_ref?: string | null;
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
        target_ref?: string | null;
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
        target_ref?: string | null;
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
  | {
      type: "random_choice";
      config: {
        output_name?: string | null;
        choices: Array<{
          id: string;
          label: string;
          weight: number;
          steps: CompiledNestedAction[];
        }>;
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

export type FindElementRank = "first" | "nearest_viewport_center" | "largest_visible_area";

export type FindElementFilter = {
  in_viewport?: boolean | null;
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
  target_ref?: string | null;
  iframe_xpath?: string | null;
  wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
  timeout_ms?: number | null;
};

type DataCaptureElementConfig = {
  xpath?: string | null;
  target?: ElementTarget | null;
  target_ref?: string | null;
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
  | "call_subflow"
  | "merge"
  | "router"
  | "random_choice"
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

export type CallSubflowGraphConfig = {
  subflow_id: string;
  input_mapping: Array<{
    input_name: string;
    value: string;
  }>;
  output_prefix?: string | null;
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
  delay?: GraphEdgeDelay | null;
};

export type WorkflowGraph = {
  version: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  viewport: GraphViewport;
  migration_notes?: WorkflowGraphMigrationNote[];
};

export type Subflow = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  tags: string[];
  graph: WorkflowGraph;
  created_at: string;
  updated_at: string;
};

export type SubflowSummary = Omit<Subflow, "graph"> & {
  used_by_count: number;
};

export type SubflowUsage = {
  workflow_id: string;
  workflow_name: string;
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

export type OperationsNavigationTarget =
  | { type: "workflow"; workflow_id: string }
  | { type: "schedule"; schedule_id: string }
  | { type: "evidence"; evidence_id: string };

export type MissionControlTarget =
  | { type: "overview"; focus?: "attention" | "recent_evidence" | "live_runs" }
  | {
      type: "workflow";
      workflow_id: string;
      mode?: "list" | "detail" | "graph" | "settings";
    }
  | { type: "evidence"; evidence_id?: string | null; filters?: EvidenceListRequest | null }
  | { type: "identity"; target: IdentityLabTarget }
  | { type: "schedule"; schedule_id?: string | null; schedule_event_id?: string | null }
  | {
      type: "graph_issue";
      workflow_id: string;
      node_id?: string | null;
      issue_id?: string | null;
      run_id?: string | null;
      evidence_id?: string | null;
    };

export type OperationsOverviewRequest = {
  day_start_utc: string;
  day_end_utc: string;
  timezone_label?: string | null;
  attention_filter?: {
    source_kind?: Array<"launch_blocked" | "run_failed" | "schedule_event"> | null;
    severity?: Array<"warning" | "failure"> | null;
  } | null;
  limits?: {
    live_runs?: number | null;
    attention?: number | null;
    recent_evidence?: number | null;
    upcoming_schedules?: number | null;
  } | null;
};

export type OverviewMetrics = {
  active_runs: number;
  succeeded_today: number;
  attention_today: number;
  upcoming_schedules: number;
};

export type OverviewLiveRun = {
  run_id: string;
  workflow_id: string;
  workflow_name: string;
  source: WorkflowRunSource;
  status: RunStatus;
  current_step_id?: string | null;
  current_step_number?: number | null;
  started_at: string;
  identity_display_name: string | null;
  navigation_target: OperationsNavigationTarget;
};

export type OverviewAttentionItem = {
  id: string;
  source_kind: "launch_blocked" | "run_failed" | "schedule_event";
  severity: "warning" | "failure";
  occurred_at: string;
  title: string;
  summary: string;
  workflow: { id: string; name: string };
  run_id?: string | null;
  schedule_id?: string | null;
  schedule_event_type?: WorkflowScheduleStatus | null;
  navigation_target: OperationsNavigationTarget;
};

export type OverviewActivityBucket = {
  bucket_start_utc: string;
  bucket_end_utc: string;
  succeeded: number;
  failed: number;
  blocked: number;
  schedule_attention: number;
};

export type OverviewEvidenceItem = {
  evidence_id: string;
  artifact_kind: string;
  relative_path_or_label: string;
  created_at?: string | null;
  run_id: string;
  workflow: { id: string; name: string };
  node_id?: string | null;
  navigation_targets: {
    workflow?: OperationsNavigationTarget;
    evidence?: OperationsNavigationTarget;
  };
};

export type OverviewUpcomingSchedule = {
  schedule_id: string;
  workflow_id: string;
  workflow_name: string;
  schedule_name: string;
  next_run_at: string;
  last_status?: WorkflowScheduleStatus | null;
  last_reason?: string | null;
  navigation_target: OperationsNavigationTarget;
};

export type BoundedOperationsList<T> = {
  items: T[];
  total: number;
  has_more: boolean;
};

export type OperationsOverview = {
  generated_at: string;
  range: {
    day_start_utc: string;
    day_end_utc: string;
    timezone_label: string;
  };
  metrics: OverviewMetrics;
  live_runs: BoundedOperationsList<OverviewLiveRun>;
  attention: BoundedOperationsList<OverviewAttentionItem>;
  activity: OverviewActivityBucket[];
  recent_evidence: BoundedOperationsList<OverviewEvidenceItem>;
  upcoming_schedules: BoundedOperationsList<OverviewUpcomingSchedule>;
  data_warnings: { evidence_items_skipped: number };
};

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

export type WorkflowRunSource = "manual" | "schedule";

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
