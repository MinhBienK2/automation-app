// @vitest-environment node

import { describe, expect, test } from "vitest";
import {
  renderTemplate,
  resolveObjectTemplates,
  setVariables,
  writeVariableValue,
  findReferencedVariables,
  resolveDynamicOutputs,
  getDeepValue,
} from "./variables";

describe("runner variable helpers", () => {
  test("getDeepValue resolves nested paths", () => {
    const outputs = {
      user: {
        name: "Ada",
        details: {
          age: 30,
          hobbies: ["coding"],
        },
      },
      "flat.key": "flat value",
    };

    expect(getDeepValue(outputs, "user.name")).toBe("Ada");
    expect(getDeepValue(outputs, "user.details.age")).toBe(30);
    expect(getDeepValue(outputs, "user.details.hobbies")).toEqual(["coding"]);
    expect(getDeepValue(outputs, "flat.key")).toBe("flat value");
    expect(getDeepValue(outputs, "user.details.invalid")).toBeUndefined();
    expect(getDeepValue(outputs, "invalid.path")).toBeUndefined();
  });

  test("renders template tokens with deep path resolution", () => {
    const outputs = {
      user: {
        name: "Ada",
        details: {
          age: 30,
        },
      },
    };
    expect(renderTemplate("Hello {{ user.name }} ({{ user.details.age }})", outputs))
      .toBe("Hello Ada (30)");
  });

  test("writes object values as root outputs without flattening", () => {
    const outputs: Record<string, unknown> = {};

    writeVariableValue(outputs, "user", { email: "ada@example.test", flags: ["qa"] });

    expect(outputs.user).toEqual({ email: "ada@example.test", flags: ["qa"] });
    expect(outputs["user.email"]).toBeUndefined();
    expect(outputs["user.flags"]).toBeUndefined();
  });

  test("sets typed variable rows with template rendering", () => {
    const outputs: Record<string, unknown> = { base: "4" };

    setVariables(outputs, {
      name: null,
      value: null,
      value_type: null,
      variables: [
        { name: "count", value_type: "number", value: "{{base}}" },
        { name: "enabled", value_type: "boolean", value: "true" },
        { name: "payload", value_type: "json", value: "{\"ok\":true}" },
      ],
    });

    expect(outputs.count).toBe(4);
    expect(outputs.enabled).toBe(true);
    expect(outputs.payload).toEqual({ ok: true });
    expect(outputs["payload.ok"]).toBeUndefined();
  });

  test("does not evaluate =() math expressions for number variables", () => {
    const outputs: Record<string, unknown> = { count: 3 };

    setVariables(outputs, {
      name: null,
      value: null,
      value_type: null,
      variables: [
        { name: "next_count", value_type: "number", value: "={{count}} + 1" },
        { name: "complex_math", value_type: "number", value: "=2 * (5 + 3)" },
        { name: "plain_number", value_type: "number", value: "42" },
        { name: "templated_number", value_type: "number", value: "{{count}}" },
      ],
    });

    expect(outputs.next_count).toBeNaN();
    expect(outputs.complex_math).toBeNaN();
    expect(outputs.plain_number).toBe(42);
    expect(outputs.templated_number).toBe(3);
  });

  test("keeps text fields literal including former math prefixes", () => {
    const outputs: Record<string, unknown> = {};

    setVariables(outputs, {
      name: null,
      value: null,
      value_type: null,
      variables: [
        { name: "date_val", value_type: "text", value: "2026-06-13" },
        { name: "phone_val", value_type: "text", value: "09-123-456" },
        { name: "math_as_text", value_type: "text", value: "1 + 2" },
        { name: "math_prefix_text", value_type: "text", value: "=1 + 2" },
      ],
    });

    expect(outputs.date_val).toBe("2026-06-13");
    expect(outputs.phone_val).toBe("09-123-456");
    expect(outputs.math_as_text).toBe("1 + 2");
    expect(outputs.math_prefix_text).toBe("=1 + 2");
  });

  test("resolves template tokens in check_conditions script config", () => {
    const config = {
      output_name: "is_valid",
      mode: "script",
      script: "{{counter}} > 5 && outputs.status === '{{status}}'",
      rules_group: undefined,
    };
    const outputs = { counter: 10, status: "active" };

    const resolved = resolveObjectTemplates(config, outputs);

    expect(resolved.script).toBe("10 > 5 && outputs.status === 'active'");
    expect(resolved.output_name).toBe("is_valid");
    expect(resolved.mode).toBe("script");
  });

  test("finds referenced variables in templates and scripts", () => {
    const refs = new Set<string>();
    findReferencedVariables("Hello {{ name }} and {{ user.email }}", refs);
    findReferencedVariables("outputs.status === 'active'", refs);
    findReferencedVariables("outputs['config_value']", refs);
    findReferencedVariables({ kind: "variable_is_true", name: "is_verified" }, refs);
    expect(Array.from(refs)).toEqual(["name", "user.email", "status", "config_value", "is_verified"]);
  });

  test("recursively resolves dynamic variables and detects circular dependencies", async () => {
    const outputs: Record<string, unknown> = {};
    const resolvers = new Map<string, { dependencies: string[]; resolve: () => Promise<any> }>();
    Object.defineProperty(outputs, "__dynamicResolvers", {
      value: resolvers,
      writable: true,
      enumerable: false,
    });

    resolvers.set("a", {
      dependencies: ["b"],
      resolve: async () => (outputs.b as number) + 1,
    });
    resolvers.set("b", {
      dependencies: [],
      resolve: async () => 10,
    });

    await resolveDynamicOutputs(outputs, "{{a}}");
    expect(outputs.a).toBe(11);
    expect(outputs.b).toBe(10);

    // Circular dependency check
    resolvers.set("c", { dependencies: ["d"], resolve: async () => 1 });
    resolvers.set("d", { dependencies: ["c"], resolve: async () => 2 });
    await expect(resolveDynamicOutputs(outputs, "{{c}}")).rejects.toThrow("Circular dependency detected");
  });
});
