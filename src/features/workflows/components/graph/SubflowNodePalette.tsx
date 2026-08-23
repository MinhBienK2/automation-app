import { useEffect, useMemo, useState } from "react";
import { Blocks, Copy, Search, Workflow } from "lucide-react";
import type { SubflowSummary } from "../../../../types/workflow";
import { Button } from "../../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../../components/ui/dialog";
import { Input } from "../../../../components/ui/input";

export type SubflowAddMode = "call_node" | "insert_nodes";

export type SubflowNodePaletteProps = {
  open: boolean;
  subflows: SubflowSummary[];
  error?: string | null;
  isSelecting?: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSubflow: (subflow: SubflowSummary, mode: SubflowAddMode) => void;
};

const subflowAddModeCards: Array<{
  value: SubflowAddMode;
  label: string;
  detail: string;
  badge: string;
  Icon: typeof Blocks;
}> = [
  {
    value: "call_node",
    label: "Call subflow",
    detail: "Linked reusable node",
    badge: "Default",
    Icon: Blocks,
  },
  {
    value: "insert_nodes",
    label: "Insert nodes",
    detail: "Editable copied nodes",
    badge: "Copy",
    Icon: Copy,
  },
];

export function SubflowNodePalette({
  open,
  subflows,
  error = null,
  isSelecting = false,
  onOpenChange,
  onSelectSubflow,
}: SubflowNodePaletteProps) {
  const [query, setQuery] = useState("");
  const [addMode, setAddMode] = useState<SubflowAddMode>("call_node");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleSubflows = useMemo(() => {
    if (!normalizedQuery) return subflows;
    return subflows.filter((subflow) => {
      const haystack = [subflow.name, subflow.description ?? ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, subflows]);

  function resetPalette() {
    setQuery("");
    setAddMode("call_node");
  }

  useEffect(() => {
    if (!open) {
      setQuery("");
      setAddMode("call_node");
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) resetPalette();
      }}
    >
      <DialogContent className="add-step-palette max-w-none">
        <DialogHeader>
          <p className="eyebrow">Add Subflow</p>
          <DialogTitle>Choose a subflow</DialogTitle>
          <DialogDescription>
            Select a reusable graph path from this project and choose how it should be added.
          </DialogDescription>
        </DialogHeader>

        <div className="subflow-mode-grid" role="group" aria-label="Subflow add mode">
          {subflowAddModeCards.map(({ value, label, detail, badge, Icon }) => {
            const active = addMode === value;
            return (
              <Button
                aria-pressed={active}
                className={
                  active
                    ? "subflow-mode-card subflow-mode-card-active"
                    : "subflow-mode-card"
                }
                key={value}
                type="button"
                variant="ghost"
                onClick={() => setAddMode(value)}
              >
                <span className="subflow-mode-icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="subflow-mode-copy">
                  <span>{label}</span>
                  <small>{detail}</small>
                </span>
                <span className="subflow-mode-badge">{badge}</span>
              </Button>
            );
          })}
        </div>

        <div className="subflow-picker-search-row">
          <div className="subflow-picker-search">
            <Search aria-hidden="true" />
            <Input
              aria-label="Search subflows"
              placeholder="Search subflows..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <span className="subflow-picker-count">
            {visibleSubflows.length} {visibleSubflows.length === 1 ? "match" : "matches"}
          </span>
        </div>

        {error ? (
          <p className="graph-subflow-create-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="subflow-picker-results" aria-label="Subflow results">
          {visibleSubflows.length === 0 ? (
            <div className="empty-state panel">
              <h2>No subflows in this project</h2>
              <p className="muted">
                Create one from Projects &gt; Subflows before adding it here.
              </p>
            </div>
          ) : (
            visibleSubflows.map((subflow) => (
              <Button
                className="subflow-picker-result"
                data-value={subflow.id}
                key={subflow.id}
                type="button"
                variant="ghost"
                disabled={isSelecting}
                onClick={() => {
                  onSelectSubflow(subflow, addMode);
                  if (addMode === "call_node") resetPalette();
                }}
              >
                <span className="subflow-picker-result-icon" aria-hidden="true">
                  <Workflow />
                </span>
                <span className="subflow-picker-result-main">
                  <span className="subflow-picker-result-title">{subflow.name}</span>
                  <small>
                    {[subflow.description, `${subflow.used_by_count} ${subflow.used_by_count === 1 ? "workflow" : "workflows"}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </span>
                <span className="subflow-picker-result-action">
                  {addMode === "call_node" ? "Add call node" : "Insert nodes"}
                </span>
              </Button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
