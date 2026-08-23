import type { GraphNode } from "../../../../../types/workflow";
import type { VariableOption } from "../../variables/TemplateTextField";
import { ListMutationFields } from "./ListMutationFields";
import { ListProcessingFields } from "./ListProcessingFields";
import { ListConditionFields } from "./ListConditionFields";

export function ListNodeFields({
  node,
  onChange,
  variableOptions,
}: {
  node: GraphNode;
  onChange: (node: GraphNode) => void;
  variableOptions?: VariableOption[];
}) {
  switch (node.node_type) {
    // Mutation / Creation
    case "update_list_variable":
    case "create_empty_list":
    case "create_list_manual":
    case "split_text_to_list":
    case "generate_number_range":
    case "add_to_list":
    case "remove_from_list_by_index":
    case "remove_from_list_by_value":
    case "merge_lists":
      return (
        <ListMutationFields
          node={node}
          onChange={onChange}
          variableOptions={variableOptions}
        />
      );

    // Processing / Mapping
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
      return (
        <ListProcessingFields
          node={node}
          onChange={onChange}
          variableOptions={variableOptions}
        />
      );

    // Conditions
    case "check_list_empty":
    case "check_list_contains":
      return (
        <ListConditionFields
          node={node}
          onChange={onChange}
          variableOptions={variableOptions}
        />
      );

    default:
      return null;
  }
}
