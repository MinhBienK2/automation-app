// @vitest-environment node

import { describe, expect, test } from "vitest";
import {
  dragTargetPoint,
  scrollGesturePulses,
  scrollPlanForBox,
} from "./interactionPrimitives.js";

describe("interactionPrimitives", () => {
  test("computes drag target points for percent and offset positions", () => {
    const box = { x: 10, y: 20, width: 200, height: 100 };

    expect(dragTargetPoint(box, { mode: "percent", x_percent: 75, y_percent: 40 }))
      .toEqual({ x: 160, y: 60 });
    expect(dragTargetPoint(box, { mode: "offset", x_px: 15, y_px: 30 }))
      .toEqual({ x: 25, y: 50 });
    expect(dragTargetPoint(box, { mode: "center" }))
      .toEqual({ x: 110, y: 70 });
  });

  test("plans target scroll only when the box is outside the viewport comfort zone", () => {
    expect(scrollPlanForBox({ x: 50, y: 80, width: 120, height: 90 }, { width: 800, height: 600 }))
      .toEqual({ done: true, deltaX: 0, deltaY: 0, distance: 0 });

    expect(scrollPlanForBox({ x: 50, y: 700, width: 120, height: 90 }, { width: 800, height: 600 }))
      .toEqual({ done: false, deltaX: 0, deltaY: 238, distance: 238 });
  });

  test("keeps generated wheel pulses monotonic and distance-preserving", () => {
    const random = () => 0.5;
    const pulses = scrollGesturePulses(900, 4, random);

    expect(pulses.reduce((sum, pulse) => sum + pulse, 0)).toBe(900);
    expect(pulses.every((pulse) => pulse > 0)).toBe(true);
  });
});
