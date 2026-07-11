import type { WorkflowGraph } from "../../../../src/types/workflow.js";
import type { Migration } from "./types.js";

/**
 * 008_migrate_extract_nodes — migrates legacy extract actions to native graph nodes.
 */
export const migration008MigrateExtractNodes: Migration = {
  version: 9,
  description: "Migrate legacy extract actions to native graph nodes",
  up: (graph: WorkflowGraph): WorkflowGraph => {
    const legacyTypes = new Set([
      "extract_text",
      "extract_attribute",
      "extract_input_value",
      "extract_table",
      "extract_list",
      "count_elements",
      "extract_regex_matches",
      "get_current_url",
    ]);

    const nodes = graph.nodes.map((node) => {
      if (node.node_type === "action" && node.config && typeof node.config === "object") {
        const config = node.config as any;
        if (legacyTypes.has(config.type)) {
          return {
            ...node,
            node_type: config.type,
            config: config.config ?? {},
          };
        }
      }
      return node;
    });

    return {
      ...graph,
      version: 9,
      nodes,
    };
  },
};
