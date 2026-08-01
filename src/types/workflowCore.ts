/**
 * Sub-barrel for the workflow core types, split by concern.
 *
 * This module held all of them in one 1,941-line file: the action-type union,
 * run enums, persistence DTOs, the settings and browser-profile tree, the
 * `ActionConfig` union, and the shapes that union is built from — with the shapes
 * declared 1,300 lines after their first use. Importers see no difference; the
 * concerns are now separable.
 */

export type * from "./workflowActionTypes.js";
export type * from "./workflowRunEnums.js";
export type * from "./workflowRecords.js";
export type * from "./workflowSettingsTypes.js";
export type * from "./workflowActionConfigs.js";
export type * from "./workflowActionShapes.js";
