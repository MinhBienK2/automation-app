// @vitest-environment node

import { describe, expect, test } from "vitest";
import type {
  BrowserDriverLocator,
  BrowserDriverPage,
} from "../browser/sessionManager.js";
import {
  locatorFor,
  rankedCandidatesForTarget,
  selectRankedElementCandidate,
} from "./targetResolver.js";

type TestLocator = BrowserDriverLocator & {
  id: string;
  nth?: (index: number) => TestLocator;
};

function testLocator(
  id: string,
  options: {
    visible?: boolean;
    enabled?: boolean;
    text?: string;
    box?: { x?: number; y?: number; width: number; height: number } | null;
    children?: TestLocator[];
  } = {},
): TestLocator {
  return {
    id,
    fill: async () => undefined,
    click: async () => undefined,
    isVisible: async () => options.visible ?? true,
    isEnabled: async () => options.enabled ?? true,
    textContent: async () => options.text ?? "",
    boundingBox: async () => options.box ?? null,
    count: options.children
      ? async () => options.children?.length ?? 0
      : undefined,
    nth: options.children
      ? (index: number) => options.children?.[index] ?? testLocator(`${id}-${index}`)
      : undefined,
  };
}

function testPage(
  locators: Record<string, TestLocator>,
  viewport = { width: 100, height: 100 },
): BrowserDriverPage {
  return {
    goto: async () => undefined,
    locator: (selector: string) => {
      const locator = locators[selector];
      if (!locator) throw new Error(`Unexpected selector ${selector}`);
      return locator;
    },
    evaluate: async () => viewport,
  };
}

describe("targetResolver", () => {
  test("uses the first locator that satisfies target constraints", async () => {
    const hidden = testLocator("hidden", { visible: false, text: "Ready" });
    const visible = testLocator("visible", { visible: true, text: "Ready" });
    const page = testPage({
      ".hidden": hidden,
      ".visible": visible,
    });

    const resolved = await locatorFor(page, {
      locators: [
        { kind: "css", value: ".hidden" },
        { kind: "css", value: ".visible" },
      ],
      constraints: {
        visible: true,
        contains_text: "Ready",
      },
    });

    expect(resolved).toBe(visible);
  });

  test("selects ranked candidates by distance to the viewport center", async () => {
    const far = testLocator("far", { box: { x: 0, y: 0, width: 10, height: 10 } });
    const near = testLocator("near", { box: { x: 45, y: 45, width: 10, height: 10 } });
    const base = testLocator("base", { children: [far, near] });
    const page = testPage({ ".candidate": base });

    const candidates = await rankedCandidatesForTarget(page, {
      locators: [{ kind: "css", value: ".candidate" }],
      constraints: null,
    });

    expect(candidates.map((candidate) => candidate.index)).toEqual([0, 1]);
    await expect(
      selectRankedElementCandidate(page, candidates, "nearest_viewport_center"),
    ).resolves.toMatchObject({ index: 1 });
  });
});
