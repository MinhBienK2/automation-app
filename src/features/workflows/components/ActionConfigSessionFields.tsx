import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { updateActionConfigField } from "../lib/workflowStepForm";
import { ActionConfigFieldGroup } from "./ActionConfigFieldGroup";

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
            <Label>
              Name
              <Input
                value={config.config.name}
                onChange={(event) =>
                  onChange(updateActionConfigField(config, "name", event.currentTarget.value))
                }
              />
            </Label>
            <Label>
              Value
              <Textarea
                value={config.config.value}
                onChange={(event) =>
                  onChange(updateActionConfigField(config, "value", event.currentTarget.value))
                }
              />
            </Label>
          </ActionConfigFieldGroup>
          <ActionConfigFieldGroup title="Cookie scope">
            <Label>
              Domain
              <Input
                value={config.config.domain ?? ""}
                onChange={(event) =>
                  onChange(updateActionConfigField(config, "domain", event.currentTarget.value))
                }
                placeholder="Current host"
              />
            </Label>
            <Label>
              Path
              <Input
                value={config.config.path ?? "/"}
                onChange={(event) =>
                  onChange(updateActionConfigField(config, "path", event.currentTarget.value))
                }
              />
            </Label>
          </ActionConfigFieldGroup>
        </>
      );
    case "clear_cookies":
      return (
        <ActionConfigFieldGroup title="Cookie scope">
          <Label>
            Domain
            <Input
              value={config.config.domain ?? ""}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "domain", event.currentTarget.value))
              }
              placeholder="Blank clears visible cookies"
            />
          </Label>
        </ActionConfigFieldGroup>
      );
    case "set_viewport":
      return (
        <ActionConfigFieldGroup title="Viewport size">
          <Label>
            Width
            <Input
              min="1"
              type="number"
              value={config.config.width}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "width", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Height
            <Input
              min="1"
              type="number"
              value={config.config.height}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "height", event.currentTarget.value))
              }
            />
          </Label>
        </ActionConfigFieldGroup>
      );
    case "set_geolocation":
      return (
        <ActionConfigFieldGroup title="Geolocation coordinates">
          <Label>
            Latitude
            <Input
              step="0.000001"
              type="number"
              value={config.config.latitude}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "latitude", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Longitude
            <Input
              step="0.000001"
              type="number"
              value={config.config.longitude}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "longitude", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Accuracy
            <Input
              min="0"
              step="1"
              type="number"
              value={config.config.accuracy ?? 100}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "accuracy", event.currentTarget.value))
              }
            />
          </Label>
        </ActionConfigFieldGroup>
      );
    case "set_extra_headers":
      return (
        <ActionConfigFieldGroup title="Request headers">
          <Label>
            Headers
            <Textarea
              value={config.config.headers
                .map((header) => `${header.name}: ${header.value}`)
                .join("\n")}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "headers", event.currentTarget.value))
              }
            />
          </Label>
        </ActionConfigFieldGroup>
      );
    case "grant_permission":
      return (
        <ActionConfigFieldGroup title="Permission scope">
          <Label>
            Origin
            <Input
              value={config.config.origin ?? ""}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "origin", event.currentTarget.value))
              }
              placeholder="Current origin"
            />
          </Label>
          <Label>
            Permissions
            <Textarea
              value={config.config.permissions.join("\n")}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "permissions", event.currentTarget.value))
              }
            />
          </Label>
        </ActionConfigFieldGroup>
      );

    default:
      return null;
  }
}
