import type { BrowserDriverLocator, BrowserDriverPage } from "../browser/sessionManager.js";

export function assertRuntimeEnumValue(
  value: unknown,
  allowedValues: readonly string[],
  message: string,
) {
  if (typeof value !== "string" || !allowedValues.includes(value)) {
    throw new Error(message);
  }
}

export async function waitForLocatorState(
  locator: BrowserDriverLocator,
  state: "attached" | "detached" | "visible" | "hidden",
  timeoutMs: number | null | undefined,
) {
  if (locator.waitFor) {
    await locator.waitFor({ state, timeout: timeoutMs ?? undefined });
    return;
  }
  if (state === "visible") {
    const visible = await locator.isVisible?.({ timeout: timeoutMs ?? undefined });
    if (!visible) throw new Error("Element is not visible");
  }
}

export async function assertElementState(
  locator: BrowserDriverLocator,
  state: "attached" | "visible" | "hidden" | "enabled" | "disabled",
  timeoutMs: number | null | undefined,
) {
  if (state === "attached") {
    await locator.waitFor?.({ state: "attached", timeout: timeoutMs ?? undefined });
    if (!locator.count) throw new Error("Element attached assertion requires locator count support");
    if ((await locator.count()) <= 0) throw new Error("Element is not attached");
    return;
  }

  if (state === "visible" || state === "hidden") {
    await locator.waitFor?.({ state, timeout: timeoutMs ?? undefined });
    if (!locator.isVisible) throw new Error("Element visibility assertion requires locator visibility support");
    const visible = await locator.isVisible({ timeout: timeoutMs ?? undefined });
    if (state === "visible" && !visible) throw new Error("Element is not visible");
    if (state === "hidden" && visible) throw new Error("Element is not hidden");
    return;
  }

  await locator.waitFor?.({ state: "visible", timeout: timeoutMs ?? undefined });
  if (!locator.isEnabled) throw new Error("Element enabled assertion requires locator enabled-state support");
  const enabled = await locator.isEnabled({ timeout: timeoutMs ?? undefined });
  if (state === "enabled" && !enabled) throw new Error("Element is not enabled");
  if (state === "disabled" && enabled) throw new Error("Element is not disabled");
}

export function requireLocatorMethod(
  locator: BrowserDriverLocator,
  method: keyof BrowserDriverLocator,
  actionType: string,
): (...args: unknown[]) => Promise<unknown> {
  const methodValue = locator[method];
  if (typeof methodValue !== "function") {
    throw new Error(`${actionType} requires driver support for locator.${String(method)}`);
  }
  return methodValue.bind(locator) as (...args: unknown[]) => Promise<unknown>;
}

export async function setWebStorage(
  page: BrowserDriverPage,
  storage: "local" | "session",
  key: string,
  value: string,
) {
  await page.evaluate(
    (entry?: {
      storage: "local" | "session";
      key: string;
      value: string;
    }) => {
      if (!entry) return;
      const target =
        entry.storage === "local" ? window.localStorage : window.sessionStorage;
      target.setItem(entry.key, entry.value);
    },
    { storage, key, value },
  );
}

export function waitUntil(value: string | null | undefined) {
  if (value === "dom_content_loaded") return "domcontentloaded";
  if (value === "network_idle") return "networkidle";
  return value ?? "load";
}

export function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Run stopped", "AbortError"));
      return;
    }
    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(new DOMException("Run stopped", "AbortError"));
      },
      { once: true },
    );
  });
}

export function weightedRandomChoice<T extends { id: string; weight: number }>(
  choices: T[],
  random: () => number,
): T {
  if (choices.length === 0) throw new Error("Random choices are required");
  const totalWeight = choices.reduce((total, choice) => {
    if (!Number.isFinite(choice.weight) || choice.weight <= 0) {
      throw new Error("Random choice weight must be greater than 0");
    }
    return total + choice.weight;
  }, 0);
  let threshold = random() * totalWeight;
  for (const choice of choices) {
    threshold -= choice.weight;
    if (threshold < 0) return choice;
  }
  return choices[choices.length - 1];
}

export function executableJavaScript(script: string) {
  return `(() => {\n${script}\n})()`;
}

export async function withActionTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number | null | undefined,
  message: (timeoutMs: number) => string,
) {
  if (!timeoutMs) return promise;
  return new Promise<T>((resolve, reject) => {
    const handle = setTimeout(() => reject(new Error(message(timeoutMs))), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(handle);
        resolve(value);
      },
      (error) => {
        clearTimeout(handle);
        reject(error);
      },
    );
  });
}

export async function extractListLike(locator: BrowserDriverLocator) {
  const count = (await locator.count?.()) ?? 0;
  const values: string[] = [];
  for (let index = 0; index < count; index += 1) {
    values.push((await locator.nth?.(index).textContent?.()) ?? "");
  }
  return values;
}

export async function extractTable(locator: BrowserDriverLocator) {
  if (locator.evaluate) {
    return locator.evaluate((element) => {
      const table = element instanceof HTMLTableElement ? element : element.closest("table");
      const root = table ?? element;
      return Array.from(root.querySelectorAll("tr")).map((row) =>
        Array.from(row.querySelectorAll("th,td")).map((cell) =>
          cell.textContent?.trim() ?? "",
        ),
      );
    });
  }

  return extractListLike(locator);
}
