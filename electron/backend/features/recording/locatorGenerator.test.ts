// @vitest-environment node

import { describe, expect, test } from "vitest";
import type { RecordingTarget } from "../../../../src/types/workflow";
import { generateElementTarget } from "./locatorGenerator";

describe("generateElementTarget", () => {
  test("orders semantic locator candidates ahead of css and xpath fallbacks", () => {
    const target: RecordingTarget = {
      tag_name: "button",
      accessible_name: "Submit order",
      text_sample: "Submit order",
      role: "button",
      locators: [
        { kind: "xpath", value: "//*[@id='submit']", score: 0.95, reason: "XPath fallback" },
        { kind: "css", value: "#submit", score: 0.85, reason: "Element id" },
        {
          kind: "role",
          value: "button",
          name: "Submit order",
          score: 0.8,
          reason: "Accessible role",
        },
        {
          kind: "test_id",
          value: "submit-order",
          score: 0.7,
          reason: "Stable test id",
        },
      ],
    };

    const result = generateElementTarget(target);

    expect(result.confidence).toBe("high");
    expect(result.target).toEqual({
      locators: [
        { kind: "test_id", value: "submit-order" },
        { kind: "role", value: "Submit order", role: "button", exact: true },
        { kind: "css", value: "#submit" },
        { kind: "xpath", value: "//*[@id='submit']" },
      ],
      constraints: { visible: true, enabled: true },
      iframe: null,
    });
    expect(result.warnings).toEqual([]);
  });

  test("creates a low-confidence fallback when no stable locator is available", () => {
    const result = generateElementTarget({
      tag_name: "div",
      text_sample: "This is a very long generated marketing block that should not be used as a stable text locator because it is noisy.",
      locators: [],
    });

    expect(result.confidence).toBe("low");
    expect(result.target.locators).toEqual([{ kind: "css", value: "div" }]);
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: "weak_locator",
        severity: "warning",
      }),
    ]);
  });
});
