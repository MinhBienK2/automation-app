import path from "node:path";
import { test, expect } from "./support/electronFixture";
import { createAndRunWorkflow, target } from "./support/workflows";

test.describe("desktop extended form node execution", () => {
  test("runs upload, custom select, and contenteditable nodes", async ({
    appWindow,
    fixtureServer,
  }, testInfo) => {
    testInfo.annotations.push(
      { type: "fixture route", description: "/extended-form" },
      {
        type: "nodes",
        description:
          "navigate, upload_file, select_custom_option, set_contenteditable, extract_text",
      },
      {
        type: "desktop depth",
        description: "Verifies advanced form side effects through real browser form controls.",
      },
    );

    const uploadFile = path.resolve("tests/e2e/fixtures/upload-note.txt");
    const { state } = await createAndRunWorkflow(appWindow, "E2E extended form execution", [
      {
        id: "navigate-extended-form",
        label: "Navigate Extended Form",
        config: { type: "navigate", config: { url: `${fixtureServer.baseUrl}/extended-form` } },
      },
      {
        id: "upload-file",
        label: "Upload File",
        config: { type: "upload_file", config: { target: target("upload-input"), files: [uploadFile] } },
      },
      {
        id: "select-custom",
        label: "Select Custom",
        config: {
          type: "select_custom_option",
          config: { trigger_target: target("custom-trigger"), option_text: "Delta" },
        },
      },
      {
        id: "set-rich-text",
        label: "Set Rich Text",
        config: {
          type: "set_contenteditable",
          config: { target: target("rich-editor"), text: "Hello rich text", clear_before_input: true },
        },
      },
      {
        id: "extract-upload",
        label: "Extract Upload",
        config: {
          type: "extract_text",
          config: { target: target("upload-status"), output_name: "upload_status" },
        },
      },
      {
        id: "extract-custom",
        label: "Extract Custom",
        config: {
          type: "extract_text",
          config: { target: target("custom-status"), output_name: "custom_status" },
        },
      },
      {
        id: "extract-rich",
        label: "Extract Rich Text",
        config: {
          type: "extract_text",
          config: { target: target("rich-editor"), output_name: "rich_text" },
        },
      },
    ]);

    expect(state.outputs.upload_status).toBe("upload:upload-note.txt");
    expect(state.outputs.custom_status).toBe("custom:Delta");
    expect(state.outputs.rich_text).toBe("Hello rich text");
  });
});
