import type {
  ClickActionConfig,
  ExtractTextActionConfig,
  FillActionConfig,
  LocatorConfig,
  NavigateActionConfig,
  StartRunPayload,
  WaitActionConfig,
} from "../shared/product.js";
import type { BrowserAutomationAdapter } from "./runnerCore.js";

type LoosePage = {
  goto: (url: string, options?: Record<string, unknown>) => Promise<unknown>;
  locator?: (selector: string, options?: Record<string, unknown>) => LooseLocator;
  getByRole?: (role: string, options?: Record<string, unknown>) => LooseLocator;
  getByLabel?: (text: string, options?: Record<string, unknown>) => LooseLocator;
  getByPlaceholder?: (text: string, options?: Record<string, unknown>) => LooseLocator;
  getByText?: (text: string, options?: Record<string, unknown>) => LooseLocator;
  getByTestId?: (text: string) => LooseLocator;
  waitForTimeout?: (durationMs: number) => Promise<unknown>;
  waitForURL?: (url: string, options?: Record<string, unknown>) => Promise<unknown>;
  screenshot: (options: Record<string, unknown>) => Promise<Buffer>;
  setExtraHTTPHeaders?: (headers: Record<string, string>) => Promise<unknown>;
};

type LooseLocator = {
  click: (options?: Record<string, unknown>) => Promise<unknown>;
  fill: (value: string, options?: Record<string, unknown>) => Promise<unknown>;
  waitFor?: (options?: Record<string, unknown>) => Promise<unknown>;
  innerText?: (options?: Record<string, unknown>) => Promise<string>;
  nth?: (index: number) => LooseLocator;
  filter?: (options: Record<string, unknown>) => LooseLocator;
};

type LooseBrowser = {
  newPage: (options?: Record<string, unknown>) => Promise<LoosePage>;
  close: () => Promise<unknown>;
};

function cssEscape(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function selectorFor(locator: LocatorConfig) {
  switch (locator.strategy) {
    case "css":
      return locator.value;
    case "xpath":
      return `xpath=${locator.value}`;
    case "attribute":
      return `[${locator.value}]`;
    case "testId":
      return `[data-testid="${cssEscape(locator.value)}"]`;
    default:
      return locator.value;
  }
}

function resolveLocator(page: LoosePage, locator: LocatorConfig): LooseLocator {
  let resolved: LooseLocator;
  const options = {
    exact: locator.exact ?? false,
    name: locator.name ?? undefined,
  };

  switch (locator.strategy) {
    case "role":
      if (!page.getByRole) throw new Error("CloakBrowser page does not expose getByRole.");
      resolved = page.getByRole(locator.value, options);
      break;
    case "label":
      if (!page.getByLabel) throw new Error("CloakBrowser page does not expose getByLabel.");
      resolved = page.getByLabel(locator.value, { exact: locator.exact ?? false });
      break;
    case "placeholder":
      if (!page.getByPlaceholder) throw new Error("CloakBrowser page does not expose getByPlaceholder.");
      resolved = page.getByPlaceholder(locator.value, { exact: locator.exact ?? false });
      break;
    case "text":
      if (!page.getByText) throw new Error("CloakBrowser page does not expose getByText.");
      resolved = page.getByText(locator.value, { exact: locator.exact ?? false });
      break;
    case "testId":
      if (page.getByTestId) {
        resolved = page.getByTestId(locator.value);
      } else if (page.locator) {
        resolved = page.locator(selectorFor(locator));
      } else {
        throw new Error("CloakBrowser page does not expose locator APIs.");
      }
      break;
    case "css":
    case "xpath":
    case "attribute":
      if (!page.locator) throw new Error("CloakBrowser page does not expose locator.");
      resolved = page.locator(selectorFor(locator));
      break;
  }

  if (locator.filters?.hasText && resolved.filter) {
    resolved = resolved.filter({ hasText: locator.filters.hasText });
  }
  if (typeof locator.filters?.index === "number" && resolved.nth) {
    resolved = resolved.nth(locator.filters.index);
  }

  return resolved;
}

export function createCloakBrowserAdapter(): BrowserAutomationAdapter {
  let browser: LooseBrowser | null = null;
  let page: LoosePage | null = null;

  function currentPage() {
    if (!page) throw new Error("CloakBrowser page has not been initialized.");
    return page;
  }

  return {
    async launch(payload: StartRunPayload) {
      const cloakbrowser = (await import("cloakbrowser")) as {
        launch: (options?: Record<string, unknown>) => Promise<LooseBrowser>;
      };
      browser = await cloakbrowser.launch({
        headless: payload.identityProfileSnapshot.headless,
        humanize: true,
      });
      page = await browser.newPage({
        viewport: payload.identityProfileSnapshot.viewport,
        userAgent: payload.identityProfileSnapshot.userAgent ?? undefined,
        locale: payload.identityProfileSnapshot.locale ?? undefined,
        timezoneId: payload.identityProfileSnapshot.timezone ?? undefined,
      });
      if (payload.environmentSnapshot.extraHTTPHeaders && page.setExtraHTTPHeaders) {
        await page.setExtraHTTPHeaders(payload.environmentSnapshot.extraHTTPHeaders);
      }
    },

    async close() {
      await browser?.close();
      browser = null;
      page = null;
    },

    async navigate(config: NavigateActionConfig) {
      await currentPage().goto(config.url, { timeout: config.timeoutMs });
    },

    async click(config: ClickActionConfig) {
      await resolveLocator(currentPage(), config.locator).click({ timeout: config.timeoutMs });
    },

    async fill(config: FillActionConfig) {
      await resolveLocator(currentPage(), config.locator).fill(config.value, {
        timeout: config.timeoutMs,
      });
    },

    async wait(config: WaitActionConfig) {
      const activePage = currentPage();
      const waitForTimeout = activePage.waitForTimeout;
      if (config.durationMs && waitForTimeout) {
        await waitForTimeout(config.durationMs);
        return;
      }

      const waitForURL = activePage.waitForURL;
      if (config.url && waitForURL) {
        await waitForURL(config.url, { timeout: config.timeoutMs });
        return;
      }

      if (config.locator) {
        await resolveLocator(activePage, config.locator).waitFor?.({
          timeout: config.timeoutMs,
        });
      }
    },

    async screenshot(input) {
      return currentPage().screenshot({
        path: input.path,
        fullPage: input.fullPage ?? true,
      });
    },

    async extractText(config: ExtractTextActionConfig) {
      const locator = resolveLocator(currentPage(), config.locator);
      if (!locator.innerText) throw new Error("Resolved locator cannot extract inner text.");
      return locator.innerText({ timeout: config.timeoutMs });
    },
  };
}
