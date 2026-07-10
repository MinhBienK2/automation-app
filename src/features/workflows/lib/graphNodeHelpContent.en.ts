import type { GraphNodeType } from "../../../types/workflow";
import type { GraphNodeHelpContent } from "./graphNodeHelpContent";
import { flowNodesEn } from "./graphNodeHelpContent.flow.en";
import { varsNodesEn } from "./graphNodeHelpContent.vars.en";
import { collNodesEn } from "./graphNodeHelpContent.colls.en";
import { miscNodesEn } from "./graphNodeHelpContent.misc.en";

export const englishGraphNodeHelpContent: Record<GraphNodeType, GraphNodeHelpContent> = {
  ...flowNodesEn,
  ...varsNodesEn,
  ...collNodesEn,
  ...miscNodesEn,
} as Record<GraphNodeType, GraphNodeHelpContent>;
