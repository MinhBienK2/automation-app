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

  test("updates phase one human interaction configs with typed values", () => {
    const typeSequenceConfig: ActionConfig = {
      type: "type_sequence",
      config: {
        xpath: "//*[@name='search']",
        text: "old",
      },
    };
    const dragConfig: ActionConfig = {
      type: "drag_and_drop",
      config: {
        source_xpath: "//*[@id='source']",
        target_xpath: "//*[@id='target']",
      },
    };
    const setClipboardConfig: ActionConfig = {
      type: "set_clipboard",
      config: { text: "old" },
    };
    const pasteClipboardConfig: ActionConfig = {
      type: "paste_clipboard",
      config: { xpath: "//*[@name='notes']" },
    };

    expect(updateActionConfigField(typeSequenceConfig, "delay_ms", "25")).toEqual({
      type: "type_sequence",
      config: {
        xpath: "//*[@name='search']",
        text: "old",
        delay_ms: 25,
      },
    });
    expect(updateActionConfigField(dragConfig, "source_xpath", "//*[@id='card']")).toEqual({
      type: "drag_and_drop",
      config: {
        source_xpath: "//*[@id='card']",
        target_xpath: "//*[@id='target']",
      },
    });
    expect(updateActionConfigField(setClipboardConfig, "text", "new text")).toEqual({
      type: "set_clipboard",
      config: { text: "new text" },
    });
    expect(updateActionConfigField(pasteClipboardConfig, "timeout_ms", "3000")).toEqual({
      type: "paste_clipboard",
      config: {
        xpath: "//*[@name='notes']",
        timeout_ms: 3000,
      },
    });
  });

  test("updates phase two form and file configs with typed values", () => {
    const uploadConfig: ActionConfig = {
      type: "upload_file",
      config: {
        xpath: "//*[@id='file']",
        files: ["/tmp/a.txt"],
      },
    };
    const submitConfig: ActionConfig = {
      type: "submit_form",
      config: {},
    };
    const customSelectConfig: ActionConfig = {
      type: "select_custom_option",
      config: {
        trigger_xpath: "//*[@role='combobox']",
        option_text: "Old",
      },
    };
    const editableConfig: ActionConfig = {
      type: "set_contenteditable",
      config: {
        xpath: "//*[@contenteditable='true']",
        text: "Old",
        clear_before_input: true,
      },
    };

    expect(updateActionConfigField(uploadConfig, "files", "/tmp/a.txt\n/tmp/b.txt")).toEqual({
      type: "upload_file",
      config: {
        xpath: "//*[@id='file']",
        files: ["/tmp/a.txt", "/tmp/b.txt"],
      },
    });
    expect(updateActionConfigField(submitConfig, "xpath", "//*[@id='login']")).toEqual({
      type: "submit_form",
      config: { xpath: "//*[@id='login']" },
    });
    expect(updateActionConfigField(customSelectConfig, "option_text", "Vietnam")).toEqual({
      type: "select_custom_option",
      config: {
        trigger_xpath: "//*[@role='combobox']",
        option_text: "Vietnam",
      },
    });
    expect(updateActionConfigField(editableConfig, "clear_before_input", "false")).toEqual({
      type: "set_contenteditable",
      config: {
        xpath: "//*[@contenteditable='true']",
        text: "Old",
        clear_before_input: false,
      },
    });
  });
});
