import type { RunnerActionRuntime } from "../runnerActionExecutors.js";
import { locatorFor, locatorForRuntimeElementRef } from "../targetResolver.js";
import { renderTemplate } from "../variables.js";

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

export async function evaluateSingleRule(rule: any, runtime: RunnerActionRuntime): Promise<boolean> {
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


export function outputValueToText(value: unknown, separator = "\n"): string {
  if (Array.isArray(value)) {
    return value.map((item) => outputValueToText(item, separator)).join(separator);
  }
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

export function outputValueToList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => outputValueToText(item));
  if (value == null || value === "") return [];
  return [outputValueToText(value)];
}
