import { randomUUID } from "node:crypto";
import type {
  ActionConfig,
  DragTargetPosition,
  ElementTarget,
} from "../../../src/types/workflow.js";
import type { AppPaths } from "../db/database.js";
import {
  requireWebSurface,
  type BrowserDriverLocator,
  type BrowserDriverPage,
} from "./surface.js";
import { hostnameAllowed } from "./domainPolicy.js";
import {
  locatorFor,
  locatorForRuntimeElementRef,
  rankedCandidatesForTarget,
  selectRankedElementCandidate,
  type RuntimeElementRef,
} from "./targetResolver.js";
import {
  centerPoint,
  dragTargetPoint,
  type PointerBox,
} from "./interactionPrimitives.js";
import {
  executePasteClipboardAction,
  executeScrollAction,
  nativePointerLocatorIntoView,
  pressHotkeyHuman,
  pressKeyHuman,
  registerDialogHandler,
  type CloakHumanScrollAdapter,
} from "./interactionActions.js";
import {
  waitForLocatorState,
} from "./runtimeHelpers.js";
import { waitForRunnerDownload } from "./runnerEvidence.js";
import type { RunnerActionRuntime } from "./executors/types.js";

function webSurfaceOf(runtime: Pick<RunnerActionRuntime, "surface">) {
  return requireWebSurface(runtime.surface, "web interaction");
}

export type WebInteractionEngineOptions = {
  appPaths: AppPaths;
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  random: () => number;
  cloakHumanScroll?: CloakHumanScrollAdapter;
};

export class WebInteractionEngine {
  constructor(private readonly options: WebInteractionEngineOptions) {}

  get appPaths(): AppPaths {
    return this.options.appPaths;
  }

  get sleep(): (ms: number, signal?: AbortSignal) => Promise<void> {
    return this.options.sleep;
  }

  get random(): () => number {
    return this.options.random;
  }

  get cloakHumanScroll(): CloakHumanScrollAdapter | undefined {
    return this.options.cloakHumanScroll;
  }

  private throwIfCancelled(signal?: AbortSignal) {
    if (signal?.aborted) {
      throw new Error("Run stopped");
    }
  }

  async enforceNavigationPolicy(
    runtime: RunnerActionRuntime & { domainPolicy?: { allowed_domains?: string[] } },
    url: string,
  ): Promise<void> {
    const allowedDomains = runtime.domainPolicy?.allowed_domains ?? [];
    if (allowedDomains.length === 0) return;

    let hostname: string;
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch {
      throw new Error(`Navigation URL is invalid for domain allowlist: ${url}`);
    }

    if (hostnameAllowed(hostname, allowedDomains)) return;
    throw new Error(
      `Navigation to ${hostname} is not in the allowlist (${allowedDomains.join(", ")})`,
    );
  }

  async executeWait(
    runtime: RunnerActionRuntime,
    action: Extract<ActionConfig, { type: "wait" }>,
  ): Promise<void> {
    switch (action.config.condition) {
      case "duration":
        await this.sleep(action.config.duration_ms ?? 1000, runtime.signal);
        return;
      case "page_load":
        await webSurfaceOf(runtime).page.waitForLoadState?.("load", {
          timeout: action.config.timeout_ms ?? undefined,
        });
        return;
      case "url_contains":
        await webSurfaceOf(runtime).page.waitForURL?.(
          (url: URL) => url.href.includes(action.config.url ?? ""),
          { timeout: action.config.timeout_ms ?? undefined },
        );
        return;
      case "element_visible":
        await waitForLocatorState(
          await this.locatorForAction(runtime, action.config, "body"),
          "visible",
          action.config.timeout_ms,
        );
        return;
      case "element_attached":
        await waitForLocatorState(
          await this.locatorForAction(runtime, action.config, "body"),
          "attached",
          action.config.timeout_ms,
        );
        return;
      case "element_enabled": {
        const locator = await this.locatorForAction(runtime, action.config, "body");
        await waitForLocatorState(locator, "visible", action.config.timeout_ms);
        await this.waitForLocatorEnabled(locator, true, action.config.timeout_ms, runtime.signal);
        return;
      }
      case "text_visible":
        await waitForLocatorState(
          webSurfaceOf(runtime).page.locator(`text=${action.config.text ?? ""}`),
          "visible",
          action.config.timeout_ms,
        );
        return;
      case "element_hidden":
        await waitForLocatorState(
          await this.locatorForAction(runtime, action.config, "body"),
          "hidden",
          action.config.timeout_ms,
        );
        return;
      case "element_detached":
        await waitForLocatorState(
          await this.locatorForAction(runtime, action.config, "body"),
          "detached",
          action.config.timeout_ms,
        );
        return;
      case "element_disabled":
        await this.waitForLocatorEnabled(
          await this.locatorForAction(runtime, action.config, "body"),
          false,
          action.config.timeout_ms,
          runtime.signal,
        );
        return;
    }
  }

  async waitForLocatorEnabled(
    locator: BrowserDriverLocator,
    enabled: boolean,
    timeoutMs: number | null | undefined,
    signal?: AbortSignal,
    retryIntervalMs = 100,
  ): Promise<void> {
    const deadline = Date.now() + (timeoutMs ?? 30_000);
    while (Date.now() <= deadline) {
      this.throwIfCancelled(signal);
      const current = await locator.isEnabled?.();
      if (current === enabled) return;
      await this.sleep(
        Math.min(retryIntervalMs, Math.max(1, deadline - Date.now())),
        signal,
      );
    }
    throw new Error(`Element did not become ${enabled ? "enabled" : "disabled"}`);
  }

  async executeDragAndDrop(
    runtime: RunnerActionRuntime,
    action: Extract<ActionConfig, { type: "drag_and_drop" }>,
  ): Promise<void> {
    const source = await this.locatorForDragEndpoint(runtime, action, "source");
    const target = await this.locatorForDragEndpoint(runtime, action, "target");
    await this.waitForElementReadiness(
      source,
      action.config.wait_until ?? null,
      action.config.timeout_ms,
      runtime.signal,
      undefined,
    );
    await this.waitForElementReadiness(
      target,
      action.config.wait_until ?? null,
      action.config.timeout_ms,
      runtime.signal,
      undefined,
    );

    const targetPosition = action.config.target_position;
    if (targetPosition && targetPosition.mode !== "center") {
      await this.executePositionedDragAndDrop(
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

  async locatorForDragEndpoint(
    runtime: RunnerActionRuntime,
    action: Extract<ActionConfig, { type: "drag_and_drop" }>,
    endpoint: "source" | "target",
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
        this.getEffectiveIframeXpath(runtime, action.config.iframe_xpath),
      );
    }

    return locatorFor(
      webSurfaceOf(runtime).page,
      action.config.target_target,
      action.config.target_xpath,
      this.getEffectiveIframeXpath(runtime, action.config.iframe_xpath),
    );
  }

  async locatorForCustomSelectTrigger(
    runtime: RunnerActionRuntime,
    action: Extract<ActionConfig, { type: "select_custom_option" }>,
  ): Promise<BrowserDriverLocator> {
    if (action.config.trigger_ref != null) {
      const refName = action.config.trigger_ref.trim();
      if (!refName) {
        throw new Error("Trigger ref is required");
      }
      const ref = runtime.elementRefs.get(refName);
      if (!ref) {
        throw new Error(`Element ref not found: ${action.config.trigger_ref}`);
      }
      return locatorForRuntimeElementRef(webSurfaceOf(runtime).page, ref);
    }

    return locatorFor(
      webSurfaceOf(runtime).page,
      action.config.trigger_target,
      action.config.trigger_xpath,
      this.getEffectiveIframeXpath(runtime, action.config.iframe_xpath),
    );
  }

  async executePositionedDragAndDrop(
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
    this.throwIfCancelled(runtime.signal);

    const sourceBox = await this.locatorBoundingBox(source, "source");
    const targetBox = await this.locatorBoundingBox(target, "target");
    const sourcePoint = centerPoint(sourceBox);
    const targetPoint = dragTargetPoint(targetBox, position);

    this.throwIfCancelled(runtime.signal);
    await mouse.move(sourcePoint.x, sourcePoint.y);
    this.throwIfCancelled(runtime.signal);
    await mouse.down({ button: "left" });
    try {
      this.throwIfCancelled(runtime.signal);
      await mouse.move(targetPoint.x, targetPoint.y);
      this.throwIfCancelled(runtime.signal);
    } finally {
      await mouse.up({ button: "left" });
    }
  }

  async locatorBoundingBox(
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

  async locatorForAction(
    runtime: RunnerActionRuntime,
    config: {
      target?: ElementTarget | null;
      target_ref?: string | null;
      xpath?: string | null;
      iframe_xpath?: string | null;
      wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
      timeout_ms?: number | null;
    },
    fallbackXpath = "body",
  ): Promise<BrowserDriverLocator> {
    if (config.target_ref?.trim()) {
      const ref = runtime.elementRefs.get(config.target_ref.trim());
      if (!ref) {
        throw new Error(`Element ref not found: ${config.target_ref}`);
      }
      const locator = await locatorForRuntimeElementRef(webSurfaceOf(runtime).page, ref);
      await this.waitForElementReadiness(
        locator,
        config.wait_until ?? null,
        config.timeout_ms,
        runtime.signal,
      );
      return locator;
    }

    const locator = await locatorFor(
      webSurfaceOf(runtime).page,
      config.target,
      config.xpath ?? fallbackXpath,
      this.getEffectiveIframeXpath(runtime, config.iframe_xpath),
    );
    await this.waitForElementReadiness(
      locator,
      config.wait_until ?? null,
      config.timeout_ms,
      runtime.signal,
    );
    return locator;
  }

  getEffectiveIframeXpath(runtime: RunnerActionRuntime, iframeXpath?: string | null): string | null {
    return iframeXpath || webSurfaceOf(runtime).activeFrameXpath || null;
  }

  async executeFindElement(
    runtime: RunnerActionRuntime,
    action: Extract<ActionConfig, { type: "find_element" }>,
  ): Promise<void> {
    const outputName = action.config.output_name.trim();
    const rank = action.config.rank ?? "nearest_viewport_center";
    const candidates = await this.waitForFindElementCandidates(
      runtime,
      action.config,
    );
    if (!candidates.length) {
      throw new Error("No element locator satisfied target constraints");
    }
    const selected = await selectRankedElementCandidate(webSurfaceOf(runtime).page, candidates, rank);
    const target = action.config.target ?? {
      locators: [selected.locatorConfig],
      constraints: null,
      iframe: null,
    };
    const ref: RuntimeElementRef = {
      refId: randomUUID(),
      target,
      locator: selected.locatorConfig,
      index: selected.index,
      outputName,
      rank,
    };
    runtime.elementRefs.set(outputName, ref);
    runtime.outputs[outputName] = {
      kind: "element_ref",
      ref_id: ref.refId,
      locator: selected.locatorConfig.value,
      locator_kind: selected.locatorConfig.kind,
      index: selected.index,
      rank,
      box: selected.box,
    };
  }

  async waitForFindElementCandidates(
    runtime: RunnerActionRuntime,
    config: Extract<ActionConfig, { type: "find_element" }>["config"],
  ) {
    const timeoutMs = config.timeout_ms ?? 0;
    const deadline = Date.now() + timeoutMs;
    const effectiveIframe = this.getEffectiveIframeXpath(runtime, config.iframe_xpath);
    do {
      this.throwIfCancelled(runtime.signal);
      const candidates = await rankedCandidatesForTarget(
        webSurfaceOf(runtime).page,
        config.target,
        config.xpath,
        effectiveIframe,
        Boolean(config.filter?.in_viewport),
      );
      if (candidates.length || timeoutMs <= 0) return candidates;
      await this.sleep(Math.min(100, Math.max(1, deadline - Date.now())), runtime.signal);
    } while (Date.now() < deadline);
    return rankedCandidatesForTarget(
      webSurfaceOf(runtime).page,
      config.target,
      config.xpath,
      effectiveIframe,
      Boolean(config.filter?.in_viewport),
    );
  }

  async waitForElementReadiness(
    locator: BrowserDriverLocator,
    waitUntil: unknown,
    timeoutMs: number | null | undefined,
    signal?: AbortSignal,
    retryIntervalMs?: number | null,
  ): Promise<void> {
    switch (waitUntil) {
      case "attached":
        await waitForLocatorState(locator, "attached", timeoutMs);
        return;
      case "visible":
        await waitForLocatorState(locator, "visible", timeoutMs);
        return;
      case "enabled":
      case "clickable":
        await waitForLocatorState(locator, "visible", timeoutMs);
        await this.waitForLocatorEnabled(
          locator,
          true,
          timeoutMs,
          signal,
          retryIntervalMs ?? undefined,
        );
        return;
      case null:
        return;
      default:
        throw new Error("Wait until must be attached, visible, enabled, or clickable");
    }
  }

  async executeScroll(
    runtime: RunnerActionRuntime,
    action: Extract<ActionConfig, { type: "scroll" }>,
  ): Promise<void> {
    return executeScrollAction(runtime, action, {
      locatorForAction: (_scrollRuntime, config, fallbackXpath) =>
        this.locatorForAction(runtime, config, fallbackXpath),
      cloakHumanScroll: this.cloakHumanScroll,
      sleep: this.sleep,
      random: this.random,
    });
  }

  async pressKeyHuman(
    page: BrowserDriverPage,
    key: string,
    signal?: AbortSignal,
  ): Promise<void> {
    return pressKeyHuman(page, key, this.sleep, this.random, signal);
  }

  async pressHotkeyHuman(
    page: BrowserDriverPage,
    keys: string[],
    signal?: AbortSignal,
  ): Promise<void> {
    return pressHotkeyHuman(page, keys, this.sleep, this.random, signal);
  }

  async executePasteClipboard(
    runtime: RunnerActionRuntime,
    action: Extract<ActionConfig, { type: "paste_clipboard" }>,
  ): Promise<void> {
    return executePasteClipboardAction(runtime, action, {
      locatorForAction: (_pasteRuntime, config) => this.locatorForAction(runtime, config),
    });
  }

  registerDialogHandler(
    runtime: RunnerActionRuntime,
    behavior: "accept" | "dismiss",
    promptText?: string | null,
  ): () => void {
    return registerDialogHandler(runtime, behavior, promptText);
  }

  async waitForDownload(
    runtime: RunnerActionRuntime,
    outputName: string,
    timeoutMs: number,
  ): Promise<void> {
    return waitForRunnerDownload(this.appPaths, runtime, outputName, timeoutMs);
  }
}
