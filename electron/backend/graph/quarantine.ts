import type { GraphNode } from "../../../src/types/workflow.js";

export type QuarantineReason = "unknown_type" | "invalid_config" | "parse_error";

export type QuarantineOptions = {
  reason: QuarantineReason;
  message: string;
};

/**
 * Convert a graph node into a quarantined placeholder, preserving the
 * original payload verbatim. The resulting node is runnable (no-op) but
 * surfaces a warning in validateGraph so the user can fix or delete it.
 */
export function quarantineNode(
  node: GraphNode,
  options: QuarantineOptions,
): GraphNode {
  const originalType =
    typeof node.node_type === "string" && node.node_type !== "quarantined"
      ? node.node_type
      : null;

  const config = node.config as { type?: unknown } | null;
  const originalActionType =
    config && typeof config.type === "string" ? config.type : null;

  return {
    id: node.id,
    node_type: "quarantined",
    label: node.label?.trim() ? node.label : "Quarantined node",
    position: node.position ?? { x: 0, y: 0 },
    ports: [],
    config: {
      type: "quarantined",
      config: {
        original_type: originalActionType ?? originalType,
        reason: options.reason,
        message: options.message,
        original_payload: node.config,
      },
    },
  };
}

/**
 * Type guard: is this graph node quarantined?
 */
export function isQuarantinedNode(node: GraphNode): boolean {
  return node.node_type === "quarantined";
}
