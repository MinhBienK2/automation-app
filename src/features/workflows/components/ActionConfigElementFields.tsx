import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { FormActionFields } from "./ActionConfigFormFields";
import { PointerActionFields } from "./ActionConfigPointerFields";

type ActionFieldsProps = {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
};

const elementFieldRenderers = [PointerActionFields, FormActionFields];

export function ElementActionFields(props: ActionFieldsProps): ReactNode | null {
  for (const renderFields of elementFieldRenderers) {
    const fields = renderFields(props);
    if (fields) return fields;
  }

  return null;
}
