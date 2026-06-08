// @vitest-environment node

import { describe, expect, test } from "vitest";
import type { BrowserDriverLocator } from "../browser/sessionManager.js";
import {
  extractListLike,
  waitUntil,
  weightedRandomChoice,
  withActionTimeout,
} from "./runtimeHelpers.js";

describe("runtimeHelpers", () => {
  test("maps serialized wait-until values to driver load-state values", () => {
    expect(waitUntil("dom_content_loaded")).toBe("domcontentloaded");
    expect(waitUntil("network_idle")).toBe("networkidle");
    expect(waitUntil(null)).toBe("load");
  });

  test("selects weighted random choices and rejects invalid weights", () => {
    expect(
      weightedRandomChoice(
        [
          { id: "low", weight: 1 },
          { id: "high", weight: 9 },
        ],
        () => 0.5,
      ).id,
    ).toBe("high");

    expect(() => weightedRandomChoice([{ id: "bad", weight: 0 }], () => 0))
      .toThrow("Random choice weight must be greater than 0");
  });

  test("extracts list-like locator text in index order", async () => {
    const values = ["first", "second"];
    const locator = {
      fill: async () => undefined,
      click: async () => undefined,
      count: async () => values.length,
      nth: (index: number) => ({
        fill: async () => undefined,
        click: async () => undefined,
        textContent: async () => values[index],
      }) satisfies BrowserDriverLocator,
    } satisfies BrowserDriverLocator;

    await expect(extractListLike(locator)).resolves.toEqual(values);
  });

  test("rejects timed-out actions with the configured message", async () => {
    await expect(
      withActionTimeout(
        new Promise((resolve) => setTimeout(resolve, 20)),
        1,
        (timeoutMs) => `Timed out after ${timeoutMs} ms`,
      ),
    ).rejects.toThrow("Timed out after 1 ms");
  });
});
