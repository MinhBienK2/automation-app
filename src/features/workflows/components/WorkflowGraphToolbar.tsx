import type { GraphNodeType } from "../../../types/workflow";
import { Button } from "../../../components/ui/button";
import {
  endNodeGroups,
  logicNodeGroups,
  outputNodeGroups,
  variableNodeGroups,
} from "./WorkflowGraphPalettes";

type NodePaletteGroups = Array<{ label: string; nodes: GraphNodeType[] }>;

type WorkflowGraphToolbarProps = {
  onAddAction: () => void;
  onFitView: () => void;
  onOpenNodePalette: (
    title: string,
    eyebrow: string,
    searchLabel: string,
    groups: NodePaletteGroups,
  ) => void;
};

export function WorkflowGraphToolbar({
  onAddAction,
  onFitView,
  onOpenNodePalette,
}: WorkflowGraphToolbarProps) {
  return (
    <div className="graph-toolbar" role="toolbar" aria-label="Graph tools">
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
            "Choose an output node",
            "Add Output Node",
            "Search output nodes",
            outputNodeGroups,
          )
        }
      >
        Add Output
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
      <Button type="button" variant="secondary" onClick={onFitView}>
        Fit
      </Button>
    </div>
  );
}
