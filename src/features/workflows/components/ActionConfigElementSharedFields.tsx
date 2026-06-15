import { useEffect, useState } from "react";
import type { ActionConfig, ElementLocatorKind, ElementTarget } from "../../../types/workflow";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { SegmentedControl } from "../../../components/ui/segmented-control";
import { updateActionConfigField } from "../lib/workflowStepForm";
import { VariableNumericInput } from "./VariableNumericInput";
import { TemplateTextField } from "./TemplateTextField";


type TargetableElementConfig = Extract<
  ActionConfig,
  {
    type:
      | "input_text"
      | "wait"
      | "clear_input"
      | "click"
      | "find_element"
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
      | "count_elements"
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

export function ElementTargetSourceFields({
  config,
  onChange,
  showConstraints = true,
  targetField = "target",
  refField = "target_ref",
  labelPrefix = "Target",
  sourceLabel = `${labelPrefix} source`,
  refLabel = `${labelPrefix} ref`,
  description = "This action uses the element resolved by a previous Find Element node in this run.",
}: {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
  showConstraints?: boolean;
  targetField?: "target" | "source_target" | "target_target" | "trigger_target";
  refField?: "target_ref" | "source_ref" | "trigger_ref";
  labelPrefix?: string;
  sourceLabel?: string;
  refLabel?: string;
  description?: string;
}) {
  const rawConfig = config.config as Record<string, unknown>;
  const targetRef = rawConfig[refField] as string | null | undefined;
  const [targetSource, setTargetSource] = useState<"locator" | "ref">(
    targetRef != null ? "ref" : "locator",
  );

  useEffect(() => {
    setTargetSource(targetRef != null ? "ref" : "locator");
  }, [config.type, refField, targetRef]);

  return (
    <>
      <div className="grid gap-1.5">
        <Label>{sourceLabel}</Label>
        <SegmentedControl
          ariaLabel={sourceLabel}
          value={targetSource}
          options={[
            { label: "Use locator", value: "locator" },
            { label: "Use Find Element ref", value: "ref" },
          ]}
          onValueChange={(value) => {
            setTargetSource(value);
            onChange({
              ...config,
              config: {
                ...config.config,
                [refField]: value === "ref" ? (targetRef ?? "") : null,
              },
            } as ActionConfig);
          }}
        />
      </div>
      {targetSource === "ref" ? (
        <>
          <TemplateTextField
            label={refLabel}
            value={targetRef ?? ""}
            onChange={(val) =>
              onChange({
                ...config,
                config: {
                  ...config.config,
                  [refField]: val,
                },
              } as ActionConfig)
            }
            placeholder="Output name from Find Element"
          />
          <p className="text-xs leading-5 text-[var(--app-text-muted)]">
            {description}
          </p>
        </>
      ) : (
        <StructuredTargetFields
          config={config}
          onChange={onChange}
          targetField={targetField}
          labelPrefix={labelPrefix}
          showConstraints={showConstraints}
        />
      )}
    </>
  );
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
      <TemplateTextField
        label="Iframe XPath"
        value={optionalConfig.iframe_xpath ?? ""}
        onChange={(val) =>
          onChange(updateActionConfigField(config, "iframe_xpath", val))
        }
        placeholder="Optional iframe XPath"
      />
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
      <VariableNumericInput
        label="Timeout ms"
        value={optionalConfig.timeout_ms}
        min={1}
        onChange={(nextVal) => {
          const val = nextVal !== "" && nextVal !== null && nextVal !== undefined
            ? typeof nextVal === "string" && nextVal.startsWith("{{")
              ? nextVal
              : Number(nextVal)
            : null;
          onChange(updateActionConfigField(config, "timeout_ms", val));
        }}
      />
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
  labelPrefix = "Target",
  showConstraints = true,
}: {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
  targetField?: "target" | "source_target" | "target_target" | "trigger_target";
  labelPrefix?: string;
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
    nextValue: any,
  ) => {
    const nextConstraints = {
      ...(constraints ?? {}),
      [field]:
        field === "visible" || field === "enabled"
          ? nextValue === "any"
            ? null
            : nextValue === "true"
          : field === "index"
            ? nextValue !== "" && nextValue !== null && nextValue !== undefined
              ? typeof nextValue === "string" && nextValue.startsWith("{{")
                ? nextValue
                : Number(nextValue)
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
        {labelPrefix} locator type
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
      <TemplateTextField
        label={`${labelPrefix} locator`}
        value={value}
        onChange={(val) => updateLocator({ value: val })}
        placeholder="Optional structured target"
      />
      {kind === "role" ? (
        <TemplateTextField
          label={`${labelPrefix} role`}
          value={locator?.role ?? "button"}
          onChange={(val) => updateLocator({ role: val })}
        />
      ) : null}
      {kind === "attribute" ? (
        <TemplateTextField
          label={`${labelPrefix} attribute`}
          value={locator?.attribute ?? ""}
          onChange={(val) => updateLocator({ attribute: val })}
        />
      ) : null}
      {showConstraints ? (
        <>
          <Label>
            {labelPrefix} visibility
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
            {labelPrefix} enabled
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
          <TemplateTextField
            label={`${labelPrefix} contains text`}
            value={constraints?.contains_text ?? ""}
            onChange={(val) => updateConstraint("contains_text", val)}
          />
          <VariableNumericInput
            label={`${labelPrefix} index`}
            value={constraints?.index}
            min={0}
            onChange={(nextVal) => updateConstraint("index", nextVal)}
          />
        </>
      ) : null}
    </>
  );
}
