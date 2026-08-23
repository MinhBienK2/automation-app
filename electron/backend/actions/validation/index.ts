import {
  actionDefinitions,
  getActionDefinition,
  unsupportedActionTypeMessage,
  type ActionType,
} from "../registry.js";
import { validationError } from "../../shared/records.js";
import type { ActionConfig } from "../../../../src/types/workflow.js";
import {
  registerNestedValidatorLookup,
  type ActionValidationError,
  type ActionValidator,
  type ActionValidatorMap as ValidatorMapShape,
} from "./primitives.js";

type ActionValidatorMap = {
  [Type in ActionType]: ActionValidator<Extract<ActionConfig, { type: Type }>>;
};

import { navigationValidators } from "./navigation.js";
import { browserContextValidators } from "./browserContext.js";
import { elementInteractionValidators } from "./elementInteraction.js";
import { keyboardValidators } from "./keyboard.js";
import { formValidators } from "./form.js";
import { captureValidators } from "./capture.js";
import { variablesValidators } from "./variables.js";
import { networkValidators } from "./network.js";
import { flowControlValidators } from "./flowControl.js";
import { variableOpValidators } from "./variableOps.js";
import { variableLogicValidators } from "./variableLogic.js";
import { desktopValidators } from "./desktop.js";

/**
 * The per-action completeness validators, grouped by registry owner. Each
 * group file owns one slice of the action taxonomy; this composition is the
 * single lookup surface consumed by `validateActionConfig`.
 */
const actionValidators = {
  ...navigationValidators,
  ...browserContextValidators,
  ...elementInteractionValidators,
  ...keyboardValidators,
  ...formValidators,
  ...captureValidators,
  ...variablesValidators,
  ...networkValidators,
  ...flowControlValidators,
  ...variableOpValidators,
  ...variableLogicValidators,
  ...desktopValidators,
} as unknown as ActionValidatorMap;

/**
 * The authority on whether an Action Config is complete enough to run.
 *
 * This is one of two tiers of the same interface. `parseActionConfigShape` in
 * `../schemas/index.js` answers the narrower question "can this persisted JSON
 * be read as an Action Config of its declared type?", which the graph load path
 * uses to decide what to quarantine. This function answers "is it runnable?",
 * which is what the authoring path and the compile path enforce.
 *
 * The two are asymmetric by design: this tier is strictly stricter. A freshly
 * dropped `click` node has an empty element target, so the load path must accept
 * it while this tier reports it. `actionConfigTiers.test.ts` pins that
 * relationship so it stays deliberate.
 */
export function validateActionConfig(config: ActionConfig): ActionValidationError | null {
  const definition = getActionDefinition((config as { type?: unknown }).type);
  if (!definition) {
    return validationError(
      "type",
      unsupportedActionTypeMessage((config as { type?: unknown }).type),
    );
  }
  const validator = actionValidators[definition.type] as ActionValidator | undefined;
  if (!validator) {
    return validationError(
      "type",
      `Action ${definition.type} is registered without a validation handler`,
    );
  }
  return validator(config);
}

// Nested action arrays re-enter validation through the same public surface.
registerNestedValidatorLookup(validateActionConfig);

/**
 * The single module-load coverage assertion over the action registry.
 *
 * Every registered action type needs both tiers: a shape schema (absent only for
 * `quarantined`, which has no authorable config) and a completeness validator.
 * Adding an action type and forgetting either half fails at import time with the
 * missing type named.
 */
export function assertActionRegistryCoverage(
  validators: Partial<Record<ActionType, unknown>> = actionValidators,
): asserts validators is ValidatorMapShape {
  for (const definition of actionDefinitions) {
    if (typeof validators[definition.type] !== "function") {
      throw new Error(`Action ${definition.type} is registered without a validation handler`);
    }
    if (definition.type !== "quarantined" && !definition.configSchema) {
      throw new Error(
        `Action type "${definition.type}" is registered without a Zod schema. ` +
          `Add a schema in electron/backend/actions/schemas/ and register it in index.ts.`,
      );
    }
  }
}

assertActionRegistryCoverage();

export type { ActionValidationError };
