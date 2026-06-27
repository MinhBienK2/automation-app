import type { CompiledNestedAction } from "../../../src/types/workflow.js";

/**
 * Recursively collects all graph_node_id values from compiled nested actions.
 */
export function collectNestedNodeIds(actions: CompiledNestedAction[]): string[] {
  const ids: string[] = [];
  for (const action of actions) {
    if (action.graph_node_id) {
      ids.push(action.graph_node_id);
    }
    
    // Check for nested actions in different logic types
    if (action.type === "repeat_times" || action.type === "repeat_for_each") {
      const config = action.config as { steps?: CompiledNestedAction[] } | null;
      if (config?.steps) {
        ids.push(...collectNestedNodeIds(config.steps));
      }
    } else if (action.type === "while_loop" || action.type === "repeat_until") {
      const config = action.config as { steps?: CompiledNestedAction[]; timeout_steps?: CompiledNestedAction[] } | null;
      if (config?.steps) {
        ids.push(...collectNestedNodeIds(config.steps));
      }
      if (action.type === "repeat_until" && config?.timeout_steps) {
        ids.push(...collectNestedNodeIds(config.timeout_steps));
      }
    } else if (action.type === "retry_block") {
      const config = action.config as { steps?: CompiledNestedAction[]; failed_steps?: CompiledNestedAction[] } | null;
      if (config?.steps) {
        ids.push(...collectNestedNodeIds(config.steps));
      }
      if (config?.failed_steps) {
        ids.push(...collectNestedNodeIds(config.failed_steps));
      }
    } else if (action.type === "try_catch") {
      const config = action.config as {
        try_steps?: CompiledNestedAction[];
        success_steps?: CompiledNestedAction[];
        error_steps?: CompiledNestedAction[];
        finally_steps?: CompiledNestedAction[];
      } | null;
      if (config?.try_steps) {
        ids.push(...collectNestedNodeIds(config.try_steps));
      }
      if (config?.success_steps) {
        ids.push(...collectNestedNodeIds(config.success_steps));
      }
      if (config?.error_steps) {
        ids.push(...collectNestedNodeIds(config.error_steps));
      }
      if (config?.finally_steps) {
        ids.push(...collectNestedNodeIds(config.finally_steps));
      }
    } else if (action.type === "fallback_block") {
      const config = action.config as { primary_steps?: CompiledNestedAction[]; fallback_steps?: CompiledNestedAction[] } | null;
      if (config?.primary_steps) {
        ids.push(...collectNestedNodeIds(config.primary_steps));
      }
      if (config?.fallback_steps) {
        ids.push(...collectNestedNodeIds(config.fallback_steps));
      }
    } else if (action.type === "switch_condition") {
      const config = action.config as {
        cases?: Array<{ steps?: CompiledNestedAction[] }>;
        default_steps?: CompiledNestedAction[];
      } | null;
      if (config?.cases) {
        for (const c of config.cases) {
          if (c.steps) {
            ids.push(...collectNestedNodeIds(c.steps));
          }
        }
      }
      if (config?.default_steps) {
        ids.push(...collectNestedNodeIds(config.default_steps));
      }
    }
  }
  return ids;
}
