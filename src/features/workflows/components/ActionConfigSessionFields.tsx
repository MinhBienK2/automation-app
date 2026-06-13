import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { updateActionConfigField } from "../lib/workflowStepForm";
import { ActionConfigFieldGroup } from "./ActionConfigFieldGroup";
import { TemplateTextField, TemplateTextareaField } from "./TemplateTextField";
import { VariableNumericInput } from "./VariableNumericInput";

type ActionFieldsProps = {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
};

export function SessionActionFields({
  config,
  onChange,
}: ActionFieldsProps): ReactNode | null {
  switch (config.type) {
    case "set_cookie":
      return (
        <>
          <ActionConfigFieldGroup title="Cookie value">
            <TemplateTextField
              label="Name"
              value={config.config.name}
              onChange={(val) =>
                onChange(updateActionConfigField(config, "name", val))
              }
            />
            <TemplateTextareaField
              label="Value"
              value={config.config.value}
              onChange={(val) =>
                onChange(updateActionConfigField(config, "value", val))
              }
            />
          </ActionConfigFieldGroup>
          <ActionConfigFieldGroup title="Cookie scope">
            <TemplateTextField
              label="Domain"
              value={config.config.domain ?? ""}
              onChange={(val) =>
                onChange(updateActionConfigField(config, "domain", val))
              }
              placeholder="Current host"
            />
            <TemplateTextField
              label="Path"
              value={config.config.path ?? "/"}
              onChange={(val) =>
                onChange(updateActionConfigField(config, "path", val))
              }
            />
          </ActionConfigFieldGroup>
        </>
      );
    case "clear_cookies":
      return (
        <ActionConfigFieldGroup title="Cookie scope">
          <TemplateTextField
            label="Domain"
            value={config.config.domain ?? ""}
            onChange={(val) =>
              onChange(updateActionConfigField(config, "domain", val))
            }
            placeholder="Blank clears visible cookies"
          />
        </ActionConfigFieldGroup>
      );
    case "set_viewport":
      return (
        <ActionConfigFieldGroup title="Viewport size">
          <VariableNumericInput
            label="Width"
            value={config.config.width}
            min={1}
            onChange={(nextVal) => {
              const val = nextVal !== "" && nextVal !== null && nextVal !== undefined
                ? typeof nextVal === "string" && nextVal.startsWith("{{")
                  ? nextVal
                  : Number(nextVal)
                : null;
              onChange(updateActionConfigField(config, "width", val));
            }}
          />
          <VariableNumericInput
            label="Height"
            value={config.config.height}
            min={1}
            onChange={(nextVal) => {
              const val = nextVal !== "" && nextVal !== null && nextVal !== undefined
                ? typeof nextVal === "string" && nextVal.startsWith("{{")
                  ? nextVal
                  : Number(nextVal)
                : null;
              onChange(updateActionConfigField(config, "height", val));
            }}
          />
        </ActionConfigFieldGroup>
      );
    case "set_geolocation":
      return (
        <ActionConfigFieldGroup title="Geolocation coordinates">
          <VariableNumericInput
            label="Latitude"
            value={config.config.latitude}
            step={0.000001}
            onChange={(nextVal) => {
              const val = nextVal !== "" && nextVal !== null && nextVal !== undefined
                ? typeof nextVal === "string" && nextVal.startsWith("{{")
                  ? nextVal
                  : Number(nextVal)
                : null;
              onChange(updateActionConfigField(config, "latitude", val));
            }}
          />
          <VariableNumericInput
            label="Longitude"
            value={config.config.longitude}
            step={0.000001}
            onChange={(nextVal) => {
              const val = nextVal !== "" && nextVal !== null && nextVal !== undefined
                ? typeof nextVal === "string" && nextVal.startsWith("{{")
                  ? nextVal
                  : Number(nextVal)
                : null;
              onChange(updateActionConfigField(config, "longitude", val));
            }}
          />
          <VariableNumericInput
            label="Accuracy"
            value={config.config.accuracy}
            min={0}
            step={1}
            onChange={(nextVal) => {
              const val = nextVal !== "" && nextVal !== null && nextVal !== undefined
                ? typeof nextVal === "string" && nextVal.startsWith("{{")
                  ? nextVal
                  : Number(nextVal)
                : null;
              onChange(updateActionConfigField(config, "accuracy", val));
            }}
          />
        </ActionConfigFieldGroup>
      );
    case "set_extra_headers":
      return (
        <ActionConfigFieldGroup title="Request headers">
          <TemplateTextareaField
            label="Headers"
            value={config.config.headers
              .map((header) => `${header.name}: ${header.value}`)
              .join("\n")}
            onChange={(val) =>
              onChange(updateActionConfigField(config, "headers", val))
            }
          />
        </ActionConfigFieldGroup>
      );
    case "grant_permission":
      return (
        <ActionConfigFieldGroup title="Permission scope">
          <TemplateTextField
            label="Origin"
            value={config.config.origin ?? ""}
            onChange={(val) =>
              onChange(updateActionConfigField(config, "origin", val))
            }
            placeholder="Current origin"
          />
          <TemplateTextareaField
            label="Permissions"
            value={config.config.permissions.join("\n")}
            onChange={(val) =>
              onChange(updateActionConfigField(config, "permissions", val))
            }
          />
        </ActionConfigFieldGroup>
      );

    default:
      return null;
  }
}
