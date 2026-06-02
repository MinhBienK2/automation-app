import { useEffect, useRef, useState } from "react";
import type {
  ActionConfig,
  ActionType,
  GraphNode,
  GraphPort,
  RouterGraphCase,
  RouterGraphConfig,
  WorkflowCondition,
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

function routerPortsForCases(
  cases: RouterGraphCase[],
  defaultLabel = "Default",
): GraphPort[] {
  return [
    { id: "in", label: "In", direction: "input" },
    ...cases.map((caseValue) => ({
      id: `case_${caseValue.id}`,
      label: caseValue.label.trim() || "Case",
      direction: "output" as const,
    })),
    { id: "default", label: defaultLabel.trim() || "Default", direction: "output" },
    { id: "done", label: "Done", direction: "output" },
  ];
}

type RandomChoiceOption = {
  id: string;
  label: string;
  weight: number;
};

type RandomChoiceGraphConfig = {
  choices: RandomChoiceOption[];
  output_name?: string | null;
};

function randomChoicePortsForChoices(choices: RandomChoiceOption[]): GraphPort[] {
  return [
    { id: "in", label: "In", direction: "input" },
    ...choices.map((choice) => ({
      id: `choice_${choice.id}`,
      label: choice.label.trim() || "Choice",
      direction: "output" as const,
    })),
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
    case "router": {
      const routerConfigValue = routerConfig(node.config);
      const cases = routerConfigValue.cases;
      function updateRouterConfig(nextConfig: RouterGraphConfig) {
        onChange({
          ...node,
          config: nextConfig,
          ports: routerPortsForCases(nextConfig.cases, nextConfig.default_label ?? "Default"),
        });
      }
      return (
        <div className="graph-config-fields">
          <div className="router-case-table" role="group" aria-label="Router decision table">
            {cases.map((caseValue, index) => (
              <div className="router-case-row" key={caseValue.id}>
                <div className="router-case-header">
                  <span className="eyebrow">Priority {index + 1}</span>
                  <div className="router-case-actions">
                    <Button
                      aria-label={`Move router case ${caseValue.label || index + 1} up`}
                      disabled={index === 0}
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        const nextCases = [...cases];
                        [nextCases[index - 1], nextCases[index]] = [
                          nextCases[index],
                          nextCases[index - 1],
                        ];
                        updateRouterConfig({ ...routerConfigValue, cases: nextCases });
                      }}
                    >
                      Up
                    </Button>
                    <Button
                      aria-label={`Move router case ${caseValue.label || index + 1} down`}
                      disabled={index === cases.length - 1}
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        const nextCases = [...cases];
                        [nextCases[index], nextCases[index + 1]] = [
                          nextCases[index + 1],
                          nextCases[index],
                        ];
                        updateRouterConfig({ ...routerConfigValue, cases: nextCases });
                      }}
                    >
                      Down
                    </Button>
                    <Button
                      aria-label={`Remove router case ${caseValue.label || index + 1}`}
                      disabled={cases.length <= 1}
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        updateRouterConfig({
                          ...routerConfigValue,
                          cases: cases.filter((item) => item.id !== caseValue.id),
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
                <Label>
                  Router case label
                  <Input
                    value={caseValue.label}
                    onChange={(event) =>
                      updateRouterConfig({
                        ...routerConfigValue,
                        cases: cases.map((item) =>
                          item.id === caseValue.id
                            ? { ...item, label: event.currentTarget.value }
                            : item,
                        ),
                      })
                    }
                  />
                </Label>
                <ConditionFields
                  condition={caseValue.condition}
                  onChange={(condition) =>
                    updateRouterConfig({
                      ...routerConfigValue,
                      cases: cases.map((item) =>
                        item.id === caseValue.id ? { ...item, condition } : item,
                      ),
                    })
                  }
                />
              </div>
            ))}
          </div>
          <Button
            aria-label="Add router case"
            type="button"
            variant="secondary"
            onClick={() => {
              const nextId = nextRouterCaseId(cases);
              updateRouterConfig({
                ...routerConfigValue,
                cases: [
                  ...cases,
                  {
                    id: nextId,
                    label: `Case ${cases.length + 1}`,
                    condition: defaultCondition(),
                  },
                ],
              });
            }}
          >
            Add case
          </Button>
          <Label>
            Default label
            <Input
              value={routerConfigValue.default_label ?? "Default"}
              onChange={(event) =>
                updateRouterConfig({
                  ...routerConfigValue,
                  default_label: event.currentTarget.value,
                })
              }
            />
          </Label>
        </div>
      );
    }
    case "random_choice": {
      const randomChoiceConfigValue = randomChoiceConfig(node.config);
      const choices = randomChoiceConfigValue.choices;
      function updateRandomChoiceConfig(nextConfig: RandomChoiceGraphConfig) {
        onChange({
          ...node,
          config: nextConfig,
          ports: randomChoicePortsForChoices(nextConfig.choices),
        });
      }
      return (
        <div className="graph-config-fields">
          <Label>
            Output name
            <Input
              value={randomChoiceConfigValue.output_name ?? ""}
              onChange={(event) =>
                updateRandomChoiceConfig({
                  ...randomChoiceConfigValue,
                  output_name: event.currentTarget.value,
                })
              }
            />
          </Label>
          <div className="router-case-table" role="group" aria-label="Random choice table">
            {choices.map((choice, index) => (
              <div className="router-case-row" key={choice.id}>
                <div className="router-case-header">
                  <span className="eyebrow">Choice {index + 1}</span>
                  <div className="router-case-actions">
                    <Button
                      aria-label={`Remove random choice ${choice.label || index + 1}`}
                      disabled={choices.length <= 1}
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        updateRandomChoiceConfig({
                          ...randomChoiceConfigValue,
                          choices: choices.filter((item) => item.id !== choice.id),
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
                <Label>
                  Choice label
                  <Input
                    value={choice.label}
                    onChange={(event) =>
                      updateRandomChoiceConfig({
                        ...randomChoiceConfigValue,
                        choices: choices.map((item) =>
                          item.id === choice.id
                            ? { ...item, label: event.currentTarget.value }
                            : item,
                        ),
                      })
                    }
                  />
                </Label>
                <Label>
                  Choice weight
                  <Input
                    min="1"
                    type="number"
                    value={choice.weight}
                    onChange={(event) =>
                      updateRandomChoiceConfig({
                        ...randomChoiceConfigValue,
                        choices: choices.map((item) =>
                          item.id === choice.id
                            ? { ...item, weight: Number(event.currentTarget.value) || 1 }
                            : item,
                        ),
                      })
                    }
                  />
                </Label>
              </div>
            ))}
          </div>
          <Button
            aria-label="Add random choice"
            type="button"
            variant="secondary"
            onClick={() => {
              const nextId = nextRandomChoiceId(choices);
              updateRandomChoiceConfig({
                ...randomChoiceConfigValue,
                choices: [
                  ...choices,
                  { id: nextId, label: `Choice ${choices.length + 1}`, weight: 1 },
                ],
              });
            }}
          >
            Add choice
          </Button>
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

function routerConfig(config: unknown): RouterGraphConfig {
  const record = objectConfig(config);
  const rawCases = Array.isArray(record.cases) ? record.cases : [];
  const cases = rawCases
    .map((item, index): RouterGraphCase => {
      const caseRecord = objectConfig(item);
      return {
        id: stringValue(caseRecord.id) || String(index + 1),
        label: stringValue(caseRecord.label) || `Case ${index + 1}`,
        condition: isWorkflowCondition(caseRecord.condition)
          ? caseRecord.condition
          : defaultCondition(),
      };
    });
  return {
    mode: "first_match",
    cases: cases.length ? cases : [{ id: "1", label: "Case 1", condition: defaultCondition() }],
    default_label: stringValue(record.default_label) || "Default",
  };
}

function randomChoiceConfig(config: unknown): RandomChoiceGraphConfig {
  const record = objectConfig(config);
  const rawChoices = Array.isArray(record.choices) ? record.choices : [];
  const choices = rawChoices.map((item, index): RandomChoiceOption => {
    const choiceRecord = objectConfig(item);
    return {
      id: stringValue(choiceRecord.id) || String(index + 1),
      label: stringValue(choiceRecord.label) || `Choice ${index + 1}`,
      weight: positiveNumberValue(choiceRecord.weight) ?? 1,
    };
  });
  return {
    choices: choices.length
      ? choices
      : [
          { id: "1", label: "Choice 1", weight: 1 },
          { id: "2", label: "Choice 2", weight: 1 },
        ],
    output_name: stringValue(record.output_name) || "random_choice",
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function positiveNumberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function defaultCondition(): WorkflowCondition {
  return { kind: "output_equals", name: "name", value: "" };
}

function isWorkflowCondition(value: unknown): value is WorkflowCondition {
  return Boolean(value && typeof value === "object" && "kind" in value);
}

function nextRouterCaseId(cases: RouterGraphCase[]) {
  const numericIds = cases
    .map((caseValue) => Number(caseValue.id))
    .filter((value) => Number.isInteger(value) && value > 0);
  if (numericIds.length > 0) return String(Math.max(...numericIds) + 1);
  return `case_${Date.now()}`;
}

function nextRandomChoiceId(choices: RandomChoiceOption[]) {
  const numericIds = choices
    .map((choice) => Number(choice.id))
    .filter((value) => Number.isInteger(value) && value > 0);
  if (numericIds.length > 0) return String(Math.max(...numericIds) + 1);
  return `choice_${Date.now()}`;
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
