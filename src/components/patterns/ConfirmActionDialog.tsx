import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";

type ConfirmActionDialogProps = {
  open: boolean;
  actionName: string;
  affectedScope: string;
  consequence: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "destructive" | "warning" | "neutral";
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function ConfirmActionDialog({
  open,
  actionName,
  affectedScope,
  consequence,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "neutral",
  onOpenChange,
  onConfirm,
}: ConfirmActionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{actionName}</DialogTitle>
          <DialogDescription>{consequence}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <dl className="key-value-list">
            <div>
              <dt>Affected scope</dt>
              <dd>{affectedScope}</dd>
            </div>
          </dl>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === "destructive" ? "destructive" : tone === "warning" ? "secondary" : "primary"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
