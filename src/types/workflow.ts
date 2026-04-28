export type ActionType =
  | "navigate"
  | "open_url"
  | "sleep"
  | "wait"
  | "input_text"
  | "type_text"
  | "clear_input"
  | "click"
  | "scroll"
  | "select_option"
  | "set_checkbox"
  | "press_key"
  | "hotkey"
  | "hover";

export type RunStatus = "idle" | "running" | "success" | "failed" | "stopped";
export type RunMode = "none" | "run_workflow" | "test_step";

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

export type ActionConfig =
  | {
      type: "navigate";
      config: {
        url: string;
        wait_until?: "load" | "dom_content_loaded" | "network_idle" | null;
        timeout_ms?: number | null;
      };
    }
  | { type: "open_url"; config: { url: string } }
  | { type: "sleep"; config: { seconds: number } }
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
      };
    }
  | {
      type: "input_text";
      config: {
        xpath: string;
        iframe_xpath?: string | null;
        text: string;
        clear_before_input: boolean;
        typing_mode?: "set_value" | "type" | null;
        delay_ms?: number | null;
        wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
        timeout_ms?: number | null;
      };
    }
  | { type: "type_text"; config: { xpath: string; text: string } }
  | {
      type: "clear_input";
      config: {
        xpath: string;
        iframe_xpath?: string | null;
        method?: "select_all" | "backspace" | "dom" | null;
        wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
        timeout_ms?: number | null;
      };
    }
  | {
      type: "click";
      config: {
        xpath: string;
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
        xpath: string;
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
        xpath: string;
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
        iframe_xpath?: string | null;
        wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
        timeout_ms?: number | null;
      };
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

export type RunState = {
  status: RunStatus;
  mode: RunMode;
  target_step_id: string | null;
  current_step_id: string | null;
  current_step_number: number | null;
  completed_step_ids: string[];
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
