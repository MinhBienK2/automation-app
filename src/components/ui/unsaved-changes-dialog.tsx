import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./dialog";

type UnsavedChangesDialogProps = {
  open: boolean;
  onKeepEditing: () => void;
  onDiscardChanges: () => void;
  onSaveAndClose: () => void | boolean | Promise<unknown>;
};

export function UnsavedChangesDialog({
  open,
  onKeepEditing,
  onDiscardChanges,
  onSaveAndClose,
}: UnsavedChangesDialogProps) {
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setSaving(false);
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onKeepEditing();
      }}
    >
      <DialogContent className="unsaved-changes-dialog">
        <DialogHeader>
          <DialogTitle>Unsaved changes</DialogTitle>
          <DialogDescription>
            You have unsaved changes. Save them before closing, discard them, or keep
            editing.
          </DialogDescription>
        </DialogHeader>
        <div className="unsaved-changes-actions">
          <Button
            shape="pill"
            type="button"
            disabled={saving}
            loading={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSaveAndClose();
              } finally {
                setSaving(false);
              }
            }}
          >
            <Save aria-hidden="true" />
            Save and close
          </Button>
          <Button variant="secondary" type="button" disabled={saving} onClick={onDiscardChanges}>
            Discard changes
          </Button>
          <Button variant="ghost" type="button" disabled={saving} onClick={onKeepEditing}>
            Keep editing
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
