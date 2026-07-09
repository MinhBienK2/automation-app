import {
  Blocks,
  GitFork,
  Hand,
  History,
  Keyboard,
  Maximize,
  MousePointer2,
  Plus,
  Redo2,
  StopCircle,
  Undo2,
  Variable,
  Workflow,
  Zap,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import type { GraphNodeType } from "../../../types/workflow";
import { IconButton } from "../../../components/ui/icon-button";
import {
  endNodeGroups,
  logicNodeGroups,
  variableNodeGroups,
} from "./WorkflowGraphPalettes";

type NodePaletteGroups = Array<{ label: string; nodes: GraphNodeType[] }>;

type WorkflowGraphToolbarProps = {
  graphKind?: "workflow" | "subflow";
  isArranging: boolean;
  isPanMode: boolean;
  isReadOnly?: boolean;
  onAddAction: () => void;
  onAddNewNode: () => void;
  onAddSubflow: () => void;
  onAutoArrange: () => void;
  onFitView: () => void;
  onOpenHistory?: () => void;
  onOpenShortcuts: () => void;
  onOpenNodePalette: (
    title: string,
    eyebrow: string,
    searchLabel: string,
    groups: NodePaletteGroups,
  ) => void;
  onRedo: () => void;
  onSelectMode: () => void;
  onTogglePanMode: () => void;
  onUndo: () => void;
  nodeCount: number;
  edgeCount: number;
  arrangeError: string | null;
  zoom: number;
  onZoomChange: (zoom: number) => void;
};

export function WorkflowGraphToolbar({
  graphKind = "workflow",
  isArranging,
  isPanMode,
  isReadOnly = false,
  onAddAction,
  onAddNewNode,
  onAddSubflow,
  onAutoArrange,
  onFitView,
  onOpenHistory,
  onOpenShortcuts,
  onOpenNodePalette,
  onRedo,
  onSelectMode,
  onTogglePanMode,
  onUndo,
  nodeCount,
  edgeCount,
  arrangeError,
  zoom,
  onZoomChange,
}: WorkflowGraphToolbarProps) {
  const visibleLogicNodeGroups =
    graphKind === "subflow"
      ? logicNodeGroups
          .map((group) => ({
            ...group,
            nodes: group.nodes.filter((nodeType) => nodeType !== "call_subflow"),
          }))
          .filter((group) => group.nodes.length > 0)
      : logicNodeGroups;

  return (
    <div className="graph-toolbar" role="toolbar" aria-label="Graph tools">
      <div className="graph-icon-tools" aria-label="Graph edit and view tools">
        <IconButton
          label="Undo"
          type="button"
          variant="ghost"
          disabled={isReadOnly}
          onClick={onUndo}
        >
          <Undo2 aria-hidden="true" />
        </IconButton>
        <IconButton
          label="Redo"
          type="button"
          variant="ghost"
          disabled={isReadOnly}
          onClick={onRedo}
        >
          <Redo2 aria-hidden="true" />
        </IconButton>
        <IconButton
          label="Select canvas mode"
          aria-pressed={!isPanMode}
          type="button"
          variant="ghost"
          onClick={onSelectMode}
        >
          <MousePointer2 aria-hidden="true" />
        </IconButton>
        <IconButton
          label="Pan canvas mode"
          aria-pressed={isPanMode}
          type="button"
          variant="ghost"
          onClick={onTogglePanMode}
        >
          <Hand aria-hidden="true" />
        </IconButton>
        <IconButton
          label="Fit graph view"
          type="button"
          variant="ghost"
          onClick={onFitView}
        >
          <Maximize aria-hidden="true" />
        </IconButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="btn btn-ghost btn-sm text-xs font-semibold px-2 min-w-[64px] rounded-md h-9 border border-transparent hover:border-base-300 flex items-center justify-between gap-1"
              title="Zoom Level"
            >
              <span>{Math.round(zoom * 100)}%</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-24">
            {[0.1, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((level) => (
              <DropdownMenuItem key={level} onClick={() => onZoomChange(level)}>
                <span>{level * 100}%</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={onFitView}>
              <span>Fit View</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <IconButton
          label="Auto arrange graph"
          disabled={isArranging || isReadOnly}
          type="button"
          variant="ghost"
          onClick={onAutoArrange}
        >
          <Workflow aria-hidden="true" />
        </IconButton>
      </div>

      <div className="graph-node-tools" aria-label="Graph node creation tools">
        <IconButton
          label="New node"
          type="button"
          variant="ghost"
          disabled={isReadOnly}
          onClick={onAddNewNode}
        >
          <Plus aria-hidden="true" />
        </IconButton>
        <IconButton
          label="Add Action"
          type="button"
          variant="ghost"
          disabled={isReadOnly}
          onClick={onAddAction}
        >
          <Zap aria-hidden="true" />
        </IconButton>
        {graphKind === "workflow" ? (
          <IconButton
            label="Add Subflow"
            type="button"
            variant="ghost"
            disabled={isReadOnly}
            onClick={onAddSubflow}
          >
            <Blocks aria-hidden="true" />
          </IconButton>
        ) : null}
        <IconButton
          label="Add Logic"
          type="button"
          variant="ghost"
          disabled={isReadOnly}
          onClick={() =>
            onOpenNodePalette(
              "Choose a logic node",
              "Add Logic Node",
              "Search logic nodes",
              visibleLogicNodeGroups,
            )
          }
        >
          <GitFork aria-hidden="true" />
        </IconButton>
        <IconButton
          label="Add Variable"
          type="button"
          variant="ghost"
          disabled={isReadOnly}
          onClick={() =>
            onOpenNodePalette(
              "Choose a variable node",
              "Add Variable Node",
              "Search variable nodes",
              variableNodeGroups,
            )
          }
        >
          <Variable aria-hidden="true" />
        </IconButton>
        <IconButton
          label="Add End"
          type="button"
          variant="ghost"
          disabled={isReadOnly}
          onClick={() =>
            onOpenNodePalette(
              "Choose an end node",
              "Add End Node",
              "Search end nodes",
              endNodeGroups,
            )
          }
        >
          <StopCircle aria-hidden="true" />
        </IconButton>
      </div>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "12px" }}>
        {onOpenHistory ? (
          <IconButton
            label="Revision history"
            type="button"
            variant="ghost"
            disabled={isReadOnly}
            onClick={onOpenHistory}
          >
            <History aria-hidden="true" />
          </IconButton>
        ) : null}
        <IconButton
          label="Shortcuts"
          type="button"
          variant="ghost"
          onClick={onOpenShortcuts}
        >
          <Keyboard aria-hidden="true" />
        </IconButton>
        <div className="graph-toolbar-summary" aria-label="Graph summary">
          {nodeCount} nodes / {edgeCount} edges
          {isArranging ? (
            <span role="status" className="graph-toolbar-status">Arranging...</span>
          ) : null}
          {arrangeError ? (
            <span className="graph-arrange-error" role="status">{arrangeError}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
