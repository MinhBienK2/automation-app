import type {
  GraphNode,
  SubflowSummary,
} from "../../../types/workflow";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { SwitchField } from "../../../components/ui/switch";
import { Textarea } from "../../../components/ui/textarea";
import { ConditionFields, conditionFromConfig } from "./WorkflowGraphConditionFields";
import { WorkflowGraphCheckConditionsFields } from "./WorkflowGraphCheckConditionsFields";
import { WorkflowGraphCalculateValueFields } from "./WorkflowGraphCalculateValueFields";
import { ActionConfigFieldGroup } from "./ActionConfigFieldGroup";
import { SetVariablesConfigFields } from "./VariableConfigFields";
import { TemplateTextareaField, type VariableOption } from "./TemplateTextField";
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
import { MathNodeFields } from "./inspector/fields/MathNodeFields";
import { TextNodeFields } from "./inspector/fields/TextNodeFields";
import { BooleanNodeFields } from "./inspector/fields/BooleanNodeFields";
import { ListNodeFields } from "./inspector/fields/ListNodeFields";
import { ObjectNodeFields } from "./inspector/fields/ObjectNodeFields";
import { ActionNodeConfigFields } from "./inspector/fields/ActionNodeConfigFields";

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
    case "set_number_variable":
    case "generate_random_number":
    case "parse_text_to_number":
    case "math_operation":
    case "round_number":
    case "format_number":
    case "compare_numbers":
    case "check_number_range":
    case "check_number_property":
    case "update_number_variable":
      return (
        <MathNodeFields
          node={node}
          onChange={onChange}
          variableOptions={variableOptions}
        />
      );
    case "update_text_variable":
    case "set_text_variable":
    case "append_text":
    case "prepend_text":
    case "replace_text":
    case "trim_text":
    case "change_text_case":
    case "slice_text":
    case "regex_extract":
    case "get_text_length":
    case "check_text_empty":
    case "check_text_contains":
    case "check_text_regex_matches":
      return (
        <TextNodeFields
          node={node}
          onChange={onChange}
          variableOptions={variableOptions}
        />
      );
    case "set_boolean_variable":
    case "generate_random_boolean":
    case "parse_to_boolean":
    case "boolean_logical_op":
    case "compare_booleans":
    case "check_boolean_property":
    case "update_flag_variable":
      return (
        <BooleanNodeFields
          node={node}
          onChange={onChange}
          variableOptions={variableOptions}
        />
      );
    case "update_list_variable":
    case "create_empty_list":
    case "create_list_manual":
    case "split_text_to_list":
    case "generate_number_range":
    case "add_to_list":
    case "remove_from_list_by_index":
    case "remove_from_list_by_value":
    case "merge_lists":
    case "get_list_item":
    case "get_list_length":
    case "slice_list":
    case "join_list":
    case "filter_list":
    case "check_list_any_match":
    case "check_list_all_match":
    case "map_list_property":
    case "sort_reverse_list":
    case "execute_list_script":
    case "check_list_empty":
    case "check_list_contains":
      return (
        <ListNodeFields
          node={node}
          onChange={onChange}
          variableOptions={variableOptions}
        />
      );
    case "create_empty_object":
    case "create_object_manual":
    case "parse_json_to_object":
    case "set_object_property":
    case "remove_object_property":
    case "merge_objects":
    case "rename_object_property":
    case "get_object_property":
    case "get_object_keys":
    case "get_object_values":
    case "stringify_object":
    case "execute_object_script":
    case "check_object_key_exists":
    case "check_object_empty":
      return (
        <ObjectNodeFields
          node={node}
          onChange={onChange}
          variableOptions={variableOptions}
        />
      );
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
    case "action":
      return (
        <ActionNodeConfigFields
          node={node}
          onChange={onChange}
          variableOptions={variableOptions}
        />
      );
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
