import { test, expect } from "./support/electronFixture";
import { createAndRunWorkflow, target } from "./support/workflows";

test.describe("desktop keyboard, clipboard, focus, and dialog node execution", () => {
  test("runs focus, blur, key, hotkey, clipboard, paste, and type sequence nodes", async ({
    appWindow,
    fixtureServer,
  }, testInfo) => {
    testInfo.annotations.push(
      { type: "fixture route", description: "/keyboard" },
      {
        type: "nodes",
        description:
          "navigate, focus_element, blur_element, press_key, hotkey, set_clipboard, paste_clipboard, type_sequence, extract_text, extract_input_value",
      },
      {
        type: "desktop depth",
        description: "Verifies keyboard and clipboard side effects through the real browser page.",
      },
    );

    const { state } = await createAndRunWorkflow(appWindow, "E2E keyboard execution", [
      {
        id: "navigate-keyboard",
        label: "Navigate Keyboard",
        config: { type: "navigate", config: { url: `${fixtureServer.baseUrl}/keyboard` } },
      },
      {
        id: "focus-input",
        label: "Focus Input",
        config: { type: "focus_element", config: { target: target("focus-input") } },
      },
      {
        id: "blur-input",
        label: "Blur Input",
        config: { type: "blur_element", config: { target: target("focus-input") } },
      },
      {
        id: "focus-paste",
        label: "Focus Paste",
        config: { type: "focus_element", config: { target: target("paste-input") } },
      },
      {
        id: "press-enter",
        label: "Press Enter",
        config: { type: "press_key", config: { key: "Enter" } },
      },
      {
        id: "hotkey",
        label: "Hotkey",
        config: { type: "hotkey", config: { keys: ["Control", "K"] } },
      },
      {
        id: "set-clipboard",
        label: "Set Clipboard",
        config: { type: "set_clipboard", config: { text: "clipboard text" } },
      },
      {
        id: "paste",
        label: "Paste",
        config: { type: "paste_clipboard", config: { target: target("paste-input") } },
      },
      {
        id: "type-sequence",
        label: "Type Sequence",
        config: { type: "type_sequence", config: { target: target("sequence-input"), text: "typed keys" } },
      },
      {
        id: "extract-status",
        label: "Extract Status",
        config: {
          type: "extract_text",
          config: { target: target("keyboard-status"), output_name: "keyboard_status" },
        },
      },
      {
        id: "extract-paste",
        label: "Extract Paste",
        config: {
          type: "extract_input_value",
          config: { target: target("paste-input"), output_name: "paste_value" },
        },
      },
      {
        id: "extract-sequence",
        label: "Extract Sequence",
        config: {
          type: "extract_input_value",
          config: { target: target("sequence-input"), output_name: "sequence_value" },
        },
      },
    ]);

    expect(state.outputs.keyboard_status).toBe("hotkey");
    expect(state.outputs.paste_value).toBe("clipboard text");
    expect(state.outputs.sequence_value).toBe("typed keys");
  });

  test("accepts prompts and dismisses confirms through dialog nodes", async ({
    appWindow,
    fixtureServer,
  }, testInfo) => {
    testInfo.annotations.push(
      { type: "fixture route", description: "/dialog" },
      {
        type: "nodes",
        description: "navigate, accept_dialog, dismiss_dialog, click, wait, extract_text",
      },
      {
        type: "desktop depth",
        description: "Verifies one-shot browser dialog handlers through the desktop runner.",
      },
    );

    const { state } = await createAndRunWorkflow(appWindow, "E2E dialog execution", [
      {
        id: "navigate-dialog",
        label: "Navigate Dialog",
        config: { type: "navigate", config: { url: `${fixtureServer.baseUrl}/dialog` } },
      },
      {
        id: "accept-prompt",
        label: "Accept Prompt",
        config: { type: "accept_dialog", config: { prompt_text: "Ada" } },
      },
      {
        id: "click-prompt",
        label: "Click Prompt",
        config: { type: "click", config: { target: target("prompt-button") } },
      },
      {
        id: "wait-prompt",
        label: "Wait Prompt",
        config: { type: "wait", config: { condition: "text_visible", text: "prompt:Ada" } },
      },
      {
        id: "dismiss-confirm",
        label: "Dismiss Confirm",
        config: { type: "dismiss_dialog", config: {} },
      },
      {
        id: "click-confirm",
        label: "Click Confirm",
        config: { type: "click", config: { target: target("confirm-button") } },
      },
      {
        id: "wait-confirm",
        label: "Wait Confirm",
        config: { type: "wait", config: { condition: "text_visible", text: "confirm:false" } },
      },
      {
        id: "extract-dialog",
        label: "Extract Dialog",
        config: {
          type: "extract_text",
          config: { target: target("dialog-status"), output_name: "dialog_status" },
        },
      },
    ]);

    expect(state.outputs.dialog_status).toBe("confirm:false");
    expect(state.completed_step_ids).toEqual(
      expect.arrayContaining(["accept-prompt", "dismiss-confirm", "extract-dialog"]),
    );
  });
});
