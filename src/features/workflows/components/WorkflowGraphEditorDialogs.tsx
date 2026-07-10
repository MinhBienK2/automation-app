import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { GraphShortcutGuide } from "./GraphShortcutGuide";
import type { SelectionSubflowMode } from "./useSelectionSubflowCreator";

import { FormField } from "../../../components/ui/form-field";

type WorkflowGraphEditorDialogsProps = {
  isShortcutGuideOpen: boolean;
  isSelectionSubflowDialogOpen: boolean;
  isCreatingSelectionSubflow: boolean;
  selectionSubflowName: string;
  selectionSubflowError: string | null;
  onShortcutGuideOpenChange: (open: boolean) => void;
  onSelectionSubflowDialogOpenChange: (open: boolean) => void;
  onSelectionSubflowNameChange: (value: string) => void;
  onResetSelectionSubflowDialog: () => void;
  onCreateSubflowFromSelection: (mode: SelectionSubflowMode) => void;
};

export function WorkflowGraphEditorDialogs({
  isShortcutGuideOpen,
  isSelectionSubflowDialogOpen,
  isCreatingSelectionSubflow,
  selectionSubflowName,
  selectionSubflowError,
  onShortcutGuideOpenChange,
  onSelectionSubflowDialogOpenChange,
  onSelectionSubflowNameChange,
  onResetSelectionSubflowDialog,
  onCreateSubflowFromSelection,
}: WorkflowGraphEditorDialogsProps) {
  function closeSelectionSubflowDialog() {
    onSelectionSubflowDialogOpenChange(false);
    onResetSelectionSubflowDialog();
  }

  return (
    <>
      <Dialog open={isShortcutGuideOpen} onOpenChange={onShortcutGuideOpenChange}>
        <DialogContent className="graph-shortcuts-dialog max-w-none">
          <DialogHeader className="modal-header">
            <div>
              <p className="eyebrow">Visual Graph</p>
              <DialogTitle>Graph Shortcuts</DialogTitle>
              <DialogDescription>
                Mouse and keyboard controls for selecting, moving, editing, and running graph workflows.
              </DialogDescription>
            </div>
          </DialogHeader>
          <GraphShortcutGuide />
        </DialogContent>
      </Dialog>
      <Dialog
        open={isSelectionSubflowDialogOpen}
        onOpenChange={(open) => {
          if (isCreatingSelectionSubflow) return;
          onSelectionSubflowDialogOpenChange(open);
          if (!open) onResetSelectionSubflowDialog();
        }}
      >
        <DialogContent>
          <DialogHeader className="modal-header">
            <div>
              <p className="eyebrow">Reusable block</p>
              <DialogTitle>Create subflow from selection</DialogTitle>
              <DialogDescription>
                Create a reusable subflow from the selected graph nodes.
              </DialogDescription>
            </div>
          </DialogHeader>
          <FormField
            label="Subflow name"
            htmlFor="subflow-name-input"
            error={selectionSubflowError ?? undefined}
          >
            <Input
              id="subflow-name-input"
              autoFocus
              value={selectionSubflowName}
              onChange={(event) => onSelectionSubflowNameChange(event.currentTarget.value)}
              placeholder="Login block"
            />
          </FormField>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={isCreatingSelectionSubflow}
              onClick={closeSelectionSubflowDialog}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={isCreatingSelectionSubflow}
              onClick={() => onCreateSubflowFromSelection("create_only")}
            >
              Create Only
            </Button>
            <Button
              type="button"
              disabled={isCreatingSelectionSubflow}
              onClick={() => onCreateSubflowFromSelection("create_and_replace")}
            >
              Create & Replace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
