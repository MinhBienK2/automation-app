import { test, expect } from "./support/electronFixture";
import { createAndRunWorkflow, target } from "./support/workflows";

type HumanBehaviorSummary = {
  global: {
    mouse_moves: number;
    pointer_moves: number;
    untrusted_events: number;
    duration_ms: number;
  };
  hover: {
    enter_trusted: boolean;
    moves_before_enter: number;
  };
  click: {
    down_trusted: boolean;
    up_trusted: boolean;
    click_trusted: boolean;
    moves_before_down: number;
  };
  double_click: {
    dblclick_trusted: boolean;
    click_events: number;
  };
  right_click: {
    down_button: number | null;
    up_button: number | null;
    contextmenu_trusted: boolean;
  };
  input: {
    value: string;
    trusted_keydowns: number;
    trusted_inputs: number;
  };
  type_sequence: {
    value: string;
    trusted_keydowns: number;
    trusted_inputs: number;
  };
  scroll: {
    trusted_wheels: number;
    scroll_events: number;
    max_scroll_y: number;
  };
};

test.describe("desktop humanized browser interaction evidence", () => {
  test("records trusted pointer movement and keyboard event sequences for humanized actions", async ({
    appWindow,
    fixtureServer,
  }, testInfo) => {
    testInfo.annotations.push(
      { type: "fixture route", description: "/human-behavior" },
      {
        type: "nodes",
        description:
          "navigate, hover, click, double_click, right_click, input_text, type_sequence, scroll(page), extract_text",
      },
      {
        type: "desktop depth",
        description:
          "Verifies humanized browser actions through page-observable trusted pointer, wheel, and keyboard events.",
      },
    );

    const { state } = await createAndRunWorkflow(appWindow, "E2E human behavior evidence", [
      {
        id: "navigate-human-behavior",
        label: "Navigate Human Behavior",
        config: { type: "navigate", config: { url: `${fixtureServer.baseUrl}/human-behavior` } },
      },
      {
        id: "hover-human-target",
        label: "Hover Human Target",
        config: { type: "hover", config: { target: target("human-hover") } },
      },
      {
        id: "click-human-target",
        label: "Click Human Target",
        config: { type: "click", config: { target: target("human-click") } },
      },
      {
        id: "double-click-human-target",
        label: "Double Click Human Target",
        config: { type: "double_click", config: { target: target("human-double-click") } },
      },
      {
        id: "right-click-human-target",
        label: "Right Click Human Target",
        config: { type: "right_click", config: { target: target("human-right-click") } },
      },
      {
        id: "fill-human-input",
        label: "Fill Human Input",
        config: {
          type: "input_text",
          config: { target: target("human-input"), text: "alpha", clear_before_input: true },
        },
      },
      {
        id: "type-human-sequence",
        label: "Type Human Sequence",
        config: {
          type: "type_sequence",
          config: { target: target("human-type-sequence"), text: "beta" },
        },
      },
      {
        id: "scroll-human-page",
        label: "Scroll Human Page",
        config: { type: "scroll", config: { direction: "down", pixels: 720 } },
      },
      {
        id: "extract-human-summary",
        label: "Extract Human Summary",
        config: {
          type: "extract_text",
          config: { target: target("human-summary"), output_name: "human_behavior_summary" },
        },
      },
    ]);

    const summary = parseHumanBehaviorSummary(state.outputs.human_behavior_summary);
    const browserIdentity = state.outputs.browser_identity as { browser_engine?: unknown; humanize?: unknown };

    expect(browserIdentity.browser_engine).toBe("cloakbrowser");
    expect(browserIdentity.humanize).toBe(true);
    expect(summary.global.untrusted_events).toBe(0);
    expect(summary.global.mouse_moves).toBeGreaterThanOrEqual(6);
    expect(summary.global.pointer_moves).toBeGreaterThanOrEqual(3);
    expect(summary.global.duration_ms).toBeGreaterThan(20);
    expect(summary.hover.enter_trusted).toBe(true);
    expect(summary.hover.moves_before_enter).toBeGreaterThan(0);
    expect(summary.click.down_trusted).toBe(true);
    expect(summary.click.up_trusted).toBe(true);
    expect(summary.click.click_trusted).toBe(true);
    expect(summary.click.moves_before_down).toBeGreaterThan(summary.hover.moves_before_enter);
    expect(summary.double_click.dblclick_trusted).toBe(true);
    expect(summary.double_click.click_events).toBeGreaterThanOrEqual(1);
    expect(summary.right_click.down_button).toBe(2);
    expect(summary.right_click.up_button).toBe(2);
    expect(summary.right_click.contextmenu_trusted).toBe(true);
    expect(summary.input.value).toBe("alpha");
    expect(summary.input.trusted_keydowns).toBeGreaterThanOrEqual("alpha".length);
    expect(summary.input.trusted_inputs).toBeGreaterThan(0);
    expect(summary.type_sequence.value).toBe("beta");
    expect(summary.type_sequence.trusted_keydowns).toBeGreaterThanOrEqual("beta".length);
    expect(summary.type_sequence.trusted_inputs).toBeGreaterThan(0);
    expect(summary.scroll.trusted_wheels).toBeGreaterThan(0);
    expect(summary.scroll.scroll_events).toBeGreaterThan(0);
    expect(summary.scroll.max_scroll_y).toBeGreaterThan(0);
    expect(state.completed_step_ids).toEqual(
      expect.arrayContaining([
        "hover-human-target",
        "click-human-target",
        "double-click-human-target",
        "right-click-human-target",
        "fill-human-input",
        "type-human-sequence",
        "scroll-human-page",
      ]),
    );
  });
});

function parseHumanBehaviorSummary(value: unknown): HumanBehaviorSummary {
  if (typeof value !== "string") {
    throw new Error(`Expected human behavior summary string, received ${typeof value}`);
  }
  return JSON.parse(value) as HumanBehaviorSummary;
}
