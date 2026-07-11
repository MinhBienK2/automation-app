import type { ActionConfig } from "../../../src/types/workflow.js";

export function setVariables(
  outputs: Record<string, unknown>,
  config: Extract<ActionConfig, { type: "set_variable" }>["config"],
) {
  const variables = config.variables ?? [
    {
      name: config.name ?? "",
      value_type: config.value_type ?? "text",
      value: config.value ?? "",
    },
  ];
  for (const variable of variables) {
    if (!variable.name.trim()) continue;
    writeVariableValue(
      outputs,
      variable.name,
      parseVariableValue(variable.value_type, variable.value, outputs),
    );
  }
}

export function parseVariableValue(
  valueType: string,
  value: string,
  outputs: Record<string, unknown>,
) {
  const rendered = renderTemplate(value, outputs);
  if (valueType === "json") return JSON.parse(rendered);
  if (valueType === "number") return Number(rendered);
  if (valueType === "boolean") return rendered === "true";
  return rendered;
}

export function getDeepValue(obj: Record<string, unknown>, path: string): unknown {
  if (path in obj) return obj[path];
  const parts = path.split(".");
  let current: any = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = current[part];
  }
  return current;
}


export function writeVariableValue(
  outputs: Record<string, unknown>,
  name: string,
  value: unknown,
) {
  outputs[name] = value;
  const resolvers = (outputs as any).__dynamicResolvers;
  if (resolvers && resolvers.has(name)) {
    resolvers.delete(name);
  }
}

export function renderTemplate(value: string, outputs: Record<string, unknown>) {
  return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, name: string) =>
    String(getDeepValue(outputs, name.trim()) ?? ""),
  );
}

const NUMERIC_KEYS = new Set([
  "timeout_ms",
  "duration_ms",
  "min_ms",
  "max_ms",
  "delay_ms",
  "index",
  "times",
  "max_attempts",
  "width",
  "height",
  "latitude",
  "longitude",
]);

const NESTED_STEP_KEYS = new Set([
  "steps",
  "then_steps",
  "else_steps",
  "try_steps",
  "success_steps",
  "error_steps",
  "finally_steps",
  "primary_steps",
  "fallback_steps",
  "failed_steps",
  "timeout_steps",
  "cases",
  "choices",
  "condition",
]);

export function resolveObjectTemplates(
  val: any,
  outputs: Record<string, unknown>,
  parentKey?: string,
): any {
  if (val === null || val === undefined) return val;

  if (typeof val === "string") {
    const rendered = renderTemplate(val, outputs);
    if (parentKey && NUMERIC_KEYS.has(parentKey)) {
      const parsed = Number(rendered);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return rendered;
  }

  if (Array.isArray(val)) {
    return val.map((item) => resolveObjectTemplates(item, outputs, parentKey));
  }

  if (typeof val === "object") {
    const result: any = {};
    for (const [key, child] of Object.entries(val)) {
      if (NESTED_STEP_KEYS.has(key)) {
        result[key] = child;
      } else {
        result[key] = resolveObjectTemplates(child, outputs, key);
      }
    }
    return result;
  }

  return val;
}

export function findReferencedVariables(val: any, refs: Set<string>): void {
  if (val === null || val === undefined) return;
  if (typeof val === "string") {
    const templateRegex = /\{\{\s*([^}]+?)\s*\}\}/g;
    let match;
    while ((match = templateRegex.exec(val)) !== null) {
      refs.add(match[1].trim());
    }
    const scriptRegex1 = /outputs\.([a-zA-Z_][a-zA-Z0-9_]*)/g;
    while ((match = scriptRegex1.exec(val)) !== null) {
      refs.add(match[1].trim());
    }
    const scriptRegex2 = /outputs\[['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]\]/g;
    while ((match = scriptRegex2.exec(val)) !== null) {
      refs.add(match[1].trim());
    }
    return;
  }
  if (Array.isArray(val)) {
    for (const item of val) {
      findReferencedVariables(item, refs);
    }
    return;
  }
  if (typeof val === "object") {
    if (val.kind === "variable_is_true" && typeof val.name === "string") {
      refs.add(val.name.trim());
    }
    for (const child of Object.values(val)) {
      findReferencedVariables(child, refs);
    }
  }
}

export async function ensureResolved(
  outputs: Record<string, unknown>,
  name: string,
  resolving = new Set<string>()
): Promise<void> {
  const resolvers = (outputs as any).__dynamicResolvers;
  if (!resolvers) return;
  const entry = resolvers.get(name);
  if (!entry) return;

  if (resolving.has(name)) {
    const path = Array.from(resolving).join(" -> ");
    throw new Error(`Circular dependency detected: ${path} -> ${name}`);
  }
  resolving.add(name);

  for (const dep of entry.dependencies) {
    await ensureResolved(outputs, dep, resolving);
  }

  const val = await entry.resolve();
  outputs[name] = val;
}

export async function resolveDynamicOutputs(
  outputs: Record<string, unknown>,
  target: any
): Promise<void> {
  const resolvers = (outputs as any).__dynamicResolvers;
  if (!resolvers || resolvers.size === 0) return;

  const referenced = new Set<string>();
  findReferencedVariables(target, referenced);

  if (referenced.size === 0) return;

  for (const name of referenced) {
    if (resolvers.has(name)) {
      await ensureResolved(outputs, name);
    }
  }
}


