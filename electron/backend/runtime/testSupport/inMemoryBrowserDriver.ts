// Not named `*.test.ts` on purpose: this module sits inside the electron
// TypeScript project, so the fakes are type-checked against the real
// `BrowserDriver*` shapes. A fake that has drifted from the interface it
// stands in for is worse than no fake — it makes tests pass for a page the
// production code could never receive.
//
// It lives here rather than inside the runner test because more than one
// test file needs a browser: executor tests were hand-rolling a stub locator
// per test instead.

import fs from "node:fs/promises";
import path from "node:path";
import type {
  BrowserDriver,
  BrowserDriverContext,
  BrowserDriverPage,
} from "../../browser/sessionManager.js";

export function createFakeDriver(context: FakeContext) {
  const driver: BrowserDriver & {
    launches: Array<{ kind: "temporary" | "persistent"; options: Record<string, unknown> }>;
  } = {
    launches: [],
    async launch(options) {
      driver.launches.push({ kind: "temporary", options });
      return context;
    },
    async launchPersistent(options) {
      driver.launches.push({ kind: "persistent", options });
      return context;
    },
  };
  return driver;
}

export class FakeContext implements BrowserDriverContext {
  closed = false;
  events: string[] = [];
  addedCookies: Array<Record<string, unknown>> = [];
  routes: Array<{
    matcher: string | RegExp | ((url: URL) => boolean);
    handler: (route: FakeRoute) => Promise<void> | void;
  }> = [];
  readonly page: FakePage;

  constructor(page = new FakePage()) {
    this.page = page;
  }

  pages() {
    return [this.page];
  }

  async newPage() {
    return this.page;
  }

  async close() {
    this.closed = true;
  }

  async addCookies(cookies: Array<Record<string, unknown>>) {
    this.addedCookies.push(...cookies);
    this.events.push(
      `cookies:${cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join(",")}`,
    );
  }

  async grantPermissions(permissions: string[], options?: { origin?: string }) {
    this.events.push(`permissions:${options?.origin ?? "any"}:${permissions.join(",")}`);
  }

  async setExtraHTTPHeaders(headers: Record<string, string>) {
    this.events.push(`headers:${JSON.stringify(headers)}`);
  }

  async setGeolocation(geolocation: Record<string, unknown>) {
    this.events.push(
      `geolocation:${geolocation.latitude}:${geolocation.longitude}:${geolocation.accuracy}`,
    );
  }

  async route(
    matcher: string | RegExp | ((url: URL) => boolean),
    handler: (route: FakeRoute) => Promise<void> | void,
  ) {
    this.routes.push({ matcher, handler });
  }

  async triggerRoute(url: string) {
    const matchedRoute = this.routes.find((route) => {
      if (typeof route.matcher === "function") return route.matcher(new URL(url));
      if (typeof route.matcher === "string") return route.matcher === url;
      return route.matcher.test(url);
    });
    if (!matchedRoute) return null;

    const route = new FakeRoute();
    await matchedRoute.handler(route);
    return route.fulfilledResponse;
  }
}

export class FakeRoute {
  fulfilledResponse: Record<string, unknown> | null = null;

  async abort() {}

  async fulfill(response: Record<string, unknown>) {
    this.fulfilledResponse = response;
  }

  async continue() {}
}

export class FakePage implements BrowserDriverPage {
  events: string[] = [];
  urlValue = "about:blank";
  evaluateResult: unknown = null;

  /**
   * What the page was asked to do, in full.
   *
   * `events` is a compact log for asserting *order*; these two record the
   * arguments, which is what an executor test is usually about — that the right
   * URL and wait condition were passed, or the right script text and data.
   * Separate arrays rather than richer `events` entries, so every assertion
   * already written against `events` keeps its exact meaning.
   */
  gotoCalls: Array<{ url: string; options?: Record<string, unknown> }> = [];
  evaluateCalls: unknown[] = [];

  async goto(url: string, options?: Record<string, unknown>) {
    this.gotoCalls.push({ url, ...(options ? { options } : {}) });
    this.urlValue = url.endsWith("/") ? url : `${url}/`;
    this.events.push(`goto:${url}`);
  }

  locator(selector: string) {
    this.events.push(`locator:${selector}`);
    return new FakeLocator(selector, this.events);
  }

  getByTestId(testId: string) {
    this.events.push(`getByTestId:${testId}`);
    return new FakeLocator(`testid=${testId}`, this.events);
  }

  getByRole(role: string, options?: { name?: string }) {
    this.events.push(`getByRole:${role}:${options?.name ?? ""}`);
    return new FakeLocator(`role=${role}:${options?.name ?? ""}`, this.events);
  }

  getByLabel(label: string) {
    this.events.push(`getByLabel:${label}`);
    return new FakeLocator(`label=${label}`, this.events);
  }

  getByPlaceholder(placeholder: string) {
    this.events.push(`getByPlaceholder:${placeholder}`);
    return new FakeLocator(`placeholder=${placeholder}`, this.events);
  }

  getByText(text: string) {
    this.events.push(`getByText:${text}`);
    return new FakeLocator(`text=${text}`, this.events);
  }

  frameLocator(selector: string) {
    this.events.push(`frameLocator:${selector}`);
    return new FakeFrameLocator(this.events);
  }

  async waitForLoadState() {}

  async waitForURL() {}

  async waitForRequest() {
    return { url: () => this.urlValue };
  }

  async waitForResponse() {
    return { url: () => this.urlValue, status: () => 200 };
  }

  once(_eventName: "dialog", handler: (dialog: FakeDialog) => void) {
    this.events.push("dialog-once");
    handler(new FakeDialog(this.events));
  }

  async waitForEvent(eventName: "download") {
    this.events.push(`waitForEvent:${eventName}`);
    return new FakeDownload(this.events);
  }

  async goBack() {}

  async goForward() {}

  async reload() {}

  async bringToFront() {}

  async close() {}

  async screenshot() {
    return Buffer.from("png");
  }

  // Generic like the interface it stands in for. The fake decides its answer
  // from the argument rather than by running the function, so the result is
  // cast once, here, instead of at every call site.
  async evaluate<R = unknown, A = unknown>(
    pageFunction: string | ((arg?: A) => R | Promise<R>),
    arg?: A,
  ): Promise<R> {
    return (await this.evaluateFake(pageFunction, arg)) as R;
  }

  private async evaluateFake(pageFunction: unknown, arg?: unknown): Promise<unknown> {
    this.evaluateCalls.push(arg);
    if (this.evaluateResult != null) {
      this.events.push("evaluate:custom");
      return this.evaluateResult;
    }
    if (typeof pageFunction === "string" && pageFunction.includes("window.location.href")) {
      return this.urlValue;
    }
    if (isScrollEvaluationArg(arg)) {
      this.events.push(`scrollBy:${arg.deltaX}:${arg.deltaY}`);
      return null;
    }
    if (isClipboardEvaluationArg(arg)) {
      this.events.push(`clipboard:${arg.text}`);
      return null;
    }
    if (isStorageEvaluationArg(arg)) {
      this.events.push(`${arg.storage}Storage:${arg.key}:${arg.value}`);
      return null;
    }
    if (typeof pageFunction === "function") {
      return pageFunction(arg);
    }
    return null;
  }

  async evaluateHandle() {
    return {};
  }

  async addInitScript() {}

  async setViewportSize(viewport: { width: number; height: number }) {
    this.events.push(`viewport:${viewport.width}:${viewport.height}`);
  }

  keyboard = {
    press: async (key: string) => {
      this.events.push(`press:${key}`);
    },
    down: async (key: string) => {
      this.events.push(`down:${key}`);
    },
    up: async (key: string) => {
      this.events.push(`up:${key}`);
    },
    type: async (text: string) => {
      this.events.push(`keyboard:${text}`);
    },
  };

  mouse = {
    move: async (x: number, y: number) => {
      this.events.push(`move:${x}:${y}`);
    },
    down: async (options?: { button?: string }) => {
      this.events.push(`mouseDown:${options?.button ?? "left"}`);
    },
    up: async (options?: { button?: string }) => {
      this.events.push(`mouseUp:${options?.button ?? "left"}`);
    },
    wheel: async (x: number, y: number) => {
      this.events.push(`wheel:${x}:${y}`);
    },
  };
}

export class FakeLocator {
  constructor(
    protected readonly selector: string,
    protected readonly events: string[],
  ) {}

  async fill(value: string) {
    this.events.push(`fill:${this.selector}:${value}`);
  }

  async type(value: string, options?: { delay?: number }) {
    this.events.push(`type:${this.selector}:${value}:${options?.delay ?? 0}`);
  }

  async click(options?: {
    button?: string;
    clickCount?: number;
    position?: { x: number; y: number };
  }) {
    if (options?.position || options?.clickCount) {
      this.events.push(
        `click:${this.selector}:${options.button ?? "left"}:${options.clickCount ?? 1}:${options.position?.x ?? "center"}:${options.position?.y ?? "center"}`,
      );
      return;
    }
    this.events.push(
      options?.button ? `click:${this.selector}:${options.button}` : `click:${this.selector}`,
    );
  }

  async evaluate<Result, Arg = unknown>(
    pageFunction: (element: Element, arg: Arg) => Result | Promise<Result>,
    arg?: Arg,
  ): Promise<Result> {
    return (await this.evaluateFake(pageFunction, arg)) as Result;
  }

  private async evaluateFake(_pageFunction?: unknown, arg?: unknown): Promise<unknown> {
    if (isScrollIntoViewArg(arg)) {
      this.events.push(`scrollIntoView:${this.selector}:${arg.block}:${arg.inline}`);
      return null;
    }
    this.events.push(`evaluate:${this.selector}`);
    if (this.selector.includes("table")) {
      return [
        ["Name", "Status"],
        ["Fixture", "Ready"],
      ];
    }
    return null;
  }

  async hover() {
    this.events.push(`hover:${this.selector}`);
  }

  async dblclick() {
    this.events.push(`dblclick:${this.selector}`);
  }

  async check() {
    this.events.push(`check:${this.selector}`);
  }

  async uncheck() {
    this.events.push(`uncheck:${this.selector}`);
  }

  async selectOption() {
    this.events.push(`selectOption:${this.selector}`);
  }

  async setInputFiles() {
    this.events.push(`setInputFiles:${this.selector}`);
  }

  async press(key?: string) {
    this.events.push(`locatorPress:${this.selector}:${key ?? ""}`);
  }

  async textContent() {
    return "Owned Fixture";
  }

  async getAttribute(attribute: string) {
    return `attr:${attribute}`;
  }

  async inputValue() {
    return "input";
  }

  async boundingBox() {
    return { x: 10, y: 20, width: 100, height: 40 };
  }

  async count() {
    this.events.push(`count:${this.selector}`);
    return this.selector === "#missing" ? 0 : 1;
  }

  nth() {
    return this;
  }

  async isVisible() {
    this.events.push(`isVisible:${this.selector}`);
    return this.selector !== "#hidden";
  }

  async isEnabled() {
    this.events.push(`isEnabled:${this.selector}`);
    return this.selector !== "#blocked";
  }

  async waitFor(options?: { state?: string; timeout?: number }) {
    this.events.push(
      `waitFor:${this.selector}:${options?.state ?? "visible"}:${options?.timeout ?? "none"}`,
    );
  }

  async scrollIntoViewIfNeeded(options?: { timeout?: number }) {
    this.events.push(
      `scrollIntoViewIfNeeded:${this.selector}:${options?.timeout ?? "none"}`,
    );
  }

  async dragTo(target: FakeLocator) {
    this.events.push(`dragTo:${this.selector}:${target.selector}`);
  }
}

export class FakeFrameLocator {
  constructor(private readonly events: string[]) {}

  locator(selector: string) {
    this.events.push(`frameLocator.locator:${selector}`);
    return new FakeLocator(selector, this.events);
  }
}

export class FakeDialog {
  constructor(private readonly events: string[]) {}

  async accept(promptText?: string) {
    this.events.push(`dialog-accept:${promptText ?? ""}`);
  }

  async dismiss() {
    this.events.push("dialog-dismiss");
  }
}

export class FakeDownload {
  constructor(private readonly events: string[]) {}

  suggestedFilename() {
    return "owned report.csv";
  }

  async saveAs(filePath: string) {
    this.events.push(`download-save:${filePath}`);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, "download");
  }
}

function isStorageEvaluationArg(
  value: unknown,
): value is { storage: "local" | "session"; key: string; value: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "storage" in value &&
      "key" in value &&
      "value" in value,
  );
}

function isScrollEvaluationArg(value: unknown): value is { deltaX: number; deltaY: number } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "deltaX" in value &&
      "deltaY" in value,
  );
}

function isClipboardEvaluationArg(value: unknown): value is { text: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "text" in value &&
      typeof (value as { text?: unknown }).text === "string",
  );
}

function isScrollIntoViewArg(
  value: unknown,
): value is { block: string; inline: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "block" in value &&
      "inline" in value,
  );
}
