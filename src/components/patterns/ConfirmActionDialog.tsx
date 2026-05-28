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
  preserved?: string;
  confirmLabel: string;
  cancelLabel?: string;
  pending?: boolean;
  pendingLabel?: string;
  error?: string;
  tone?: "destructive" | "warning" | "neutral";
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function ConfirmActionDialog({
  open,
  actionName,
  affectedScope,
  consequence,
  preserved,
  confirmLabel,
  cancelLabel = "Cancel",
  pending = false,
  pendingLabel,
  error,
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
            {preserved ? (
              <div>
                <dt>Preserved</dt>
                <dd>{preserved}</dd>
              </div>
            ) : null}
          </dl>
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={
              tone === "destructive"
                ? "destructive"
                : tone === "warning"
                  ? "secondary"
                  : "primary"
            }
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? pendingLabel ?? "Working..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
