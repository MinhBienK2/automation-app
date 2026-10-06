import type {
  ActionConfig,
  DragTargetPosition,
} from "../../../src/types/workflow.js";
import {
  requireWebSurface,
  type BrowserDriverLocator,
} from "./surface.js";
import {
  locatorFor,
  locatorForRuntimeElementRef,
} from "./targetResolver.js";
import {
  centerPoint,
  dragTargetPoint,
  type PointerBox,
} from "./interactionPrimitives.js";
import {
  nativePointerLocatorIntoView,
} from "./interactionActions.js";
import type { RunnerActionRuntime } from "./executors/types.js";

function webSurfaceOf(runtime: Pick<RunnerActionRuntime, "surface">) {
  return requireWebSurface(runtime.surface, "web interaction");
}

export async function locatorBoundingBox(
  locator: BrowserDriverLocator,
  role: "source" | "target",
): Promise<PointerBox> {
  if (!locator.boundingBox) {
    throw new Error(`drag_and_drop ${role} requires driver boundingBox support`);
  }
  const box = await locator.boundingBox();
  if (!box || !Number.isFinite(box.width) || !Number.isFinite(box.height)) {
    throw new Error(`Drag ${role} element has no visible bounding box`);
  }
  return box;
}

export async function locatorForDragEndpoint(
  runtime: RunnerActionRuntime,
  action: Extract<ActionConfig, { type: "drag_and_drop" }>,
  endpoint: "source" | "target",
  getEffectiveIframeXpath: (runtime: RunnerActionRuntime, iframeXpath?: string | null) => string | null,
): Promise<BrowserDriverLocator> {
  const refName = endpoint === "source" ? action.config.source_ref : action.config.target_ref;
  if (refName?.trim()) {
    const trimmedRefName = refName.trim();
    const ref = runtime.elementRefs.get(trimmedRefName);
    if (!ref) {
      throw new Error(`Element ref not found: ${refName}`);
    }
    return locatorForRuntimeElementRef(webSurfaceOf(runtime).page, ref);
  }

  if (endpoint === "source") {
    return locatorFor(
      webSurfaceOf(runtime).page,
      action.config.source_target,
      action.config.source_xpath,
      getEffectiveIframeXpath(runtime, action.config.iframe_xpath),
    );
  }

  return locatorFor(
    webSurfaceOf(runtime).page,
    action.config.target_target,
    action.config.target_xpath,
    getEffectiveIframeXpath(runtime, action.config.iframe_xpath),
  );
}

export async function executePositionedDragAndDrop(
  runtime: RunnerActionRuntime,
  source: BrowserDriverLocator,
  target: BrowserDriverLocator,
  position: DragTargetPosition,
  timeoutMs: number | null | undefined,
): Promise<void> {
  const mouse = webSurfaceOf(runtime).page.mouse;
  if (!mouse?.move || !mouse.down || !mouse.up) {
    throw new Error("drag_and_drop target_position requires driver mouse support");
  }

  await nativePointerLocatorIntoView(source, timeoutMs);
  await nativePointerLocatorIntoView(target, timeoutMs);
  if (runtime.signal?.aborted) throw new Error("Run stopped");

  const sourceBox = await locatorBoundingBox(source, "source");
  const targetBox = await locatorBoundingBox(target, "target");
  const sourcePoint = centerPoint(sourceBox);
  const targetPoint = dragTargetPoint(targetBox, position);

  if (runtime.signal?.aborted) throw new Error("Run stopped");
  await mouse.move(sourcePoint.x, sourcePoint.y);
  if (runtime.signal?.aborted) throw new Error("Run stopped");
  await mouse.down({ button: "left" });
  try {
    if (runtime.signal?.aborted) throw new Error("Run stopped");
    await mouse.move(targetPoint.x, targetPoint.y);
    if (runtime.signal?.aborted) throw new Error("Run stopped");
  } finally {
    await mouse.up({ button: "left" });
  }
}

export async function executeDragAndDrop(
  runtime: RunnerActionRuntime,
  action: Extract<ActionConfig, { type: "drag_and_drop" }>,
  getEffectiveIframeXpath: (runtime: RunnerActionRuntime, iframeXpath?: string | null) => string | null,
  waitForElementReadiness: (
    locator: BrowserDriverLocator,
    waitUntil: unknown,
    timeoutMs: number | null | undefined,
    signal?: AbortSignal,
    retryIntervalMs?: number | null,
  ) => Promise<void>,
): Promise<void> {
  const source = await locatorForDragEndpoint(runtime, action, "source", getEffectiveIframeXpath);
  const target = await locatorForDragEndpoint(runtime, action, "target", getEffectiveIframeXpath);
  await waitForElementReadiness(
    source,
    action.config.wait_until ?? null,
    action.config.timeout_ms,
    runtime.signal,
    undefined,
  );
  await waitForElementReadiness(
    target,
    action.config.wait_until ?? null,
    action.config.timeout_ms,
    runtime.signal,
    undefined,
  );

  const targetPosition = action.config.target_position;
  if (targetPosition && targetPosition.mode !== "center") {
    await executePositionedDragAndDrop(
      runtime,
      source,
      target,
      targetPosition,
      action.config.timeout_ms,
    );
    return;
  }

  if (!source.dragTo) {
    throw new Error("drag_and_drop requires driver dragTo support");
  }
  await source.dragTo(target, { timeout: action.config.timeout_ms ?? undefined });
}
