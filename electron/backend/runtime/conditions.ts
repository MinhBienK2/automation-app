import { requireWebSurface } from "./surface.js";
import { locatorFor, locatorForRuntimeElementRef } from "./targetResolver.js";
import type { SurfaceActing, VariableScope } from "./actionRuntime.js";
import { resolveObjectTemplates, getDeepValue } from "./variables.js";

/**
 * Conditions span both halves of the split: `variable_is_true` reads the
 * outputs bag and nothing else, while `text_visible` needs a page. Control
 * flow calls this, and control flow must stay surface-independent — so the
 * surface is optional here and demanded only by the branches that use it.
 */
export async function conditionMatches(
  runtime: VariableScope & Partial<Pick<SurfaceActing, "surface">>,
  condition: unknown,
) {
  const web = () => {
    if (!runtime.surface) {
      throw new Error(
        "This condition inspects the page, but the run has no execution surface bound.",
      );
    }
    return requireWebSurface(runtime.surface);
  };
  if (!condition || typeof condition !== "object" || !("kind" in condition)) {
    throw new Error("Condition kind is required");
  }
  const { resolveDynamicOutputs } = await import("./variables.js");
  await resolveDynamicOutputs(runtime.outputs, condition);
  const resolvedCondition = resolveObjectTemplates(condition, runtime.outputs);
  const typed = resolvedCondition as {
    kind: string;
    name?: string;
    value?: string;
    text?: string;
    target?: unknown;
    xpath?: string | null;
    target_ref?: string | null;
  };
  if (typed.kind === "variable_is_true") {
    const val = getDeepValue(runtime.outputs, typed.name ?? "");
    return val === true || val === "true" || val === 1 || val === "1";
  }
  if (typed.kind === "url_contains") {
    const href = String(
      (await web().page.evaluate<string | null | undefined>("window.location.href")) ?? "",
    );
    return href.includes(typed.value ?? "");
  }
  if (typed.kind === "text_visible") {
    return Boolean(await web().page.locator(`text=${typed.text ?? ""}`).isVisible?.());
  }
  if (typed.kind === "element_visible") {
    if (typed.target_ref != null) {
      const refName = typed.target_ref.trim();
      if (!refName) {
        throw new Error("Target ref is required");
      }
      const ref = runtime.elementRefs.get(refName);
      if (!ref) {
        throw new Error(`Element ref not found: ${typed.target_ref}`);
      }
      return Boolean(await (await locatorForRuntimeElementRef(web().page, ref)).isVisible?.());
    }
    return Boolean(
      await (await locatorFor(web().page, typed.target, typed.xpath ?? "body")).isVisible?.(),
    );
  }
  throw new Error(`Unsupported condition kind: ${typed.kind || "unknown"}`);
}
