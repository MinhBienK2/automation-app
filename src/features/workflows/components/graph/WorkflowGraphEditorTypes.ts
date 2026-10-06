import type {
  GraphEdgeDelay,
  GraphPort,
  GraphValidationIssue,
  RunState,
  Subflow,
  SubflowSummary,
  WorkflowGraph,
} from "../../../../types/workflow";

export type WorkflowGraphEditorProps = {
  graph: WorkflowGraph;
  graphKind?: "workflow" | "subflow";
  runState: RunState;
  validationIssues: GraphValidationIssue[];
  subflowOptions?: SubflowSummary[];
  selectionRequest?: GraphSelectionRequest | null;
  onChange: (graph: WorkflowGraph) => void;
  onCreateSubflowFromSelection?: (input: {
    name: string;
    graph: WorkflowGraph;
  }) => Promise<Pick<Subflow, "id" | "name">>;
  onLoadSubflowGraph?: (subflowId: string) => Promise<WorkflowGraph>;
  onRunGraph?: () => void;
  onSelectedNodeChange?: (nodeId: string | null) => void;
  onOpenSubflowDetail?: (subflowId: string) => void;
  onSaveGraph?: (options?: { comment?: string; tag?: string }) => void | Promise<unknown>;
  onValidateGraph?: () => void;
  onRestoreRevision?: (graph: WorkflowGraph) => void | Promise<void>;
  ownerId?: string;
  defaultEdgeDelay?: GraphEdgeDelay | null;
  initialVariables?: Array<{ name: string; value: string }> | null;
  profileVariables?: Array<{ name: string; value: string }> | null;
};

export type GraphSelectionRequest = {
  requestId: number;
  nodeId?: string | null;
  edgeId?: string | null;
};

export type ActivePortConnection = {
  nodeId: string;
  portId: string;
  direction: GraphPort["direction"];
} | null;

export const graphMiniMapNodeLimit = 300;
