import type { ActionSchema } from "./schema";
import type { TypedFieldContext } from "./schema";
import { numericOrTemplate } from "./coerce";
import { updateActionConfigField } from "../workflowStepForm";
import { NetworkWaitFields } from "../../components/actionFields/ActionConfigNetworkFields";
import { TemplateTextField, TemplateTextareaField } from "../../components/variables/TemplateTextField";
import { VariableNumericInput } from "../../components/variables/VariableNumericInput";

export const advancedSchemas: Partial<Record<string, ActionSchema>> = {
  execute_js: {
    sections: [
      {
        title: "Script body",
        fields: [{ widget: "textarea", key: "script", label: "Script" }],
      },
      {
        title: "Script result",
        fields: [
          { widget: "text", key: "output_name", label: "Output name" },
          { widget: "numeric", key: "timeout_ms", label: "Timeout ms", min: 1 },
        ],
      },
    ],
  },
  wait_for_request: {
    sections: [
      {
        title: "Network match",
        fields: [
          {
            widget: "custom",
            render: ({ config, onChange }: TypedFieldContext) => {
              if (config.type !== "wait_for_request") return null;
              return (
                <NetworkWaitFields
                  config={config}
                  onChange={onChange}
                  includeStatus={false}
                />
              );
            },
          },
        ],
      },
    ],
  },
  wait_for_response: {
    sections: [
      {
        title: "Network match",
        fields: [
          {
            widget: "custom",
            render: ({ config, onChange }: TypedFieldContext) => {
              if (config.type !== "wait_for_response") return null;
              return (
                <NetworkWaitFields
                  config={config}
                  onChange={onChange}
                  includeStatus
                />
              );
            },
          },
        ],
      },
    ],
  },
  block_request: {
    sections: [
      {
        title: "Blocked URLs",
        fields: [{ widget: "textarea", key: "url_patterns", label: "URL patterns" }],
      },
    ],
  },
  mock_response: {
    sections: [
      {
        title: "Request match",
        fields: [
          { widget: "template", key: "url_contains", label: "URL contains" },
        ],
      },
      {
        title: "Mock response",
        fields: [
          {
            widget: "custom",
            render: ({ config, onChange }: TypedFieldContext) => {
              if (config.type !== "mock_response") return null;
              return (
                <VariableNumericInput
                  label="Status"
                  value={config.config.status}
                  min={100}
                  max={599}
                  onChange={(nextVal) =>
                    onChange(
                      updateActionConfigField(
                        config,
                        "status",
                        numericOrTemplate(nextVal),
                      ),
                    )
                  }
                />
              );
            },
          },
          { widget: "textarea", key: "body", label: "Body" },
          { widget: "template", key: "content_type", label: "Content type" },
        ],
      },
    ],
  },
  set_local_storage: {
    sections: [
      {
        title: "Storage entry",
        fields: [
          { widget: "template", key: "key", label: "Key" },
          { widget: "textarea", key: "value", label: "Value" },
        ],
      },
    ],
  },
  set_session_storage: {
    sections: [
      {
        title: "Storage entry",
        fields: [
          { widget: "template", key: "key", label: "Key" },
          { widget: "textarea", key: "value", label: "Value" },
        ],
      },
    ],
  },
  set_cookie: {
    sections: [
      {
        title: "Cookie value",
        fields: [
          { widget: "template", key: "name", label: "Name" },
          { widget: "textarea", key: "value", label: "Value" },
        ],
      },
      {
        title: "Cookie scope",
        fields: [
          {
            widget: "template",
            key: "domain",
            label: "Domain",
            placeholder: "Current host",
          },
          {
            // Preserves the legacy "/" display default for an unset path.
            widget: "custom",
            render: ({ config, onChange }: TypedFieldContext) => {
              if (config.type !== "set_cookie") return null;
              return (
                <TemplateTextField
                  label="Path"
                  value={config.config.path ?? "/"}
                  onChange={(val) =>
                    onChange(updateActionConfigField(config, "path", val))
                  }
                />
              );
            },
          },
        ],
      },
    ],
  },
  clear_cookies: {
    sections: [
      {
        title: "Cookie scope",
        fields: [
          {
            widget: "template",
            key: "domain",
            label: "Domain",
            placeholder: "Blank clears visible cookies",
          },
        ],
      },
    ],
  },
  set_viewport: {
    sections: [
      {
        title: "Viewport size",
        fields: [
          { widget: "numeric", key: "width", label: "Width", min: 1 },
          { widget: "numeric", key: "height", label: "Height", min: 1 },
        ],
      },
    ],
  },
  set_geolocation: {
    sections: [
      {
        title: "Geolocation coordinates",
        fields: [
          {
            widget: "custom",
            render: ({ config, onChange }: TypedFieldContext) => {
              if (config.type !== "set_geolocation") return null;
              return (
                <VariableNumericInput
                  label="Latitude"
                  value={config.config.latitude}
                  step={0.000001}
                  onChange={(nextVal) =>
                    onChange(
                      updateActionConfigField(
                        config,
                        "latitude",
                        numericOrTemplate(nextVal),
                      ),
                    )
                  }
                />
              );
            },
          },
          {
            widget: "custom",
            render: ({ config, onChange }: TypedFieldContext) => {
              if (config.type !== "set_geolocation") return null;
              return (
                <VariableNumericInput
                  label="Longitude"
                  value={config.config.longitude}
                  step={0.000001}
                  onChange={(nextVal) =>
                    onChange(
                      updateActionConfigField(
                        config,
                        "longitude",
                        numericOrTemplate(nextVal),
                      ),
                    )
                  }
                />
              );
            },
          },
          { widget: "numeric", key: "accuracy", label: "Accuracy", min: 0 },
        ],
      },
    ],
  },
  set_extra_headers: {
    sections: [
      {
        title: "Request headers",
        fields: [
          {
            // Headers arrive as a "Name: Value" list rendered from structured
            // data, mirroring http_request.
            widget: "custom",
            render: ({ config, onChange }: TypedFieldContext) => {
              if (config.type !== "set_extra_headers") return null;
              return (
                <TemplateTextareaField
                  label="Headers"
                  value={config.config.headers
                    .map((header) => `${header.name}: ${header.value}`)
                    .join("\n")}
                  onChange={(val) =>
                    onChange(updateActionConfigField(config, "headers", val))
                  }
                />
              );
            },
          },
        ],
      },
    ],
  },
  grant_permission: {
    sections: [
      {
        title: "Permission scope",
        fields: [
          {
            widget: "template",
            key: "origin",
            label: "Origin",
            placeholder: "Current origin",
          },
          { widget: "textarea", key: "permissions", label: "Permissions" },
        ],
      },
    ],
  },
};
