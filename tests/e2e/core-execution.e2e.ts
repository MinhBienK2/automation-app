import { test, expect } from "./support/electronFixture";
import { createAndRunWorkflow, target } from "./support/workflows";

test.describe("desktop workflow node execution", () => {
  test("runs navigation, click, wait, and extract text through the desktop runtime", async ({
    appWindow,
    fixtureServer,
  }, testInfo) => {
    testInfo.annotations.push(
      {
        type: "fixture route",
        description: "/basic",
      },
      {
        type: "nodes",
        description: "navigate, click, wait(text_visible), extract_text",
      },
      {
        type: "desktop depth",
        description: "Proves saved graph execution crosses renderer IPC, backend commands, SQLite, and runner.",
      },
    );

    const { state } = await createAndRunWorkflow(appWindow, "E2E basic execution", [
      {
        id: "navigate-basic",
        label: "Navigate Basic",
        config: { type: "navigate", config: { url: `${fixtureServer.baseUrl}/basic` } },
      },
      {
        id: "click-toggle",
        label: "Click Toggle",
        config: { type: "click", config: { target: target("toggle") } },
      },
      {
        id: "wait-clicked",
        label: "Wait Clicked",
        config: { type: "wait", config: { condition: "text_visible", text: "clicked" } },
      },
      {
        id: "extract-status",
        label: "Extract Status",
        config: {
          type: "extract_text",
          config: { target: target("status"), output_name: "status_text" },
        },
      },
    ]);

    expect(state.outputs.status_text).toBe("clicked");
    expect(state.completed_step_ids).toEqual(
      expect.arrayContaining(["navigate-basic", "click-toggle", "wait-clicked", "extract-status"]),
    );
  });

  test("runs form field actions and extracts an observable submitted summary", async ({
    appWindow,
    fixtureServer,
  }, testInfo) => {
    testInfo.annotations.push(
      {
        type: "fixture route",
        description: "/form",
      },
      {
        type: "nodes",
        description:
          "navigate, input_text, clear_input, select_option, check, uncheck, toggle_checkbox, select_radio, submit_form, extract_text, extract_input_value",
      },
      {
        type: "desktop depth",
        description: "Covers user-authorable form node side effects through the real runner.",
      },
    );

    const { state } = await createAndRunWorkflow(appWindow, "E2E form execution", [
      {
        id: "navigate-form",
        label: "Navigate Form",
        config: { type: "navigate", config: { url: `${fixtureServer.baseUrl}/form` } },
      },
      {
        id: "fill-email",
        label: "Fill Email",
        config: {
          type: "input_text",
          config: { target: target("email"), text: "qa@example.test", clear_before_input: true },
        },
      },
      {
        id: "clear-field",
        label: "Clear Field",
        config: { type: "clear_input", config: { target: target("clear-me") } },
      },
      {
        id: "select-plan",
        label: "Select Plan",
        config: {
          type: "select_option",
          config: { target: target("plan"), match_by: "label", value: "Team" },
        },
      },
      {
        id: "check-agree",
        label: "Check Agree",
        config: { type: "check", config: { target: target("agree") } },
      },
      {
        id: "uncheck-newsletter",
        label: "Uncheck Newsletter",
        config: { type: "uncheck", config: { target: target("newsletter") } },
      },
      {
        id: "toggle-box",
        label: "Toggle Box",
        config: { type: "toggle_checkbox", config: { target: target("toggle") } },
      },
      {
        id: "select-radio",
        label: "Select Radio",
        config: { type: "select_radio", config: { target: target("role-admin") } },
      },
      {
        id: "submit-form",
        label: "Submit Form",
        config: { type: "submit_form", config: { target: target("submit") } },
      },
      {
        id: "extract-summary",
        label: "Extract Summary",
        config: {
          type: "extract_text",
          config: { target: target("summary"), output_name: "summary_text" },
        },
      },
      {
        id: "extract-email",
        label: "Extract Email",
        config: {
          type: "extract_input_value",
          config: { target: target("email"), output_name: "email_value" },
        },
      },
    ]);

    expect(state.outputs.email_value).toBe("qa@example.test");
    expect(state.outputs.summary_text).toContain("email=qa@example.test");
    expect(state.outputs.summary_text).toContain("clear=");
    expect(state.outputs.summary_text).toContain("plan=Team");
    expect(state.outputs.summary_text).toContain("agree=true");
    expect(state.outputs.summary_text).toContain("newsletter=false");
    expect(state.outputs.summary_text).toContain("toggle=true");
    expect(state.outputs.summary_text).toContain("role=admin");
    expect(state.outputs.summary_text).toContain("status=submitted");
  });
});
