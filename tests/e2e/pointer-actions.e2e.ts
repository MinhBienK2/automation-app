import { test, expect } from "./support/electronFixture";
import {
  createAndRunWorkflow,
  createAndRunWorkflowExpectingFailure,
  target,
} from "./support/workflows";

test.describe("desktop pointer and element interaction node execution", () => {
  test("runs click, double click, right click, hover, drag and drop, and scroll nodes", async ({
    appWindow,
    fixtureServer,
  }, testInfo) => {
    testInfo.annotations.push(
      { type: "fixture route", description: "/pointer" },
      {
        type: "nodes",
        description:
          "navigate, click, double_click, right_click, hover, drag_and_drop, scroll(page/into_view), extract_text",
      },
      {
        type: "desktop depth",
        description: "Verifies pointer and direct scroll mode side effects through the real browser page.",
      },
    );

    const { state } = await createAndRunWorkflow(
      appWindow,
      "E2E pointer execution",
      [
        {
          id: "navigate-pointer",
          label: "Navigate Pointer",
          config: { type: "navigate", config: { url: `${fixtureServer.baseUrl}/pointer` } },
        },
        {
          id: "click-button",
          label: "Click Button",
          config: { type: "click", config: { target: target("click-target") } },
        },
        {
          id: "double-click-button",
          label: "Double Click Button",
          config: { type: "double_click", config: { target: target("double-click-target") } },
        },
        {
          id: "right-click-button",
          label: "Right Click Button",
          config: { type: "right_click", config: { target: target("right-click-target") } },
        },
        {
          id: "hover-button",
          label: "Hover Button",
          config: { type: "hover", config: { xpath: "", target: target("hover-target") } },
        },
        {
          id: "drag-source-to-zone",
          label: "Drag Source To Zone",
          config: {
            type: "drag_and_drop",
            config: {
              source_target: target("drag-source"),
              target_target: target("drop-zone"),
            },
          },
        },
        {
          id: "scroll-page",
          label: "Scroll Page",
          config: { type: "scroll", config: { direction: "down", pixels: 900 } },
        },
        {
          id: "scroll-into-view",
          label: "Scroll Into View",
          config: {
            type: "scroll",
            config: { mode: "into_view", target: target("into-view-target"), timeout_ms: 5000 },
          },
        },
        {
          id: "extract-pointer-summary",
          label: "Extract Pointer Summary",
          config: {
            type: "extract_text",
            config: { target: target("pointer-summary"), output_name: "pointer_summary" },
          },
        },
      ],
      { timeoutMs: 90_000 },
    );

    expect(state.outputs.pointer_summary).toBe(
      "click:1|double:1|right:1|hover:1|drop:drag-source|scroll:scrolled",
    );
    expect(state.completed_step_ids).toEqual(
      expect.arrayContaining([
        "click-button",
        "double-click-button",
        "right-click-button",
        "hover-button",
        "drag-source-to-zone",
        "scroll-page",
        "scroll-into-view",
      ]),
    );
  });

  test("fails target scroll when lazy-loaded element is not yet in the DOM", async ({
    appWindow,
    fixtureServer,
  }, testInfo) => {
    testInfo.annotations.push(
      { type: "fixture route", description: "/lazy-scroll" },
      {
        type: "nodes",
        description: "navigate, scroll(into_view), extract_text",
      },
      {
        type: "desktop depth",
        description:
          "Verifies target scroll cannot trigger page-scroll lazy loading when the target has no DOM bounding box.",
      },
    );

    const { state } = await createAndRunWorkflowExpectingFailure(
      appWindow,
      "E2E lazy target scroll failure",
      [
        {
          id: "navigate-lazy-scroll",
          label: "Navigate Lazy Scroll",
          config: { type: "navigate", config: { url: `${fixtureServer.baseUrl}/lazy-scroll` } },
        },
        {
          id: "scroll-lazy-target",
          label: "Scroll Lazy Target",
          config: {
            type: "scroll",
            config: { mode: "into_view", target: target("lazy-target"), timeout_ms: 1000 },
          },
        },
        {
          id: "extract-lazy-summary",
          label: "Extract Lazy Summary",
          config: {
            type: "extract_text",
            config: { target: target("lazy-summary"), output_name: "lazy_summary" },
          },
        },
      ],
    );

    expect(state.error).toMatchObject({
      step_id: "scroll-lazy-target",
      action_type: "scroll",
    });
    expect(state.error?.reason).toMatch(/Scroll target|Timeout|Element/i);
    expect(state.completed_step_ids).not.toContain("extract-lazy-summary");
  });

  test("scrolls until a lazy-loaded element is visible", async ({
    appWindow,
    fixtureServer,
  }, testInfo) => {
    testInfo.annotations.push(
      { type: "fixture route", description: "/lazy-scroll" },
      {
        type: "nodes",
        description: "navigate, scroll(until_element_visible), extract_text",
      },
      {
        type: "desktop depth",
        description:
          "Verifies scroll-until-visible page-scrolls to trigger lazy DOM mounting before targeting the element.",
      },
    );

    const { state } = await createAndRunWorkflow(
      appWindow,
      "E2E lazy scroll until visible",
      [
        {
          id: "navigate-lazy-scroll",
          label: "Navigate Lazy Scroll",
          config: { type: "navigate", config: { url: `${fixtureServer.baseUrl}/lazy-scroll` } },
        },
        {
          id: "scroll-lazy-target",
          label: "Scroll Lazy Target",
          config: {
            type: "scroll",
            config: {
              mode: "until_element_visible",
              target: target("lazy-target"),
              direction: "down",
              pixels: 700,
              timeout_ms: 10000,
            },
          },
        },
        {
          id: "extract-lazy-summary",
          label: "Extract Lazy Summary",
          config: {
            type: "extract_text",
            config: { target: target("lazy-summary"), output_name: "lazy_summary" },
          },
        },
      ],
      { timeoutMs: 90_000 },
    );

    expect(state.outputs.lazy_summary).toMatch(/^lazy:mounted\|scroll:/);
    expect(state.completed_step_ids).toEqual(
      expect.arrayContaining(["scroll-lazy-target", "extract-lazy-summary"]),
    );
  });
});
