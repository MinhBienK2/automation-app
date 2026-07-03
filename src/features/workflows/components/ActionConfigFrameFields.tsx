import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { updateActionConfigField } from "../lib/workflowStepForm";
import { TemplateTextField } from "./TemplateTextField";

type ActionFieldsProps = {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
};

export function FrameActionFields({ config, onChange }: ActionFieldsProps): ReactNode | null {
  switch (config.type) {
    case "switch_frame":
      return (
        <TemplateTextField
          label="Iframe XPath"
          placeholder="//iframe[@id='my-iframe']"
          value={config.config.iframe_xpath}
          onChange={(val) => onChange(updateActionConfigField(config, "iframe_xpath", val))}
        />
      );
    case "switch_to_parent_frame":
      return (
        <div className="text-sm text-muted-foreground p-2">
          This action switches the execution context back to the main/top-level page document.
        </div>
      );
    default:
      return null;
  }
}
