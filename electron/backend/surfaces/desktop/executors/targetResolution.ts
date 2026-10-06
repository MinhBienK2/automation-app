import type { DesktopSurface } from "../../../runtime/surface.js";
import { resolveDesktopLocator } from "../locator.js";
import { snapshotWarnings, tierOf } from "../snapshot.js";
import type { DesktopLocator, ElementSnapshot, NameMatch } from "../types.js";
import {
  noteTrace,
  type LocatorConfig,
  type ResolvedTarget,
  type StepConfig,
  type StepScope,
} from "./types.js";

export async function resolveStep(
  desktop: DesktopSurface,
  config: StepConfig,
  runtime: StepScope,
): Promise<ResolvedTarget> {
  if (config.target.kind === "pixel") {
    noteTrace(runtime, { matched: "pixel" });
    return { x: config.target.x, y: config.target.y, warnings: [] };
  }

  const snapshot = await desktop.driver.getWindowState(desktop.binding, runtime.signal);
  const warnings = snapshotWarnings(snapshot);
  noteTrace(runtime, {
    tier: tierOf(snapshot),
    ...(warnings.length > 0 ? { warnings } : {}),
  });

  const element = resolveOrThrow(
    snapshot,
    config,
    runtime.currentActionType ?? "desktop action",
    runtime,
  );

  return { elementToken: element.element_token, warnings };
}

export async function resolvePoint(
  desktop: DesktopSurface,
  target: StepConfig["target"],
  runtime: StepScope,
  actionType: string,
): Promise<{ x: number; y: number }> {
  if (target.kind === "pixel") {
    noteTrace(runtime, { matched: "pixel" });
    return { x: target.x, y: target.y };
  }
  const snapshot = await desktop.driver.getWindowState(desktop.binding, runtime.signal);
  noteTrace(runtime, { tier: tierOf(snapshot) });
  return pointFromSnapshot(snapshot, target, runtime, actionType);
}

export function pointFromSnapshot(
  snapshot: ElementSnapshot,
  target: StepConfig["target"],
  runtime: StepScope,
  actionType: string,
): { x: number; y: number } {
  if (target.kind === "pixel") {
    noteTrace(runtime, { matched: "pixel" });
    return { x: target.x, y: target.y };
  }
  const element = resolveOrThrow(snapshot, { target }, actionType, runtime);
  return centerOf(element, actionType);
}

export function centerOf(
  element: { frame?: { x: number; y: number; w: number; h: number } },
  actionType: string,
): { x: number; y: number } {
  const frame = element.frame;
  if (!frame) {
    throw new Error(
      `${actionType} needs the element's on-screen position, but its accessibility node reported no frame. Point the step at a pixel target instead.`,
    );
  }
  return { x: Math.round(frame.x + frame.w / 2), y: Math.round(frame.y + frame.h / 2) };
}

export function resolveOrThrow(
  snapshot: ElementSnapshot,
  config: StepConfig,
  actionType: string,
  runtime: StepScope,
) {
  if (config.target.kind !== "element") {
    throw new Error(`${actionType} needs an element target, not a pixel one.`);
  }

  const resolution = resolveDesktopLocator(toLocator(config.target.locator), snapshot);

  if (!resolution.ok) {
    const tier = tierOf(snapshot);
    throw new Error(
      `${actionType} could not resolve its target (${resolution.reason}, window tier: ${tier}): ${resolution.detail}`,
    );
  }

  noteTrace(runtime, {
    role: resolution.element.role,
    ...(resolution.element.label !== undefined ? { label: resolution.element.label } : {}),
    matched: resolution.matchedBy,
  });

  return resolution.element;
}

export function requireElement(target: ResolvedTarget, actionType: string): string {
  if (target.elementToken === undefined) {
    throw new Error(`${actionType} needs an element target; a pixel cannot carry a value.`);
  }
  return target.elementToken;
}

export function toLocator(config: LocatorConfig): DesktopLocator {
  return {
    role: config.role,
    name: config.name ? (config.name as NameMatch) : undefined,
    ancestors:
      config.ancestors?.map((stepItem) => ({
        role: stepItem.role,
        name: stepItem.name ? (stepItem.name as NameMatch) : undefined,
      })) ?? undefined,
    ordinal: config.ordinal ?? undefined,
    automationId: config.automation_id ?? undefined,
  };
}
