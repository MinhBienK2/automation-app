import path from "node:path";
import type { BrowserDriverPage } from "../../browser/sessionManager.js";
import { isPlainRecord } from "../../shared/records.js";
import { locatorFor, locatorForRuntimeElementRef } from "../targetResolver.js";
import { renderTemplate } from "../variables.js";
import type { RunnerActionRuntime } from "./types.js";

/**
 * Single funnel for the `runtime.outputs[name] = value` writes that executor
 * bodies perform, so future tracing/normalization hooks have one place to live.
 */
export function assignOutput(
  outputs: Record<string, unknown>,
  name: string,
  value: unknown,
): void {
  outputs[name] = value;
}

/**
 * Resolve a user-supplied relative path against the app root; absolute paths
 * pass through untouched.
 */
export function resolveUnderRoot(rootDir: string, renderedPath: string): string {
  return path.isAbsolute(renderedPath)
    ? renderedPath
    : path.resolve(rootDir, renderedPath);
}

export function cleanFlattenedKeys(outputs: Record<string, unknown>, varName: string): void {
  const prefix = varName + ".";
  for (const key of Object.keys(outputs)) {
    if (key.startsWith(prefix)) {
      delete outputs[key];
    }
  }
}

export function deepMerge(
  target: Record<string, any>,
  source: Record<string, any>,
): Record<string, any> {
  const result = { ...target };
  for (const [key, val] of Object.entries(source)) {
    if (isPlainRecord(val) && isPlainRecord(result[key])) {
      result[key] = deepMerge(result[key], val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

/**
 * Evaluate a script string inside the page with one named scope value bound as
 * the script's sole parameter. Logic-equivalent home of the inline
 * `new Function(...)` blocks previously duplicated across check_conditions,
 * calculate_value, execute_list_script and execute_object_script.
 */
function evaluateScopedScript(
  page: BrowserDriverPage,
  scriptText: string,
  scopeName: string,
  scopeValue: unknown,
  errorPrefix: string,
  coerceToBoolean: boolean,
): Promise<unknown> {
  return page.evaluate((args) => {
    if (!args) throw new Error("Arguments are required");
    const { scriptText, scopeName, scopeValue, errorPrefix, coerceToBoolean } = args;
    try {
      const fn = new Function(scopeName, `return (${scriptText});`);
      const result = fn(scopeValue);
      return coerceToBoolean ? Boolean(result) : result;
    } catch (err) {
      throw new Error(`${errorPrefix}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, { scriptText, scopeName, scopeValue, errorPrefix, coerceToBoolean });
}

export function evaluateScriptOnOutputs(
  page: BrowserDriverPage,
  scriptText: string,
  outputs: Record<string, unknown>,
  options?: { coerceToBoolean?: boolean },
): Promise<unknown> {
  return evaluateScopedScript(
    page,
    scriptText,
    "outputs",
    outputs,
    "Failed to evaluate JS",
    options?.coerceToBoolean ?? false,
  );
}

export function evaluateScriptOnList(
  page: BrowserDriverPage,
  scriptText: string,
  list: unknown,
): Promise<unknown> {
  return evaluateScopedScript(page, scriptText, "list", list, "Failed to evaluate JS on list", false);
}

export function evaluateScriptOnObject(
  page: BrowserDriverPage,
  scriptText: string,
  obj: unknown,
): Promise<unknown> {
  return evaluateScopedScript(page, scriptText, "obj", obj, "Failed to evaluate JS on object", false);
}

export function getMockValueForVariable(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("video")) {
    return "https://www.tiktok.com/@tiktok/video/7350000000000000000";
  }
  if (lower.includes("url") || lower.includes("link")) {
    return "https://www.tiktok.com/@tiktok";
  }
  if (
    lower.includes("user") ||
    lower.includes("name") ||
    lower.includes("account") ||
    lower.includes("channel") ||
    lower.includes("profile")
  ) {
    return "tiktok";
  }
  if (lower.includes("id")) {
    return "1234567890";
  }
  if (lower.includes("num") || lower.includes("count") || lower.includes("index")) {
    return "1";
  }
  return `mock_${name}`;
}

export async function evaluateRuleGroup(group: any, runtime: RunnerActionRuntime): Promise<boolean> {
  if (!group || !Array.isArray(group.rules) || group.rules.length === 0) {
    return true;
  }

  const results: boolean[] = [];
  for (const rule of group.rules) {
    if ("operator" in rule) {
      results.push(await evaluateRuleGroup(rule, runtime));
    } else {
      results.push(await evaluateSingleRule(rule, runtime));
    }
  }

  if (group.operator === "or") {
    return results.some(r => r === true);
  }
  return results.every(r => r === true);
}

async function evaluateSingleRule(rule: any, runtime: RunnerActionRuntime): Promise<boolean> {
  switch (rule.type) {
    case "value_compare": {
      const left = renderTemplate(rule.left_operand ?? "", runtime.outputs);
      const right = renderTemplate(rule.right_operand ?? "", runtime.outputs);

      switch (rule.comparison) {
        case "equals": return left === right;
        case "not_equals": return left !== right;
        case "contains": return left.includes(right);
        case "not_contains": return !left.includes(right);
        case "greater_than": return Number(left) > Number(right);
        case "less_than": return Number(left) < Number(right);
        case "greater_than_or_equals": return Number(left) >= Number(right);
        case "less_than_or_equals": return Number(left) <= Number(right);
        case "is_empty": return !left || left.trim() === "";
        case "is_not_empty": return left.trim() !== "";
        case "matches_regex": return new RegExp(right).test(left);
        default: return false;
      }
    }
    case "element_state": {
      let locator;
      if (rule.element_source === "ref") {
        if (!rule.target_ref) throw new Error("Target ref is required");
        const ref = runtime.elementRefs.get(rule.target_ref);
        if (!ref) throw new Error(`Element ref not found: ${rule.target_ref}`);
        locator = await locatorForRuntimeElementRef(runtime.page, ref);
      } else {
        locator = await locatorFor(runtime.page, null, rule.xpath || "body");
      }

      switch (rule.element_property) {
        case "visible": return locator.isVisible ? await locator.isVisible() : false;
        case "hidden": return locator.isVisible ? !(await locator.isVisible()) : true;
        case "enabled": return locator.isEnabled ? await locator.isEnabled() : false;
        case "disabled": return locator.isEnabled ? !(await locator.isEnabled()) : true;
        case "checked": return locator.evaluate ? await locator.evaluate((el) => (el as HTMLInputElement).checked) : false;
        case "unchecked": return locator.evaluate ? !(await locator.evaluate((el) => (el as HTMLInputElement).checked)) : true;
        default: return false;
      }
    }
    case "url_check": {
      const href = await runtime.page.evaluate(() => window.location.href);
      const val = rule.url_value ?? "";
      switch (rule.url_comparison) {
        case "contains": return href.includes(val);
        case "not_contains": return !href.includes(val);
        case "matches_regex": return new RegExp(val).test(href);
        default: return false;
      }
    }
    default:
      return false;
  }
}
