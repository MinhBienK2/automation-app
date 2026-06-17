import { locatorFor, locatorForRuntimeElementRef } from "./targetResolver.js";
import type { RunnerActionRuntime } from "./runnerActionExecutors.js";
import { resolveObjectTemplates } from "./variables.js";

export async function conditionMatches(runtime: RunnerActionRuntime, condition: unknown) {
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
  if (typed.kind === "output_equals") return String(runtime.outputs[typed.name ?? ""]) === typed.value;
  if (typed.kind === "output_contains") {
    return String(runtime.outputs[typed.name ?? ""]).includes(typed.value ?? "");
  }
  if (typed.kind === "url_contains") {
    const href = String(
      (await runtime.page.evaluate<string | null | undefined>("window.location.href")) ?? "",
    );
    return href.includes(typed.value ?? "");
  }
  if (typed.kind === "text_visible") {
    return Boolean(await runtime.page.locator(`text=${typed.text ?? ""}`).isVisible?.());
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
      return Boolean(await (await locatorForRuntimeElementRef(runtime.page, ref)).isVisible?.());
    }
    return Boolean(
      await (await locatorFor(runtime.page, typed.target, typed.xpath ?? "body")).isVisible?.(),
    );
  }
  throw new Error(`Unsupported condition kind: ${typed.kind || "unknown"}`);
}
