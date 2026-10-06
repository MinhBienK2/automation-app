import type { ReactNode } from "react";
import type {
  ActionType,
  GraphNode,
  GraphNodeType,
  SubflowSummary,
  WorkflowGraph,
} from "../../../../types/workflow";
import type { NodePaletteState, SubflowAddMode } from "../../lib/workflowGraphUi";
import { RevisionHistoryDrawer } from "../run/RevisionHistoryDrawer";
import { ActionNodePalette } from "./ActionNodePalette";
import { SubflowNodePalette } from "./SubflowNodePalette";
import { GraphNodePalette } from "./WorkflowGraphPalettes";
import { NodeHelpDialog } from "../dialogs/NodeHelpDialog";
import { WorkflowGraphEditorDialogs } from "./WorkflowGraphEditorDialogs";

export type WorkflowGraphEditorOverlaysProps = {
  ownerId?: string | null;
  graphKind: "workflow" | "subflow";
  isHistoryOpen: boolean;
  setIsHistoryOpen: (open: boolean) => void;
  graph: WorkflowGraph;
  onSaveGraph?: () => Promise<void>;
  onRestoreRevision?: (graph: WorkflowGraph) => Promise<void>;
  onChange: (graph: WorkflowGraph) => void;
  isActionPaletteOpen: boolean;
  setIsActionPaletteOpen: (open: boolean) => void;
  addActionNode: (actionType: ActionType) => void;
  isSubflowPaletteOpen: boolean;
  setIsSubflowPaletteOpen: (open: boolean) => void;
  subflowOptions: SubflowSummary[];
  subflowInsertError: string | null;
  setSubflowInsertError: (error: string | null) => void;
  isInsertingSubflowNodes: boolean;
  addSubflowNode: (subflow: SubflowSummary, mode?: SubflowAddMode) => void;
  nodePalette: NodePaletteState | null;
  setNodePalette: (palette: NodePaletteState | null) => void;
  addNode: (nodeType: GraphNodeType) => void;
  helpNode: GraphNode | null;
  setHelpNode: (node: GraphNode | null) => void;
  helpLanguage: "vi" | "en";
  setHelpLanguage: (lang: "vi" | "en") => void;
  isShortcutGuideOpen: boolean;
  setIsShortcutGuideOpen: (open: boolean) => void;
  isSelectionSubflowDialogOpen: boolean;
  setIsSelectionSubflowDialogOpen: (open: boolean) => void;
  isCreatingSelectionSubflow: boolean;
  selectionSubflowName: string;
  selectionSubflowError: string | null;
  setSelectionSubflowName: (name: string) => void;
  resetSelectionSubflowDialog: () => void;
  createSubflowFromSelection: (mode: "link_subflow" | "keep_selection") => Promise<void>;
};

export function WorkflowGraphEditorOverlays(props: WorkflowGraphEditorOverlaysProps): ReactNode {
  const {
    ownerId,
    graphKind,
    isHistoryOpen,
    setIsHistoryOpen,
    graph,
    onSaveGraph,
    onRestoreRevision,
    onChange,
    isActionPaletteOpen,
    setIsActionPaletteOpen,
    addActionNode,
    isSubflowPaletteOpen,
    setIsSubflowPaletteOpen,
    subflowOptions,
    subflowInsertError,
    setSubflowInsertError,
    isInsertingSubflowNodes,
    addSubflowNode,
    nodePalette,
    setNodePalette,
    addNode,
    helpNode,
    setHelpNode,
    helpLanguage,
    setHelpLanguage,
    isShortcutGuideOpen,
    setIsShortcutGuideOpen,
    isSelectionSubflowDialogOpen,
    setIsSelectionSubflowDialogOpen,
    isCreatingSelectionSubflow,
    selectionSubflowName,
    selectionSubflowError,
    setSelectionSubflowName,
    resetSelectionSubflowDialog,
    createSubflowFromSelection,
  } = props;

  return (
    <>
      {ownerId ? (
        <RevisionHistoryDrawer
          open={isHistoryOpen}
          ownerId={ownerId}
          ownerKind={graphKind}
          onClose={() => setIsHistoryOpen(false)}
          onRestore={async (restoredGraph) => {
            if (onRestoreRevision) {
              await onRestoreRevision(restoredGraph);
            } else {
              onChange(restoredGraph);
            }
            setIsHistoryOpen(false);
          }}
          onSaveBackup={onSaveGraph}
          currentGraph={graph}
        />
      ) : null}

      <ActionNodePalette
        open={isActionPaletteOpen}
        onOpenChange={setIsActionPaletteOpen}
        onSelectAction={addActionNode}
      />
      <SubflowNodePalette
        open={isSubflowPaletteOpen}
        subflows={subflowOptions}
        error={subflowInsertError}
        isSelecting={isInsertingSubflowNodes}
        onOpenChange={(open: boolean) => {
          setIsSubflowPaletteOpen(open);
          if (open) setSubflowInsertError(null);
        }}
        onSelectSubflow={addSubflowNode}
      />
      <GraphNodePalette
        palette={nodePalette}
        onOpenChange={(open: boolean) => {
          if (!open) setNodePalette(null);
        }}
        onSelectNode={addNode}
      />
      <NodeHelpDialog
        node={helpNode}
        language={helpLanguage}
        onOpenChange={(open: boolean) => !open && setHelpNode(null)}
        onLanguageChange={setHelpLanguage}
      />
      <WorkflowGraphEditorDialogs
        isShortcutGuideOpen={isShortcutGuideOpen}
        isSelectionSubflowDialogOpen={isSelectionSubflowDialogOpen}
        isCreatingSelectionSubflow={isCreatingSelectionSubflow}
        selectionSubflowName={selectionSubflowName}
        selectionSubflowError={selectionSubflowError}
        onShortcutGuideOpenChange={setIsShortcutGuideOpen}
        onSelectionSubflowDialogOpenChange={setIsSelectionSubflowDialogOpen}
        onSelectionSubflowNameChange={setSelectionSubflowName}
        onResetSelectionSubflowDialog={resetSelectionSubflowDialog}
        onCreateSubflowFromSelection={(mode) => {
          void createSubflowFromSelection(mode);
        }}
      />
    </>
  );
}
