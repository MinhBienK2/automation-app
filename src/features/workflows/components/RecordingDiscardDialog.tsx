import { ConfirmActionDialog } from "../../../components/patterns/ConfirmActionDialog";

type RecordingDiscardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function RecordingDiscardDialog({
  open,
  onOpenChange,
  onConfirm,
}: RecordingDiscardDialogProps) {
  return (
    <ConfirmActionDialog
      open={open}
      actionName="Discard Recording"
      affectedScope="Current recorder session and unsaved generated draft"
      consequence="Discarded captured events cannot be recovered. Saved workflows and settings are not changed."
      confirmLabel="Discard Recording"
      cancelLabel="Keep Reviewing"
      tone="destructive"
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
    />
  );
}
