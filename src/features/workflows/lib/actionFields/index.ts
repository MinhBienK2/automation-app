import type { ActionConfig } from "../../../../types/workflow";
import type { ActionSchema } from "./schema";
import { coreSchemas } from "./core";
import { browserSchemas } from "./browser";
import { elementSchemas } from "./element";
import { captureSchemas } from "./capture";
import { outputSchemas } from "./output";
import { logicSchemas } from "./logic";
import { advancedSchemas } from "./advanced";
import { fileSchemas } from "./file";
import { httpSchemas } from "./http";
import { dateTimeSchemas } from "./dateTime";
import { frameSchemas } from "./frame";

/**
 * Registry of schema-driven action config forms, keyed by action type.
 * One deep renderer (ActionConfigSchemaForm) consumes the whole registry;
 * per-domain variance lives in these schema files as pure data.
 */
export const actionSchemas: Partial<Record<ActionConfig["type"], ActionSchema>> = {
  ...coreSchemas,
  ...browserSchemas,
  ...elementSchemas,
  ...captureSchemas,
  ...outputSchemas,
  ...logicSchemas,
  ...advancedSchemas,
  ...fileSchemas,
  ...httpSchemas,
  ...dateTimeSchemas,
  ...frameSchemas,
};
