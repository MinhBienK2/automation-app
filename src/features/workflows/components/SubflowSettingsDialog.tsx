import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import type { Subflow, SubflowSummary } from "../../../types/workflow";

type EditableSubflow = Pick<Subflow | SubflowSummary, "id" | "name">;

type SubflowSettingsDialogProps = {
  subflow: EditableSubflow | null;
  onOpenChange: (open: boolean) => void;
  onSave: (input: { name: string }) => Promise<void>;
};

export function SubflowSettingsDialog({
  subflow,
  onOpenChange,
  onSave,
}: SubflowSettingsDialogProps) {
  const [nameDraft, setNameDraft] = useState("");
  const [localError, setLocalError] = useState("");
  const [saving, setSaving] = useState(false);
  const open = Boolean(subflow);

  useEffect(() => {
    if (!subflow) return;
    setNameDraft(subflow.name);
    setLocalError("");
    setSaving(false);
  }, [subflow]);

  async function submitSettings(event: React.FormEvent) {
    event.preventDefault();
    const name = nameDraft.trim();
    if (!name) {
      setLocalError("Subflow name is required");
      return;
    }
    setSaving(true);
    setLocalError("");
    try {
      await onSave({ name });
      onOpenChange(false);
    } catch (error) {
      setLocalError(commandMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onOpenChange(false);
      }}
    >
      <DialogContent className="workflow-dialog">
        <DialogHeader>
          <p className="eyebrow">Subflow</p>
          <DialogTitle>Subflow Settings</DialogTitle>
          <DialogDescription>
            Rename this reusable graph fragment for the current project.
          </DialogDescription>
        </DialogHeader>
        <form className="workflow-dialog-form" onSubmit={submitSettings}>
          <Label htmlFor="subflow-settings-name">Subflow name</Label>
          <Input
            autoFocus
            id="subflow-settings-name"
            value={nameDraft}
            onChange={(event) => setNameDraft(event.currentTarget.value)}
          />
          {localError ? (
            <p className="field-error" role="alert">
              {localError}
            </p>
          ) : null}
          <DialogFooter className="form-actions">
            <Button shape="pill" type="submit" disabled={saving}>
              Save Settings
            </Button>
            <Button
              variant="secondary"
              type="button"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function commandMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  if (error instanceof Error) return error.message;
  return "Unexpected command error";
}
