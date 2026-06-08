import type {
  ElementLocator,
  ElementTarget,
  FindElementRank,
} from "../../../src/types/workflow.js";
import type {
  BrowserDriverFrameLocator,
  BrowserDriverLocator,
  BrowserDriverPage,
} from "../browser/sessionManager.js";

export type RuntimeElementRef = {
  refId: string;
  target: ElementTarget;
  locator: ElementLocator;
  index: number;
  outputName: string;
  rank: FindElementRank;
};

export type RankedElementCandidate = {
  locator: BrowserDriverLocator;
  locatorConfig: ElementLocator;
  index: number;
  box: { x?: number; y?: number; width: number; height: number } | null;
};

export async function locatorFor(
  page: BrowserDriverPage,
  target: unknown,
  xpath?: string | null,
  iframeXpath?: string | null,
): Promise<BrowserDriverLocator> {
  const typedTarget = isElementTarget(target) ? target : null;
  const root = typedTarget?.iframe
    ? frameRootForTarget(page, typedTarget.iframe)
    : iframeXpath?.trim()
      ? frameRootForXpath(page, iframeXpath)
      : page;
  const locators = typedTarget?.locators?.length
    ? typedTarget.locators
    : xpath?.trim()
      ? [{ kind: "xpath", value: xpath } satisfies ElementLocator]
      : [];
  const constraints = typedTarget?.constraints ?? null;

  let lastLocator: BrowserDriverLocator | null = null;
  for (const locatorConfig of locators) {
    const candidate = applyIndexConstraint(
      locatorFromConfig(root, locatorConfig),
      constraints?.index,
    );
    lastLocator = candidate;
    if (await locatorSatisfiesConstraints(candidate, constraints)) {
      return candidate;
    }
  }

  if (lastLocator) {
    throw new Error("No element locator satisfied target constraints");
  }
  throw new Error("Element target is required");
}

export async function rankedCandidatesForTarget(
  page: BrowserDriverPage,
  target: ElementTarget | null | undefined,
  xpath?: string | null,
  iframeXpath?: string | null,
  inViewportOnly = false,
): Promise<RankedElementCandidate[]> {
  const typedTarget = isElementTarget(target) ? target : null;
  const root = typedTarget?.iframe
    ? frameRootForTarget(page, typedTarget.iframe)
    : iframeXpath?.trim()
      ? frameRootForXpath(page, iframeXpath)
      : page;
  const locators = typedTarget?.locators?.length
    ? typedTarget.locators
    : xpath?.trim()
      ? [{ kind: "xpath", value: xpath } satisfies ElementLocator]
      : [];
  const constraints = typedTarget?.constraints ?? null;
  const viewport = inViewportOnly ? await browserViewport(page) : null;

  for (const locatorConfig of locators) {
    const base = locatorFromConfig(root, locatorConfig);
    const indexes = await candidateIndexes(base, constraints?.index);
    const candidates: RankedElementCandidate[] = [];
    for (const index of indexes) {
      const locator = applyIndexConstraint(base, index);
      if (!(await locatorSatisfiesConstraints(locator, withoutIndexConstraint(constraints)))) {
        continue;
      }
      const box = await locator.boundingBox?.() ?? null;
      if (inViewportOnly && (!box || !boxIntersectsViewport(box, viewport))) {
        continue;
      }
      candidates.push({ locator, locatorConfig, index, box });
    }
    if (candidates.length) return candidates;
  }

  return [];
}

export async function selectRankedElementCandidate(
  page: BrowserDriverPage,
  candidates: RankedElementCandidate[],
  rank: RuntimeElementRef["rank"],
) {
  if (rank === "first") return candidates[0];
  const viewport = await browserViewport(page);
  const viewportCenter = {
    x: viewport.width / 2,
    y: viewport.height / 2,
  };
  const sorted = [...candidates].sort((left, right) => {
    if (rank === "largest_visible_area") {
      return visibleArea(right.box, viewport) - visibleArea(left.box, viewport);
    }
    return distanceToViewportCenter(left.box, viewportCenter) - distanceToViewportCenter(right.box, viewportCenter);
  });
  return sorted[0];
}

export async function locatorForRuntimeElementRef(
  page: BrowserDriverPage,
  ref: RuntimeElementRef,
) {
  const root = ref.target.iframe ? frameRootForTarget(page, ref.target.iframe) : page;
  return applyIndexConstraint(locatorFromConfig(root, ref.locator), ref.index);
}

function frameRootForTarget(page: BrowserDriverPage, iframeTarget: ElementTarget) {
  if (!page.frameLocator) {
    throw new Error("iframe targets require driver support for frameLocator");
  }
  const iframeLocator = iframeTarget.locators[0];
  if (!iframeLocator) {
    throw new Error("iframe target requires a locator");
  }
  return page.frameLocator(selectorFromLocatorConfig(iframeLocator));
}

function frameRootForXpath(page: BrowserDriverPage, iframeXpath: string) {
  if (!page.frameLocator) {
    throw new Error("iframe targets require driver support for frameLocator");
  }
  return page.frameLocator(xpathSelector(iframeXpath));
}

function locatorFromConfig(
  root: BrowserDriverPage | BrowserDriverFrameLocator,
  locator: ElementLocator,
) {
  switch (locator.kind) {
    case "test_id":
      if (!root.getByTestId) throw new Error("Locator kind test_id requires driver support for getByTestId");
      return root.getByTestId(locator.value);
    case "role":
      if (!root.getByRole) throw new Error("Locator kind role requires driver support for getByRole");
      return root.getByRole(locator.role ?? locator.value, {
        name: locator.role ? locator.value : undefined,
        exact: locator.exact ?? undefined,
      });
    case "label":
      if (!root.getByLabel) throw new Error("Locator kind label requires driver support for getByLabel");
      return root.getByLabel(locator.value, { exact: locator.exact ?? undefined });
    case "placeholder":
      if (!root.getByPlaceholder) {
        throw new Error("Locator kind placeholder requires driver support for getByPlaceholder");
      }
      return root.getByPlaceholder(locator.value, { exact: locator.exact ?? undefined });
    case "text":
      if (!root.getByText) throw new Error("Locator kind text requires driver support for getByText");
      return root.getByText(locator.value, { exact: locator.exact ?? undefined });
    case "attribute":
      return root.locator(`[${locator.attribute ?? "data-testid"}="${cssAttributeValue(locator.value)}"]`);
    case "css":
      return root.locator(locator.value);
    case "xpath":
      return root.locator(xpathSelector(locator.value));
  }
}

function selectorFromLocatorConfig(locator: ElementLocator) {
  switch (locator.kind) {
    case "test_id":
      return `[data-testid="${cssAttributeValue(locator.value)}"]`;
    case "text":
      return `text=${locator.value}`;
    case "attribute":
      return `[${locator.attribute ?? "data-testid"}="${cssAttributeValue(locator.value)}"]`;
    case "role":
    case "label":
    case "placeholder":
      return locator.value;
    case "css":
      return locator.value;
    case "xpath":
      return xpathSelector(locator.value);
  }
}

function xpathSelector(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("xpath=")) return trimmed;
  return trimmed.startsWith("/") && !trimmed.startsWith("//") ? `xpath=${trimmed}` : trimmed;
}

function applyIndexConstraint(
  locator: BrowserDriverLocator,
  index: number | null | undefined,
) {
  if (index == null) return locator;
  if (!locator.nth) throw new Error("Target index constraint requires driver support for locator.nth");
  return locator.nth(index);
}

async function locatorSatisfiesConstraints(
  locator: BrowserDriverLocator,
  constraints: ElementTarget["constraints"] | null,
) {
  if (!constraints) return true;
  if (constraints.visible != null) {
    const visible = await locator.isVisible?.();
    if (visible !== constraints.visible) return false;
  }
  if (constraints.enabled != null) {
    const enabled = await locator.isEnabled?.();
    if (enabled !== constraints.enabled) return false;
  }
  if (constraints.contains_text) {
    const text = await locator.textContent?.();
    if (!String(text ?? "").includes(constraints.contains_text)) return false;
  }
  return true;
}

async function candidateIndexes(
  locator: BrowserDriverLocator,
  index: number | null | undefined,
) {
  if (index != null) return [index];
  if (!locator.count || !locator.nth) return [0];
  const count = await locator.count();
  return Array.from({ length: count }, (_value, candidateIndex) => candidateIndex);
}

function withoutIndexConstraint(
  constraints: ElementTarget["constraints"] | null,
): ElementTarget["constraints"] | null {
  if (!constraints) return null;
  return { ...constraints, index: null };
}

async function browserViewport(page: BrowserDriverPage) {
  const viewport = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  if (
    viewport &&
    typeof viewport === "object" &&
    typeof (viewport as { width?: unknown }).width === "number" &&
    typeof (viewport as { height?: unknown }).height === "number"
  ) {
    return viewport as { width: number; height: number };
  }
  return { width: 0, height: 0 };
}

function boxIntersectsViewport(
  box: { x?: number; y?: number; width: number; height: number },
  viewport: { width: number; height: number } | null,
) {
  if (!viewport) return true;
  const x = box.x ?? 0;
  const y = box.y ?? 0;
  return x + box.width > 0 && y + box.height > 0 && x < viewport.width && y < viewport.height;
}

function visibleArea(
  box: { x?: number; y?: number; width: number; height: number } | null,
  viewport: { width: number; height: number },
) {
  if (!box) return 0;
  const x = box.x ?? 0;
  const y = box.y ?? 0;
  const visibleWidth = Math.max(0, Math.min(x + box.width, viewport.width) - Math.max(x, 0));
  const visibleHeight = Math.max(0, Math.min(y + box.height, viewport.height) - Math.max(y, 0));
  return visibleWidth * visibleHeight;
}

function distanceToViewportCenter(
  box: { x?: number; y?: number; width: number; height: number } | null,
  viewportCenter: { x: number; y: number },
) {
  if (!box) return Number.POSITIVE_INFINITY;
  const x = (box.x ?? 0) + box.width / 2;
  const y = (box.y ?? 0) + box.height / 2;
  return Math.hypot(x - viewportCenter.x, y - viewportCenter.y);
}

function isElementTarget(value: unknown): value is ElementTarget {
  return Boolean(
    value &&
      typeof value === "object" &&
      "locators" in value &&
      Array.isArray((value as { locators?: unknown }).locators),
  );
}

function cssAttributeValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}
