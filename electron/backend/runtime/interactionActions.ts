import type {
  ActionConfig,
} from "../../../src/types/workflow.js";
import type {
  BrowserDriverLocator,
  BrowserDriverPage,
} from "../browser/sessionManager.js";
import {
  PAGE_SCROLL_PULSE_PAUSE_MAX_MS,
  PAGE_SCROLL_PULSE_PAUSE_MIN_MS,
  SCROLL_TARGET_DEFAULT_TIMEOUT_MS,
  SCROLL_UNTIL_VISIBLE_ATTEMPT_BUDGET_MS,
  SCROLL_UNTIL_VISIBLE_DEFAULT_PIXELS,
  decisivePageScrollSteps,
  humanScrollPauseMs,
  humanScrollProfile,
  humanTargetScrollChunk,
  keyGapMs,
  keyHoldMs,
  mouseMovePauseMs,
  nextScrollChunk,
  scrollGesturePulseCount,
  scrollGesturePulses,
  scrollPauseMs,
  scrollPlanForBox,
  scrollPulsePauseMs,
  type ScrollBox,
  type ScrollViewport,
} from "./interactionPrimitives.js";

import type { RunnerActionRuntime } from "./actionRuntime.js";

type ScrollDirection = "up" | "down" | "left" | "right" | null | undefined;

// Derived, not restated. These were hand-written copies of parts of the
// runtime, free to drift from the shape callers actually pass.
type ScrollActionRuntime = Pick<RunnerActionRuntime, "page" | "settings" | "signal">;

type PasteClipboardRuntime = Pick<
  RunnerActionRuntime,
  "page" | "context" | "clipboard" | "signal"
>;

export type CloakHumanScrollAdapter = (input: {
  page: BrowserDriverPage;
  locator: BrowserDriverLocator;
  timeoutMs?: number | null;
  preset?: string | null;
  signal?: AbortSignal;
}) => Promise<boolean>;

type CloakHumanModule = {
  humanScrollIntoView?: (
    page: BrowserDriverPage,
    raw: {
      move: (x: number, y: number) => Promise<void>;
      down: (options?: Record<string, unknown>) => Promise<void>;
      up: (options?: Record<string, unknown>) => Promise<void>;
      wheel: (deltaX: number, deltaY: number) => Promise<void>;
    },
    getBox: () => Promise<ScrollBox | null>,
    cursorX: number,
    cursorY: number,
    cfg: Record<string, unknown>,
  ) => Promise<unknown>;
  resolveConfig?: (preset?: string) => Record<string, unknown>;
};

export async function submitFormTarget(locator: BrowserDriverLocator) {
  const failures: unknown[] = [];
  try {
    await locator.click();
    return;
  } catch (error) {
    failures.push(error);
  }

  if (locator.press) {
    try {
      await locator.press("Enter");
      return;
    } catch (error) {
      failures.push(error);
    }
  }

  if (locator.evaluate) {
    await locator.evaluate((element) => {
      const form = element instanceof HTMLFormElement ? element : element.closest("form");
      if (!form) {
        if (element instanceof HTMLElement) element.click();
        return;
      }

      const submitter =
        element instanceof HTMLButtonElement ||
        (element instanceof HTMLInputElement &&
          (element.type === "submit" || element.type === "image"))
          ? element
          : undefined;

      if (form.requestSubmit) {
        form.requestSubmit(submitter);
        return;
      }

      const event = new Event("submit", { bubbles: true, cancelable: true });
      if (form.dispatchEvent(event)) form.submit();
    });
    return;
  }

  throw firstActionFailure(failures, "submit_form could not click, press, or submit the target");
}

export async function blurElementTarget(locator: BrowserDriverLocator) {
  if (!locator.evaluate) {
    throw new Error("blur_element requires driver support for locator.evaluate");
  }
  await locator.evaluate((element) => {
    if (element instanceof HTMLElement) element.blur();
  });
}

export async function selectRadioTarget(locator: BrowserDriverLocator) {
  const failures: unknown[] = [];
  if (locator.check) {
    try {
      await locator.check();
      return;
    } catch (error) {
      failures.push(error);
    }
  }

  try {
    await locator.click();
    return;
  } catch (error) {
    failures.push(error);
  }

  if (locator.evaluate) {
    await locator.evaluate((element) => {
      const radio =
        element instanceof HTMLInputElement && element.type === "radio"
          ? element
          : element.querySelector<HTMLInputElement>("input[type='radio']");

      if (!radio) {
        if (element instanceof HTMLElement) element.click();
        return;
      }

      if (radio.checked) return;
      radio.checked = true;
      radio.dispatchEvent(new Event("input", { bubbles: true }));
      radio.dispatchEvent(new Event("change", { bubbles: true }));
    });
    return;
  }

  throw firstActionFailure(failures, "select_radio could not check or click the target");
}

export async function humanPageScroll(
  page: BrowserDriverPage,
  direction: ScrollDirection,
  pixels: number,
  sleepFn: (ms: number, signal?: AbortSignal) => Promise<void>,
  random: () => number,
  signal?: AbortSignal,
) {
  const deltaX = direction === "left" ? -pixels : direction === "right" ? pixels : 0;
  const deltaY = direction === "up" ? -pixels : direction === "down" ? pixels : 0;
  if (page.mouse?.wheel) {
    const distance = Math.max(Math.abs(deltaX), Math.abs(deltaY));
    const steps = decisivePageScrollSteps(distance);
    let remainingX = deltaX;
    let remainingY = deltaY;
    for (let remainingSteps = steps; remainingSteps > 0; remainingSteps -= 1) {
      throwIfAborted(signal);
      const chunkX = nextScrollChunk(remainingX, remainingSteps, random);
      const chunkY = nextScrollChunk(remainingY, remainingSteps, random);
      await humanScrollGesture(
        page,
        chunkX,
        chunkY,
        sleepFn,
        random,
        signal,
        {
          pulsePauseMinMs: PAGE_SCROLL_PULSE_PAUSE_MIN_MS,
          pulsePauseMaxMs: PAGE_SCROLL_PULSE_PAUSE_MAX_MS,
        },
      );
      remainingX -= chunkX;
      remainingY -= chunkY;
      if (remainingSteps > 1) {
        await sleepFn(scrollPauseMs(random), signal);
      }
    }
    return;
  }
  await page.evaluate(
    (payload?: { deltaX: number; deltaY: number }) => {
      const { deltaX: x, deltaY: y } = payload ?? { deltaX: 0, deltaY: 0 };
      window.scrollBy({ left: x, top: y, behavior: "instant" });
      window.dispatchEvent(new Event("scroll"));
    },
    { deltaX, deltaY },
  );
}

export async function executeScrollAction(
  runtime: ScrollActionRuntime,
  action: Extract<ActionConfig, { type: "scroll" }>,
  deps: {
    locatorForAction: (
      runtime: ScrollActionRuntime,
      config: Extract<ActionConfig, { type: "scroll" }>["config"],
      fallbackXpath?: string,
    ) => Promise<BrowserDriverLocator>;
    cloakHumanScroll: CloakHumanScrollAdapter;
    sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
    random: () => number;
  },
) {
  const mode = action.config.mode ?? "page";
  assertInteractionEnumValue(
    mode,
    ["page", "into_view", "until_element_visible"],
    "Scroll mode must be page, into_view, or until_element_visible",
  );
  if (mode === "page") {
    const scrollStyle = action.config.scroll_style ?? "human_like";
    assertInteractionEnumValue(
      scrollStyle,
      ["human_like", "smooth_single"],
      "Scroll style must be human_like or smooth_single",
    );
    if (scrollStyle === "smooth_single") {
      await smoothSinglePageScroll(
        runtime.page,
        action.config.direction ?? "down",
        action.config.pixels ?? 0,
        runtime.signal,
      );
    } else {
      await humanPageScroll(
        runtime.page,
        action.config.direction ?? "down",
        action.config.pixels ?? 0,
        deps.sleep,
        deps.random,
        runtime.signal,
      );
    }
    return;
  }

  const locator = await deps.locatorForAction(runtime, action.config, "");
  if (mode === "until_element_visible") {
    await humanScrollUntilLocatorVisible(
      runtime.page,
      locator,
      action.config.direction ?? "down",
      action.config.pixels ?? SCROLL_UNTIL_VISIBLE_DEFAULT_PIXELS,
      action.config.timeout_ms,
      deps.sleep,
      deps.random,
      runtime.signal,
      runtime.settings.browser_launch.human_preset,
    );
  }

  const handledByCloakBrowser = await deps.cloakHumanScroll({
    page: runtime.page,
    locator,
    timeoutMs: action.config.timeout_ms,
    preset: runtime.settings.browser_launch.human_preset,
    signal: runtime.signal,
  });
  if (handledByCloakBrowser) return;

  await humanScrollLocatorIntoView(
    runtime.page,
    locator,
    action.config.timeout_ms,
    deps.sleep,
    deps.random,
    runtime.signal,
    runtime.settings.browser_launch.human_preset,
  );
}

export async function smoothSinglePageScroll(
  page: BrowserDriverPage,
  direction: ScrollDirection,
  pixels: number,
  signal?: AbortSignal,
) {
  throwIfAborted(signal);
  const deltaX = direction === "left" ? -pixels : direction === "right" ? pixels : 0;
  const deltaY = direction === "up" ? -pixels : direction === "down" ? pixels : 0;
  if (page.mouse?.wheel) {
    await page.mouse.wheel(deltaX, deltaY);
    return;
  }
  await page.evaluate(
    (payload?: { deltaX: number; deltaY: number }) => {
      const { deltaX: x, deltaY: y } = payload ?? { deltaX: 0, deltaY: 0 };
      window.scrollBy({ left: x, top: y, behavior: "smooth" });
    },
    { deltaX, deltaY },
  );
}

export async function cloakBrowserHumanScrollLocatorIntoView({
  page,
  locator,
  timeoutMs,
  preset,
  signal,
}: Parameters<CloakHumanScrollAdapter>[0]) {
  throwIfAborted(signal);
  if (!locator.boundingBox || !page.mouse?.move || !page.mouse.down || !page.mouse.up || !page.mouse.wheel) {
    return false;
  }
  if (typeof (page as { viewportSize?: unknown }).viewportSize !== "function") {
    return false;
  }

  const cloakHuman = await loadCloakHumanModule();
  if (!cloakHuman?.humanScrollIntoView || !cloakHuman.resolveConfig) return false;

  try {
    const cfg = cloakHuman.resolveConfig(preset === "careful" ? "careful" : "default");
    await cloakHuman.humanScrollIntoView(
      page,
      {
        move: page.mouse.move.bind(page.mouse),
        down: page.mouse.down.bind(page.mouse),
        up: page.mouse.up.bind(page.mouse),
        wheel: page.mouse.wheel.bind(page.mouse),
      },
      () => locatorBoundingBox(locator, timeoutMs),
      0,
      0,
      cfg,
    );
    throwIfAborted(signal);
    return true;
  } catch {
    throwIfAborted(signal);
    return false;
  }
}

export async function humanScrollUntilLocatorVisible(
  page: BrowserDriverPage,
  locator: BrowserDriverLocator,
  direction: ScrollDirection,
  pixels: number,
  timeoutMs: number | null | undefined,
  sleepFn: (ms: number, signal?: AbortSignal) => Promise<void>,
  random: () => number,
  signal?: AbortSignal,
  preset?: string | null,
) {
  const timeoutBudgetMs = timeoutMs ?? SCROLL_TARGET_DEFAULT_TIMEOUT_MS;
  const maxAttempts = Math.max(
    1,
    Math.min(240, Math.ceil(timeoutBudgetMs / SCROLL_UNTIL_VISIBLE_ATTEMPT_BUDGET_MS)),
  );
  const profile = humanScrollProfile(preset);
  const startedAt = Date.now();

  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    throwIfAborted(signal);
    if (Date.now() - startedAt > timeoutBudgetMs) {
      throw new Error(`Scroll target did not become visible within ${timeoutBudgetMs} ms`);
    }

    if (await locatorHasVisibleBox(locator, 200)) return;
    if (attempt === maxAttempts) break;

    await humanPageScroll(page, direction ?? "down", pixels, sleepFn, random, signal);
    await sleepFn(humanScrollPauseMs(profile, random, pixels), signal);
  }

  throw new Error("Scroll target did not become visible before max attempts");
}

export async function humanScrollLocatorIntoView(
  page: BrowserDriverPage,
  locator: BrowserDriverLocator,
  timeoutMs: number | null | undefined,
  sleepFn: (ms: number, signal?: AbortSignal) => Promise<void>,
  random: () => number,
  signal?: AbortSignal,
  preset?: string | null,
) {
  if (!locator.boundingBox) {
    throw new Error("Scroll To Element requires driver support for locator.boundingBox");
  }
  const profile = humanScrollProfile(preset);
  const timeoutBudgetMs = timeoutMs ?? SCROLL_TARGET_DEFAULT_TIMEOUT_MS;
  const maxAttempts = Math.max(20, Math.min(600, Math.ceil(timeoutBudgetMs / 70)));
  const startedAt = Date.now();
  let lastDistance = Number.POSITIVE_INFINITY;
  let stalledAttempts = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    throwIfAborted(signal);
    if (Date.now() - startedAt > timeoutBudgetMs) {
      throw new Error(`Scroll target did not enter the viewport within ${timeoutBudgetMs} ms`);
    }

    const viewport = await viewportSizeFor(page);
    const box = await locator.boundingBox();
    if (!box) {
      await sleepFn(humanScrollPauseMs(profile, random, profile.farDistance), signal);
      continue;
    }

    const plan = scrollPlanForBox(box, viewport);
    if (plan.done) return;

    if (plan.distance >= lastDistance - 2) {
      stalledAttempts += 1;
    } else {
      stalledAttempts = 0;
    }
    lastDistance = plan.distance;
    if (stalledAttempts >= 5) {
      throw new Error("Scroll target did not move closer to the viewport");
    }

    const chunk = humanTargetScrollChunk(plan, profile, random);
    await humanScrollGesture(
      page,
      chunk.deltaX,
      chunk.deltaY,
      sleepFn,
      random,
      signal,
      {
        pulsePauseMinMs: profile.pulsePauseMinMs,
        pulsePauseMaxMs: profile.pulsePauseMaxMs,
      },
    );

    await sleepFn(humanScrollPauseMs(profile, random, plan.distance), signal);
  }

  throw new Error("Scroll target did not enter the viewport before max attempts");
}

export async function nativePointerLocatorIntoView(
  locator: BrowserDriverLocator,
  timeoutMs: number | null | undefined,
) {
  if (locator.scrollIntoViewIfNeeded) {
    await locator.scrollIntoViewIfNeeded({ timeout: timeoutMs ?? undefined });
    return;
  }

  if (locator.evaluate) {
    await locator.evaluate(
      (element, arg?: { block: ScrollLogicalPosition; inline: ScrollLogicalPosition }) => {
        element.scrollIntoView({
          block: arg?.block ?? "center",
          inline: arg?.inline ?? "nearest",
          behavior: "smooth",
        });
      },
      { block: "center", inline: "nearest" },
    );
    return;
  }

  throw new Error("pointer action requires driver support for locator scroll into view");
}

export async function writeBrowserClipboard(page: BrowserDriverPage, text: string) {
  await page.evaluate(
    async (payload?: { text: string }) => {
      await navigator.clipboard.writeText(payload?.text ?? "");
    },
    { text },
  );
}

export async function pressKeyboardShortcut(page: BrowserDriverPage, shortcut: string) {
  if (page.keyboard?.press) {
    await page.keyboard.press(shortcut);
    return;
  }
  throw new Error("paste_clipboard requires driver keyboard shortcut support");
}

export async function executePasteClipboardAction(
  runtime: PasteClipboardRuntime,
  action: Extract<ActionConfig, { type: "paste_clipboard" }>,
  deps: {
    locatorForAction: (
      runtime: PasteClipboardRuntime,
      config: Extract<ActionConfig, { type: "paste_clipboard" }>["config"],
    ) => Promise<BrowserDriverLocator>;
  },
) {
  await runtime.context.grantPermissions?.(["clipboard-read", "clipboard-write"]).catch(() => undefined);
  await writeBrowserClipboard(runtime.page, runtime.clipboard);
  await (await deps.locatorForAction(runtime, action.config)).click();
  await pressKeyboardShortcut(
    runtime.page,
    process.platform === "darwin" ? "Meta+V" : "Control+V",
  );
}

export async function pressKeyHuman(
  page: BrowserDriverPage,
  key: string,
  sleepFn: (ms: number, signal?: AbortSignal) => Promise<void>,
  random: () => number,
  signal?: AbortSignal,
) {
  const keyboard = page.keyboard;
  if (!keyboard) return;
  if (keyboard.down && keyboard.up) {
    await keyboard.down(key);
    await sleepFn(keyHoldMs(random), signal);
    await keyboard.up(key);
    return;
  }
  await keyboard.press(key);
}

export async function pressHotkeyHuman(
  page: BrowserDriverPage,
  keys: string[],
  sleepFn: (ms: number, signal?: AbortSignal) => Promise<void>,
  random: () => number,
  signal?: AbortSignal,
) {
  const keyboard = page.keyboard;
  if (!keyboard) return;
  if (!keyboard.down || !keyboard.up) {
    await keyboard.press(keys.join("+"));
    return;
  }

  const primaryKey = keys[keys.length - 1];
  const modifiers = keys.slice(0, -1);
  for (const modifier of modifiers) {
    await keyboard.down(modifier);
    await sleepFn(keyGapMs(random), signal);
  }
  if (primaryKey) {
    await keyboard.down(primaryKey);
    await sleepFn(keyHoldMs(random), signal);
    await keyboard.up(primaryKey);
  }
  for (const modifier of [...modifiers].reverse()) {
    await sleepFn(keyGapMs(random), signal);
    await keyboard.up(modifier);
  }
}

export function registerDialogHandler(
  runtime: { page: BrowserDriverPage },
  behavior: "accept" | "dismiss",
  promptText?: string,
) {
  if (!runtime.page.once) {
    throw new Error(`${behavior}_dialog requires driver dialog event support`);
  }
  runtime.page.once("dialog", async (dialog) => {
    if (behavior === "accept") {
      await dialog.accept(promptText);
    } else {
      await dialog.dismiss();
    }
  });
}

export async function rightClickTarget(
  page: BrowserDriverPage,
  locator: BrowserDriverLocator,
  sleepFn: (ms: number, signal?: AbortSignal) => Promise<void>,
  random: () => number,
  timeoutMs: number | null | undefined,
  signal?: AbortSignal,
) {
  await nativePointerLocatorIntoView(locator, timeoutMs);
  const box = await locator.boundingBox?.();
  if (box && page.mouse?.move && page.mouse.down && page.mouse.up) {
    const targetX = Math.round((box.x ?? 0) + box.width / 2);
    const targetY = Math.round((box.y ?? 0) + box.height / 2);
    await humanMoveToPoint(page, targetX, targetY, sleepFn, random, signal);
    await page.mouse.down({ button: "right" });
    await sleepFn(keyHoldMs(random), signal);
    await page.mouse.up({ button: "right" });
    return;
  }
  await locator.click({ button: "right" });
}

async function loadCloakHumanModule(): Promise<CloakHumanModule | null> {
  try {
    return (await import("cloakbrowser/human")) as unknown as CloakHumanModule;
  } catch {
    return null;
  }
}

async function locatorBoundingBox(
  locator: BrowserDriverLocator,
  timeoutMs?: number | null,
): Promise<ScrollBox | null> {
  if (!locator.boundingBox) return null;
  return (
    locator.boundingBox as (options?: { timeout?: number }) => Promise<ScrollBox | null>
  )({ timeout: timeoutMs ?? undefined });
}

async function locatorHasVisibleBox(locator: BrowserDriverLocator, timeoutMs?: number) {
  let box: ScrollBox | null | undefined = null;
  try {
    box = await locatorBoundingBox(locator, timeoutMs);
  } catch {
    box = null;
  }
  if (box && box.width > 0 && box.height > 0) return true;
  if (!locator.boundingBox && locator.isVisible) {
    return locator.isVisible();
  }
  return false;
}

async function viewportSizeFor(page: BrowserDriverPage): Promise<ScrollViewport> {
  try {
    const viewport = await page.evaluate<Partial<ScrollViewport>>(() => ({
      width: window.innerWidth || document.documentElement.clientWidth || 1280,
      height: window.innerHeight || document.documentElement.clientHeight || 720,
    }));
    const width = typeof viewport?.width === "number" && viewport.width > 0 ? viewport.width : 1280;
    const height = typeof viewport?.height === "number" && viewport.height > 0 ? viewport.height : 720;
    return { width, height };
  } catch {
    return { width: 1280, height: 720 };
  }
}

async function humanScrollGesture(
  page: BrowserDriverPage,
  deltaX: number,
  deltaY: number,
  sleepFn: (ms: number, signal?: AbortSignal) => Promise<void>,
  random: () => number,
  signal: AbortSignal | undefined,
  timing: { pulsePauseMinMs: number; pulsePauseMaxMs: number },
) {
  const distance = Math.max(Math.abs(deltaX), Math.abs(deltaY));
  const pulseCount = scrollGesturePulseCount(distance, random);
  const pulsesX = scrollGesturePulses(deltaX, pulseCount, random);
  const pulsesY = scrollGesturePulses(deltaY, pulseCount, random);

  for (let index = 0; index < pulseCount; index += 1) {
    throwIfAborted(signal);
    await wheelOrScrollBy(page, pulsesX[index] ?? 0, pulsesY[index] ?? 0);
    if (index < pulseCount - 1) {
      await sleepFn(scrollPulsePauseMs(timing, random), signal);
    }
  }
}

async function wheelOrScrollBy(page: BrowserDriverPage, deltaX: number, deltaY: number) {
  if (page.mouse?.wheel) {
    await page.mouse.wheel(deltaX, deltaY);
    return;
  }
  await page.evaluate(
    (payload?: { deltaX: number; deltaY: number }) => {
      const { deltaX: x, deltaY: y } = payload ?? { deltaX: 0, deltaY: 0 };
      window.scrollBy({ left: x, top: y, behavior: "instant" });
      window.dispatchEvent(new Event("scroll"));
    },
    { deltaX, deltaY },
  );
}

async function humanMoveToPoint(
  page: BrowserDriverPage,
  targetX: number,
  targetY: number,
  sleepFn: (ms: number, signal?: AbortSignal) => Promise<void>,
  random: () => number,
  signal?: AbortSignal,
) {
  const steps = 3 + Math.floor(random() * 3);
  for (let index = 1; index <= steps; index += 1) {
    throwIfAborted(signal);
    const progress = index / steps;
    const wobble = index === steps ? 0 : (random() - 0.5) * 8;
    await page.mouse?.move?.(
      Math.round(targetX * progress + wobble),
      Math.round(targetY * progress + wobble),
    );
    if (index < steps) {
      await sleepFn(mouseMovePauseMs(random), signal);
    }
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("Run stopped", "AbortError");
  }
}

function firstActionFailure(failures: unknown[], fallbackMessage: string) {
  const firstFailure = failures.find((failure) => failure instanceof Error);
  return firstFailure instanceof Error ? firstFailure : new Error(fallbackMessage);
}

function assertInteractionEnumValue(
  value: unknown,
  allowedValues: readonly string[],
  message: string,
) {
  if (typeof value !== "string" || !allowedValues.includes(value)) {
    throw new Error(message);
  }
}
