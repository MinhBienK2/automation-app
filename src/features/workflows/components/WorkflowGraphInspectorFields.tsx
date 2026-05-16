import { useEffect, useRef, useState } from "react";
import type {
  ActionConfig,
  ActionType,
  GraphNode,
  GraphPort,
} from "../../../types/workflow";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { SwitchField } from "../../../components/ui/switch";
import { Textarea } from "../../../components/ui/textarea";
import { actionLabels } from "../../../lib/workflowUi";
import { defaultActionConfig } from "../lib/workflowGraph";
import { ActionConfigEditor } from "./ActionConfigEditor";
import {
  actionDescriptions,
  actionPickerGroups,
  actionPickerOptions,
} from "./WorkflowGraphPalettes";
import {
  ConditionFields,
  conditionFromConfig,
} from "./WorkflowGraphConditionFields";
import { SetVariablesConfigFields } from "./VariableConfigFields";
import type { VariableOption } from "./TemplateTextField";

function switchPortsForCases(cases: string[]): GraphPort[] {
  return [
    { id: "in", label: "In", direction: "input" },
    ...cases.map((_, index) => ({
      id: `case_${index + 1}`,
      label: `Case ${index + 1}`,
      direction: "output" as const,
    })),
    { id: "default", label: "Default", direction: "output" },
    { id: "done", label: "Done", direction: "output" },
  ];
}

type NodeConfigFieldsProps = {
  node: GraphNode;
  onChange: (node: GraphNode) => void;
  variableOptions?: VariableOption[];
};

export function NodeConfigFields({
  node,
  onChange,
  variableOptions,
}: NodeConfigFieldsProps) {
  function updateConfig(config: unknown) {
    onChange({ ...node, config });
  }

  function updateActionType(actionType: ActionType) {
    onChange({
      ...node,
      label: actionLabels[actionType],
      config: defaultActionConfig(actionType),
    });
  }

  switch (node.node_type) {
    case "if":
      return (
        <div className="graph-config-fields">
          <ConditionFields
            condition={conditionFromConfig(node.config)}
            onChange={(condition) => updateConfig({ ...objectConfig(node.config), condition })}
          />
        </div>
      );
    case "repeat_until":
    case "while":
      return (
        <div className="graph-config-fields">
          <ConditionFields
            condition={conditionFromConfig(node.config)}
            onChange={(condition) => updateConfig({ ...objectConfig(node.config), condition })}
          />
          <Label>
            Loop max attempts
            <Input
              min="1"
              type="number"
              value={numberConfig(node.config, "max_attempts", 10)}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  max_attempts: Number(event.currentTarget.value) || 1,
                })
              }
            />
          </Label>
          <Label>
            Loop timeout ms
            <Input
              min="0"
              type="number"
              value={numberConfig(node.config, "timeout_ms", 0)}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  timeout_ms: Number(event.currentTarget.value) || null,
                })
              }
            />
          </Label>
        </div>
      );
    case "switch": {
      const cases = arrayConfig(node.config, "cases");
      return (
        <div className="graph-config-fields">
          <Label>
            Switch expression
            <Input
              value={stringConfig(node.config, "expression", "")}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  expression: event.currentTarget.value,
                })
              }
            />
          </Label>
          <Label>
            Switch cases
            <Textarea
              value={cases.join("\n")}
              onChange={(event) => {
                const nextCases = event.currentTarget.value
                  .split("\n")
                  .map((item) => item.trim())
                  .filter(Boolean);
                onChange({
                  ...node,
                  config: {
                    ...objectConfig(node.config),
                    cases: nextCases,
                  },
                  ports: switchPortsForCases(nextCases),
                });
              }}
            />
          </Label>
        </div>
      );
    }
    case "repeat_times":
      return (
        <div className="graph-config-fields">
          <Label>
            Times
            <Input
              min="1"
              type="number"
              value={numberConfig(node.config, "times", 1)}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  times: Number(event.currentTarget.value),
                })
              }
            />
          </Label>
        </div>
      );
    case "repeat_for_each":
      {
        const source = stringConfig(node.config, "array_variable", "")
          ? "variable_array"
          : "manual";
        return (
          <div className="graph-config-fields">
            <Label>
              Items source
              <Select
                value={source}
                onChange={(event) => {
                  const nextSource = event.currentTarget.value;
                  updateConfig({
                    ...objectConfig(node.config),
                    array_variable: nextSource === "variable_array" ? "items" : null,
                    items:
                      nextSource === "manual"
                        ? arrayConfig(node.config, "items").length
                          ? arrayConfig(node.config, "items")
                          : ["item"]
                        : [],
                  });
                }}
              >
                <option value="manual">Manual list</option>
                <option value="variable_array">Variable array</option>
              </Select>
            </Label>
            <Label>
              Item name
              <Input
                value={stringConfig(node.config, "item_name", "item")}
                onChange={(event) =>
                  updateConfig({
                    ...objectConfig(node.config),
                    item_name: event.currentTarget.value,
                  })
                }
              />
            </Label>
            {source === "variable_array" ? (
              <Label>
                Array variable
                <Input
                  value={stringConfig(node.config, "array_variable", "items")}
                  onChange={(event) =>
                    updateConfig({
                      ...objectConfig(node.config),
                      array_variable: event.currentTarget.value,
                      items: [],
                    })
                  }
                />
              </Label>
            ) : (
              <Label>
                Items
                <Textarea
                  value={arrayConfig(node.config, "items").join("\n")}
                  onChange={(event) =>
                    updateConfig({
                      ...objectConfig(node.config),
                      array_variable: null,
                      items: event.currentTarget.value
                        .split("\n")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </Label>
            )}
          </div>
        );
      }
    case "retry":
      return (
        <div className="graph-config-fields">
          <Label>
            Max attempts
            <Input
              min="1"
              type="number"
              value={numberConfig(node.config, "max_attempts", 3)}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  max_attempts: Number(event.currentTarget.value),
                })
              }
            />
          </Label>
          <Label>
            Delay ms
            <Input
              min="0"
              type="number"
              value={numberConfig(node.config, "delay_ms", 100)}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  delay_ms: Number(event.currentTarget.value),
                })
              }
            />
          </Label>
        </div>
      );
    case "end_success":
      return (
        <div className="graph-config-fields">
          <CloseBrowserField
            checked={booleanConfig(node.config, "close_browser", false)}
            onChange={(closeBrowser) =>
              updateConfig({
                ...objectConfig(node.config),
                close_browser: closeBrowser,
              })
            }
          />
        </div>
      );
    case "end_failure":
      return (
        <div className="graph-config-fields">
          <Label>
            Failure reason
            <Input
              value={stringConfig(node.config, "reason", "Graph reached failure end")}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  reason: event.currentTarget.value,
                })
              }
              />
          </Label>
          <CloseBrowserField
            checked={booleanConfig(node.config, "close_browser", false)}
            onChange={(closeBrowser) =>
              updateConfig({
                ...objectConfig(node.config),
                close_browser: closeBrowser,
              })
            }
          />
        </div>
      );
    case "stop_workflow":
      return (
        <div className="graph-config-fields">
          <Label>
            Status
            <Select
              value={stringConfig(node.config, "status", "success")}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  status: event.currentTarget.value,
                })
              }
            >
              <option value="success">Success</option>
              <option value="failure">Failure</option>
            </Select>
          </Label>
          <Label>
            Reason
            <Input
              value={stringConfig(node.config, "reason", "")}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  reason: event.currentTarget.value,
                })
              }
              />
          </Label>
          <CloseBrowserField
            checked={booleanConfig(node.config, "close_browser", false)}
            onChange={(closeBrowser) =>
              updateConfig({
                ...objectConfig(node.config),
                close_browser: closeBrowser,
              })
            }
          />
        </div>
      );
    case "set_variable":
      return (
        <div className="graph-config-fields">
          <SetVariablesConfigFields
            config={objectConfig(node.config)}
            onChange={(config) => updateConfig(config)}
          />
        </div>
      );
    case "set_json_variables":
      return (
        <div className="graph-config-fields">
          <Label>
            JSON variables
            <Textarea
              value={stringConfig(node.config, "json", "{\n  \"name\": \"value\"\n}")}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  json: event.currentTarget.value,
                })
              }
            />
          </Label>
        </div>
      );
    case "transform_variable":
      return (
        <div className="graph-config-fields">
          <Label>
            Source output
            <Input
              value={stringConfig(node.config, "source_name", "input")}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  source_name: event.currentTarget.value,
                })
              }
            />
          </Label>
          <Label>
            Target output
            <Input
              value={stringConfig(node.config, "target_name", "output")}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  target_name: event.currentTarget.value,
                })
              }
            />
          </Label>
          <Label>
            Expression
            <Textarea
              value={stringConfig(node.config, "expression", "")}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  expression: event.currentTarget.value,
                })
              }
            />
          </Label>
        </div>
      );
    case "assert_output":
      return (
        <div className="graph-config-fields">
          <Label>
            Output name
            <Input
              value={stringConfig(node.config, "name", "output")}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  name: event.currentTarget.value,
                })
              }
            />
          </Label>
          <Label>
            Match
            <Select
              value={stringConfig(node.config, "match", "equals")}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  match: event.currentTarget.value,
                })
              }
            >
              <option value="equals">Equals</option>
              <option value="contains">Contains</option>
            </Select>
          </Label>
          <Label>
            Expected value
            <Input
              value={stringConfig(node.config, "value", "")}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  value: event.currentTarget.value,
                })
              }
            />
          </Label>
        </div>
      );
    case "domain_allowlist":
      return (
        <div className="graph-config-fields">
          <Label>
            Allowed domains
            <Textarea
              value={arrayConfig(node.config, "domains").join("\n")}
              onChange={(event) =>
                updateConfig({
                  ...objectConfig(node.config),
                  domains: event.currentTarget.value
                    .split("\n")
                    .map((domain) => domain.trim())
                    .filter(Boolean),
                })
              }
            />
          </Label>
        </div>
      );
    case "try_catch":
    case "fallback":
    case "break_loop":
    case "continue_loop":
      return (
        <div className="graph-config-fields">
          <p className="muted">
            Configure this node by connecting its named ports on the canvas.
          </p>
        </div>
      );
    case "action": {
      const actionConfig = isActionConfig(node.config) ? node.config : null;
      const isCompatibilityAction = actionConfig
        ? !actionPickerOptions.includes(actionConfig.type as ActionType)
        : false;
      return (
        <div className="graph-config-fields">
          <ActionTypeDropdown
            value={actionTypeFromConfig(actionConfig)}
            onChange={updateActionType}
          />
          {actionConfig && isCompatibilityAction ? (
            <GraphInternalActionConfigPanel config={actionConfig} />
          ) : actionConfig ? (
            <ActionConfigEditor
              config={actionConfig}
              onChange={(config) => updateConfig(config)}
              variableOptions={variableOptions}
            />
          ) : null}
        </div>
      );
    }
    default:
      return null;
  }
}

function actionTypeFromConfig(config: ActionConfig | null): ActionType | null {
  if (!config) {
    return null;
  }
  return actionPickerOptions.includes(config.type as ActionType)
    ? (config.type as ActionType)
    : null;
}

function ActionTypeDropdown({
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

function GraphInternalActionConfigPanel({ config }: { config: ActionConfig }) {
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

function matchesActionSearch(actionType: ActionType, query: string) {
  const haystack = `${actionLabels[actionType]} ${actionDescriptions[actionType]}`.toLowerCase();
  return query
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

function isActionConfig(config: unknown): config is ActionConfig {
  return Boolean(
    config &&
      typeof config === "object" &&
      "type" in config &&
      "config" in config,
  );
}

function objectConfig(config: unknown): Record<string, unknown> {
  return config && typeof config === "object" && !Array.isArray(config)
    ? (config as Record<string, unknown>)
    : {};
}

function stringConfig(config: unknown, key: string, fallback: string) {
  const value = objectConfig(config)[key];
  return typeof value === "string" ? value : fallback;
}

function numberConfig(config: unknown, key: string, fallback: number) {
  const value = objectConfig(config)[key];
  return typeof value === "number" ? value : fallback;
}

function booleanConfig(config: unknown, key: string, fallback: boolean) {
  const value = objectConfig(config)[key];
  return typeof value === "boolean" ? value : fallback;
}

function arrayConfig(config: unknown, key: string) {
  const value = objectConfig(config)[key];
  return Array.isArray(value) ? value.map(String) : [];
}

function CloseBrowserField({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <SwitchField
      checked={checked}
      label="Close browser after workflow ends"
      onCheckedChange={onChange}
    />
  );
}
