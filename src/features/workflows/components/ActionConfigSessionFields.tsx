import type { ReactNode } from "react";
import type { ActionConfig } from "../../../types/workflow";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { updateActionConfigField } from "../lib/workflowStepForm";

type ActionFieldsProps = {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
};

export function SessionActionFields({
  config,
  onChange,
}: ActionFieldsProps): ReactNode | null {
  switch (config.type) {
    case "use_profile":
      return (
        <Label>
          Name
          <Input
            value={config.config.name}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "name", event.currentTarget.value))
            }
          />
        </Label>
      );
    case "save_session":
    case "load_session":
      return (
        <Label>
          Path
          <Input
            value={config.config.path}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "path", event.currentTarget.value))
            }
          />
        </Label>
      );
    case "set_cookie":
      return (
        <>
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
        </>
      );
    case "clear_cookies":
      return (
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
      );
    case "set_secret":
      return (
        <>
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
        </>
      );
    case "use_proxy":
      return (
        <>
          <Label>
            Server
            <Input
              value={config.config.server}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "server", event.currentTarget.value))
              }
              placeholder="http://127.0.0.1:8080"
            />
          </Label>
          <Label>
            Username
            <Input
              value={config.config.username ?? ""}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "username", event.currentTarget.value))
              }
            />
          </Label>
          <Label>
            Password
            <Input
              value={config.config.password ?? ""}
              onChange={(event) =>
                onChange(updateActionConfigField(config, "password", event.currentTarget.value))
              }
              type="password"
            />
          </Label>
        </>
      );
    case "set_user_agent":
      return (
        <Label>
          User agent
          <Textarea
            value={config.config.user_agent}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "user_agent", event.currentTarget.value))
            }
          />
        </Label>
      );
    case "set_viewport":
      return (
        <>
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
        </>
      );
    case "set_geolocation":
      return (
        <>
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
        </>
      );
    case "set_extra_headers":
      return (
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
      );
    case "grant_permission":
      return (
        <>
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
        </>
      );

    default:
      return null;
  }
}
