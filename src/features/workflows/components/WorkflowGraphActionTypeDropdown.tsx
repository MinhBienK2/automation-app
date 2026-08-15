import { useEffect, useRef, useState } from "react";
import type { ActionConfig, ActionType, ExecutionSurfaceKind } from "../../../types/workflow";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { useWorkflowSurfaceKind } from "../state/WorkflowSurfaceContext";
import { actionLabels } from "../../../lib/workflowUi";
import {
  actionDescriptions,
  actionPickerGroupsForSurface,
} from "./ActionNodePalette";

/**
 * Surface-blind on purpose.
 *
 * This answers "is this an authorable action type", which is a question about
 * the step already in the graph. Filtering it by surface would make an existing
 * step read as no type at all in a workflow that legitimately contains it.
 */
export function actionTypeFromConfig(config: ActionConfig | null): ActionType | null {
  if (!config) {
    return null;
  }
  return allPickerOptions.includes(config.type as ActionType)
    ? (config.type as ActionType)
    : null;
}

const allPickerOptions: ActionType[] = [
  ...new Set([
    ...actionPickerGroupsForSurface("web").flatMap((group) => group.actions),
    ...actionPickerGroupsForSurface("desktop").flatMap((group) => group.actions),
  ]),
];

export function ActionTypeDropdown({
  value,
  onChange,
  surface: surfaceOverride,
}: {
  value: ActionType | null;
  onChange: (actionType: ActionType) => void;
  /** Overrides the open workflow's surface. Tests and previews only. */
  surface?: ExecutionSurfaceKind;
}) {
  const contextSurface = useWorkflowSurfaceKind();
  const surface = surfaceOverride ?? contextSurface;
  // The other family is hidden rather than disabled: a workflow cannot mix
  // surfaces, so a greyed-out list of actions that can never be enabled is
  // noise. The line under the search box is what stops the absence reading as
  // a missing feature.
  const actionPickerGroups = actionPickerGroupsForSurface(surface);
  const actionPickerOptions = actionPickerGroups.flatMap((group) => group.actions);
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

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const options = Array.from(
          containerRef.current?.querySelectorAll(".action-type-option") ?? []
        ) as HTMLElement[];
        if (options.length === 0) return;

        const activeElement = document.activeElement as HTMLElement;
        const activeIndex = options.indexOf(activeElement);
        let nextIndex = 0;

        if (activeIndex === -1) {
          nextIndex = event.key === "ArrowDown" ? 0 : options.length - 1;
        } else {
          if (event.key === "ArrowDown") {
            nextIndex = activeIndex + 1 < options.length ? activeIndex + 1 : 0;
          } else {
            nextIndex = activeIndex - 1 >= 0 ? activeIndex - 1 : options.length - 1;
          }
        }

        options[nextIndex]?.focus();
        event.preventDefault();
        event.stopPropagation();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    containerRef.current?.addEventListener("keydown", handleKeyDown);
    
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      containerRef.current?.removeEventListener("keydown", handleKeyDown);
    };
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
          <p className="text-[11px] text-fg-muted px-2 pb-1">
            {surface === "desktop"
              ? "Desktop workflow — showing desktop and surface-independent actions. Browser actions are not offered."
              : "Web workflow — showing browser and surface-independent actions. Desktop actions are not offered."}
          </p>
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
  const actionLabel = actionLabels[config.type as ActionType] ?? config.type;

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
