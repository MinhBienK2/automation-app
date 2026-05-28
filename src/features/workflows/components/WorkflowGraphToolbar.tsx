import {
  AlignHorizontalDistributeCenter,
  Hand,
  Keyboard,
  Maximize,
  MousePointer2,
  Redo2,
  Undo2,
  Workflow,
} from "lucide-react";
import type { GraphNodeType } from "../../../types/workflow";
import { Button } from "../../../components/ui/button";
import { IconButton } from "../../../components/ui/icon-button";
import {
  endNodeGroups,
  logicNodeGroups,
  variableNodeGroups,
} from "./WorkflowGraphPalettes";

type NodePaletteGroups = Array<{ label: string; nodes: GraphNodeType[] }>;

type WorkflowGraphToolbarProps = {
  isArrangeSelectionDisabled: boolean;
  isArranging: boolean;
  isPanMode: boolean;
  onAddAction: () => void;
  onAddNewNode: () => void;
  onArrangeSelection: () => void;
  onAutoArrange: () => void;
  onFitView: () => void;
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
};

export function WorkflowGraphToolbar({
  isArrangeSelectionDisabled,
  isArranging,
  isPanMode,
  onAddAction,
  onAddNewNode,
  onArrangeSelection,
  onAutoArrange,
  onFitView,
  onOpenShortcuts,
  onOpenNodePalette,
  onRedo,
  onSelectMode,
  onTogglePanMode,
  onUndo,
}: WorkflowGraphToolbarProps) {
  const arrangeSelectionReason = isArranging
    ? "Arrange is already running."
    : isArrangeSelectionDisabled
    ? "Select at least two non-start nodes to arrange a selection."
    : "Arrange selected nodes";

  return (
    <div className="graph-toolbar" role="toolbar" aria-label="Graph tools">
      <div className="graph-toolbar-group graph-icon-tools" aria-label="History tools">
        <IconButton
          label="Undo"
          type="button"
          variant="ghost"
          onClick={onUndo}
        >
          <Undo2 aria-hidden="true" />
        </IconButton>
        <IconButton
          label="Redo"
          type="button"
          variant="ghost"
          onClick={onRedo}
        >
          <Redo2 aria-hidden="true" />
        </IconButton>
      </div>
      <div className="graph-toolbar-group graph-icon-tools" aria-label="Mode tools">
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
      </div>
      <div
        className="graph-toolbar-group graph-icon-tools"
        aria-label="View and layout tools"
      >
        <IconButton
          label="Fit graph view"
          type="button"
          variant="ghost"
          onClick={onFitView}
        >
          <Maximize aria-hidden="true" />
        </IconButton>
        <IconButton
          label="Auto arrange graph"
          disabled={isArranging}
          type="button"
          variant="ghost"
          onClick={onAutoArrange}
        >
          <Workflow aria-hidden="true" />
        </IconButton>
        <IconButton
          label="Arrange selection"
          tooltip={arrangeSelectionReason}
          disabled={isArrangeSelectionDisabled || isArranging}
          type="button"
          variant="ghost"
          onClick={onArrangeSelection}
        >
          <AlignHorizontalDistributeCenter aria-hidden="true" />
        </IconButton>
      </div>
      <div className="graph-toolbar-group graph-add-tools" aria-label="Add nodes">
        <Button type="button" variant="secondary" onClick={onAddNewNode}>
          New node
        </Button>
        <Button type="button" variant="secondary" onClick={onAddAction}>
          Add Action
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            onOpenNodePalette(
              "Choose a logic node",
              "Add Logic Node",
              "Search logic nodes",
              logicNodeGroups,
            )
          }
        >
          Add Logic
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            onOpenNodePalette(
              "Choose a variable node",
              "Add Variable Node",
              "Search variable nodes",
              variableNodeGroups,
            )
          }
        >
          Add Variable
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            onOpenNodePalette(
              "Choose an end node",
              "Add End Node",
              "Search end nodes",
              endNodeGroups,
            )
          }
        >
          Add End
        </Button>
      </div>
      <div className="graph-toolbar-group graph-icon-tools" aria-label="Graph help">
        <IconButton
          label="Shortcuts"
          type="button"
          variant="ghost"
          onClick={onOpenShortcuts}
        >
          <Keyboard aria-hidden="true" />
        </IconButton>
      </div>
    </div>
  );
}
