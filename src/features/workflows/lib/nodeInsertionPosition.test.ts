import { describe, expect, test, vi } from "vitest";
import { getVisibleNodeInsertionPosition } from "./nodeInsertionPosition";

describe("getVisibleNodeInsertionPosition", () => {
  test("falls back to deterministic offset positions when projection is unavailable", () => {
    expect(getVisibleNodeInsertionPosition(3, null, null)).toEqual({
      x: 264,
      y: 168,
    });
  });

  test("places new nodes near the visible canvas center with staggered offsets", () => {
    const screenToFlowPosition = vi.fn(({ x, y }: { x: number; y: number }) => ({
      x: x + 1000,
      y: y + 2000,
    }));
    const canvasElement = {
      getBoundingClientRect: () =>
        ({
          left: 40,
          top: 80,
          width: 800,
          height: 600,
        }) as DOMRect,
    };

    expect(
      getVisibleNodeInsertionPosition(3, { screenToFlowPosition }, canvasElement),
    ).toEqual({ x: 1432, y: 2411 });
    expect(screenToFlowPosition).toHaveBeenCalledWith(
      { x: 440, y: 380 },
      { snapToGrid: false },
    );
  });
});
