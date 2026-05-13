import { test, expect } from "./support/electronFixture";
import { createAndRunWorkflow, target } from "./support/workflows";

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
          "navigate, click, double_click, right_click, hover, drag_and_drop, scroll, extract_text",
      },
      {
        type: "desktop depth",
        description: "Verifies pointer and page-scroll side effects through the real browser page.",
      },
    );

    const { state } = await createAndRunWorkflow(appWindow, "E2E pointer execution", [
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
        id: "extract-pointer-summary",
        label: "Extract Pointer Summary",
        config: {
          type: "extract_text",
          config: { target: target("pointer-summary"), output_name: "pointer_summary" },
        },
      },
    ]);

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
      ]),
    );
  });
});
