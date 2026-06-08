import { describe, expect, test } from "vitest";
import {
  arrayConfig,
  booleanConfig,
  numberConfig,
  objectConfig,
  stringConfig,
} from "./configUtils";

describe("workflow config utils", () => {
  test("normalizes config objects without accepting arrays", () => {
    expect(objectConfig({ label: "Start" })).toEqual({ label: "Start" });
    expect(objectConfig(null)).toEqual({});
    expect(objectConfig(["not", "a", "config"])).toEqual({});
  });

  test("reads primitive config fields without coercion", () => {
    const config = {
      label: "Action",
      retry: 3,
      enabled: true,
      stringNumber: "3",
      tags: ["a", 2, false],
    };

    expect(stringConfig(config, "label", "fallback")).toBe("Action");
    expect(stringConfig(config, "missing", "fallback")).toBe("fallback");
    expect(numberConfig(config, "retry", 0)).toBe(3);
    expect(numberConfig(config, "stringNumber", 0)).toBe(0);
    expect(booleanConfig(config, "enabled", false)).toBe(true);
    expect(booleanConfig(config, "missing", false)).toBe(false);
    expect(arrayConfig(config, "tags")).toEqual(["a", "2", "false"]);
    expect(arrayConfig(config, "label")).toEqual([]);
  });
});
