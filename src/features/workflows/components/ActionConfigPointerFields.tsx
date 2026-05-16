import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { updateActionConfigField } from "../lib/workflowStepForm";
import { ElementTargetFields } from "./ActionConfigElementSharedFields";

type ActionFieldsProps = {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
};

export function PointerActionFields({
  config,
  onChange,
}: ActionFieldsProps): ReactNode | null {
  switch (config.type) {
    case "clear_input":
      return <ElementTargetFields config={config} onChange={onChange} />;
    case "click":
      return <ElementTargetFields config={config} onChange={onChange} />;
    case "scroll":
      return (
        <>
          <Label>
            Direction
            <Select
              value={config.config.direction}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "direction", event.currentTarget.value),
                )
              }
            >
              <option value="down">Down</option>
              <option value="up">Up</option>
              <option value="right">Right</option>
              <option value="left">Left</option>
            </Select>
          </Label>
          <Label>
            Pixels
            <Input
              min="1"
              type="number"
              value={config.config.pixels}
              onChange={(event) =>
                onChange(
                  updateActionConfigField(config, "pixels", event.currentTarget.value),
                )
              }
            />
          </Label>
        </>
      );

    default:
      return null;
  }
}
