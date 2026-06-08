import type { DragTargetPosition } from "../../../src/types/workflow.js";

export type ScrollViewport = {
  width: number;
  height: number;
};

export type ScrollBox = {
  x?: number;
  y?: number;
  width: number;
  height: number;
};

export type PointerBox = {
  x?: number;
  y?: number;
  width: number;
  height: number;
};

export type HumanScrollProfile = {
  closeMinChunk: number;
  closeMaxChunk: number;
  minChunk: number;
  maxChunk: number;
  farDistance: number;
  gesturePauseMinMs: number;
  gesturePauseMaxMs: number;
  farGesturePauseMinMs: number;
  farGesturePauseMaxMs: number;
  pulsePauseMinMs: number;
  pulsePauseMaxMs: number;
};

const PAGE_SCROLL_TARGET_CHUNK_PX = 240;
const PAGE_SCROLL_MAX_STEPS = 18;

export const PAGE_SCROLL_PULSE_PAUSE_MIN_MS = 18;
export const PAGE_SCROLL_PULSE_PAUSE_MAX_MS = 55;
export const PAGE_SCROLL_GESTURE_PAUSE_MIN_MS = 170;
export const PAGE_SCROLL_GESTURE_PAUSE_MAX_MS = 310;

export const SCROLL_TARGET_DEFAULT_TIMEOUT_MS = 60000;
export const SCROLL_UNTIL_VISIBLE_DEFAULT_PIXELS = 700;
export const SCROLL_UNTIL_VISIBLE_ATTEMPT_BUDGET_MS = 300;

export function centerPoint(box: PointerBox) {
  return {
    x: (box.x ?? 0) + box.width / 2,
    y: (box.y ?? 0) + box.height / 2,
  };
}

export function dragTargetPoint(box: PointerBox, position: DragTargetPosition) {
  if (position.mode === "percent") {
    return {
      x: (box.x ?? 0) + box.width * (position.x_percent / 100),
      y: (box.y ?? 0) + box.height * (position.y_percent / 100),
    };
  }

  if (position.mode === "offset") {
    return {
      x: (box.x ?? 0) + position.x_px,
      y: (box.y ?? 0) + position.y_px,
    };
  }

  return centerPoint(box);
}

export function scrollPlanForBox(box: ScrollBox, viewport: ScrollViewport) {
  const x = box.x ?? 0;
  const y = box.y ?? 0;
  const marginX = Math.max(16, Math.round(viewport.width * 0.06));
  const marginY = Math.max(16, Math.round(viewport.height * 0.08));
  const targetLeft = marginX;
  const targetRight = viewport.width - marginX;
  const targetTop = marginY;
  const targetBottom = viewport.height - marginY;
  const visibleWidth = Math.max(0, Math.min(x + box.width, viewport.width) - Math.max(x, 0));
  const visibleHeight = Math.max(0, Math.min(y + box.height, viewport.height) - Math.max(y, 0));
  const visibleRatio = (visibleWidth * visibleHeight) / Math.max(1, box.width * box.height);
  if (visibleRatio >= 0.9) {
    return { done: true as const, deltaX: 0, deltaY: 0, distance: 0 };
  }

  let deltaX = 0;
  let deltaY = 0;
  if (x < targetLeft) {
    deltaX = x - targetLeft;
  } else if (x + box.width > targetRight) {
    deltaX = x + box.width - targetRight;
  }
  if (y < targetTop) {
    deltaY = y - targetTop;
  } else if (y + box.height > targetBottom) {
    deltaY = y + box.height - targetBottom;
  }

  return {
    done: false as const,
    deltaX,
    deltaY,
    distance: Math.max(Math.abs(deltaX), Math.abs(deltaY)),
  };
}

export function humanTargetScrollChunk(
  plan: { deltaX: number; deltaY: number; distance: number },
  profile: HumanScrollProfile,
  random: () => number,
) {
  const axisDistance = Math.max(Math.abs(plan.deltaX), Math.abs(plan.deltaY));
  const magnitude = decisiveTargetScrollChunk(axisDistance, profile, random);
  const scale = axisDistance > 0 ? magnitude / axisDistance : 0;
  return {
    deltaX: Math.round(Math.sign(plan.deltaX) * Math.abs(plan.deltaX) * scale),
    deltaY: Math.round(Math.sign(plan.deltaY) * Math.abs(plan.deltaY) * scale),
  };
}

export function humanScrollProfile(preset?: string | null): HumanScrollProfile {
  if (preset === "careful") {
    return {
      closeMinChunk: 90,
      closeMaxChunk: 170,
      minChunk: 150,
      maxChunk: 260,
      farDistance: 1000,
      gesturePauseMinMs: 140,
      gesturePauseMaxMs: 220,
      farGesturePauseMinMs: 210,
      farGesturePauseMaxMs: 360,
      pulsePauseMinMs: 22,
      pulsePauseMaxMs: 58,
    };
  }
  return {
    closeMinChunk: 110,
    closeMaxChunk: 200,
    minChunk: 190,
    maxChunk: 320,
    farDistance: 1200,
    gesturePauseMinMs: 130,
    gesturePauseMaxMs: 210,
    farGesturePauseMinMs: 200,
    farGesturePauseMaxMs: 340,
    pulsePauseMinMs: 18,
    pulsePauseMaxMs: 55,
  };
}

export function humanScrollPauseMs(
  profile: HumanScrollProfile,
  random: () => number,
  distance: number,
) {
  const distanceScale = clampRatio(distance / profile.farDistance);
  const pauseMinMs = interpolate(profile.gesturePauseMinMs, profile.farGesturePauseMinMs, distanceScale);
  const pauseMaxMs = interpolate(profile.gesturePauseMaxMs, profile.farGesturePauseMaxMs, distanceScale);
  return pauseMinMs + Math.floor(random() * (pauseMaxMs - pauseMinMs));
}

export function nextScrollChunk(total: number, remainingSteps: number, random: () => number) {
  if (remainingSteps <= 1) return total;
  const base = total / remainingSteps;
  const jitter = Math.abs(base) * 0.25 * (random() - 0.5);
  const chunk = Math.round(base + jitter);
  if (chunk !== 0) return chunk;
  return total > 0 ? 1 : total < 0 ? -1 : 0;
}

export function decisivePageScrollSteps(distance: number) {
  if (distance <= 0) return 0;
  return Math.max(1, Math.min(PAGE_SCROLL_MAX_STEPS, Math.ceil(distance / PAGE_SCROLL_TARGET_CHUNK_PX)));
}

function decisiveTargetScrollChunk(distance: number, profile: HumanScrollProfile, random: () => number) {
  if (distance <= 0) return 0;
  const distanceScale = clampRatio(distance / profile.farDistance);
  const minChunk = interpolate(profile.closeMinChunk, profile.minChunk, distanceScale);
  const maxChunk = interpolate(profile.closeMaxChunk, profile.maxChunk, distanceScale);
  if (distance <= maxChunk) return distance;

  const preferredChunk = minChunk + Math.floor(random() * (maxChunk - minChunk));
  const remainingSteps = Math.max(1, Math.ceil(distance / preferredChunk));
  const chunk = Math.abs(nextScrollChunk(distance, remainingSteps, random));
  return Math.max(minChunk, Math.min(maxChunk, chunk));
}

export function scrollGesturePulseCount(distance: number, random: () => number) {
  if (distance <= 0) return 1;
  if (distance < 120) return 2;
  if (distance < 260) return random() > 0.75 ? 4 : 3;
  return random() > 0.65 ? 5 : 4;
}

export function scrollGesturePulses(total: number, pulseCount: number, random: () => number) {
  const weights = scrollGestureWeights(pulseCount);
  const pulses: number[] = [];
  let remaining = total;
  let remainingWeight = weights.reduce((sum, weight) => sum + weight, 0);

  for (let index = 0; index < pulseCount; index += 1) {
    if (index === pulseCount - 1) {
      pulses.push(remaining);
      break;
    }

    const share = weights[index] / remainingWeight;
    const base = remaining * share;
    const jitter = Math.abs(base) * 0.18 * (random() - 0.5);
    let pulse = Math.round(base + jitter);
    if (pulse === 0 && remaining !== 0) pulse = Math.sign(remaining);
    if (Math.sign(pulse) !== Math.sign(remaining)) pulse = Math.sign(remaining);

    pulses.push(pulse);
    remaining -= pulse;
    remainingWeight -= weights[index];
  }

  return pulses;
}

function scrollGestureWeights(pulseCount: number) {
  if (pulseCount <= 2) return [0.46, 0.54];
  if (pulseCount === 3) return [0.24, 0.42, 0.34];
  if (pulseCount === 4) return [0.16, 0.28, 0.34, 0.22];
  return [0.12, 0.21, 0.28, 0.24, 0.15];
}

export function scrollPulsePauseMs(
  timing: { pulsePauseMinMs: number; pulsePauseMaxMs: number },
  random: () => number,
) {
  return timing.pulsePauseMinMs + Math.floor(random() * (timing.pulsePauseMaxMs - timing.pulsePauseMinMs));
}

function clampRatio(value: number) {
  return Math.max(0, Math.min(1, value));
}

function interpolate(from: number, to: number, ratio: number) {
  return Math.round(from + (to - from) * ratio);
}

export function scrollPauseMs(random: () => number) {
  return (
    PAGE_SCROLL_GESTURE_PAUSE_MIN_MS +
    Math.floor(random() * (PAGE_SCROLL_GESTURE_PAUSE_MAX_MS - PAGE_SCROLL_GESTURE_PAUSE_MIN_MS))
  );
}

export function keyHoldMs(random: () => number) {
  return 35 + Math.floor(random() * 85);
}

export function keyGapMs(random: () => number) {
  return 20 + Math.floor(random() * 50);
}

export function mouseMovePauseMs(random: () => number) {
  return 20 + Math.floor(random() * 40);
}
