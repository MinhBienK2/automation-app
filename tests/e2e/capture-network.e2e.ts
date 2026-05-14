import fs from "node:fs/promises";
import path from "node:path";
import { test, expect } from "./support/electronFixture";
import { createAndRunWorkflow, target } from "./support/workflows";

test.describe("desktop capture and network node execution", () => {
  test("captures text, attributes, inputs, lists, screenshots, and downloads", async ({
    appDataDir,
    appWindow,
    fixtureServer,
  }, testInfo) => {
    testInfo.annotations.push(
      { type: "fixture route", description: "/capture" },
      {
        type: "nodes",
        description:
          "navigate, extract_text, extract_attribute, extract_input_value, extract_list, extract_table, take_screenshot, execute_js, wait_for_download",
      },
      {
        type: "desktop depth",
        description: "Verifies output capture and evidence artifacts through Electron and the real runner.",
      },
    );

    const { state } = await createAndRunWorkflow(appWindow, "E2E capture execution", [
      {
        id: "navigate-capture",
        label: "Navigate Capture",
        config: { type: "navigate", config: { url: `${fixtureServer.baseUrl}/capture` } },
      },
      {
        id: "extract-title",
        label: "Extract Title",
        config: {
          type: "extract_text",
          config: { target: target("capture-title"), output_name: "capture_title" },
        },
      },
      {
        id: "extract-attribute",
        label: "Extract Attribute",
        config: {
          type: "extract_attribute",
          config: {
            target: target("capture-title"),
            attribute: "data-status",
            output_name: "capture_status",
          },
        },
      },
      {
        id: "extract-input",
        label: "Extract Input",
        config: {
          type: "extract_input_value",
          config: { target: target("capture-input"), output_name: "capture_input" },
        },
      },
      {
        id: "extract-list",
        label: "Extract List",
        config: {
          type: "extract_list",
          config: { target: target("capture-item"), output_name: "capture_items" },
        },
      },
      {
        id: "extract-table",
        label: "Extract Table",
        config: {
          type: "extract_table",
          config: { target: target("capture-table"), output_name: "capture_table" },
        },
      },
      {
        id: "take-shot",
        label: "Take Screenshot",
        config: {
          type: "take_screenshot",
          config: { path: "capture-page.png", output_name: "capture_screenshot", full_page: false },
        },
      },
      {
        id: "trigger-download",
        label: "Trigger Download",
        config: {
          type: "execute_js",
          config: {
            script:
              "setTimeout(() => document.querySelector('[data-testid=\"download-report\"]').click(), 50); return 'scheduled';",
            output_name: "download_trigger",
          },
        },
      },
      {
        id: "wait-download",
        label: "Wait Download",
        config: { type: "wait_for_download", config: { output_name: "download_path" } },
      },
    ]);

    expect(state.outputs.capture_title).toBe("Capture Fixture");
    expect(state.outputs.capture_status).toBe("ready");
    expect(state.outputs.capture_input).toBe("field-value");
    expect(state.outputs.capture_items).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(state.outputs.capture_table).toEqual([
      ["Name", "Status"],
      ["Fixture", "Ready"],
    ]);
    expect(state.outputs.download_trigger).toBe("scheduled");
    expect(String(state.outputs.capture_screenshot)).toMatch(
      /^runs\/.+\/screenshots\/\d+-take-shot-capture-page\.png$/,
    );
    expect(String(state.outputs.download_path)).toMatch(
      /^runs\/.+\/downloads\/\d+-wait-download-owned-report\.csv$/,
    );

    const evidenceDir = path.join(appDataDir, "automation-app", "evidence");
    await expect(fs.stat(path.join(evidenceDir, String(state.outputs.capture_screenshot))))
      .resolves.toMatchObject({ size: expect.any(Number) });
    await expect(fs.stat(path.join(evidenceDir, String(state.outputs.download_path))))
      .resolves.toMatchObject({ size: expect.any(Number) });
  });

  test("runs request waits, route blocking, response mocking, and JavaScript outputs", async ({
    appWindow,
    fixtureServer,
  }, testInfo) => {
    testInfo.annotations.push(
      { type: "fixture route", description: "/network" },
      {
        type: "nodes",
        description:
          "navigate, execute_js, wait_for_request, wait_for_response, block_request, mock_response",
      },
      {
        type: "desktop depth",
        description: "Verifies network route actions and JavaScript outputs through the real browser context.",
      },
    );

    const { state } = await createAndRunWorkflow(appWindow, "E2E network execution", [
      {
        id: "navigate-network",
        label: "Navigate Network",
        config: { type: "navigate", config: { url: `${fixtureServer.baseUrl}/network` } },
      },
      {
        id: "page-title",
        label: "Page Title",
        config: {
          type: "execute_js",
          config: { script: "return document.title;", output_name: "network_title" },
        },
      },
      {
        id: "schedule-request",
        label: "Schedule Request",
        config: {
          type: "execute_js",
          config: {
            script: `setTimeout(() => fetch('${fixtureServer.baseUrl}/api/echo?q=request'), 250); return 'request scheduled';`,
            output_name: "request_schedule",
          },
        },
      },
      {
        id: "wait-request",
        label: "Wait Request",
        config: {
          type: "wait_for_request",
          config: { url_contains: "/api/echo?q=request" },
        },
      },
      {
        id: "schedule-response",
        label: "Schedule Response",
        config: {
          type: "execute_js",
          config: {
            script: `setTimeout(() => fetch('${fixtureServer.baseUrl}/api/echo?q=response'), 250); return 'response scheduled';`,
            output_name: "response_schedule",
          },
        },
      },
      {
        id: "wait-response",
        label: "Wait Response",
        config: {
          type: "wait_for_response",
          config: { url_contains: "/api/echo?q=response", status: 200 },
        },
      },
      {
        id: "block-route",
        label: "Block Route",
        config: {
          type: "block_request",
          config: { url_patterns: [`${fixtureServer.baseUrl}/api/blocked`] },
        },
      },
      {
        id: "fetch-blocked",
        label: "Fetch Blocked",
        config: {
          type: "execute_js",
          config: {
            script: `return fetch('${fixtureServer.baseUrl}/api/blocked').then(() => 'unexpected').catch(() => 'blocked');`,
            output_name: "blocked_result",
          },
        },
      },
      {
        id: "mock-route",
        label: "Mock Route",
        config: {
          type: "mock_response",
          config: {
            url_contains: `${fixtureServer.baseUrl}/api/mock`,
            status: 203,
            body: "mocked",
            content_type: "text/plain",
          },
        },
      },
      {
        id: "fetch-mocked",
        label: "Fetch Mocked",
        config: {
          type: "execute_js",
          config: {
            script: `return fetch('${fixtureServer.baseUrl}/api/mock').then(async (response) => response.status + ':' + await response.text());`,
            output_name: "mocked_result",
          },
        },
      },
    ]);

    expect(state.outputs.network_title).toBe("Network Fixture");
    expect(state.outputs.request_schedule).toBe("request scheduled");
    expect(state.outputs.response_schedule).toBe("response scheduled");
    expect(String(state.outputs.last_request_url)).toContain("/api/echo?q=request");
    expect(String(state.outputs.last_response_url)).toContain("/api/echo?q=response");
    expect(state.outputs.blocked_result).toBe("blocked");
    expect(state.outputs.mocked_result).toBe("203:mocked");
  });
});
