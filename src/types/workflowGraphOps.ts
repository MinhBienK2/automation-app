import type {
  ActionConfig,
  ActionType,
  GraphEdgeDelay,
  RunStatus,
  Workflow,
  WorkflowCondition,
  WorkflowGraphMigrationNote,
} from "./workflowCore.js";
import type { EvidenceListRequest, IdentityLabTarget } from "./workflowEvidenceRecording.js";

export type WorkflowRunSource = "manual" | "schedule";

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

export type CompiledStepMetadata = {
  subflow?: {
    id: string;
    name: string;
    step_number: number;
    step_count: number;
  } | null;
};

export type CompiledGraphStep = {
  node_id: string;
  label: string;
  config: ActionConfig;
  metadata?: CompiledStepMetadata | null;
};

export type CompiledNestedAction = ActionConfig & {
  graph_node_id?: string;
  graph_label?: string;
  graph_metadata?: CompiledStepMetadata | null;
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
  | {
      type: "workflow";
      workflow_id: string;
      mode?: "list" | "detail" | "graph" | "settings";
    }
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
