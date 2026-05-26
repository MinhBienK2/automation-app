import type { ActionConfig, ElementLocatorKind, ElementTarget } from "../../../types/workflow";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { updateActionConfigField } from "../lib/workflowStepForm";

type TargetableElementConfig = Extract<
  ActionConfig,
  {
    type:
      | "input_text"
      | "wait"
      | "clear_input"
      | "click"
      | "select_option"
      | "hover"
      | "double_click"
      | "right_click"
      | "focus_element"
      | "blur_element"
      | "type_sequence"
      | "paste_clipboard"
      | "check"
      | "uncheck"
      | "toggle_checkbox"
      | "select_radio"
      | "upload_file"
      | "submit_form"
      | "set_contenteditable"
      | "extract_text"
      | "extract_attribute"
      | "extract_input_value"
      | "extract_table"
      | "extract_list"
      | "assert_element"
      | "assert_text";
  }
>;

export function ElementTargetFields({
  config,
  onChange,
}: {
  config: TargetableElementConfig;
  onChange: (config: ActionConfig) => void;
}) {
  return <StructuredTargetFields config={config} onChange={onChange} />;
}

export function ElementOptionalFields({
  config,
  onChange,
}: {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
}) {
  const optionalConfig = config.config as {
    iframe_xpath?: string | null;
    wait_until?: string | null;
    timeout_ms?: number | null;
  };
  const showWaitUntil = actionSupportsWaitUntil(config.type);

  return (
    <>
      <Label>
        Iframe XPath
        <Input
          value={optionalConfig.iframe_xpath ?? ""}
          onChange={(event) =>
            onChange(updateActionConfigField(config, "iframe_xpath", event.currentTarget.value))
          }
          placeholder="Optional iframe XPath"
        />
      </Label>
      {showWaitUntil ? (
        <Label>
          Wait until
          <Select
            value={optionalConfig.wait_until ?? "clickable"}
            onChange={(event) =>
              onChange(updateActionConfigField(config, "wait_until", event.currentTarget.value))
            }
          >
            <option value="clickable">Clickable</option>
            <option value="visible">Visible</option>
            <option value="enabled">Enabled</option>
            <option value="attached">Attached</option>
          </Select>
        </Label>
      ) : null}
      <Label>
        Timeout ms
        <Input
          min="1"
          type="number"
          value={optionalConfig.timeout_ms ?? 5000}
          onChange={(event) =>
            onChange(updateActionConfigField(config, "timeout_ms", event.currentTarget.value))
          }
        />
      </Label>
    </>
  );
}

function actionSupportsWaitUntil(actionType: ActionConfig["type"]): boolean {
  return (
    [
      "input_text",
      "clear_input",
      "click",
      "select_option",
      "hover",
      "double_click",
      "right_click",
      "drag_and_drop",
      "focus_element",
      "blur_element",
      "type_sequence",
      "paste_clipboard",
      "check",
      "uncheck",
      "toggle_checkbox",
      "select_radio",
      "upload_file",
      "submit_form",
      "set_contenteditable",
    ] as Array<ActionConfig["type"]>
  ).includes(actionType);
}

export function StructuredTargetFields({
  config,
  onChange,
  targetField = "target",
  showConstraints = true,
}: {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
  targetField?: "target" | "source_target" | "target_target" | "trigger_target";
  showConstraints?: boolean;
}) {
  const rawConfig = config.config as Record<string, unknown>;
  const target = (rawConfig[targetField] as ElementTarget | null | undefined) ?? null;
  const locator = target?.locators[0] ?? null;
  const constraints = target?.constraints ?? null;
  const kind = locator?.kind ?? "xpath";
  const value = locator?.value ?? "";

  const updateTarget = (nextTarget: ElementTarget | null) => {
    onChange({
      ...config,
      config: {
        ...config.config,
        [targetField]: nextTarget,
      },
    } as ActionConfig);
  };
  const updateLocator = (
    next: Partial<{ kind: ElementLocatorKind; value: string; role: string; attribute: string; exact: boolean }>,
  ) => {
    const nextKind = next.kind ?? kind;
    const nextValue = next.value ?? value;
    if (!nextValue.trim()) {
      updateTarget(null);
      return;
    }
    updateTarget({
      locators: [
        {
          kind: nextKind,
          value: nextValue,
          role: nextKind === "role" ? next.role ?? locator?.role ?? "button" : null,
          attribute:
            nextKind === "attribute" ? next.attribute ?? locator?.attribute ?? "" : null,
          exact: next.exact ?? locator?.exact ?? null,
        },
      ],
      constraints,
      iframe: target?.iframe ?? null,
    });
  };
  const updateConstraint = (
    field: "visible" | "enabled" | "contains_text" | "index",
    nextValue: string,
  ) => {
    const nextConstraints = {
      ...(constraints ?? {}),
      [field]:
        field === "visible" || field === "enabled"
          ? nextValue === "any"
            ? null
            : nextValue === "true"
          : field === "index"
            ? nextValue
              ? Number(nextValue)
              : null
            : nextValue || null,
    };
    updateTarget({
      locators: target?.locators.length
        ? target.locators
        : [{ kind, value: value || "target", role: null, attribute: null, exact: null }],
      constraints: nextConstraints,
      iframe: target?.iframe ?? null,
    });
  };

  return (
    <>
      <Label>
        Target locator type
        <Select
          value={kind}
          onChange={(event) =>
            updateLocator({ kind: event.currentTarget.value as ElementLocatorKind })
          }
        >
          <option value="test_id">Test ID</option>
          <option value="role">Role</option>
          <option value="label">Label</option>
          <option value="placeholder">Placeholder</option>
          <option value="text">Text</option>
          <option value="css">CSS</option>
          <option value="xpath">XPath</option>
          <option value="attribute">Attribute</option>
        </Select>
      </Label>
      <Label>
        Target locator
        <Input
          value={value}
          onChange={(event) => updateLocator({ value: event.currentTarget.value })}
          placeholder="Optional structured target"
        />
      </Label>
      {kind === "role" ? (
        <Label>
          Target role
          <Input
            value={locator?.role ?? "button"}
            onChange={(event) => updateLocator({ role: event.currentTarget.value })}
          />
        </Label>
      ) : null}
      {kind === "attribute" ? (
        <Label>
          Target attribute
          <Input
            value={locator?.attribute ?? ""}
            onChange={(event) => updateLocator({ attribute: event.currentTarget.value })}
          />
        </Label>
      ) : null}
      {showConstraints ? (
        <>
          <Label>
            Target visibility
            <Select
              value={
                constraints?.visible === true
                  ? "true"
                  : constraints?.visible === false
                    ? "false"
                    : "any"
              }
              onChange={(event) => updateConstraint("visible", event.currentTarget.value)}
            >
              <option value="any">Any</option>
              <option value="true">Visible</option>
              <option value="false">Hidden</option>
            </Select>
          </Label>
          <Label>
            Target enabled
            <Select
              value={
                constraints?.enabled === true
                  ? "true"
                  : constraints?.enabled === false
                    ? "false"
                    : "any"
              }
              onChange={(event) => updateConstraint("enabled", event.currentTarget.value)}
            >
              <option value="any">Any</option>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </Select>
          </Label>
          <Label>
            Target contains text
            <Input
              value={constraints?.contains_text ?? ""}
              onChange={(event) => updateConstraint("contains_text", event.currentTarget.value)}
            />
          </Label>
          <Label>
            Target index
            <Input
              min="0"
              type="number"
              value={constraints?.index ?? ""}
              onChange={(event) => updateConstraint("index", event.currentTarget.value)}
            />
          </Label>
        </>
      ) : null}
    </>
  );
}
