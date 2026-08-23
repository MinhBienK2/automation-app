import { useEffect, useMemo, useState } from "react";
import { Alert } from "../../../components/ui/alert";
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
import type {
  DesktopInspection,
  DesktopLocator,
  PickerElement,
} from "../../../types/desktopTargets";

/**
 * The element picker.
 *
 * An operator does not hand-write a Desktop Locator. This launches the
 * application the workflow drives, reads its accessibility tree once, and lets
 * them choose from it — and then shows the locator it wrote and, in a sentence,
 * why that one. `locator-model.md` asks for exactly that last part: the
 * difference between "the only button with this name" and "the second of four
 * identical buttons" is the difference between a step that lasts and one that
 * breaks on the next release, and it is invisible unless the picker says so.
 *
 * The locator is composed in the backend, next to the resolver that has to find
 * it again. This component displays and never derives.
 *
 * Spec: `docs/domain/desktop/locator-model.md`.
 */

type DesktopElementPickerDialogProps = {
  open: boolean;
  targetId: string | null;
  targetName?: string;
  onClose: () => void;
  onPick: (locator: DesktopLocator) => void;
  inspect: (targetId: string) => Promise<DesktopInspection>;
};

const MATCH_COPY: Record<PickerElement["suggestion"]["matchedBy"], string> = {
  automation_id: "Automation ID",
  name: "Name",
  ancestry: "Name and container",
  ordinal: "Position",
};

export function DesktopElementPickerDialog({
  open,
  targetId,
  targetName,
  onClose,
  onPick,
  inspect,
}: DesktopElementPickerDialogProps) {
  const [inspection, setInspection] = useState<DesktopInspection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !targetId) return;

    let cancelled = false;
    setLoading(true);
    setError("");
    setInspection(null);
    setSelected(null);

    inspect(targetId)
      .then((result) => {
        if (!cancelled) setInspection(result);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, targetId, inspect]);

  const elements = useMemo(() => {
    const all = inspection?.tree.elements ?? [];
    const needle = filter.trim().toLowerCase();
    if (!needle) return all;
    return all.filter(
      (element) =>
        element.role.toLowerCase().includes(needle) ||
        (element.label ?? "").toLowerCase().includes(needle) ||
        (element.automationId ?? "").toLowerCase().includes(needle),
    );
  }, [inspection, filter]);

  const chosen = useMemo(
    () => inspection?.tree.elements.find((element) => element.index === selected) ?? null,
    [inspection, selected],
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="desktop-picker-dialog">
        <DialogHeader>
          <DialogTitle>Pick an element</DialogTitle>
          <DialogDescription>
            {targetName
              ? `${targetName} is opened, read once, and closed again. Nothing is typed or clicked in it.`
              : "The application is opened, read once, and closed again."}
          </DialogDescription>
        </DialogHeader>

        {loading && <p className="desktop-picker-status">Opening the application…</p>}

        {error && <Alert variant="error">{error}</Alert>}

        {inspection?.warnings.map((warning) => (
          <Alert key={warning} variant="warning">
            {warning}
          </Alert>
        ))}

        {inspection && inspection.tree.elements.length === 0 && (
          <Alert variant="warning">
            This window exposes no accessibility tree
            {inspection.tree.degradedReason ? ` — ${inspection.tree.degradedReason}` : ""}. Only
            screen position can address it, and a step built that way breaks when the window moves
            or the display scaling changes.
          </Alert>
        )}

        {inspection && inspection.tree.elements.length > 0 && (
          <>
            <Input
              placeholder="Filter by name, role or automation ID"
              value={filter}
              onChange={(e) => setFilter(e.currentTarget.value)}
              aria-label="Filter elements"
            />
            <ul className="desktop-picker-tree" aria-label="Window elements">
              {elements.map((element) => (
                <li key={element.index}>
                  <button
                    type="button"
                    className={
                      element.index === selected
                        ? "desktop-picker-row desktop-picker-row-selected"
                        : "desktop-picker-row"
                    }
                    style={{ paddingLeft: `${Math.min(element.depth, 12) * 12 + 8}px` }}
                    onClick={() => setSelected(element.index)}
                  >
                    <span className="desktop-picker-role">{element.role}</span>
                    <span className="desktop-picker-label">
                      {element.label ?? <em>unnamed</em>}
                    </span>
                    {element.suggestion.fragile && (
                      <span className="desktop-picker-fragile" title={element.suggestion.explanation}>
                        position only
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {chosen && (
          <div className="desktop-picker-explanation">
            <div>
              <strong>Identified by:</strong> {MATCH_COPY[chosen.suggestion.matchedBy]}
            </div>
            <p>{chosen.suggestion.explanation}</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!chosen}
            onClick={() => {
              if (!chosen) return;
              onPick(chosen.suggestion.locator);
              onClose();
            }}
          >
            Use this element
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
