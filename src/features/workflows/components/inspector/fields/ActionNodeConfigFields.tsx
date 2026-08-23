import type { GraphNode, ActionConfig, ActionType } from "../../../../../types/workflow";
import { ActionConfigFieldGroup } from "../../actionFields/ActionConfigFieldGroup";
import { ActionConfigEditor } from "../../actionFields/ActionConfigEditor";
import {
  ActionTypeDropdown,
  GraphInternalActionConfigPanel,
  actionTypeFromConfig,
  isActionConfig,
} from "../WorkflowGraphActionTypeDropdown";
import type { VariableOption } from "../../variables/TemplateTextField";
import { actionLabels } from "../../../../../lib/workflowUi";
import { defaultActionConfig } from "../../../lib/workflowGraph";

export function ActionNodeConfigFields({
  node,
  onChange,
  variableOptions,
}: {
  node: GraphNode;
  onChange: (node: GraphNode) => void;
  variableOptions?: VariableOption[];
}) {
  const updateConfig = (config: ActionConfig) => {
    onChange({ ...node, config });
  };

  const updateActionType = (actionType: ActionType) => {
    onChange({
      ...node,
      label: actionLabels[actionType],
      config: defaultActionConfig(actionType),
    });
  };

  const actionConfig = isActionConfig(node.config) ? node.config : null;
  const type = actionTypeFromConfig(actionConfig);
  if (!type) {
    return (
      <div className="graph-config-fields">
        <ActionConfigFieldGroup title="Action configuration">
          <ActionTypeDropdown value={null} onChange={updateActionType} />
          {actionConfig ? (
            <GraphInternalActionConfigPanel config={actionConfig} />
          ) : null}
        </ActionConfigFieldGroup>
      </div>
    );
  }

  return (
    <div className="graph-config-fields">
      <ActionConfigFieldGroup title="Action configuration">
        <ActionTypeDropdown value={type} onChange={updateActionType} />
      </ActionConfigFieldGroup>
      <ActionConfigEditor
        config={actionConfig as ActionConfig}
        onChange={updateConfig}
        variableOptions={variableOptions}
      />
    </div>
  );
}
