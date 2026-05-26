import { describe, expect, test } from "vitest";
import { e2eWorkflowRuntimeOverrides } from "./workflows";

describe("E2E workflow runtime overrides", () => {
  test("keeps the default full E2E lane headless and auto-closing", () => {
    expect(e2eWorkflowRuntimeOverrides({})).toEqual({
      browserRetention: "close",
      headless: true,
      observeAfterRunMs: 0,
    });
  });

  test("shows and retains the workflow browser in visible E2E mode", () => {
    expect(e2eWorkflowRuntimeOverrides({ E2E_VISIBLE_BROWSER: "1" })).toEqual({
      browserRetention: "retain",
      headless: false,
      observeAfterRunMs: 1500,
    });
  });

  test("allows the visible-mode observation pause to be overridden", () => {
    expect(
      e2eWorkflowRuntimeOverrides({
        E2E_VISIBLE_BROWSER: "true",
        E2E_OBSERVE_MS: "3000",
      }),
    ).toMatchObject({
      observeAfterRunMs: 3000,
    });
  });
});
