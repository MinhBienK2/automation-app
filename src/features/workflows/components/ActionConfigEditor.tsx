import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { AdvancedActionFields } from "./ActionConfigAdvancedFields";
import { BrowserActionFields } from "./ActionConfigBrowserFields";
import { CaptureActionFields } from "./ActionConfigCaptureFields";
import { CoreActionFields } from "./ActionConfigCoreFields";
import { ElementActionFields } from "./ActionConfigElementFields";
import { LogicActionFields } from "./ActionConfigLogicFields";
import { OutputActionFields } from "./ActionConfigOutputFields";

type ActionFieldsProps = {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
};

type ActionFieldRenderer = (props: ActionFieldsProps) => ReactNode | null;

const actionFieldRenderers: ActionFieldRenderer[] = [
  CoreActionFields,
  ElementActionFields,
  CaptureActionFields,
  BrowserActionFields,
  OutputActionFields,
  LogicActionFields,
  AdvancedActionFields,
];

export function ActionConfigEditor({ config, onChange }: ActionFieldsProps) {
  return <ActionFields config={config} onChange={onChange} />;
}

function ActionFields(props: ActionFieldsProps) {
  for (const renderFields of actionFieldRenderers) {
    const fields = renderFields(props);
    if (fields) return fields;
  }

  return null;
}
