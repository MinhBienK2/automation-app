import type {
  ActionConfig,
  GraphNode,
  RouterGraphCase,
  RouterGraphConfig,
  SwitchGraphCase,
  SwitchGraphConfig,
  VariableAssignment,
  WorkflowCondition,
} from "../../../src/types/workflow.js";
import {
  arrayField,
  asRecord,
  stringField,
  validationError,
} from "../shared/records.js";

/**
 * Readers that turn a graph node's loosely-typed `config` record into the
 * structured shapes the compiler and the node-semantics validator both need.
 *
 * These were defined identically in both modules — six of them byte-for-byte —
 * so a fix to a reader landed in one caller and not the other. They belong to
 * neither module: compilation and validation are separate concerns that happen
 * to read the same persisted shapes.
 */

export function switchGraphConfigOrNull(node: GraphNode): SwitchGraphConfig | null {
  const record = asRecord(node.config);
  const rawCases = Array.isArray(record.cases) ? record.cases : [];
  const cases = rawCases.map((item, index): SwitchGraphCase => {
    if (typeof item === "string") {
      return {
        id: String(index + 1),
        value: item,
      };
    }
    const caseRecord = asRecord(item);
    return {
      id: stringField(caseRecord, "id") ?? String(index + 1),
      value: stringField(caseRecord, "value") ?? "",
    };
  });
  return {
    expression: stringField(record, "expression") ?? "",
    cases,
  };
}

export function switchGraphConfig(node: GraphNode): SwitchGraphConfig {
  const switchConfigValue = switchGraphConfigOrNull(node);
  if (!switchConfigValue || switchConfigValue.cases.length === 0) {
    throw validationError("cases", "Switch cases are required");
  }
  return switchConfigValue;
}

export function routerGraphConfigOrNull(node: GraphNode): RouterGraphConfig | null {
  const record = asRecord(node.config);
  if (record.mode != null && record.mode !== "first_match") return null;
  const rawCases = Array.isArray(record.cases) ? record.cases : [];
  const cases = rawCases.map((item): RouterGraphCase => {
    const caseValue = asRecord(item);
    return {
      id: stringField(caseValue, "id") ?? "",
      label: typeof caseValue.label === "string" ? caseValue.label : "",
      condition: caseValue.condition as WorkflowCondition,
    };
  });
  return {
    mode: "first_match",
    cases,
    default_label: stringField(record, "default_label") ?? "Default",
  };
}

export function nodeCondition(node: GraphNode): WorkflowCondition {
  const condition = asRecord(node.config).condition;
  if (!condition) throw validationError("condition", "Condition is required");
  return condition as WorkflowCondition;
}

export function unsupportedGraphNodeTypeMessage(nodeType: unknown) {
  return `Unsupported graph node type: ${typeof nodeType === "string" && nodeType ? nodeType : "unknown"}`;
}

export function stringArrayOrNull(config: unknown, field: string): string[] | null {
  const values = arrayField(config, field)
    .filter((value) => typeof value === "string")
    .map((value) => (value as string).trim())
    .filter(Boolean);
  return values.length > 0 ? values : null;
}

/**
 * `readName` is a thunk, not a value, because the two callers disagree on what a
 * missing name means and the disagreement is load-bearing: the compiler throws
 * ("Variable name is required") while the validator substitutes an empty string
 * so it can keep collecting issues. Neither should be evaluated when the node
 * carries a `variables` array, where the name is unused.
 */
export function setVariableActionConfig(
  node: GraphNode,
  readName: () => string,
): ActionConfig {
  const variables = asRecord(node.config).variables;
  if (Array.isArray(variables)) {
    return {
      type: "set_variable",
      config: {
        name: null,
        value: null,
        value_type: null,
        variables: variables as VariableAssignment[],
      },
    };
  }
  return {
    type: "set_variable",
    config: {
      name: readName(),
      value: stringField(node.config, "value") ?? "",
      value_type: null,
      variables: [],
    },
  };
}
