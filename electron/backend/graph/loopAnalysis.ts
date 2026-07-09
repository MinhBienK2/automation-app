import type {
  CompiledGraphStep,
  GraphNode,
  WorkflowGraph,
} from "../../../src/types/workflow.js";
import { asRecord, stringField } from "../shared/records.js";

export function findAncestorLoops(graph: WorkflowGraph, startNodeId: string): GraphNode[] {
  const startNode = graph.nodes.find((n) => n.node_type === "start");
  if (!startNode) return [];

  const visited = new Set<string>();
  let result: GraphNode[] | null = null;

  function dfs(currentNodeId: string, activeLoops: GraphNode[]) {
    if (result) return;
    if (currentNodeId === startNodeId) {
      result = [...activeLoops];
      return;
    }

    if (visited.has(currentNodeId)) return;
    visited.add(currentNodeId);

    const currentNode = graph.nodes.find((n) => n.id === currentNodeId);
    if (!currentNode) return;

    const outgoingEdges = graph.edges.filter((e) => e.source_node_id === currentNodeId);
    for (const edge of outgoingEdges) {
      let nextActiveLoops = activeLoops;
      if (isLoopNode(currentNode.node_type) && edge.source_port === "loop") {
        nextActiveLoops = [...activeLoops, currentNode];
      }
      dfs(edge.target_node_id, nextActiveLoops);
    }

    visited.delete(currentNodeId);
  }

  dfs(startNode.id, []);
  return result ?? [];
}

export function isLoopNode(nodeType: string): boolean {
  return ["repeat_times", "repeat_for_each", "while", "repeat_until"].includes(nodeType);
}

export function generateLoopPreludeSteps(graph: WorkflowGraph, startNodeId: string): CompiledGraphStep[] {
  const ancestorLoops = findAncestorLoops(graph, startNodeId);
  const steps: CompiledGraphStep[] = [];

  for (const loop of ancestorLoops) {
    if (loop.node_type === "repeat_for_each") {
      const itemName = stringField(loop.config, "item_name");
      if (itemName) {
        const arrayVariable = stringField(loop.config, "array_variable");
        if (arrayVariable) {
          steps.push({
            node_id: `__prelude:loop_item:${loop.id}`,
            label: `Initialize loop variable ${itemName} for ${loop.label || loop.id}`,
            config: {
              type: "get_list_item",
              config: {
                source: arrayVariable,
                position: "first",
                index: null,
                output_name: itemName,
              },
            },
          });
        } else {
          const items = asRecord(loop.config).items;
          const firstItem = Array.isArray(items) ? items[0] : "";
          steps.push({
            node_id: `__prelude:loop_item:${loop.id}`,
            label: `Initialize loop variable ${itemName} for ${loop.label || loop.id}`,
            config: {
              type: "set_variable",
              config: {
                name: itemName,
                value: typeof firstItem === "string" ? firstItem : JSON.stringify(firstItem ?? ""),
                value_type: "text",
                variables: undefined,
              },
            },
          });
        }
      }
    }

    // Set loop index and number for all loops
    steps.push({
      node_id: `__prelude:loop_indices:${loop.id}`,
      label: `Initialize loop indices for ${loop.label || loop.id}`,
      config: {
        type: "set_variable",
        config: {
          name: null,
          value: null,
          value_type: null,
          variables: [
            { name: "system.loop.index", value_type: "number", value: "0" },
            { name: "system.loop.number", value_type: "number", value: "1" },
          ],
        },
      },
    });
  }

  return steps;
}
