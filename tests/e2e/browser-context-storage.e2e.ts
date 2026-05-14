import { test, expect } from "./support/electronFixture";
import { createAndRunWorkflow, target } from "./support/workflows";

test.describe("desktop browser context and storage node execution", () => {
  test("runs visible context, cookie, header, permission, and storage nodes", async ({
    appWindow,
    fixtureServer,
  }, testInfo) => {
    testInfo.annotations.push(
      { type: "fixture route", description: "/context-storage, /headers" },
      {
        type: "nodes",
        description:
          "navigate, set_viewport, set_local_storage, set_session_storage, set_cookie, clear_cookies, set_extra_headers, grant_permission, set_geolocation, execute_js, extract_text",
      },
      {
        type: "desktop depth",
        description: "Verifies browser context and storage mutations through real page-visible state.",
      },
    );

    const origin = fixtureServer.baseUrl;
    const hostname = new URL(fixtureServer.baseUrl).hostname;
    const { state } = await createAndRunWorkflow(appWindow, "E2E browser context storage", [
      {
        id: "navigate-context",
        label: "Navigate Context",
        config: { type: "navigate", config: { url: `${fixtureServer.baseUrl}/context-storage` } },
      },
      {
        id: "set-viewport",
        label: "Set Viewport",
        config: {
          type: "set_viewport",
          config: { width: 900, height: 700, mobile: false, touch: false },
        },
      },
      {
        id: "read-viewport",
        label: "Read Viewport",
        config: {
          type: "execute_js",
          config: {
            script: "return window.innerWidth + 'x' + window.innerHeight;",
            output_name: "viewport_size",
          },
        },
      },
      {
        id: "set-local",
        label: "Set Local Storage",
        config: { type: "set_local_storage", config: { key: "localFlag", value: "local-value" } },
      },
      {
        id: "set-session",
        label: "Set Session Storage",
        config: { type: "set_session_storage", config: { key: "sessionFlag", value: "session-value" } },
      },
      {
        id: "read-storage",
        label: "Read Storage",
        config: {
          type: "execute_js",
          config: {
            script:
              "return window.localStorage.getItem('localFlag') + '|' + window.sessionStorage.getItem('sessionFlag');",
            output_name: "storage_values",
          },
        },
      },
      {
        id: "set-cookie",
        label: "Set Cookie",
        config: {
          type: "set_cookie",
          config: { name: "e2e_cookie", value: "cookie-value", domain: hostname, path: "/" },
        },
      },
      {
        id: "read-cookie",
        label: "Read Cookie",
        config: {
          type: "execute_js",
          config: { script: "return document.cookie;", output_name: "cookie_before_clear" },
        },
      },
      {
        id: "clear-cookie",
        label: "Clear Cookie",
        config: { type: "clear_cookies", config: { domain: hostname } },
      },
      {
        id: "read-cookie-cleared",
        label: "Read Cookie Cleared",
        config: {
          type: "execute_js",
          config: { script: "return document.cookie;", output_name: "cookie_after_clear" },
        },
      },
      {
        id: "set-headers",
        label: "Set Headers",
        config: {
          type: "set_extra_headers",
          config: { headers: [{ name: "x-e2e-context", value: "header-value" }] },
        },
      },
      {
        id: "navigate-headers",
        label: "Navigate Headers",
        config: { type: "navigate", config: { url: `${fixtureServer.baseUrl}/headers` } },
      },
      {
        id: "extract-header",
        label: "Extract Header",
        config: {
          type: "extract_text",
          config: { target: target("header-marker"), output_name: "header_marker" },
        },
      },
      {
        id: "grant-geolocation",
        label: "Grant Geolocation",
        config: { type: "grant_permission", config: { origin, permissions: ["geolocation"] } },
      },
      {
        id: "set-geolocation",
        label: "Set Geolocation",
        config: { type: "set_geolocation", config: { latitude: 10, longitude: 20, accuracy: 5 } },
      },
      {
        id: "read-geolocation",
        label: "Read Geolocation",
        config: {
          type: "execute_js",
          config: {
            script: `
              return new Promise((resolve) => {
                navigator.geolocation.getCurrentPosition(
                  (position) => resolve(Math.round(position.coords.latitude) + ':' + Math.round(position.coords.longitude)),
                  (error) => resolve('error:' + error.code),
                );
              });
            `,
            output_name: "geolocation_value",
          },
        },
      },
    ]);

    expect(state.outputs.viewport_size).toBe("900x700");
    expect(state.outputs.storage_values).toBe("local-value|session-value");
    expect(String(state.outputs.cookie_before_clear)).toContain("e2e_cookie=cookie-value");
    expect(String(state.outputs.cookie_after_clear)).not.toContain("e2e_cookie=cookie-value");
    expect(state.outputs.header_marker).toBe("header:header-value");
    expect(state.outputs.geolocation_value).toBe("10:20");
  });
});
