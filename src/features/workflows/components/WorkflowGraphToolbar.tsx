import { Hand, Maximize, MousePointer2, Redo2, Undo2, Keyboard } from "lucide-react";
import type { GraphNodeType } from "../../../types/workflow";
import { Button } from "../../../components/ui/button";
import {
  endNodeGroups,
  logicNodeGroups,
  variableNodeGroups,
} from "./WorkflowGraphPalettes";

type NodePaletteGroups = Array<{ label: string; nodes: GraphNodeType[] }>;

type WorkflowGraphToolbarProps = {
  isPanMode: boolean;
  onAddAction: () => void;
  onAddNewNode: () => void;
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
  isPanMode,
  onAddAction,
  onAddNewNode,
  onFitView,
  onOpenShortcuts,
  onOpenNodePalette,
  onRedo,
  onSelectMode,
  onTogglePanMode,
  onUndo,
}: WorkflowGraphToolbarProps) {
  return (
    <div className="graph-toolbar" role="toolbar" aria-label="Graph tools">
      <div className="graph-icon-tools" aria-label="Graph edit and view tools">
        <Button
          aria-label="Undo"
          type="button"
          variant="ghost"
          size="icon"
          onClick={onUndo}
        >
          <Undo2 aria-hidden="true" />
        </Button>
        <Button
          aria-label="Redo"
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRedo}
        >
          <Redo2 aria-hidden="true" />
        </Button>
        <Button
          aria-label="Select canvas mode"
          aria-pressed={!isPanMode}
          type="button"
          variant="ghost"
          size="icon"
          onClick={onSelectMode}
        >
          <MousePointer2 aria-hidden="true" />
        </Button>
        <Button
          aria-label="Pan canvas mode"
          aria-pressed={isPanMode}
          type="button"
          variant="ghost"
          size="icon"
          onClick={onTogglePanMode}
        >
          <Hand aria-hidden="true" />
        </Button>
        <Button
          aria-label="Fit graph view"
          type="button"
          variant="ghost"
          size="icon"
          onClick={onFitView}
        >
          <Maximize aria-hidden="true" />
        </Button>
      </div>
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
      <Button
        aria-label="Shortcuts"
        type="button"
        variant="ghost"
        size="icon"
        onClick={onOpenShortcuts}
      >
        <Keyboard aria-hidden="true" />
      </Button>
    </div>
  );
}
