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
          "navigate, execute_js, wait(duration/text_visible/url_contains/element_visible), random_wait, assert_element, assert_text, extract_text",
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
              return 'scheduled';
            `,
            output_name: "schedule_result",
          },
        },
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
