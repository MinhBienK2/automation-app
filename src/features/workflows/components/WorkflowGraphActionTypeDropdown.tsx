import { useEffect, useRef, useState } from "react";
import type { ActionConfig, ActionType } from "../../../types/workflow";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { actionLabels } from "../../../lib/workflowUi";
import {
  actionDescriptions,
  actionPickerGroups,
  actionPickerOptions,
} from "./WorkflowGraphPalettes";

export function actionTypeFromConfig(config: ActionConfig | null): ActionType | null {
  if (!config) {
    return null;
  }
  return actionPickerOptions.includes(config.type as ActionType)
    ? (config.type as ActionType)
    : null;
}

export function ActionTypeDropdown({
  value,
  onChange,
}: {
  value: ActionType | null;
  onChange: (actionType: ActionType) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleActions = normalizedQuery
    ? actionPickerOptions.filter((actionType) =>
        matchesActionSearch(actionType, normalizedQuery),
      )
    : actionPickerOptions;

  function choose(actionType: ActionType) {
    onChange(actionType);
    setQuery("");
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (
        target instanceof Node &&
        containerRef.current &&
        !containerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div className="action-type-dropdown" ref={containerRef}>
      <Label>Action type</Label>
      <Button
        aria-expanded={open}
        aria-label="Action type"
        className="action-type-trigger"
        role="combobox"
        type="button"
        variant="secondary"
        onClick={() => setOpen((current) => !current)}
      >
        {value ? actionLabels[value] : "Choose action type"}
      </Button>
      {open ? (
        <div className="action-type-popover" role="listbox" aria-label="Action type options">
          <Input
            ref={searchRef}
            aria-label="Search action types"
            placeholder="Search actions..."
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          {actionPickerGroups.map((group) => {
            const groupActions = group.actions.filter((actionType) =>
              visibleActions.includes(actionType),
            );
            if (groupActions.length === 0) return null;

            return (
              <div className="action-type-group" key={group.label}>
                <p className="eyebrow">{group.label}</p>
                {groupActions.map((actionType) => (
                  <button
                    aria-label={actionLabels[actionType]}
                    aria-selected={value === actionType}
                    className="action-type-option"
                    key={actionType}
                    role="option"
                    type="button"
                    onClick={() => choose(actionType)}
                  >
                    <span>{actionLabels[actionType]}</span>
                    <small>{actionDescriptions[actionType]}</small>
                  </button>
                ))}
              </div>
            );
          })}
          {visibleActions.length === 0 ? <p className="muted">No matching actions</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function GraphInternalActionConfigPanel({ config }: { config: ActionConfig }) {
  const actionLabel = actionLabels[config.type] ?? config.type;

  return (
    <div className="graph-internal-action">
      <p className="eyebrow">Graph-internal action</p>
      <h3>{actionLabel}</h3>
      <p className="muted">
        Replace this action-node payload with a supported user action, or use
        the graph-native node for this control-flow behavior.
      </p>
      <pre aria-label="Graph-internal action JSON">
        {JSON.stringify(config, null, 2)}
      </pre>
    </div>
  );
}

export function matchesActionSearch(actionType: ActionType, query: string) {
  const haystack = `${actionLabels[actionType]} ${actionDescriptions[actionType]}`.toLowerCase();
  return query
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

export function isActionConfig(config: unknown): config is ActionConfig {
  return Boolean(
    config &&
      typeof config === "object" &&
      "type" in config &&
      "config" in config,
  );
}
