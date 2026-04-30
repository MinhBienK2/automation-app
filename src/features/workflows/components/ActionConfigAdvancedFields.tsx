import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { LogicActionFields } from "./ActionConfigLogicFields";
import { ReliabilityActionFields } from "./ActionConfigReliabilityFields";
import { SessionActionFields } from "./ActionConfigSessionFields";

type ActionFieldsProps = {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
};

const advancedFieldRenderers = [
  LogicActionFields,
  SessionActionFields,
  ReliabilityActionFields,
];

export function AdvancedActionFields(props: ActionFieldsProps): ReactNode | null {
  for (const renderFields of advancedFieldRenderers) {
    const fields = renderFields(props);
    if (fields) return fields;
  }

  return null;
}
