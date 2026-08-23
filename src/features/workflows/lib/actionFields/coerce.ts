export type NumericTemplateValue = string | number | null | undefined;

/**
 * Single home for the "number, or an injected {{variable}} template" coercion
 * previously pasted next to every numeric config field.
 */
export function numericOrTemplate(nextVal: NumericTemplateValue): string | number | null {
  if (nextVal === "" || nextVal === null || nextVal === undefined) return null;
  if (typeof nextVal === "string" && nextVal.startsWith("{{")) return nextVal;
  return Number(nextVal);
}
