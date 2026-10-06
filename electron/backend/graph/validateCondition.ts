import type { WorkflowCondition } from "../../../src/types/workflow.js";
import { validationError } from "../shared/records.js";

export function validateWorkflowCondition(condition: WorkflowCondition) {
  const conditionRecord = condition as { kind?: unknown; target_ref?: unknown };
  switch (condition.kind) {
    case "variable_is_true":
      if (!condition.name.trim()) throw validationError("name", "Condition variable name is required");
      break;
    case "text_visible":
      if (!condition.text.trim()) throw validationError("text", "Condition text is required");
      break;
    case "url_contains":
      if (!condition.value.trim()) throw validationError("value", "Condition value is required");
      break;
    case "element_visible":
      if (
        Object.prototype.hasOwnProperty.call(conditionRecord, "target_ref") &&
        conditionRecord.target_ref != null
      ) {
        if (typeof conditionRecord.target_ref !== "string" || !conditionRecord.target_ref.trim()) {
          throw validationError("target_ref", "Target ref is required");
        }
      } else if (!condition.target && !condition.xpath?.trim()) {
        throw validationError("xpath", "Condition XPath is required");
      }
      break;
    default:
      throw validationError(
        "kind",
        `Unsupported condition kind: ${conditionKindLabel(conditionRecord.kind)}`,
      );
  }
}


function conditionKindLabel(kind: unknown) {
  return typeof kind === "string" && kind ? kind : "unknown";
}


