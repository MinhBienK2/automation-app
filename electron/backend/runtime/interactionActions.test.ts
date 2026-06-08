// @vitest-environment node

import { describe, expect, test } from "vitest";
import type {
  BrowserDriverLocator,
  BrowserDriverPage,
} from "../browser/sessionManager.js";
import {
  executeScrollAction,
  humanPageScroll,
  pressKeyHuman,
  submitFormTarget,
} from "./interactionActions.js";

describe("interactionActions", () => {
  test("submits a target through click, keypress, then DOM fallback", async () => {
    const calls: string[] = [];
    const locator = {
      fill: async () => undefined,
      click: async () => {
        calls.push("click");
        throw new Error("click failed");
      },
      press: async (key: string) => {
        calls.push(`press:${key}`);
        throw new Error("press failed");
      },
      evaluate: async () => {
        calls.push("evaluate");
      },
    } satisfies BrowserDriverLocator;

    await submitFormTarget(locator);

    expect(calls).toEqual(["click", "press:Enter", "evaluate"]);
  });

  test("page scroll emits wheel pulses that preserve requested distance", async () => {
    const wheels: Array<{ x: number; y: number }> = [];
    const page = {
      goto: async () => undefined,
      locator: () => {
        throw new Error("not used");
      },
      evaluate: async () => undefined,
      mouse: {
        wheel: async (x: number, y: number) => {
          wheels.push({ x, y });
        },
      },
    } satisfies BrowserDriverPage;

    await humanPageScroll(page, "down", 900, async () => undefined, () => 0.5);

    expect(wheels.length).toBeGreaterThan(1);
    expect(wheels.reduce((sum, wheel) => sum + wheel.y, 0)).toBe(900);
    expect(wheels.every((wheel) => wheel.x === 0 && wheel.y > 0)).toBe(true);
  });

  test("presses keys with human hold timing when keyboard down/up are available", async () => {
    const calls: string[] = [];
    const page = {
      goto: async () => undefined,
      locator: () => {
        throw new Error("not used");
      },
      evaluate: async () => undefined,
      keyboard: {
        press: async (key: string) => calls.push(`press:${key}`),
        down: async (key: string) => calls.push(`down:${key}`),
        up: async (key: string) => calls.push(`up:${key}`),
      },
    } satisfies BrowserDriverPage;

    await pressKeyHuman(page, "Enter", async (ms) => calls.push(`sleep:${ms}`), () => 0);

    expect(calls).toEqual(["down:Enter", "sleep:35", "up:Enter"]);
  });

  test("scroll action delegates targeted scroll to configured CloakBrowser adapter first", async () => {
    const calls: string[] = [];
    const locator = {
      fill: async () => undefined,
      click: async () => undefined,
    } satisfies BrowserDriverLocator;
    const page = {
      goto: async () => undefined,
      locator: () => locator,
      evaluate: async () => undefined,
    } satisfies BrowserDriverPage;

    await executeScrollAction(
      {
        page,
        settings: {
          browser_launch: { human_preset: "careful" },
        },
        signal: undefined,
      },
      {
        type: "scroll",
        config: {
          mode: "into_view",
          target: {
            locators: [{ kind: "css", value: "#target" }],
            constraints: null,
          },
        },
      },
      {
        locatorForAction: async () => locator,
        cloakHumanScroll: async ({ preset }) => {
          calls.push(`cloak:${preset}`);
          return true;
        },
        sleep: async () => undefined,
        random: () => 0,
      },
    );

    expect(calls).toEqual(["cloak:careful"]);
  });
});
