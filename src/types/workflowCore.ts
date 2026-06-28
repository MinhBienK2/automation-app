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
  | "count_elements"
  | "extract_regex_matches"
  | "take_screenshot"
  | "write_text_file"
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
  | "update_number_variable"
  | "update_text_variable"
  | "update_flag_variable"
  | "update_list_variable"
  | "update_object_variable"
  | "assert_element"
  | "assert_text"
  | "evaluate_logic"
  | "evaluate_expression"
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
  | "set_session_storage"
  | "get_current_url";

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
  browser_profile_id?: string | null;
  browser_profile_name?: string | null;
  created_at: string;
  updated_at: string;
};

export type Workflow = {
  id: string;
  name: string;
  project_id?: string | null;
  browser_profile_id?: string | null;
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

type CompiledNestedAction = ActionConfig & {
  graph_node_id?: string;
  graph_label?: string;
  graph_metadata?: {
    subflow?: {
      id: string;
      name: string;
      step_number: number;
      step_count: number;
    } | null;
  } | null;
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
        trigger_ref?: string | null;
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
      type: "count_elements";
      config: DataCaptureElementConfig;
    }
  | {
      type: "extract_regex_matches";
      config: {
        source_name: string;
        pattern: string;
        flags?: string | null;
        output_name: string;
        append?: boolean | null;
        dedupe?: boolean | null;
      };
    }
  | {
      type: "take_screenshot";
      config: {
        path: string;
        output_name?: string | null;
        full_page: boolean;
      };
    }
  | {
      type: "write_text_file";
      config: {
        source_name: string;
        path: string;
        output_name: string;
        separator?: string | null;
        include_trailing_newline?: boolean | null;
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
      type: "update_number_variable";
      config: {
        name: string;
        operation: "increment" | "decrement" | "add" | "subtract" | "multiply" | "divide";
        value?: string | null;
      };
    }
  | {
      type: "update_text_variable";
      config: {
        name: string;
        operation: "append" | "prepend" | "replace" | "uppercase" | "lowercase" | "trim";
        value?: string | null;
        search_pattern?: string | null;
      };
    }
  | {
      type: "update_flag_variable";
      config: {
        name: string;
        operation: "toggle" | "set_true" | "set_false";
      };
    }
  | {
      type: "update_list_variable";
      config: {
        name: string;
        operation: "push" | "unshift" | "push_unique" | "pop" | "shift" | "remove_by_index" | "remove_by_value" | "merge" | "merge_unique";
        value?: string | null;
        value_type?: VariableValueType | null;
        index?: number | string | null;
      };
    }
  | {
      type: "update_object_variable";
      config: {
        name: string;
        operation: "merge" | "deep_merge" | "set_key" | "delete_key";
        value?: string | null;
        property_key?: string | null;
        property_value?: string | null;
        property_value_type?: VariableValueType | null;
      };
    }
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
    }
  | {
      type: "get_current_url";
      config: Record<string, never>;
    }
  | {
      type: "evaluate_logic";
      config: EvaluateLogicConfig;
    }
  | {
      type: "evaluate_expression";
      config: EvaluateExpressionConfig;
    }
  | {
      type: "quarantined";
      config: {
        original_type: string | null;
        reason: "unknown_type" | "invalid_config" | "parse_error";
        message: string;
        original_payload: unknown;
      };
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
  | { kind: "variable_is_true"; name: string }
  | { kind: "text_visible"; text: string }
  | { kind: "url_contains"; value: string }
  | {
      kind: "element_visible";
      xpath?: string | null;
      target?: ElementTarget | null;
      target_ref?: string | null;
    };

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

export type EvaluateLogicConfig = {
  output_name: string;
  mode: "visual" | "script";
  script?: string;
  rules_group?: LogicRuleGroup;
  evaluation_type?: "static" | "dynamic";
};

export type EvaluateExpressionConfig = {
  output_name: string;
  expression: string;
  evaluation_type?: "static" | "dynamic";
};

export type LogicRuleGroup = {
  operator: "and" | "or";
  rules: Array<LogicRule | LogicRuleGroup>;
};

export type LogicRule = {
  type: "value_compare" | "element_state" | "url_check";
  
  // value_compare
  left_operand?: string;
  comparison?:
    | "equals"
    | "not_equals"
    | "contains"
    | "not_contains"
    | "greater_than"
    | "less_than"
    | "greater_than_or_equals"
    | "less_than_or_equals"
    | "is_empty"
    | "is_not_empty"
    | "matches_regex";
  right_operand?: string;

  // element_state
  element_source?: "xpath" | "ref";
  xpath?: string;
  target_ref?: string;
  element_property?:
    | "visible"
    | "hidden"
    | "enabled"
    | "disabled"
    | "checked"
    | "unchecked";

  // url_check
  url_comparison?: "contains" | "not_contains" | "matches_regex";
  url_value?: string;
};

