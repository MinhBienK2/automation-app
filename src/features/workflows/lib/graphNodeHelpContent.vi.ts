import type { GraphNodeType } from "../../../types/workflow";
import type { GraphNodeHelpContent } from "./graphNodeHelpContent";
import { flowNodesVi } from "./graphNodeHelpContent.flow.vi";
import { varsNodesVi } from "./graphNodeHelpContent.vars.vi";
import { collNodesVi } from "./graphNodeHelpContent.colls.vi";
import { miscNodesVi } from "./graphNodeHelpContent.misc.vi";

export const vietnameseGraphNodeHelpContent: Record<GraphNodeType, GraphNodeHelpContent> = {
  ...flowNodesVi,
  ...varsNodesVi,
  ...collNodesVi,
  ...miscNodesVi,
} as Record<GraphNodeType, GraphNodeHelpContent>;
