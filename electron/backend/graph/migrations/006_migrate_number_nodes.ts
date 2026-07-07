import type { WorkflowGraph } from "../../../../src/types/workflow.js";
import type { Migration } from "./types.js";

/**
 * 006_migrate_number_nodes — migrates legacy update_number_variable node types to the new math_operation node:
 * - increment -> math_operation (operand1: name, operation: add, operand2: "1", output_name: name)
 * - decrement -> math_operation (operand1: name, operation: subtract, operand2: "1", output_name: name)
 * - add -> math_operation (operand1: name, operation: add, operand2: value, output_name: name)
 * - subtract -> math_operation (operand1: name, operation: subtract, operand2: value, output_name: name)
 * - multiply -> math_operation (operand1: name, operation: multiply, operand2: value, output_name: name)
 * - divide -> math_operation (operand1: name, operation: divide, operand2: value, output_name: name)
 */
export const migration006MigrateNumberNodes: Migration = {
  version: 7,
  description: "Migrate update_number_variable to granular math_operation nodes",
  up: (graph: WorkflowGraph): WorkflowGraph => {
    const nodes = graph.nodes.map((node) => {
      if ((node.node_type as string) === "update_number_variable") {
        const config = node.config as any;
        const name = config?.name ?? "";
        const operation = config?.operation ?? "increment";
        const value = config?.value ?? "0";

        let finalOp: "add" | "subtract" | "multiply" | "divide" = "add";
        let finalOperand2 = value;

        if (operation === "increment") {
          finalOp = "add";
          finalOperand2 = "1";
        } else if (operation === "decrement") {
          finalOp = "subtract";
          finalOperand2 = "1";
        } else if (operation === "add") {
          finalOp = "add";
        } else if (operation === "subtract") {
          finalOp = "subtract";
        } else if (operation === "multiply") {
          finalOp = "multiply";
        } else if (operation === "divide") {
          finalOp = "divide";
        }

        return {
          ...node,
          node_type: "math_operation" as any,
          config: {
            operand1: name,
            operation: finalOp,
            operand2: finalOperand2,
            output_name: name,
          },
        };
      }
      return node;
    });

    return {
      ...graph,
      version: 7,
      nodes,
    };
  },
};
