// @vitest-environment node

import { describe, expect, test } from "vitest";
import {
  evaluateMathInObject,
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

  test("evaluates simple math expressions for number type variables", () => {
    const outputs: Record<string, unknown> = { count: 3 };

    setVariables(outputs, {
      name: null,
      value: null,
      value_type: null,
      variables: [
        { name: "next_count", value_type: "number", value: "={{count}} + 1" },
        { name: "complex_math", value_type: "number", value: "=2 * (5 + 3)" },
        { name: "decimal_math", value_type: "number", value: "=1.5 * 2" },
        { name: "non_prefixed_math", value_type: "number", value: "5 + 5" },
      ],
    });

    expect(outputs.next_count).toBe(4);
    expect(outputs.complex_math).toBe(16);
    expect(outputs.decimal_math).toBe(3);
    expect(outputs.non_prefixed_math).toBeNaN();
  });

  test("does not evaluate math expressions on non-number fields", () => {
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

  test("evaluates math expressions inside set_json_variables but preserves phone/dates", () => {
    const input = {
      nested: {
        counter: "=5 + 1",
        not_math: "hello",
        date: "2026-06-13",
        phone: "091-234-5678",
        negative_num: "-123",
        math_with_minus: "=10 - 2",
        plain_text_math: "10 -2",
      },
      array: ["=1 + 1", "hello"],
    };
    const result = evaluateMathInObject(input);

    expect(result.nested.counter).toBe(6);
    expect(result.nested.not_math).toBe("hello");
    expect(result.nested.date).toBe("2026-06-13");
    expect(result.nested.phone).toBe("091-234-5678");
    expect(result.nested.negative_num).toBe("-123");
    expect(result.nested.math_with_minus).toBe(8);
    expect(result.nested.plain_text_math).toBe("10 -2");
    expect(result.array).toEqual([2, "hello"]);
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
