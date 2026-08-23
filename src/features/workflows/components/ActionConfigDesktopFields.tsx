import { useState, type ReactNode } from "react";
import { MousePointerSquareDashed } from "lucide-react";
import type { ActionConfig } from "../../../types/workflow";
import type {
  DesktopLocatorConfig,
  DesktopStepTargetConfig,
} from "../../../types/workflowActionConfigs";
import type { DesktopLocator } from "../../../types/desktopTargets";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import { inspectDesktopTarget } from "../../../lib/api/workflowApi";
import { ActionConfigFieldGroup } from "./actionFields/ActionConfigFieldGroup";
import { DesktopElementPickerDialog } from "./DesktopElementPickerDialog";
import { TemplateTextField } from "./variables/TemplateTextField";
import type { VariableOption } from "./variables/TemplateTextField";
import { useWorkflowSurface } from "../state/WorkflowSurfaceContext";

/**
 * Configuration fields for the Desktop Surface family.
 *
 * Its own renderer rather than more branches inside the element fields, for the
 * same reason the two locator models are not shared code: a web step points at
 * a DOM node by XPath or by role, a desktop step points at a UIA element by
 * role, name and ancestor chain, and a single form over both would be a form
 * where half the inputs are always disabled.
 *
 * The target is not typed by hand. Every element-addressed action here opens
 * the same picker, which reads the live window — see
 * `docs/domain/desktop/locator-model.md`.
 */

type ActionFieldsProps = {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
  variableOptions?: VariableOption[];
};

const DESKTOP_TARGETED = new Set([
  "desktop_click",
  "desktop_set_value",
  "desktop_type_text",
  "desktop_press_key",
  "desktop_hotkey",
  "desktop_read_text",
  "desktop_wait_for",
  "desktop_invoke_menu",
  "desktop_scroll",
  "desktop_drag",
  "desktop_read_table",
  "desktop_hover",
]);

export function DesktopActionFields({
  config,
  onChange,
  variableOptions,
}: ActionFieldsProps): ReactNode | null {
  if (!config.type.startsWith("desktop_")) return null;

  const set = (field: string, value: unknown) =>
    onChange({ ...config, config: { ...config.config, [field]: value } } as ActionConfig);

  return (
    <>
      {DESKTOP_TARGETED.has(config.type) && (
        <DesktopTargetField
          target={(config.config as { target: DesktopStepTargetConfig }).target}
          onChange={(target) => set("target", target)}
        />
      )}

      {config.type === "desktop_click" && (
        <>
          <Label>
            Button
            <Select
              value={config.config.button ?? "left"}
              onChange={(e) => set("button", e.currentTarget.value)}
            >
              <option value="left">Left</option>
              <option value="right">Right</option>
              <option value="middle">Middle</option>
            </Select>
          </Label>
          <Label>
            Clicks
            <Input
              type="number"
              min={1}
              value={config.config.count ?? 1}
              onChange={(e) => set("count", Number(e.currentTarget.value) || 1)}
            />
          </Label>
        </>
      )}

      {config.type === "desktop_set_value" && (
        <TemplateTextField
          label="Value"
          value={config.config.value}
          onChange={(value: string) => set("value", value)}
          variableOptions={variableOptions}
        />
      )}

      {config.type === "desktop_type_text" && (
        <TemplateTextField
          label="Text"
          value={config.config.text}
          onChange={(value: string) => set("text", value)}
          variableOptions={variableOptions}
        />
      )}

      {config.type === "desktop_press_key" && (
        <TemplateTextField
          label="Key"
          placeholder="Enter, Tab, F2, a"
          value={config.config.key}
          onChange={(value: string) => set("key", value)}
          variableOptions={variableOptions}
        />
      )}

      {config.type === "desktop_hotkey" && (
        <Label>
          Keys, in the order they are held
          <Input
            placeholder="Control, s"
            value={(config.config.keys ?? []).join(", ")}
            onChange={(e) => set("keys", splitList(e.currentTarget.value))}
          />
        </Label>
      )}

      {config.type === "desktop_read_text" && (
        <Label>
          Output name
          <Input
            value={config.config.output_name}
            onChange={(e) => set("output_name", e.currentTarget.value)}
          />
        </Label>
      )}

      {config.type === "desktop_invoke_menu" && (
        <Label>
          Menu path
          <Input
            placeholder="File, Save As"
            value={(config.config.path ?? []).join(", ")}
            onChange={(e) => set("path", splitList(e.currentTarget.value))}
          />
        </Label>
      )}

      {config.type === "desktop_scroll" && (
        <>
          <Label>
            Direction
            <Select
              value={config.config.direction}
              onChange={(e) => set("direction", e.currentTarget.value)}
            >
              <option value="up">Up</option>
              <option value="down">Down</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </Select>
          </Label>
          <Label>
            By
            <Select
              value={config.config.by ?? ""}
              onChange={(e) => set("by", e.currentTarget.value || null)}
            >
              <option value="">Default</option>
              <option value="line">Line</option>
              <option value="page">Page</option>
            </Select>
          </Label>
          <Label>
            Amount
            <Input
              type="number"
              value={config.config.amount ?? ""}
              onChange={(e) =>
                set("amount", e.currentTarget.value === "" ? null : Number(e.currentTarget.value))
              }
            />
          </Label>
        </>
      )}

      {config.type === "desktop_drag" && (
        <DesktopTargetField
          title="Drag to"
          target={config.config.to}
          onChange={(to) => set("to", to)}
        />
      )}

      {config.type === "desktop_read_clipboard" && (
        <Label>
          Output name
          <Input
            value={config.config.output_name}
            onChange={(e) => set("output_name", e.currentTarget.value)}
          />
        </Label>
      )}

      {config.type === "desktop_set_clipboard" && (
        <TemplateTextField
          label="Text"
          value={config.config.text}
          onChange={(value: string) => set("text", value)}
          variableOptions={variableOptions}
        />
      )}

      {config.type === "desktop_read_table" && (
        <Label>
          Output name
          <Input
            value={config.config.output_name}
            onChange={(e) => set("output_name", e.currentTarget.value)}
          />
        </Label>
      )}

      {config.type === "desktop_screenshot" && (
        <>
          <Label>
            Output name
            <Input
              value={config.config.output_name ?? ""}
              onChange={(e) => set("output_name", e.currentTarget.value || null)}
            />
          </Label>
          <Label className="action-config-checkbox">
            <input
              type="checkbox"
              checked={config.config.sensitive === true}
              onChange={(e) => set("sensitive", e.currentTarget.checked)}
            />
            This step is on screen with something sensitive — take no picture
          </Label>
        </>
      )}
    </>
  );
}

/**
 * The element a step acts on, and the choice between the two ways to name one.
 *
 * Pixel addressing is a radio button rather than a fallback the system reaches
 * for: `capability-tiers.md` makes it opt-in per step, because silently
 * switching to coordinates converts a loud failure into a workflow that clicks
 * the wrong thing.
 */
function DesktopTargetField({
  target,
  onChange,
  title = "Element",
}: {
  target: DesktopStepTargetConfig;
  onChange: (target: DesktopStepTargetConfig) => void;
  title?: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const surface = useWorkflowSurface();

  return (
    <ActionConfigFieldGroup title={title} nested>
      <Label>
        Addressed by
        <Select
          value={target.kind}
          onChange={(e) =>
            onChange(
              e.currentTarget.value === "pixel"
                ? { kind: "pixel", x: 0, y: 0, origin: "window" }
                : { kind: "element", locator: { role: "" } },
            )
          }
        >
          <option value="element">The element itself</option>
          <option value="pixel">Screen position inside the window</option>
        </Select>
      </Label>

      {target.kind === "element" ? (
        <>
          <div className="desktop-target-summary">
            <code>{describeLocator(target.locator)}</code>
            <Button
              variant="secondary"
              size="sm"
              disabled={!surface.desktopTargetId}
              onClick={() => setPickerOpen(true)}
            >
              <MousePointerSquareDashed className="h-4 w-4" />
              Pick from the window
            </Button>
          </div>
          {!surface.desktopTargetId && (
            <Alert variant="info">
              Choose the application this workflow drives in Workflow Settings, and the picker can
              open it.
            </Alert>
          )}
          <DesktopElementPickerDialog
            open={pickerOpen}
            targetId={surface.desktopTargetId}
            targetName={surface.desktopTargetName}
            onClose={() => setPickerOpen(false)}
            onPick={(locator) => onChange({ kind: "element", locator: toConfig(locator) })}
            inspect={inspectDesktopTarget}
          />
        </>
      ) : (
        <>
          <Label>
            X, from the left edge of the window
            <Input
              type="number"
              value={target.x}
              onChange={(e) => onChange({ ...target, x: Number(e.currentTarget.value) || 0 })}
            />
          </Label>
          <Label>
            Y, from the top edge of the window
            <Input
              type="number"
              value={target.y}
              onChange={(e) => onChange({ ...target, y: Number(e.currentTarget.value) || 0 })}
            />
          </Label>
          <Alert variant="warning">
            A step addressed by position acts on whatever is at these coordinates. It breaks when
            the window is resized or moved, when the display scaling changes, and when the
            application changes its layout — and it fails silently, by clicking the wrong thing.
          </Alert>
        </>
      )}
    </ActionConfigFieldGroup>
  );
}

/** What the picker wrote, in one line the operator can read back. */
function describeLocator(locator: DesktopLocatorConfig): string {
  if (!locator.role) return "No element chosen yet";

  const parts = [locator.role];
  if (locator.name) parts.push(`"${locator.name.value}"`);
  if (locator.automation_id) parts.push(`#${locator.automation_id}`);
  if (locator.ancestors?.length) {
    parts.push(`inside ${locator.ancestors.map((a) => a.role).join(" < ")}`);
  }
  if (locator.ordinal !== undefined && locator.ordinal !== null) {
    parts.push(`(number ${locator.ordinal + 1} of the matches)`);
  }
  return parts.join(" ");
}

function toConfig(locator: DesktopLocator): DesktopLocatorConfig {
  return {
    role: locator.role,
    name: locator.name ?? null,
    ancestors: locator.ancestors?.map((a) => ({ role: a.role, name: a.name ?? null })) ?? null,
    ordinal: locator.ordinal ?? null,
    automation_id: locator.automationId ?? null,
  };
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}
