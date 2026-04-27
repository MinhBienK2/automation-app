export type ActionType = "open_url" | "sleep" | "type_text" | "click" | "scroll";

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
  | { type: "open_url"; config: { url: string } }
  | { type: "sleep"; config: { seconds: number } }
  | { type: "type_text"; config: { xpath: string; text: string } }
  | { type: "click"; config: { xpath: string } }
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
