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

  test("updates advanced click fields without dropping the xpath", () => {
    const config: ActionConfig = {
      type: "click",
      config: { xpath: "//*[@id='submit']" },
    };

    expect(updateActionConfigField(config, "click_count", "2")).toEqual({
      type: "click",
      config: { xpath: "//*[@id='submit']", click_count: 2 },
    });
    expect(updateActionConfigField(config, "iframe_xpath", "//*[@id='frame']")).toEqual({
      type: "click",
      config: {
        xpath: "//*[@id='submit']",
        iframe_xpath: "//*[@id='frame']",
      },
    });
    expect(updateActionConfigField(config, "mode", "force_dom")).toEqual({
      type: "click",
      config: { xpath: "//*[@id='submit']", mode: "force_dom" },
    });
  });

  test("updates new taxonomy action fields without dropping existing config", () => {
    const inputConfig: ActionConfig = {
      type: "input_text",
      config: {
        xpath: "//*[@name='email']",
        text: "old",
        clear_before_input: true,
      },
    };
    const waitConfig: ActionConfig = {
      type: "wait",
      config: { condition: "duration", duration_ms: 1000 },
    };
    const hotkeyConfig: ActionConfig = {
      type: "hotkey",
      config: { keys: ["Control"] },
    };

    expect(updateActionConfigField(inputConfig, "typing_mode", "type")).toEqual({
      type: "input_text",
      config: {
        xpath: "//*[@name='email']",
        text: "old",
        clear_before_input: true,
        typing_mode: "type",
      },
    });
    expect(updateActionConfigField(waitConfig, "duration_ms", "2500")).toEqual({
      type: "wait",
      config: { condition: "duration", duration_ms: 2500 },
    });
    expect(updateActionConfigField(hotkeyConfig, "keys", "Control+S")).toEqual({
      type: "hotkey",
      config: { keys: ["Control", "S"] },
    });
  });
});
