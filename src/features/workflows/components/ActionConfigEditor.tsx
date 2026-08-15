import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { AdvancedActionFields } from "./ActionConfigAdvancedFields";
import { BrowserActionFields } from "./ActionConfigBrowserFields";
import { CaptureActionFields } from "./ActionConfigCaptureFields";
import { CoreActionFields } from "./ActionConfigCoreFields";
import { DesktopActionFields } from "./ActionConfigDesktopFields";
import { ElementActionFields } from "./ActionConfigElementFields";
import { LogicActionFields } from "./ActionConfigLogicFields";
import { OutputActionFields } from "./ActionConfigOutputFields";
import { FileActionFields } from "./ActionConfigFileFields";
import { HttpActionFields } from "./ActionConfigHttpFields";
import { DateTimeActionFields } from "./ActionConfigDateTimeFields";
import { FrameActionFields } from "./ActionConfigFrameFields";
import type { VariableOption } from "./TemplateTextField";

type ActionFieldsProps = {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
  variableOptions?: VariableOption[];
};

type ActionFieldRenderer = (props: ActionFieldsProps) => ReactNode | null;

const actionFieldRenderers: ActionFieldRenderer[] = [
  // First, and it claims every `desktop_*` type: the renderers below are web
  // shapes, and one of them matching a desktop action would be a form of
  // fields that step does not have.
  DesktopActionFields,
  CoreActionFields,
  ElementActionFields,
  CaptureActionFields,
  BrowserActionFields,
  OutputActionFields,
  LogicActionFields,
  AdvancedActionFields,
  FileActionFields,
  HttpActionFields,
  DateTimeActionFields,
  FrameActionFields,
];

export function ActionConfigEditor(props: ActionFieldsProps) {
  return <ActionFields {...props} />;
}

function ActionFields(props: ActionFieldsProps) {
  for (const renderFields of actionFieldRenderers) {
    const fields = renderFields(props);
    if (fields) return fields;
  }

  return null;
}
