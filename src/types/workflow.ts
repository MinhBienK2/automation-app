export type ActionType =
  | "navigate"
  | "wait"
  | "random_wait"
  | "input_text"
  | "clear_input"
  | "click"
  | "scroll"
  | "select_option"
  | "set_checkbox"
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
  | "switch_frame"
  | "accept_dialog"
  | "dismiss_dialog"
  | "set_download_directory"
  | "wait_for_download"
  | "set_variable"
  | "set_json_variables"
  | "assert_element"
  | "assert_text"
  | "if_condition"
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
  | "run_subworkflow"
  | "domain_allowlist"
  | "use_profile"
  | "save_session"
  | "load_session"
  | "set_cookie"
  | "clear_cookies"
  | "set_secret"
  | "use_proxy"
  | "set_user_agent"
  | "set_viewport"
  | "set_geolocation"
  | "set_extra_headers"
  | "grant_permission"
  | "detect_challenge"
  | "pause_for_human"
  | "resume_when_condition"
  | "fallback_selector"
  | "retry_step"
  | "checkpoint"
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
  | "environment"
  | "owned_test_gates";

export type WorkflowBrowserRetention = "retain" | "close";
export type WorkflowBrowserSessionMode = "temporary" | "persistent_profile";

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
  headless: boolean;
};

export type WorkflowSettingsEnvironment = {
  initial_variables: VariableAssignment[];
};

export type WorkflowSettingsOwnedTestGates = {
  fingerprint_preflight_enabled: boolean;
  fingerprint_probe_url?: string | null;
  fingerprint_profile_id?: string | null;
  fingerprint_allowed_origins: string[];
  fingerprint_proxy_label?: string | null;
  fingerprint_proxy_region?: string | null;
};

export type WorkflowSettingsMigrationNote = {
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
  owned_test_gates: WorkflowSettingsOwnedTestGates;
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
        typing_mode?: "set_value" | "type" | null;
        delay_ms?: number | null;
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
        method?: "select_all" | "backspace" | "dom" | null;
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
        mode?: "real" | "force_dom" | null;
        button?: "left" | "right" | "middle" | null;
        click_count?: number | null;
        scroll_into_view?: boolean | null;
        block?: "start" | "center" | "end" | "nearest" | null;
        inline?: "start" | "center" | "end" | "nearest" | null;
        position?:
          | "center"
          | "top_left"
          | "top_right"
          | "bottom_left"
          | "bottom_right"
          | "offset"
          | null;
        offset_x?: number | null;
        offset_y?: number | null;
        wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
        timeout_ms?: number | null;
        retry_interval_ms?: number | null;
        post_click_wait_ms?: number | null;
      };
    }
  | {
      type: "scroll";
      config: {
        mode?: "page" | "container" | "into_view" | "until_visible";
        direction: "up" | "down" | "left" | "right";
        pixels: number;
        xpath?: string | null;
        target?: ElementTarget | null;
        iframe_xpath?: string | null;
        behavior?: "instant" | "smooth" | null;
        block?: "start" | "center" | "end" | "nearest" | null;
        inline?: "start" | "center" | "end" | "nearest" | null;
        max_attempts?: number | null;
        wait_ms?: number | null;
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
  | {
      type: "set_checkbox";
      config: {
        xpath?: string | null;
        target?: ElementTarget | null;
        iframe_xpath?: string | null;
        state: "checked" | "unchecked";
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
  | { type: "switch_frame"; config: { xpath?: string | null; target?: ElementTarget | null } }
  | { type: "accept_dialog"; config: { prompt_text?: string | null } }
  | { type: "dismiss_dialog"; config: Record<string, never> }
  | { type: "set_download_directory"; config: { path: string } }
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
      type: "if_condition";
      config: {
        condition: WorkflowCondition;
        then_steps: CompiledNestedAction[];
        else_steps: CompiledNestedAction[];
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
  | {
      type: "run_subworkflow";
      config: {
        workflow_id: string;
        input_mapping: Array<{ source: string; target: string }>;
        output_mapping: Array<{ source: string; target: string }>;
      };
    }
  | { type: "domain_allowlist"; config: { domains: string[] } }
  | { type: "use_profile"; config: { name: string } }
  | { type: "save_session"; config: { path: string } }
  | { type: "load_session"; config: { path: string } }
  | {
      type: "set_cookie";
      config: { name: string; value: string; domain?: string | null; path?: string | null };
    }
  | { type: "clear_cookies"; config: { domain?: string | null } }
  | { type: "set_secret"; config: { name: string; value: string } }
  | {
      type: "use_proxy";
      config: { server: string; username?: string | null; password?: string | null };
    }
  | { type: "set_user_agent"; config: { user_agent: string } }
  | {
      type: "set_viewport";
      config: {
        width: number;
        height: number;
        device_scale_factor?: number | null;
        mobile: boolean;
        touch: boolean;
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
      type: "detect_challenge";
      config: { output_name: string; patterns: string[]; timeout_ms?: number | null };
    }
  | {
      type: "pause_for_human";
      config: { reason: string; timeout_ms?: number | null };
    }
  | {
      type: "resume_when_condition";
      config: { condition: WorkflowCondition; timeout_ms?: number | null };
    }
  | {
      type: "fallback_selector";
      config: { output_name: string; xpaths: string[]; timeout_ms?: number | null };
    }
  | {
      type: "retry_step";
      config: { max_attempts: number; delay_ms?: number | null; step: ActionConfig };
    }
  | {
      type: "checkpoint";
      config: { name: string; screenshot_path?: string | null };
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
  | "run_subworkflow"
  | "manual_approval"
  | "rate_limit"
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

export type ScheduleKind =
  | { kind: "once_at"; timestamp: string }
  | { kind: "interval"; every_seconds: number };

export type OrchestrationSchedule = {
  workflow_id: string;
  enabled: boolean;
  kind: ScheduleKind;
};

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
  owned_test_gates: WorkflowSettingsOwnedTestGates;
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
