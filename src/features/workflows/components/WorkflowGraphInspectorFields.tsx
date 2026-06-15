import type {
  ActionType,
  GraphNode,
  RouterGraphConfig,
  SubflowSummary,
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
  ActionTypeDropdown,
  GraphInternalActionConfigPanel,
  actionTypeFromConfig,
  isActionConfig,
} from "./WorkflowGraphActionTypeDropdown";
import {
  ConditionFields,
  conditionFromConfig,
} from "./WorkflowGraphConditionFields";
import { WorkflowGraphEvaluateLogicFields } from "./WorkflowGraphEvaluateLogicFields";
import { ActionConfigFieldGroup } from "./ActionConfigFieldGroup";
import { SetVariablesConfigFields } from "./VariableConfigFields";
import { TemplateTextField, TemplateTextareaField, type VariableOption } from "./TemplateTextField";
import {
  arrayConfig,
  booleanConfig,
  numberConfig,
  objectConfig,
  stringConfig,
} from "../lib/configUtils";
import {
  defaultCondition,
  nextRandomChoiceId,
  nextRouterCaseId,
  randomChoiceConfig,
  randomChoicePortsForChoices,
  routerConfig,
  routerPortsForCases,
  switchPortsForCases,
  type RandomChoiceGraphConfig,
} from "../lib/graphNodeConfig";

type NodeConfigFieldsProps = {
  node: GraphNode;
  onChange: (node: GraphNode) => void;
  variableOptions?: VariableOption[];
  subflowOptions?: SubflowSummary[];
};

export function NodeConfigFields({
  node,
  onChange,
  variableOptions,
  subflowOptions = [],
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
          <ActionConfigFieldGroup title="Condition">
            <ConditionFields
              condition={conditionFromConfig(node.config)}
              onChange={(condition) => updateConfig({ ...objectConfig(node.config), condition })}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    case "repeat_until":
    case "while":
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Condition">
            <ConditionFields
              condition={conditionFromConfig(node.config)}
              onChange={(condition) => updateConfig({ ...objectConfig(node.config), condition })}
            />
          </ActionConfigFieldGroup>
          <ActionConfigFieldGroup title="Loop guard">
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
          </ActionConfigFieldGroup>
        </div>
      );
    case "switch": {
      const cases = arrayConfig(node.config, "cases");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Switch routes">
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
          </ActionConfigFieldGroup>
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
          <ActionConfigFieldGroup title="Router cases">
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
          </ActionConfigFieldGroup>
          <ActionConfigFieldGroup title="Default route">
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
          </ActionConfigFieldGroup>
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
          <ActionConfigFieldGroup title="Choice output">
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
          </ActionConfigFieldGroup>
          <ActionConfigFieldGroup title="Weighted choices">
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
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "repeat_times":
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Repeat count">
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
          </ActionConfigFieldGroup>
        </div>
      );
    case "repeat_for_each":
      {
        const source = stringConfig(node.config, "array_variable", "")
          ? "variable_array"
          : "manual";
        return (
          <div className="graph-config-fields">
            <ActionConfigFieldGroup title="Iteration source">
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
            </ActionConfigFieldGroup>
          </div>
        );
      }
    case "retry":
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Retry policy">
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
          </ActionConfigFieldGroup>
        </div>
      );
    case "end_success":
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Terminal behavior">
            <CloseBrowserField
              checked={booleanConfig(node.config, "close_browser", false)}
              onChange={(closeBrowser) =>
                updateConfig({
                  ...objectConfig(node.config),
                  close_browser: closeBrowser,
                })
              }
            />
          </ActionConfigFieldGroup>
        </div>
      );
    case "end_failure":
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Terminal result">
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
          </ActionConfigFieldGroup>
        </div>
      );
    case "stop_workflow":
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Terminal result">
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
          </ActionConfigFieldGroup>
        </div>
      );
    case "evaluate_logic":
      return (
        <WorkflowGraphEvaluateLogicFields
          node={node}
          onChange={onChange}
          variableOptions={variableOptions}
        />
      );
    case "set_variable":
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Variable rows">
            <SetVariablesConfigFields
              config={objectConfig(node.config)}
              onChange={(config) => updateConfig(config)}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    case "set_json_variables":
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="JSON variables">
            <TemplateTextareaField
              label="JSON variables"
              value={stringConfig(node.config, "json", "{\n  \"name\": \"value\"\n}")}
              onChange={(value) =>
                updateConfig({
                  ...objectConfig(node.config),
                  json: value,
                })
              }
              variableOptions={variableOptions}
              showMath={false}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    case "update_number_variable": {
      const configObj = objectConfig(node.config);
      const name = stringConfig(node.config, "name", "");
      const operation = stringConfig(node.config, "operation", "increment") as
        | "increment"
        | "decrement"
        | "add"
        | "subtract"
        | "multiply"
        | "divide";
      const value = stringConfig(node.config, "value", "");

      const showValue = ["add", "subtract", "multiply", "divide"].includes(operation);

      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Update Number Variable Settings">
            <TemplateTextField
              label="Variable name"
              value={name}
              onChange={(val) => updateConfig({ ...configObj, name: val })}
              placeholder="e.g. counter"
              variableOptions={variableOptions}
            />
            <Label>
              Operation
              <Select
                value={operation}
                onChange={(event) =>
                  updateConfig({
                    ...configObj,
                    operation: event.currentTarget.value,
                  })
                }
              >
                <option value="increment">Increment (+1)</option>
                <option value="decrement">Decrement (-1)</option>
                <option value="add">Add</option>
                <option value="subtract">Subtract</option>
                <option value="multiply">Multiply</option>
                <option value="divide">Divide</option>
              </Select>
            </Label>
            {showValue && (
              <TemplateTextField
                label="Value"
                value={value}
                onChange={(val) => updateConfig({ ...configObj, value: val })}
                placeholder="Value"
                variableOptions={variableOptions}
              />
            )}
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "update_text_variable": {
      const configObj = objectConfig(node.config);
      const name = stringConfig(node.config, "name", "");
      const operation = stringConfig(node.config, "operation", "append") as
        | "append"
        | "prepend"
        | "replace"
        | "uppercase"
        | "lowercase"
        | "trim";
      const value = stringConfig(node.config, "value", "");
      const search_pattern = stringConfig(node.config, "search_pattern", "");

      const showValue = ["append", "prepend", "replace"].includes(operation);
      const showSearch = operation === "replace";

      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Update Text Variable Settings">
            <TemplateTextField
              label="Variable name"
              value={name}
              onChange={(val) => updateConfig({ ...configObj, name: val })}
              placeholder="e.g. message"
              variableOptions={variableOptions}
            />
            <Label>
              Operation
              <Select
                value={operation}
                onChange={(event) =>
                  updateConfig({
                    ...configObj,
                    operation: event.currentTarget.value,
                  })
                }
              >
                <option value="append">Append</option>
                <option value="prepend">Prepend</option>
                <option value="replace">Replace</option>
                <option value="uppercase">To Uppercase</option>
                <option value="lowercase">To Lowercase</option>
                <option value="trim">Trim Whitespace</option>
              </Select>
            </Label>
            {showSearch && (
              <TemplateTextField
                label="Search pattern (string or /regex/)"
                value={search_pattern}
                onChange={(val) => updateConfig({ ...configObj, search_pattern: val })}
                placeholder="pattern"
                variableOptions={variableOptions}
              />
            )}
            {showValue && (
              <TemplateTextareaField
                label="Replacement / Value"
                value={value}
                onChange={(val) => updateConfig({ ...configObj, value: val })}
                placeholder="Value"
                variableOptions={variableOptions}
              />
            )}
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "update_flag_variable": {
      const configObj = objectConfig(node.config);
      const name = stringConfig(node.config, "name", "");
      const operation = stringConfig(node.config, "operation", "toggle") as "toggle" | "set_true" | "set_false";

      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Update Flag Variable Settings">
            <TemplateTextField
              label="Variable name"
              value={name}
              onChange={(val) => updateConfig({ ...configObj, name: val })}
              placeholder="e.g. isLoggedIn"
              variableOptions={variableOptions}
            />
            <Label>
              Operation
              <Select
                value={operation}
                onChange={(event) =>
                  updateConfig({
                    ...configObj,
                    operation: event.currentTarget.value,
                  })
                }
              >
                <option value="toggle">Toggle</option>
                <option value="set_true">Set True</option>
                <option value="set_false">Set False</option>
              </Select>
            </Label>
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "update_list_variable": {
      const configObj = objectConfig(node.config);
      const name = stringConfig(node.config, "name", "");
      const operation = stringConfig(node.config, "operation", "push") as
        | "push"
        | "unshift"
        | "push_unique"
        | "pop"
        | "shift"
        | "remove_by_index"
        | "remove_by_value"
        | "merge"
        | "merge_unique";
      const value = stringConfig(node.config, "value", "");
      const value_type = stringConfig(node.config, "value_type", "text");
      const index = stringConfig(node.config, "index", "");

      const showValue = ["push", "unshift", "push_unique", "remove_by_value", "merge", "merge_unique"].includes(operation);
      const showValueType = showValue;
      const showIndex = operation === "remove_by_index";

      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Update List Variable Settings">
            <TemplateTextField
              label="Variable name"
              value={name}
              onChange={(val) => updateConfig({ ...configObj, name: val })}
              placeholder="e.g. items"
              variableOptions={variableOptions}
            />
            <Label>
              Operation
              <Select
                value={operation}
                onChange={(event) =>
                  updateConfig({
                    ...configObj,
                    operation: event.currentTarget.value,
                  })
                }
              >
                <option value="push">Push (Add to end)</option>
                <option value="unshift">Unshift (Add to start)</option>
                <option value="push_unique">Push Unique</option>
                <option value="pop">Pop (Remove from end)</option>
                <option value="shift">Shift (Remove from start)</option>
                <option value="remove_by_index">Remove by index</option>
                <option value="remove_by_value">Remove by value</option>
                <option value="merge">Merge</option>
                <option value="merge_unique">Merge Unique</option>
              </Select>
            </Label>
            {showValueType && (
              <Label>
                Value type
                <Select
                  value={value_type}
                  onChange={(event) =>
                    updateConfig({
                      ...configObj,
                      value_type: event.currentTarget.value,
                    })
                  }
                >
                  <option value="text">Text</option>
                  <option value="json">JSON</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                </Select>
              </Label>
            )}
            {showValue && (
              <TemplateTextareaField
                label="Value"
                value={value}
                onChange={(val) => updateConfig({ ...configObj, value: val })}
                placeholder="Value"
                variableOptions={variableOptions}
                showMath={value_type === "number"}
              />
            )}
            {showIndex && (
              <TemplateTextField
                label="Index (0-based number or variable)"
                value={index}
                onChange={(val) => updateConfig({ ...configObj, index: val })}
                placeholder="0"
                variableOptions={variableOptions}
              />
            )}
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "update_object_variable": {
      const configObj = objectConfig(node.config);
      const name = stringConfig(node.config, "name", "");
      const operation = stringConfig(node.config, "operation", "merge") as "merge" | "deep_merge" | "set_key" | "delete_key";
      const value = stringConfig(node.config, "value", "");
      const property_key = stringConfig(node.config, "property_key", "");
      const property_value = stringConfig(node.config, "property_value", "");
      const property_value_type = stringConfig(node.config, "property_value_type", "text");

      const showValue = ["merge", "deep_merge"].includes(operation);
      const showKey = ["set_key", "delete_key"].includes(operation);
      const showKeyValue = operation === "set_key";
      const showKeyValueType = operation === "set_key";

      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Update Object Variable Settings">
            <TemplateTextField
              label="Variable name"
              value={name}
              onChange={(val) => updateConfig({ ...configObj, name: val })}
              placeholder="e.g. user"
              variableOptions={variableOptions}
            />
            <Label>
              Operation
              <Select
                value={operation}
                onChange={(event) =>
                  updateConfig({
                    ...configObj,
                    operation: event.currentTarget.value,
                  })
                }
              >
                <option value="merge">Merge (shallow)</option>
                <option value="deep_merge">Deep Merge</option>
                <option value="set_key">Set Key/Property</option>
                <option value="delete_key">Delete Key/Property</option>
              </Select>
            </Label>
            {showValue && (
              <TemplateTextareaField
                label="JSON value to merge"
                value={value}
                onChange={(val) => updateConfig({ ...configObj, value: val })}
                placeholder='{"key": "value"}'
                variableOptions={variableOptions}
              />
            )}
            {showKey && (
              <TemplateTextField
                label="Property key (support dot-path)"
                value={property_key}
                onChange={(val) => updateConfig({ ...configObj, property_key: val })}
                placeholder="e.g. address.city"
                variableOptions={variableOptions}
              />
            )}
            {showKeyValueType && (
              <Label>
                Property value type
                <Select
                  value={property_value_type}
                  onChange={(event) =>
                    updateConfig({
                      ...configObj,
                      property_value_type: event.currentTarget.value,
                    })
                  }
                >
                  <option value="text">Text</option>
                  <option value="json">JSON</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                </Select>
              </Label>
            )}
            {showKeyValue && (
              <TemplateTextareaField
                label="Property value"
                value={property_value}
                onChange={(val) => updateConfig({ ...configObj, property_value: val })}
                placeholder="Value"
                variableOptions={variableOptions}
                showMath={property_value_type === "number"}
              />
            )}
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "transform_variable":
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Transform mapping">
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
          </ActionConfigFieldGroup>
          <ActionConfigFieldGroup title="Transform expression">
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
          </ActionConfigFieldGroup>
        </div>
      );
    case "assert_output":
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Output assertion">
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
          </ActionConfigFieldGroup>
        </div>
      );
    case "domain_allowlist":
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Domain allowlist">
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
          </ActionConfigFieldGroup>
        </div>
      );
    case "call_subflow": {
      const config = callSubflowConfig(node.config);
      const selectedSubflow = subflowOptions.find(
        (subflow) => subflow.id === config.subflow_id,
      );
      return (
        <div className="graph-config-fields">
          {subflowOptions.length > 0 ? (
            <Label>
              Subflow
              <Select
                value={config.subflow_id}
                onChange={(event) =>
                  updateConfig({
                    ...config,
                    subflow_id: event.currentTarget.value,
                  })
                }
              >
                <option value="">Select a subflow</option>
                {subflowOptions.map((subflow) => (
                  <option key={subflow.id} value={subflow.id}>
                    {subflow.name}
                  </option>
                ))}
              </Select>
            </Label>
          ) : (
            <Label>
              Subflow id
              <Input
                value={config.subflow_id}
                onChange={(event) =>
                  updateConfig({
                    ...config,
                    subflow_id: event.currentTarget.value,
                  })
                }
              />
            </Label>
          )}
          {selectedSubflow ? (
            <p className="muted">
              Used by {selectedSubflow.used_by_count}{" "}
              {selectedSubflow.used_by_count === 1 ? "workflow" : "workflows"}
            </p>
          ) : null}
          <Label>
            Input mapping
            <Textarea
              value={formatSubflowInputMapping(config.input_mapping)}
              onChange={(event) =>
                updateConfig({
                  ...config,
                  input_mapping: parseSubflowInputMapping(event.currentTarget.value),
                })
              }
            />
          </Label>
          <Label>
            Output prefix
            <Input
              value={config.output_prefix ?? ""}
              onChange={(event) =>
                updateConfig({
                  ...config,
                  output_prefix: event.currentTarget.value.trim() || null,
                })
              }
            />
          </Label>
        </div>
      );
    }
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
      const selectedActionType = actionTypeFromConfig(actionConfig);
      const isCompatibilityAction = Boolean(actionConfig && !selectedActionType);
      return (
        <div className="graph-config-fields">
          <ActionTypeDropdown
            value={selectedActionType}
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

function callSubflowConfig(config: unknown) {
  const value = objectConfig(config);
  const inputMapping = Array.isArray(value.input_mapping)
    ? value.input_mapping.flatMap((item) => {
        const itemRecord = objectConfig(item);
        const inputName =
          typeof itemRecord.input_name === "string" ? itemRecord.input_name.trim() : "";
        const mappedValue = typeof itemRecord.value === "string" ? itemRecord.value : "";
        return inputName ? [{ input_name: inputName, value: mappedValue }] : [];
      })
    : [];
  return {
    subflow_id: typeof value.subflow_id === "string" ? value.subflow_id : "",
    input_mapping: inputMapping,
    output_prefix:
      typeof value.output_prefix === "string" && value.output_prefix.trim()
        ? value.output_prefix.trim()
        : null,
  };
}

function formatSubflowInputMapping(
  inputMapping: Array<{ input_name: string; value: string }>,
) {
  return inputMapping
    .map((item) => `${item.input_name}=${item.value}`)
    .join("\n");
}

function parseSubflowInputMapping(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const separatorIndex = line.indexOf("=");
      const inputName =
        separatorIndex >= 0 ? line.slice(0, separatorIndex).trim() : line.trim();
      if (!inputName) return [];
      return [
        {
          input_name: inputName,
          value: separatorIndex >= 0 ? line.slice(separatorIndex + 1).trim() : "",
        },
      ];
    });
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
