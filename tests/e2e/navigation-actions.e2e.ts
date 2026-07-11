import { test, expect } from "./support/electronFixture";
import { createAndRunWorkflow, target } from "./support/workflows";

test.describe("desktop navigation and tab node execution", () => {
  test("runs back, forward, and reload nodes against browser history", async ({
    appWindow,
    fixtureServer,
  }, testInfo) => {
    testInfo.annotations.push(
      { type: "fixture route", description: "/history-a, /history-b, /reload" },
      {
        type: "nodes",
        description: "navigate, go_back, go_forward, reload, extract_text",
      },
      {
        type: "desktop depth",
        description: "Verifies browser history and reload behavior through the real runner page.",
      },
    );

    const { state } = await createAndRunWorkflow(appWindow, "E2E navigation history", [
      {
        id: "navigate-a",
        label: "Navigate A",
        config: { type: "navigate", config: { url: `${fixtureServer.baseUrl}/history-a` } },
      },
      {
        id: "navigate-b",
        label: "Navigate B",
        config: { type: "navigate", config: { url: `${fixtureServer.baseUrl}/history-b` } },
      },
      {
        id: "go-back",
        label: "Go Back",
        config: { type: "go_back", config: {} },
      },
      {
        id: "extract-back",
        label: "Extract Back",
        config: {
          type: "extract_text",
          config: { target: target("history-marker"), output_name: "history_back" },
        },
      },
      {
        id: "go-forward",
        label: "Go Forward",
        config: { type: "go_forward", config: {} },
      },
      {
        id: "extract-forward",
        label: "Extract Forward",
        config: {
          type: "extract_text",
          config: { target: target("history-marker"), output_name: "history_forward" },
        },
      },
      {
        id: "navigate-reload",
        label: "Navigate Reload",
        config: { type: "navigate", config: { url: `${fixtureServer.baseUrl}/reload` } },
      },
      {
        id: "reload",
        label: "Reload",
        config: { type: "reload", config: {} },
      },
      {
        id: "extract-reload",
        label: "Extract Reload",
        config: {
          type: "extract_text",
          config: { target: target("reload-marker"), output_name: "reload_marker" },
        },
      },
    ]);

    expect(state.outputs.history_back).toBe("history:a");
    expect(state.outputs.history_forward).toBe("history:b");
    expect(state.outputs.reload_marker).toBe("reload:2");
  });

  test("runs open, switch, and close tab nodes against active page markers", async ({
    appWindow,
    fixtureServer,
  }, testInfo) => {
    testInfo.annotations.push(
      { type: "fixture route", description: "/tab-home, /tab-a, /tab-b" },
      {
        type: "nodes",
        description: "navigate, open_new_tab, switch_tab, close_tab, extract_text",
      },
      {
        type: "desktop depth",
        description: "Verifies active tab selection and close behavior through the real browser context.",
      },
    );

    const { state } = await createAndRunWorkflow(appWindow, "E2E navigation tabs", [
      {
        id: "navigate-home",
        label: "Navigate Home",
        config: { type: "navigate", config: { url: `${fixtureServer.baseUrl}/tab-home` } },
      },
      {
        id: "open-tab-a",
        label: "Open Tab A",
        config: { type: "open_new_tab", config: { url: `${fixtureServer.baseUrl}/tab-a` } },
      },
      {
        id: "open-tab-b",
        label: "Open Tab B",
        config: { type: "open_new_tab", config: { url: `${fixtureServer.baseUrl}/tab-b` } },
      },
      {
        id: "switch-tab-a",
        label: "Switch Tab A",
        config: { type: "switch_tab", config: { index: 1 } },
      },
      {
        id: "extract-tab-a",
        label: "Extract Tab A",
        config: {
          type: "extract_text",
          config: { target: target("tab-marker"), output_name: "active_tab_a" },
        },
      },
      {
        id: "close-tab-b",
        label: "Close Tab B",
        config: { type: "close_tab", config: { index: 2 } },
      },
      {
        id: "switch-tab-home",
        label: "Switch Tab Home",
        config: { type: "switch_tab", config: { index: 0 } },
      },
      {
        id: "extract-tab-home",
        label: "Extract Tab Home",
        config: {
          type: "extract_text",
          config: { target: target("tab-marker"), output_name: "active_tab_home" },
        },
      },
    ]);

    expect(state.outputs.active_tab_a).toBe("tab:a");
    expect(state.outputs.active_tab_home).toBe("tab:home");
    expect(state.completed_step_ids).toEqual(
      expect.arrayContaining(["open-tab-a", "open-tab-b", "switch-tab-a", "close-tab-b"]),
    );
  });

  test("runs click and switch tab node", async ({
    appWindow,
    fixtureServer,
  }, testInfo) => {
    testInfo.annotations.push(
      { type: "fixture route", description: "/tab-home, /tab-a" },
      {
        type: "nodes",
        description: "navigate, click_and_switch_tab, extract_text",
      },
      {
        type: "desktop depth",
        description: "Verifies clicking a link to open a tab and switching context automatically.",
      },
    );

    const { state } = await createAndRunWorkflow(appWindow, "E2E click and switch tab", [
      {
        id: "navigate-home",
        label: "Navigate Home",
        config: { type: "navigate", config: { url: `${fixtureServer.baseUrl}/tab-home` } },
      },
      {
        id: "click-switch-tab",
        label: "Click Open Tab A",
        config: {
          type: "click_and_switch_tab",
          config: {
            xpath: "//*[@data-testid='open-tab-link']",
            timeout_ms: 30000,
          },
        },
      },
      {
        id: "extract-tab-a",
        label: "Extract Tab A",
        config: {
          type: "extract_text",
          config: { target: target("tab-marker"), output_name: "active_tab_a" },
        },
      },
    ]);

    expect(state.outputs.active_tab_a).toBe("tab:a");
    expect(state.completed_step_ids).toEqual(
      expect.arrayContaining(["navigate-home", "click-switch-tab", "extract-tab-a"]),
    );
  });
});
