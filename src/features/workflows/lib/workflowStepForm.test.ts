import { describe, expect, test } from "vitest";
import type { ActionConfig } from "../../../types/workflow";
import { updateActionConfigField } from "./workflowStepForm";

describe("workflow step form config helpers", () => {
  test("updates sleep seconds as a number", () => {
    const config: ActionConfig = { type: "sleep", config: { seconds: 1 } };

    expect(updateActionConfigField(config, "seconds", "2.5")).toEqual({
      type: "sleep",
      config: { seconds: 2.5 },
    });
  });

  test("updates type text xpath without dropping the text value", () => {
    const config: ActionConfig = {
      type: "type_text",
      config: { xpath: "//input", text: "hello" },
    };

    expect(updateActionConfigField(config, "xpath", "//textarea")).toEqual({
      type: "type_text",
      config: { xpath: "//textarea", text: "hello" },
    });
  });

  test("updates scroll direction and pixels with typed values", () => {
    const config: ActionConfig = {
      type: "scroll",
      config: { direction: "down", pixels: 300 },
    };

    expect(updateActionConfigField(config, "direction", "up")).toEqual({
      type: "scroll",
      config: { direction: "up", pixels: 300 },
    });
    expect(updateActionConfigField(config, "pixels", "800")).toEqual({
      type: "scroll",
      config: { direction: "down", pixels: 800 },
    });
  });

  test("updates advanced scroll fields without dropping legacy fields", () => {
    const config: ActionConfig = {
      type: "scroll",
      config: { direction: "down", pixels: 300 },
    };

    expect(updateActionConfigField(config, "mode", "until_visible")).toEqual({
      type: "scroll",
      config: { mode: "until_visible", direction: "down", pixels: 300 },
    });
    expect(updateActionConfigField(config, "xpath", "//*[@id='target']")).toEqual({
      type: "scroll",
      config: {
        direction: "down",
        pixels: 300,
        xpath: "//*[@id='target']",
      },
    });
    expect(updateActionConfigField(config, "max_attempts", "5")).toEqual({
      type: "scroll",
      config: { direction: "down", pixels: 300, max_attempts: 5 },
    });
  });
});
