import type {
  CompiledGraphStep,
  CompileWorkflowGraphOptions,
  GraphNode,
  WorkflowGraph,
} from "../../../src/types/workflow.js";
import type { CompilerContext } from "./controlFlowCompiler.js";
import { compileDataActionNode } from "./dataActionNodeCompiler.js";
import { compileCollectionActionNode } from "./collectionActionNodeCompiler.js";

export function compileActionNode(
  graph: WorkflowGraph,
  node: GraphNode,
  visited: Set<string>,
  steps: CompiledGraphStep[],
  options: CompileWorkflowGraphOptions,
  ctx: CompilerContext,
): boolean {
  return (
    compileDataActionNode(graph, node, visited, steps, options, ctx) ||
    compileCollectionActionNode(graph, node, visited, steps, options, ctx)
  );
}
