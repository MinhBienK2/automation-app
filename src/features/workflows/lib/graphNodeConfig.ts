import type {
  GraphPort,
  RouterGraphCase,
  RouterGraphConfig,
  WorkflowCondition,
} from "../../../types/workflow";
import { objectConfig } from "./configUtils";

export type RandomChoiceOption = {
  id: string;
  label: string;
  weight: number;
};

export type RandomChoiceGraphConfig = {
  choices: RandomChoiceOption[];
  output_name?: string | null;
};

export function switchPortsForCases(cases: string[]): GraphPort[] {
  return [
    { id: "in", label: "In", direction: "input" },
    ...cases.map((_, index) => ({
      id: `case_${index + 1}`,
      label: `Case ${index + 1}`,
      direction: "output" as const,
    })),
    { id: "default", label: "Default", direction: "output" },
    { id: "done", label: "Done", direction: "output" },
  ];
}

export function routerPortsForCases(
  cases: RouterGraphCase[],
  defaultLabel = "Default",
): GraphPort[] {
  return [
    { id: "in", label: "In", direction: "input" },
    ...cases.map((caseValue) => ({
      id: `case_${caseValue.id}`,
      label: caseValue.label.trim() || "Case",
      direction: "output" as const,
    })),
    { id: "default", label: defaultLabel.trim() || "Default", direction: "output" },
    { id: "done", label: "Done", direction: "output" },
  ];
}

export function randomChoicePortsForChoices(choices: RandomChoiceOption[]): GraphPort[] {
  return [
    { id: "in", label: "In", direction: "input" },
    ...choices.map((choice) => ({
      id: `choice_${choice.id}`,
      label: choice.label.trim() || "Choice",
      direction: "output" as const,
    })),
    { id: "done", label: "Done", direction: "output" },
  ];
}

export function routerConfig(config: unknown): RouterGraphConfig {
  const record = objectConfig(config);
  const rawCases = Array.isArray(record.cases) ? record.cases : [];
  const cases = rawCases
    .map((item, index): RouterGraphCase => {
      const caseRecord = objectConfig(item);
      return {
        id: stringValue(caseRecord.id) || String(index + 1),
        label: stringValue(caseRecord.label) || `Case ${index + 1}`,
        condition: isWorkflowCondition(caseRecord.condition)
          ? caseRecord.condition
          : defaultCondition(),
      };
    });
  return {
    mode: "first_match",
    cases: cases.length ? cases : [{ id: "1", label: "Case 1", condition: defaultCondition() }],
    default_label: stringValue(record.default_label) || "Default",
  };
}

export function randomChoiceConfig(config: unknown): RandomChoiceGraphConfig {
  const record = objectConfig(config);
  const rawChoices = Array.isArray(record.choices) ? record.choices : [];
  const choices = rawChoices.map((item, index): RandomChoiceOption => {
    const choiceRecord = objectConfig(item);
    return {
      id: stringValue(choiceRecord.id) || String(index + 1),
      label: stringValue(choiceRecord.label) || `Choice ${index + 1}`,
      weight: positiveNumberValue(choiceRecord.weight) ?? 1,
    };
  });
  return {
    choices: choices.length
      ? choices
      : [
          { id: "1", label: "Choice 1", weight: 1 },
          { id: "2", label: "Choice 2", weight: 1 },
        ],
    output_name: stringValue(record.output_name) || "random_choice",
  };
}

export function defaultCondition(): WorkflowCondition {
  return { kind: "output_equals", name: "name", value: "" };
}

export function isWorkflowCondition(value: unknown): value is WorkflowCondition {
  return Boolean(value && typeof value === "object" && "kind" in value);
}

export function nextRouterCaseId(cases: RouterGraphCase[]) {
  const numericIds = cases
    .map((caseValue) => Number(caseValue.id))
    .filter((value) => Number.isInteger(value) && value > 0);
  if (numericIds.length > 0) return String(Math.max(...numericIds) + 1);
  return `case_${Date.now()}`;
}

export function nextRandomChoiceId(choices: RandomChoiceOption[]) {
  const numericIds = choices
    .map((choice) => Number(choice.id))
    .filter((value) => Number.isInteger(value) && value > 0);
  if (numericIds.length > 0) return String(Math.max(...numericIds) + 1);
  return `choice_${Date.now()}`;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function positiveNumberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}
