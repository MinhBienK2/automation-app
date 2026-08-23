import type { ComponentType, ReactNode } from "react";
import type { GraphNode, SubflowSummary } from "../../../../types/workflow";
import type { ActionSchema, FieldContext, NodeFieldContext } from "../../lib/actionFields/schema";
import { asNodeCtx } from "../../lib/actionFields/schema";
import { objectConfig } from "../../lib/configUtils";
import { ActionConfigFieldGroup } from "../actionFields/ActionConfigFieldGroup";
import { SetVariablesConfigFields } from "../variables/VariableConfigFields";
import type { VariableOption } from "../variables/TemplateTextField";
import { Textarea } from "../../../../components/ui/textarea";
import { Input } from "../../../../components/ui/input";
import { SwitchField } from "../../../../components/ui/switch";
import { Label } from "../../../../components/ui/label";
import { Select } from "../../../../components/ui/select";
import { ConditionFields, conditionFromConfig } from "./WorkflowGraphConditionFields";
import { WorkflowGraphCheckConditionsFields } from "./WorkflowGraphCheckConditionsFields";
import { WorkflowGraphCalculateValueFields } from "./WorkflowGraphCalculateValueFields";
import { RouterNodeFields } from "./RouterNodeFields";
import { RandomChoiceNodeFields } from "./RandomChoiceNodeFields";
import { LoopNodeFields } from "./LoopNodeFields";
import { SwitchNodeFields } from "./SwitchNodeFields";
import { MathNodeFields } from "./fields/MathNodeFields";
import { TextNodeFields } from "./fields/TextNodeFields";
import { BooleanNodeFields } from "./fields/BooleanNodeFields";
import { ListNodeFields } from "./fields/ListNodeFields";
import { ObjectNodeFields } from "./fields/ObjectNodeFields";
import { ActionNodeConfigFields } from "./fields/ActionNodeConfigFields";
import { DataNodeFields } from "./fields/DataNodeFields";

type NodeEditorProps = {
  node: GraphNode;
  onChange: (node: GraphNode) => void;
  variableOptions?: VariableOption[];
};

type Host = {
  node: GraphNode;
  onNodeChange: (node: GraphNode) => void;
  subflowOptions: SubflowSummary[];
};

function hostOf(ctx: FieldContext): Host {
  return (ctx.host ?? {}) as unknown as Host;
}

function updateNodeConfig(node: GraphNode, config: unknown): GraphNode {
  return { ...node, config };
}

const schema = (sections: ActionSchema["sections"]): ActionSchema => ({ sections });

const bare = (
  render: (host: Host, ctx: NodeFieldContext) => ReactNode,
): ActionSchema => ({
  sections: [
    {
      title: "",
      bare: true,
      fields: [
        {
          widget: "custom",
          render: (ctx) => render(hostOf(ctx), asNodeCtx(ctx)),
        },
      ],
    },
  ],
});

/** Delegate the whole config surface to an existing specialized editor. */
function delegatingTo(Editor: ComponentType<NodeEditorProps>): ActionSchema {
  return bare((host, ctx) => (
    <Editor node={host.node} onChange={host.onNodeChange} variableOptions={ctx.variableOptions} />
  ));
}

const infoSchema = (message: string): ActionSchema => ({
  sections: [
    {
      title: "",
      bare: true,
      fields: [
        {
          widget: "custom",
          render: () => <p className="muted">{message}</p>,
        },
      ],
    },
  ],
});

const configureByPorts =
  "Configure this node by connecting its named ports on the canvas.";

const closeBrowserField = (ctx: NodeFieldContext) => {
  const checked = Boolean(ctx.values.close_browser);
  return (
    <SwitchField
      checked={checked}
      label="Close browser after workflow ends"
      onCheckedChange={(closeBrowser) => ctx.setValue("close_browser", closeBrowser)}
    />
  );
};

// ── Registry ───────────────────────────────────────────────────────────────

export const nodeSchemas: Partial<Record<GraphNode["node_type"], ActionSchema>> = {
  if: bare((host) => (
    <ActionConfigFieldGroup title="Condition">
      <ConditionFields
        condition={conditionFromConfig(host.node.config)}
        onChange={(condition) =>
          host.onNodeChange(
            updateNodeConfig(host.node, { ...objectConfig(host.node.config), condition }),
          )
        }
      />
    </ActionConfigFieldGroup>
  )),

  retry: schema([
    {
      title: "Retry policy",
      fields: [
        { widget: "numeric", key: "max_attempts", label: "Max attempts", min: 1, defaultValue: 3 },
        { widget: "numeric", key: "delay_ms", label: "Delay ms", min: 0, defaultValue: 100 },
      ],
    },
  ]),

  end_success: schema([
    {
      title: "Terminal behavior",
      fields: [{ widget: "custom", render: (ctx) => closeBrowserField(asNodeCtx(ctx)) }],
    },
  ]),

  end_failure: schema([
    {
      title: "Terminal result",
      fields: [
        { widget: "text", key: "reason", label: "Failure reason", defaultValue: "Graph reached failure end" },
        { widget: "custom", render: (ctx) => closeBrowserField(asNodeCtx(ctx)) },
      ],
    },
  ]),

  stop_workflow: schema([
    {
      title: "Terminal result",
      fields: [
        {
          widget: "select",
          key: "status",
          label: "Status",
          defaultValue: "success",
          options: [
            { value: "success", label: "Success" },
            { value: "failure", label: "Failure" },
          ],
        },
        { widget: "text", key: "reason", label: "Reason" },
        { widget: "custom", render: (ctx) => closeBrowserField(asNodeCtx(ctx)) },
      ],
    },
  ]),

  set_variable: bare((host, ctx) => (
    <ActionConfigFieldGroup title="Variable rows">
      <SetVariablesConfigFields
        config={objectConfig(host.node.config)}
        onChange={(config) => host.onNodeChange(updateNodeConfig(host.node, config))}
        variableOptions={ctx.variableOptions}
      />
    </ActionConfigFieldGroup>
  )),

  set_json_variables: schema([
    {
      title: "JSON variables",
      fields: [
        {
          widget: "textarea",
          key: "json",
          label: "JSON variables",
          defaultValue: '{\n  "name": "value"\n}',
        },
      ],
    },
  ]),

  transform_variable: bare((_host, nctx) => {
    const values = nctx.values;
    return (
      <div className="graph-config-fields">
        <ActionConfigFieldGroup title="Transform mapping">
          <Label>
            Source output
            <Input
              value={typeof values.source_name === "string" ? values.source_name : "input"}
              onChange={(event) => nctx.setValue("source_name", event.currentTarget.value)}
            />
          </Label>
          <Label>
            Target output
            <Input
              value={typeof values.target_name === "string" ? values.target_name : "output"}
              onChange={(event) => nctx.setValue("target_name", event.currentTarget.value)}
            />
          </Label>
        </ActionConfigFieldGroup>
        <ActionConfigFieldGroup title="Transform expression">
          <Label>
            Expression
            <Textarea
              value={typeof values.expression === "string" ? values.expression : ""}
              onChange={(event) => nctx.setValue("expression", event.currentTarget.value)}
            />
          </Label>
        </ActionConfigFieldGroup>
      </div>
    );
  }),

  assert_output: schema([
    {
      title: "Output assertion",
      fields: [
        { widget: "text", key: "name", label: "Output name", defaultValue: "output" },
        {
          widget: "select",
          key: "match",
          label: "Match",
          defaultValue: "equals",
          options: [
            { value: "equals", label: "Equals" },
            { value: "contains", label: "Contains" },
          ],
        },
        { widget: "text", key: "value", label: "Expected value" },
      ],
    },
  ]),

  domain_allowlist: bare((host) => (
    <ActionConfigFieldGroup title="Domain allowlist">
      <Label>
        Allowed domains
        <Textarea
          value={(objectConfig(host.node.config).domains as string[] | undefined)?.join("\n") ?? ""}
          onChange={(event) =>
            host.onNodeChange(
              updateNodeConfig(host.node, {
                ...objectConfig(host.node.config),
                domains: event.currentTarget.value
                  .split("\n")
                  .map((domain) => domain.trim())
                  .filter(Boolean),
              }),
            )
          }
        />
      </Label>
    </ActionConfigFieldGroup>
  )),

  call_subflow: bare((host) => {
    const config = callSubflowConfig(host.node.config);
    const selectedSubflow = host.subflowOptions.find(
      (subflow) => subflow.id === config.subflow_id,
    );
    const update = (patch: Partial<ReturnType<typeof callSubflowConfig>>) =>
      host.onNodeChange(updateNodeConfig(host.node, { ...config, ...patch }));
    return (
      <div className="graph-config-fields">
        {host.subflowOptions.length > 0 ? (
          <Label>
            Subflow
            <Select
              value={config.subflow_id}
              onChange={(event) => update({ subflow_id: event.currentTarget.value })}
            >
              <option value="">Select a subflow</option>
              {host.subflowOptions.map((subflow) => (
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
              onChange={(event) => update({ subflow_id: event.currentTarget.value })}
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
              update({ input_mapping: parseSubflowInputMapping(event.currentTarget.value) })
            }
          />
        </Label>
        <Label>
          Output prefix
          <Input
            value={config.output_prefix ?? ""}
            onChange={(event) =>
              update({ output_prefix: event.currentTarget.value.trim() || null })
            }
          />
        </Label>
      </div>
    );
  }),

  check_conditions: delegatingTo(WorkflowGraphCheckConditionsFields),
  calculate_value: delegatingTo(WorkflowGraphCalculateValueFields),

  repeat_times: delegatingTo(LoopNodeFields),
  repeat_for_each: delegatingTo(LoopNodeFields),
  while: delegatingTo(LoopNodeFields),
  repeat_until: delegatingTo(LoopNodeFields),
  switch: delegatingTo(SwitchNodeFields),
  router: delegatingTo(RouterNodeFields),
  random_choice: delegatingTo(RandomChoiceNodeFields),

  try_catch: infoSchema(configureByPorts),
  fallback: infoSchema(configureByPorts),
  break_loop: infoSchema(configureByPorts),
  continue_loop: infoSchema(configureByPorts),

  action: delegatingTo(ActionNodeConfigFields),
};

// Multi-type families delegating to one editor each.
const families: Array<[ActionSchema, GraphNode["node_type"][]]> = [
  [delegatingTo(MathNodeFields), [
    "set_number_variable", "generate_random_number", "parse_text_to_number",
    "math_operation", "round_number", "format_number", "compare_numbers",
    "check_number_range", "check_number_property", "update_number_variable",
  ]],
  [delegatingTo(TextNodeFields), [
    "update_text_variable", "set_text_variable", "append_text", "prepend_text",
    "replace_text", "trim_text", "change_text_case", "slice_text",
    "regex_extract", "get_text_length", "check_text_empty",
    "check_text_contains", "check_text_regex_matches",
  ]],
  [delegatingTo(BooleanNodeFields), [
    "set_boolean_variable", "generate_random_boolean", "parse_to_boolean",
    "boolean_logical_op", "compare_booleans", "check_boolean_property",
    "update_flag_variable",
  ]],
  [delegatingTo(ListNodeFields), [
    "update_list_variable", "create_empty_list", "create_list_manual",
    "split_text_to_list", "generate_number_range", "add_to_list",
    "remove_from_list_by_index", "remove_from_list_by_value", "merge_lists",
    "get_list_item", "get_list_length", "slice_list", "join_list",
    "filter_list", "check_list_any_match", "check_list_all_match",
    "map_list_property", "sort_reverse_list", "execute_list_script",
    "check_list_empty", "check_list_contains",
  ]],
  [delegatingTo(ObjectNodeFields), [
    "create_empty_object", "create_object_manual", "parse_json_to_object",
    "set_object_property", "remove_object_property", "merge_objects",
    "rename_object_property", "get_object_property", "get_object_keys",
    "get_object_values", "stringify_object", "execute_object_script",
    "check_object_key_exists", "check_object_empty",
  ]],
  [delegatingTo(DataNodeFields), [
    "extract_text", "extract_attribute", "extract_input_value",
    "extract_table", "extract_list", "count_elements",
    "extract_regex_matches", "extract_text_content", "extract_inner_html",
    "extract_outer_html", "extract_computed_style", "extract_all_attributes",
    "extract_data_attributes", "extract_class_list",
    "extract_descendant_attributes", "extract_select_value",
    "extract_select_options", "extract_checkbox_state", "extract_form_data",
    "extract_table_headers", "extract_table_row", "extract_table_column",
    "extract_table_cell", "extract_list_attributes",
    "extract_structured_list", "extract_dimensions", "extract_visibility",
    "extract_element_state", "check_element_exists", "get_page_title",
    "get_meta_content", "extract_page_links", "extract_numbers",
    "extract_urls", "extract_emails", "get_current_url",
  ]],
];
for (const [entry, types] of families) {
  for (const type of types) nodeSchemas[type] = entry;
}

// ── Legacy helpers kept verbatim for call_subflow ──────────────────────────

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
