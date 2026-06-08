// @vitest-environment node

import { describe, expect, test } from "vitest";
import {
  renderTemplate,
  setVariables,
  writeVariableValue,
} from "./variables";

describe("runner variable helpers", () => {
  test("renders template tokens from output keys", () => {
    expect(renderTemplate("Hello {{ user.name }}", { "user.name": "Ada" }))
      .toBe("Hello Ada");
  });

  test("writes object values as both root and dotted outputs", () => {
    const outputs: Record<string, unknown> = {};

    writeVariableValue(outputs, "user", { email: "ada@example.test", flags: ["qa"] });

    expect(outputs.user).toEqual({ email: "ada@example.test", flags: ["qa"] });
    expect(outputs["user.email"]).toBe("ada@example.test");
    expect(outputs["user.flags"]).toEqual(["qa"]);
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
    expect(outputs["payload.ok"]).toBe(true);
  });
});
