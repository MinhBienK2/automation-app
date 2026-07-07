import type {
  ActionType,
  GraphNode,
  SubflowSummary,
} from "../../../types/workflow";
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
import { ConditionFields, conditionFromConfig } from "./WorkflowGraphConditionFields";
import { WorkflowGraphCheckConditionsFields } from "./WorkflowGraphCheckConditionsFields";
import { WorkflowGraphCalculateValueFields } from "./WorkflowGraphCalculateValueFields";
import { ActionConfigFieldGroup } from "./ActionConfigFieldGroup";
import { SetVariablesConfigFields } from "./VariableConfigFields";
import { TemplateTextField, TemplateTextareaField, type VariableOption } from "./TemplateTextField";
import {
  arrayConfig,
  booleanConfig,
  objectConfig,
  stringConfig,
} from "../lib/configUtils";
import { VariableNumericInput } from "./VariableNumericInput";

// Import modular field editors
import { RouterNodeFields } from "./inspector/RouterNodeFields";
import { RandomChoiceNodeFields } from "./inspector/RandomChoiceNodeFields";
import { LoopNodeFields } from "./inspector/LoopNodeFields";
import { SwitchNodeFields } from "./inspector/SwitchNodeFields";

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
    case "repeat_times":
    case "repeat_for_each":
    case "while":
    case "repeat_until":
      return (
        <LoopNodeFields
          node={node}
          onChange={onChange}
        />
      );
    case "switch":
      return (
        <SwitchNodeFields
          node={node}
          onChange={onChange}
        />
      );
    case "router":
      return (
        <RouterNodeFields
          node={node}
          onChange={onChange}
        />
      );
    case "random_choice":
      return (
        <RandomChoiceNodeFields
          node={node}
          onChange={onChange}
        />
      );
    case "retry":
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Retry policy">
            <VariableNumericInput
              label="Max attempts"
              min={1}
              value={node.config && (node.config as any).max_attempts !== undefined ? (node.config as any).max_attempts : 3}
              onChange={(nextVal) => {
                const val = nextVal !== "" && nextVal !== null && nextVal !== undefined
                  ? typeof nextVal === "string" && nextVal.startsWith("{{")
                    ? nextVal
                    : Number(nextVal)
                  : null;
                updateConfig({
                  ...objectConfig(node.config),
                  max_attempts: val,
                });
              }}
            />
            <VariableNumericInput
              label="Delay ms"
              min={0}
              value={node.config && (node.config as any).delay_ms !== undefined ? (node.config as any).delay_ms : 100}
              onChange={(nextVal) => {
                const val = nextVal !== "" && nextVal !== null && nextVal !== undefined
                  ? typeof nextVal === "string" && nextVal.startsWith("{{")
                    ? nextVal
                    : Number(nextVal)
                  : null;
                updateConfig({
                  ...objectConfig(node.config),
                  delay_ms: val,
                });
              }}
            />
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
    case "check_conditions":
      return (
        <WorkflowGraphCheckConditionsFields
          node={node}
          onChange={onChange}
          variableOptions={variableOptions}
        />
      );
    case "calculate_value":
      return (
        <WorkflowGraphCalculateValueFields
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
    case "create_empty_list": {
      const configObj = objectConfig(node.config);
      const output_name = stringConfig(node.config, "output_name", "empty_list");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Create Empty List Settings">
            <TemplateTextField
              label="Output variable name"
              value={output_name}
              onChange={(val) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. my_list"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "create_list_manual": {
      const configObj = objectConfig(node.config);
      const output_name = stringConfig(node.config, "output_name", "my_list");
      const value_type = stringConfig(node.config, "value_type", "text");
      const items = arrayConfig(node.config, "items") || [];
      const itemsText = items.join("\n");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Create List Manual Settings">
            <TemplateTextField
              label="Output variable name"
              value={output_name}
              onChange={(val) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. my_list"
              variableOptions={variableOptions}
            />
            <Label>
              Item Value Type
              <Select
                value={value_type}
                onChange={(event) => updateConfig({ ...configObj, value_type: event.currentTarget.value })}
              >
                <option value="text">Text</option>
                <option value="json">JSON</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
              </Select>
            </Label>
            <Label>
              List Items (One per line)
              <Textarea
                value={itemsText}
                placeholder="item1&#10;item2&#10;item3"
                rows={5}
                onChange={(event) =>
                  updateConfig({
                    ...configObj,
                    items: event.currentTarget.value.split("\n").filter(Boolean),
                  })
                }
              />
            </Label>
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "split_text_to_list": {
      const configObj = objectConfig(node.config);
      const output_name = stringConfig(node.config, "output_name", "split_list");
      const source_text = stringConfig(node.config, "source_text", "");
      const delimiter = stringConfig(node.config, "delimiter", ",");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Split Text to List Settings">
            <TemplateTextField
              label="Output variable name"
              value={output_name}
              onChange={(val) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. my_list"
              variableOptions={variableOptions}
            />
            <TemplateTextareaField
              label="Source text to split"
              value={source_text}
              onChange={(val) => updateConfig({ ...configObj, source_text: val })}
              placeholder="e.g. apple,banana,orange"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Delimiter"
              value={delimiter}
              onChange={(val) => updateConfig({ ...configObj, delimiter: val })}
              placeholder="e.g. ,"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "generate_number_range": {
      const configObj = objectConfig(node.config);
      const output_name = stringConfig(node.config, "output_name", "range_list");
      const start = stringConfig(node.config, "start", "1");
      const end = stringConfig(node.config, "end", "10");
      const step = stringConfig(node.config, "step", "1");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Generate Number Range Settings">
            <TemplateTextField
              label="Output variable name"
              value={output_name}
              onChange={(val) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. range_list"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Start value"
              value={start}
              onChange={(val) => updateConfig({ ...configObj, start: val })}
              placeholder="1"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="End value (inclusive)"
              value={end}
              onChange={(val) => updateConfig({ ...configObj, end: val })}
              placeholder="10"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Step size"
              value={step}
              onChange={(val) => updateConfig({ ...configObj, step: val })}
              placeholder="1"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "add_to_list": {
      const configObj = objectConfig(node.config);
      const name = stringConfig(node.config, "name", "");
      const position = stringConfig(node.config, "position", "end") as "end" | "start" | "unique_end";
      const value_type = stringConfig(node.config, "value_type", "text");
      const value = stringConfig(node.config, "value", "");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Add to List Settings">
            <TemplateTextField
              label="Target list variable name"
              value={name}
              onChange={(val) => updateConfig({ ...configObj, name: val })}
              placeholder="e.g. my_list"
              variableOptions={variableOptions}
            />
            <Label>
              Add Position
              <Select
                value={position}
                onChange={(event) => updateConfig({ ...configObj, position: event.currentTarget.value })}
              >
                <option value="end">End (Push)</option>
                <option value="start">Start (Unshift)</option>
                <option value="unique_end">End (Only if unique)</option>
              </Select>
            </Label>
            <Label>
              Value type
              <Select
                value={value_type}
                onChange={(event) => updateConfig({ ...configObj, value_type: event.currentTarget.value })}
              >
                <option value="text">Text</option>
                <option value="json">JSON</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
              </Select>
            </Label>
            <TemplateTextareaField
              label="Value to add"
              value={value}
              onChange={(val) => updateConfig({ ...configObj, value: val })}
              placeholder="Value"
              variableOptions={variableOptions}
              showMath={value_type === "number"}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "remove_from_list_by_index": {
      const configObj = objectConfig(node.config);
      const name = stringConfig(node.config, "name", "");
      const index = stringConfig(node.config, "index", "0");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Remove from List by Index Settings">
            <TemplateTextField
              label="Target list variable name"
              value={name}
              onChange={(val) => updateConfig({ ...configObj, name: val })}
              placeholder="e.g. my_list"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Index (0-based number or variable)"
              value={index}
              onChange={(val) => updateConfig({ ...configObj, index: val })}
              placeholder="0"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "remove_from_list_by_value": {
      const configObj = objectConfig(node.config);
      const name = stringConfig(node.config, "name", "");
      const value_type = stringConfig(node.config, "value_type", "text");
      const value = stringConfig(node.config, "value", "");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Remove from List by Value Settings">
            <TemplateTextField
              label="Target list variable name"
              value={name}
              onChange={(val) => updateConfig({ ...configObj, name: val })}
              placeholder="e.g. my_list"
              variableOptions={variableOptions}
            />
            <Label>
              Value type
              <Select
                value={value_type}
                onChange={(event) => updateConfig({ ...configObj, value_type: event.currentTarget.value })}
              >
                <option value="text">Text</option>
                <option value="json">JSON</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
              </Select>
            </Label>
            <TemplateTextareaField
              label="Value to match for removal"
              value={value}
              onChange={(val) => updateConfig({ ...configObj, value: val })}
              placeholder="Value"
              variableOptions={variableOptions}
              showMath={value_type === "number"}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "merge_lists": {
      const configObj = objectConfig(node.config);
      const name = stringConfig(node.config, "name", "");
      const value = stringConfig(node.config, "value", "");
      const unique = booleanConfig(node.config, "unique", false);
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Merge Lists Settings">
            <TemplateTextField
              label="Target list variable name"
              value={name}
              onChange={(val) => updateConfig({ ...configObj, name: val })}
              placeholder="e.g. my_list"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="List/Array to merge (variable template e.g. {{outputs.other_list}} or JSON array)"
              value={value}
              onChange={(val) => updateConfig({ ...configObj, value: val })}
              placeholder="e.g. {{outputs.other_list}}"
              variableOptions={variableOptions}
            />
            <SwitchField
              label="Merge Unique items only"
              checked={unique}
              onCheckedChange={(val) => updateConfig({ ...configObj, unique: val })}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "get_list_item": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const position = stringConfig(node.config, "position", "first") as "first" | "last" | "index";
      const index = stringConfig(node.config, "index", "");
      const output_name = stringConfig(node.config, "output_name", "list_item");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Get List Item Settings">
            <TemplateTextField
              label="Source list variable name"
              value={source}
              onChange={(val) => updateConfig({ ...configObj, source: val })}
              placeholder="e.g. my_list"
              variableOptions={variableOptions}
            />
            <Label>
              Position
              <Select
                value={position}
                onChange={(event) => updateConfig({ ...configObj, position: event.currentTarget.value })}
              >
                <option value="first">First item</option>
                <option value="last">Last item</option>
                <option value="index">Specific Index</option>
              </Select>
            </Label>
            {position === "index" && (
              <TemplateTextField
                label="Index (0-based number or variable)"
                value={index}
                onChange={(val) => updateConfig({ ...configObj, index: val })}
                placeholder="0"
                variableOptions={variableOptions}
              />
            )}
            <TemplateTextField
              label="Result output variable name"
              value={output_name}
              onChange={(val) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. selected_item"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "get_list_length": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const output_name = stringConfig(node.config, "output_name", "list_length");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Get List Length Settings">
            <TemplateTextField
              label="Source list variable name"
              value={source}
              onChange={(val) => updateConfig({ ...configObj, source: val })}
              placeholder="e.g. my_list"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result output variable name"
              value={output_name}
              onChange={(val) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. list_size"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "slice_list": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const start = stringConfig(node.config, "start", "0");
      const end = stringConfig(node.config, "end", "");
      const output_name = stringConfig(node.config, "output_name", "sliced_list");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Slice List Settings">
            <TemplateTextField
              label="Source list variable name"
              value={source}
              onChange={(val) => updateConfig({ ...configObj, source: val })}
              placeholder="e.g. my_list"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Start index (0-based)"
              value={start}
              onChange={(val) => updateConfig({ ...configObj, start: val })}
              placeholder="0"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="End index (optional, exclusive)"
              value={end}
              onChange={(val) => updateConfig({ ...configObj, end: val })}
              placeholder="e.g. 5"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result output variable name"
              value={output_name}
              onChange={(val) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. sub_list"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "join_list": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const separator = stringConfig(node.config, "separator", ", ");
      const output_name = stringConfig(node.config, "output_name", "joined_string");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Join List Settings">
            <TemplateTextField
              label="Source list variable name"
              value={source}
              onChange={(val) => updateConfig({ ...configObj, source: val })}
              placeholder="e.g. my_list"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Separator text"
              value={separator}
              onChange={(val) => updateConfig({ ...configObj, separator: val })}
              placeholder="e.g. , "
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result output variable name"
              value={output_name}
              onChange={(val) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. csv_text"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "filter_list":
    case "check_list_any_match":
    case "check_list_all_match": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const output_name = stringConfig(node.config, "output_name", node.node_type === "filter_list" ? "filtered_list" : "has_match");
      const rulesGroup = (configObj.rules_group as any) || { operator: "and", rules: [] };
      const rules = (rulesGroup.rules as any[]) || [];

      const handleAddRule = () => {
        const nextRules = [
          ...rules,
          {
            type: "value_compare" as const,
            left_operand: "{{item}}",
            comparison: "equals" as const,
            right_operand: "",
          },
        ];
        updateConfig({
          ...configObj,
          rules_group: {
            ...rulesGroup,
            operator: rulesGroup.operator || "and",
            rules: nextRules,
          },
        });
      };

      const handleRemoveRule = (index: number) => {
        const nextRules = rules.filter((_, i) => i !== index);
        updateConfig({
          ...configObj,
          rules_group: {
            ...rulesGroup,
            rules: nextRules,
          },
        });
      };

      const handleUpdateRule = (index: number, nextRule: any) => {
        const nextRules = [...rules];
        nextRules[index] = {
          ...nextRules[index],
          ...nextRule,
        };
        updateConfig({
          ...configObj,
          rules_group: {
            ...rulesGroup,
            rules: nextRules,
          },
        });
      };

      return (
        <div className="graph-config-fields space-y-4">
          <ActionConfigFieldGroup title={`${node.node_type === "filter_list" ? "Filter List" : "List Match"} Settings`}>
            <TemplateTextField
              label="Source list variable name"
              value={source}
              onChange={(val) => updateConfig({ ...configObj, source: val })}
              placeholder="e.g. my_list"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result output variable name"
              value={output_name}
              onChange={(val) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. result"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>

          <ActionConfigFieldGroup title="Filter Rules (Evaluated for each element 'item')">
            <Label>
              Combine Operator
              <Select
                value={rulesGroup.operator || "and"}
                onChange={(event) =>
                  updateConfig({
                    ...configObj,
                    rules_group: {
                      ...rulesGroup,
                      operator: event.currentTarget.value as "and" | "or",
                    },
                  })
                }
              >
                <option value="and">All rules must match (AND)</option>
                <option value="or">Any rule can match (OR)</option>
              </Select>
            </Label>

            <div className="space-y-4 mt-3">
              {rules.map((rule, idx) => (
                <div key={idx} className="p-3 border border-border rounded-lg space-y-2 relative bg-surface-inset">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-secondary font-mono">Rule #{idx + 1}</span>
                    <button
                      type="button"
                      className="text-destructive hover:text-destructive-hover p-1 text-xs"
                      onClick={() => handleRemoveRule(idx)}
                    >
                      Delete
                    </button>
                  </div>

                  <TemplateTextField
                    label="Left operand (e.g. {{item}} or {{item.property}})"
                    value={rule.left_operand ?? "{{item}}"}
                    placeholder="{{item}}"
                    variableOptions={variableOptions}
                    onChange={(val) => handleUpdateRule(idx, { left_operand: val })}
                  />

                  <Label>
                    Comparison
                    <Select
                      value={rule.comparison ?? "equals"}
                      onChange={(event) =>
                        handleUpdateRule(idx, {
                          comparison: event.currentTarget.value,
                        })
                      }
                    >
                      <option value="equals">Equals (=)</option>
                      <option value="not_equals">Does not equal (!=)</option>
                      <option value="contains">Contains</option>
                      <option value="not_contains">Does not contain</option>
                      <option value="greater_than">Greater than (&gt;)</option>
                      <option value="less_than">Less than (&lt;)</option>
                      <option value="greater_than_or_equals">Greater or equal (&gt;=)</option>
                      <option value="less_than_or_equals">Less or equal (&lt;=)</option>
                      <option value="is_empty">Is Empty</option>
                      <option value="is_not_empty">Is Not Empty</option>
                      <option value="matches_regex">Matches Regex</option>
                    </Select>
                  </Label>

                  {!["is_empty", "is_not_empty"].includes(rule.comparison ?? "equals") && (
                    <TemplateTextField
                      label="Right operand / Expected value"
                      value={rule.right_operand ?? ""}
                      placeholder="e.g. active"
                      variableOptions={variableOptions}
                      onChange={(val) => handleUpdateRule(idx, { right_operand: val })}
                    />
                  )}
                </div>
              ))}

              <button
                type="button"
                className="w-full flex items-center justify-center gap-1.5 p-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/80 mt-2"
                onClick={handleAddRule}
              >
                + Add Rule
              </button>
            </div>
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "map_list_property": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const property_key = stringConfig(node.config, "property_key", "");
      const output_name = stringConfig(node.config, "output_name", "mapped_list");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Map List Property Settings">
            <TemplateTextField
              label="Source list (containing objects)"
              value={source}
              onChange={(val) => updateConfig({ ...configObj, source: val })}
              placeholder="e.g. users"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Property key to extract"
              value={property_key}
              onChange={(val) => updateConfig({ ...configObj, property_key: val })}
              placeholder="e.g. id"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result output variable name"
              value={output_name}
              onChange={(val) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. user_ids"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "sort_reverse_list": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const action = stringConfig(node.config, "action", "sort_asc") as "sort_asc" | "sort_desc" | "reverse";
      const sort_key = stringConfig(node.config, "sort_key", "");
      const output_name = stringConfig(node.config, "output_name", "sorted_list");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Sort / Reverse List Settings">
            <TemplateTextField
              label="Source list variable name"
              value={source}
              onChange={(val) => updateConfig({ ...configObj, source: val })}
              placeholder="e.g. my_list"
              variableOptions={variableOptions}
            />
            <Label>
              Action
              <Select
                value={action}
                onChange={(event) => updateConfig({ ...configObj, action: event.currentTarget.value })}
              >
                <option value="sort_asc">Sort Ascending</option>
                <option value="sort_desc">Sort Descending</option>
                <option value="reverse">Reverse List Order</option>
              </Select>
            </Label>
            {action !== "reverse" && (
              <TemplateTextField
                label="Sort key (optional, for sorting objects by property)"
                value={sort_key}
                onChange={(val) => updateConfig({ ...configObj, sort_key: val })}
                placeholder="e.g. price"
                variableOptions={variableOptions}
              />
            )}
            <TemplateTextField
              label="Result output variable name"
              value={output_name}
              onChange={(val) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. sorted_result"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "execute_list_script": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const script = stringConfig(node.config, "script", "return list.map(item => item);");
      const output_name = stringConfig(node.config, "output_name", "script_result");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Execute List Script Settings">
            <TemplateTextField
              label="Source list variable name"
              value={source}
              onChange={(val) => updateConfig({ ...configObj, source: val })}
              placeholder="e.g. my_list"
              variableOptions={variableOptions}
            />
            <TemplateTextareaField
              label="JavaScript Script"
              value={script}
              placeholder="return list.filter(x => x.active).map(x => x.name);"
              variableOptions={variableOptions}
              isJs={true}
              onChange={(val) => updateConfig({ ...configObj, script: val })}
            />
            <div className="text-xs text-muted-foreground mt-1.5 space-y-1">
              <p>The input list is bound to the local variable <code>list</code>.</p>
              <p>The code is executed on the page/browser instance, allowing browser-side processing.</p>
            </div>
            <TemplateTextField
              label="Result output variable name"
              value={output_name}
              onChange={(val) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. processed_result"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "check_list_empty": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const output_name = stringConfig(node.config, "output_name", "is_empty");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Check List Empty Settings">
            <TemplateTextField
              label="Source list variable name"
              value={source}
              onChange={(val) => updateConfig({ ...configObj, source: val })}
              placeholder="e.g. my_list"
              variableOptions={variableOptions}
            />
            <TemplateTextField
              label="Result output variable name"
              value={output_name}
              onChange={(val) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. is_empty"
              variableOptions={variableOptions}
            />
          </ActionConfigFieldGroup>
        </div>
      );
    }
    case "check_list_contains": {
      const configObj = objectConfig(node.config);
      const source = stringConfig(node.config, "source", "");
      const value_type = stringConfig(node.config, "value_type", "text");
      const value = stringConfig(node.config, "value", "");
      const output_name = stringConfig(node.config, "output_name", "contains_item");
      return (
        <div className="graph-config-fields">
          <ActionConfigFieldGroup title="Check List Contains Settings">
            <TemplateTextField
              label="Source list variable name"
              value={source}
              onChange={(val) => updateConfig({ ...configObj, source: val })}
              placeholder="e.g. my_list"
              variableOptions={variableOptions}
            />
            <Label>
              Value type to check
              <Select
                value={value_type}
                onChange={(event) => updateConfig({ ...configObj, value_type: event.currentTarget.value })}
              >
                <option value="text">Text</option>
                <option value="json">JSON</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
              </Select>
            </Label>
            <TemplateTextareaField
              label="Value to search for"
              value={value}
              onChange={(val) => updateConfig({ ...configObj, value: val })}
              placeholder="Value"
              variableOptions={variableOptions}
              showMath={value_type === "number"}
            />
            <TemplateTextField
              label="Result output variable name"
              value={output_name}
              onChange={(val) => updateConfig({ ...configObj, output_name: val })}
              placeholder="e.g. has_item"
              variableOptions={variableOptions}
            />
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
