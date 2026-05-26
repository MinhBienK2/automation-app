import { test, expect } from "./support/electronFixture";
import {
  createAndRunWorkflow,
  createAndRunWorkflowExpectingFailure,
  target,
} from "./support/workflows";

type ActionTrace = {
  node_id: string;
  started_at: string;
  finished_at: string;
};

test.describe("desktop wait and assertion node execution", () => {
  test("runs duration, random, element, text, URL waits, and passing assertions", async ({
    appWindow,
    fixtureServer,
  }, testInfo) => {
    testInfo.annotations.push(
      { type: "fixture route", description: "/wait-assertion" },
      {
        type: "nodes",
        description:
          "navigate, execute_js, wait(duration/page_load/text_visible/url_contains/element_visible/element_hidden/element_attached/element_detached/element_enabled/element_disabled), random_wait, assert_element states, assert_text modes, extract_text",
      },
      {
        type: "desktop depth",
        description: "Verifies user-visible waits and assertion pass semantics through run traces and page markers.",
      },
    );

    const { state } = await createAndRunWorkflow(appWindow, "E2E wait assertion execution", [
      {
        id: "navigate-wait-assertion",
        label: "Navigate Wait Assertion",
        config: { type: "navigate", config: { url: `${fixtureServer.baseUrl}/wait-assertion` } },
      },
      {
        id: "schedule-ready",
        label: "Schedule Ready",
        config: {
          type: "execute_js",
          config: {
            script: `
              window.__startedAt = performance.now();
              setTimeout(() => {
                document.querySelector('[data-testid="async-status"]').textContent = 'ready';
                history.pushState({}, '', '/wait-assertion-ready');
              }, 80);
              setTimeout(() => {
                document.querySelector('[data-testid="hide-me"]').hidden = true;
              }, 40);
              setTimeout(() => {
                document.querySelector('[data-testid="detach-me"]').remove();
              }, 60);
              setTimeout(() => {
                document.querySelector('[data-testid="enable-me"]').disabled = false;
                document.querySelector('[data-testid="disable-me"]').disabled = true;
              }, 70);
              return 'scheduled';
            `,
            output_name: "schedule_result",
          },
        },
      },
      {
        id: "wait-page-load",
        label: "Wait Page Load",
        config: { type: "wait", config: { condition: "page_load", timeout_ms: 5000 } },
      },
      {
        id: "wait-duration",
        label: "Wait Duration",
        config: { type: "wait", config: { condition: "duration", duration_ms: 100 } },
      },
      {
        id: "wait-random",
        label: "Random Wait",
        config: { type: "random_wait", config: { min_ms: 25, max_ms: 50 } },
      },
      {
        id: "wait-element",
        label: "Wait Element",
        config: { type: "wait", config: { condition: "element_visible", target: target("async-status") } },
      },
      {
        id: "wait-hidden",
        label: "Wait Hidden",
        config: { type: "wait", config: { condition: "element_hidden", target: target("hide-me") } },
      },
      {
        id: "wait-attached",
        label: "Wait Attached",
        config: { type: "wait", config: { condition: "element_attached", target: target("async-status") } },
      },
      {
        id: "wait-detached",
        label: "Wait Detached",
        config: { type: "wait", config: { condition: "element_detached", target: target("detach-me") } },
      },
      {
        id: "wait-enabled",
        label: "Wait Enabled",
        config: { type: "wait", config: { condition: "element_enabled", target: target("enable-me") } },
      },
      {
        id: "wait-disabled",
        label: "Wait Disabled",
        config: { type: "wait", config: { condition: "element_disabled", target: target("disable-me") } },
      },
      {
        id: "wait-text",
        label: "Wait Text",
        config: { type: "wait", config: { condition: "text_visible", text: "ready" } },
      },
      {
        id: "wait-url",
        label: "Wait URL",
        config: { type: "wait", config: { condition: "url_contains", url: "/wait-assertion-ready" } },
      },
      {
        id: "assert-visible",
        label: "Assert Visible",
        config: { type: "assert_element", config: { target: target("async-status"), state: "visible" } },
      },
      {
        id: "assert-hidden",
        label: "Assert Hidden",
        config: { type: "assert_element", config: { target: target("hide-me"), state: "hidden" } },
      },
      {
        id: "assert-attached",
        label: "Assert Attached",
        config: { type: "assert_element", config: { target: target("async-status"), state: "attached" } },
      },
      {
        id: "assert-enabled",
        label: "Assert Enabled",
        config: { type: "assert_element", config: { target: target("enable-me"), state: "enabled" } },
      },
      {
        id: "assert-disabled",
        label: "Assert Disabled",
        config: { type: "assert_element", config: { target: target("disable-me"), state: "disabled" } },
      },
      {
        id: "assert-text-contains",
        label: "Assert Text Contains",
        config: {
          type: "assert_text",
          config: { target: target("async-status"), text: "rea", match_mode: "contains" },
        },
      },
      {
        id: "assert-text",
        label: "Assert Text",
        config: {
          type: "assert_text",
          config: { target: target("async-status"), text: "ready", match_mode: "equals" },
        },
      },
      {
        id: "elapsed",
        label: "Elapsed",
        config: {
          type: "execute_js",
          config: {
            script: "return Math.round(performance.now() - window.__startedAt);",
            output_name: "elapsed_ms",
          },
        },
      },
      {
        id: "wait-state",
        label: "Wait State",
        config: {
          type: "execute_js",
          config: {
            script: `
              return [
                document.querySelector('[data-testid="async-status"]').textContent,
                document.querySelector('[data-testid="hide-me"]').hidden ? 'hidden' : 'visible',
                document.querySelector('[data-testid="detach-me"]') ? 'attached' : 'detached',
                document.querySelector('[data-testid="enable-me"]').disabled ? 'disabled' : 'enabled',
                document.querySelector('[data-testid="disable-me"]').disabled ? 'disabled' : 'enabled',
              ].join('|');
            `,
            output_name: "wait_state",
          },
        },
      },
      {
        id: "extract-status",
        label: "Extract Status",
        config: {
          type: "extract_text",
          config: { target: target("async-status"), output_name: "async_status" },
        },
      },
    ]);

    expect(state.outputs.schedule_result).toBe("scheduled");
    expect(state.outputs.async_status).toBe("ready");
    expect(state.outputs.wait_state).toBe("ready|hidden|detached|enabled|disabled");
    expect(Number(state.outputs.elapsed_ms)).toBeGreaterThanOrEqual(100);

    const traces = state.outputs.__action_traces as ActionTrace[];
    expect(traceDuration(traces, "wait-duration")).toBeGreaterThanOrEqual(90);
    expect(traceDuration(traces, "wait-random")).toBeGreaterThanOrEqual(20);
    expect(traceDuration(traces, "wait-random")).toBeLessThan(500);
  });

  test("surfaces assertion failures in the desktop run state", async ({
    appWindow,
    fixtureServer,
  }, testInfo) => {
    testInfo.annotations.push(
      { type: "fixture route", description: "/wait-assertion" },
      {
        type: "nodes",
        description: "navigate, assert_text",
      },
      {
        type: "desktop depth",
        description: "Verifies assertion failure context through the real desktop run state.",
      },
    );

    const { state } = await createAndRunWorkflowExpectingFailure(
      appWindow,
      "E2E assertion failure",
      [
        {
          id: "navigate-wait-assertion",
          label: "Navigate Wait Assertion",
          config: { type: "navigate", config: { url: `${fixtureServer.baseUrl}/wait-assertion` } },
        },
        {
          id: "assert-wrong-text",
          label: "Assert Wrong Text",
          config: {
            type: "assert_text",
            config: { target: target("async-status"), text: "never", match_mode: "equals" },
          },
        },
      ],
    );

    expect(state.status).toBe("failed");
    expect(state.error).toMatchObject({
      step_id: "assert-wrong-text",
      action_type: "assert_text",
      reason: expect.stringContaining("Text did not equal never"),
    });
  });
});

function traceDuration(traces: ActionTrace[], nodeId: string) {
  const trace = traces.find((item) => item.node_id === nodeId);
  if (!trace) throw new Error(`Missing action trace for ${nodeId}`);
  return Date.parse(trace.finished_at) - Date.parse(trace.started_at);
}
