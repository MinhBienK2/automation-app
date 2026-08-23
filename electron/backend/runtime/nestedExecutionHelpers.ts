import type { CompiledNestedAction } from "../../../src/types/workflow.js";
import { forEachNestedStepArray } from "../graph/nestedSteps.js";
import { isPlainRecord } from "../shared/records.js";

/**
 * Recursively collects all graph_node_id values from compiled nested actions.
 *
 * The nested-step shape (which config fields hold child steps, including
 * branch lists under cases/choices) lives in graph/nestedSteps.ts — this
 * walker only adds what execution cares about: the compiled node ids.
 */
export function collectNestedNodeIds(actions: CompiledNestedAction[]): string[] {
  const ids: string[] = [];
  const visit = (list: CompiledNestedAction[]) => {
    for (const action of list) {
      if (action.graph_node_id) {
        ids.push(action.graph_node_id);
      }
      const config = isPlainRecord(action.config) ? action.config : {};
      forEachNestedStepArray(config, (steps) => visit(steps as CompiledNestedAction[]));
    }
  };
  visit(actions);
  return ids;
}
