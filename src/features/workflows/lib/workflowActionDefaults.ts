import type {
  ActionConfig,
  ActionType,
  DesktopStepTargetConfig,
} from "../../../types/workflow";

import { defaultSurfaceActionConfig } from "./workflowActionDefaultsSurfaces";
import { defaultVariableActionConfig } from "./workflowActionDefaultsVariables";
import { defaultCollectionActionConfig } from "./workflowActionDefaultsCollections";

export function defaultActionConfig(actionType: ActionType): ActionConfig {
  return (
    defaultSurfaceActionConfig(actionType) ??
    defaultVariableActionConfig(actionType) ??
    defaultCollectionActionConfig(actionType) ??
    ({ type: actionType, config: {} } as ActionConfig)
  );
}
