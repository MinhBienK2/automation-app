import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import type {
  GraphNode,
  RunState,
  SubflowSummary,
  WorkflowGraph,
} from "../../../../types/workflow";
import type { GraphValidationIssueGroup } from "../../lib/workflowGraph";
import { WorkflowGraphInspector } from "../inspector/WorkflowGraphInspector";

export type WorkflowGraphInspectorDrawerProps = {
  inspectorOpen: boolean;
  isInspectorCollapsed: boolean;
  setIsInspectorCollapsed: (collapsed: boolean) => void;
  graph: WorkflowGraph;
  issueGroups: GraphValidationIssueGroup[];
  nodeLabels: Record<string, string>;
  runState: RunState;
  selectionSummary: string;
  selectedEdge: WorkflowGraph["edges"][number] | null;
  selectedNode: GraphNode | null;
  subflowOptions?: SubflowSummary[];
  initialVariables?: Array<{ name: string; value: string }> | null;
  profileVariables?: Array<{ name: string; value: string }> | null;
  graphKind: "workflow" | "subflow";
  onCreateSubflowFromSelection?: unknown;
  openSelectionSubflowDialog: () => void;
  onCopySelection: () => void;
  onDeleteSelection: () => void;
  onDeleteSelectedEdge: () => void;
  onDeleteSelectedNode: () => void;
  onDuplicateSelection: () => void;
  onFocusSelectedNode: () => void;
  setHelpNode: (node: GraphNode | null) => void;
  onOpenSubflowDetail?: (subflowId: string) => void;
  closeInspector: () => void;
  updateEdge: (edge: WorkflowGraph["edges"][number]) => void;
  updateNode: (node: GraphNode) => void;
};

export function WorkflowGraphInspectorDrawer(props: WorkflowGraphInspectorDrawerProps): ReactNode {
  const {
    inspectorOpen,
    isInspectorCollapsed,
    setIsInspectorCollapsed,
    graph,
    issueGroups,
    nodeLabels,
    runState,
    selectionSummary,
    selectedEdge,
    selectedNode,
    subflowOptions,
    initialVariables,
    profileVariables,
    graphKind,
    onCreateSubflowFromSelection,
    openSelectionSubflowDialog,
    onCopySelection,
    onDeleteSelection,
    onDeleteSelectedEdge,
    onDeleteSelectedNode,
    onDuplicateSelection,
    onFocusSelectedNode,
    setHelpNode,
    onOpenSubflowDetail,
    closeInspector,
    updateEdge,
    updateNode,
  } = props;

  if (!inspectorOpen) return null;

  if (isInspectorCollapsed) {
    return (
      <button
        type="button"
        className="graph-inspector-expand-trigger"
        title="Expand inspector"
        onClick={() => setIsInspectorCollapsed(false)}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>
    );
  }

  return (
    <aside
      className="graph-inspector-drawer"
      aria-label="Graph inspector drawer"
    >
      <WorkflowGraphInspector
        graph={graph}
        issueGroups={issueGroups}
        nodeLabels={nodeLabels}
        runState={runState}
        selectionSummary={selectionSummary}
        selectedEdge={selectedEdge}
        selectedNode={selectedNode}
        subflowOptions={subflowOptions}
        initialVariables={initialVariables}
        profileVariables={profileVariables}
        onCopySelection={onCopySelection}
        onCreateSubflowFromSelection={
          graphKind === "workflow" && onCreateSubflowFromSelection
            ? openSelectionSubflowDialog
            : undefined
        }
        onDeleteSelection={onDeleteSelection}
        onDeleteSelectedEdge={onDeleteSelectedEdge}
        onDeleteSelectedNode={onDeleteSelectedNode}
        onDuplicateSelection={onDuplicateSelection}
        onFocusSelectedNode={onFocusSelectedNode}
        onOpenSelectedNodeHelp={() => setHelpNode(selectedNode)}
        onOpenSubflowDetail={onOpenSubflowDetail}
        onClose={closeInspector}
        onUpdateEdge={updateEdge}
        onUpdateNode={updateNode}
        onToggleCollapse={() => setIsInspectorCollapsed(true)}
      />
    </aside>
  );
}
