import type { ActionConfig } from "../../../../types/workflow";
import { actionSchemas } from "../../lib/actionFields";
import { ActionConfigSchemaForm } from "./ActionConfigSchemaForm";
import type { VariableOption } from "../variables/TemplateTextField";

type ActionConfigEditorProps = {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
  variableOptions?: VariableOption[];
};

/**
 * Renders one action's config form from its declarative field schema
 * (src/features/workflows/lib/actionFields/<domain>.tsx).
 */
export function ActionConfigEditor(props: ActionConfigEditorProps) {
  const schema = actionSchemas[props.config.type];
  if (!schema) return null;
  return <ActionConfigSchemaForm schema={schema} {...props} />;
}
