import { validationError } from "../../shared/records.js";
import { requiredActionString, type ActionValidationError } from "./primitives.js";

/**
 * A desktop step is runnable when it says what it points at.
 *
 * An element target needs a role — a locator with no role matches everything,
 * which is the ambiguity the locator model refuses to resolve. A pixel target
 * needs both coordinates; half of one silently means (0, 0).
 */
function validateDesktopStep(config: {
  config: {
    target?: {
      kind?: string;
      locator?: { role?: string | null } | null;
      x?: number | null;
      y?: number | null;
    } | null;
  };
}): ActionValidationError | null {
  const target = config.config.target;
  if (!target) {
    return validationError("target", "Choose the element or window position this step acts on");
  }

  if (target.kind === "pixel") {
    return Number.isFinite(target.x) && Number.isFinite(target.y)
      ? null
      : validationError("target", "A pixel target needs both x and y, relative to the window");
  }

  return requiredActionString(
    target.locator?.role,
    "target",
    "Pick the element again — its role is missing",
  );
}

export const desktopValidators = {
  desktop_click: (config: any) => validateDesktopStep(config),
  desktop_set_value: (config: any) => validateDesktopStep(config),
  desktop_type_text: (config: any) => validateDesktopStep(config),
  desktop_press_key: (config: any) => validateDesktopStep(config),
  desktop_hotkey: (config: any) => validateDesktopStep(config),
  desktop_read_text: (config: any) => validateDesktopStep(config),
  desktop_wait_for: (config: any) => validateDesktopStep(config),
  // No target: both act on the bound window itself.
  desktop_screenshot: () => null,
  desktop_focus_window: () => null,
  desktop_invoke_menu: (config: any) => validateDesktopStep(config),
};
