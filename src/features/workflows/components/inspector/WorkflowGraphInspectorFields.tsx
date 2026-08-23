import type { GraphNode, SubflowSummary } from "../../../../types/workflow";
import type { VariableOption } from "../variables/TemplateTextField";
import { NodeSchemaForm } from "./NodeSchemaForm";
import { nodeSchemas } from "./nodeSchemas";

type NodeConfigFieldsProps = {
  node: GraphNode;
  onChange: (node: GraphNode) => void;
  variableOptions?: VariableOption[];
  subflowOptions?: SubflowSummary[];
};

/**
 * Renders one graph node's config form from its declarative schema
 * (see ./nodeSchemas.tsx). Falls back to nothing for unknown types.
 */
export function NodeConfigFields({
  node,
  onChange,
  variableOptions,
  subflowOptions = [],
}: NodeConfigFieldsProps) {
  const schema = nodeSchemas[node.node_type];
  if (!schema) return null;
  return (
    <NodeSchemaForm
      schema={schema}
      node={node}
      onChange={onChange}
      variableOptions={variableOptions}
      extra={{ subflowOptions }}
    />
  );
}
