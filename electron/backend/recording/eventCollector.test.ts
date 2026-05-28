// @vitest-environment node

import vm from "node:vm";
import { describe, expect, test } from "vitest";
import type { BrowserDriverPage } from "../browser/sessionManager";
import { RecordingEventCollector } from "./eventCollector";
import { normalizeRecordingEvents } from "./timelineNormalizer";

describe("RecordingEventCollector", () => {
  test("injects page capture and records ordered page-side events", async () => {
    const page = new FakeCollectorPage();
    const collector = new RecordingEventCollector("rec_123", {
      now: () => new Date("2026-05-27T10:00:00.000Z"),
    });

    await collector.attachPage(page);
    await page.emit({
      kind: "click",
      page_url: "https://fixture.owned.test/form",
      frame_url: "https://fixture.owned.test/form",
      target: { tag_name: "button", text_sample: "Save", locators: [] },
      value: null,
      raw: { trusted: true },
      confidence: "high",
      warnings: [],
    });
    await page.emit({
      kind: "select",
      page_url: "https://fixture.owned.test/form",
      frame_url: "https://fixture.owned.test/form",
      target: { tag_name: "select", locators: [] },
      value: { selected_value: "pro", selected_label: "Pro" },
      raw: {},
      confidence: "high",
      warnings: [],
    });

    expect(page.initScripts).toHaveLength(1);
    expect(collector.listEvents()).toMatchObject([
      {
        id: "rec_123_evt_1",
        session_id: "rec_123",
        sequence: 1,
        timestamp: "2026-05-27T10:00:00.000Z",
        kind: "click",
      },
      {
        id: "rec_123_evt_2",
        session_id: "rec_123",
        sequence: 2,
        kind: "select",
        value: { selected_value: "pro", selected_label: "Pro" },
      },
    ]);
  });

  test("injects capture listeners for keyboard, upload, and click variants", async () => {
    const page = new FakeCollectorPage();
    const collector = new RecordingEventCollector("rec_capture");

    await collector.attachPage(page);

    expect(page.initScripts[0]).toContain('"keydown"');
    expect(page.initScripts[0]).toContain('"dblclick"');
    expect(page.initScripts[0]).toContain('"contextmenu"');
    expect(page.initScripts[0]).toContain('"submit"');
    expect(page.initScripts[0]).toContain('type === "file"');
    expect(page.initScripts[0]).toContain("__wamRecorderBufferedEvents.length < 1000");
  });

  test("captures contenteditable input text from visible editor content", async () => {
    const page = new FakeCollectorPage();
    const collector = new RecordingEventCollector("rec_contenteditable");

    await collector.attachPage(page);
    const { documentListeners, payloads } = runRecorderCaptureScript(page.initScripts[0]);
    documentListeners.get("input")?.[0]?.({
      target: {
        tagName: "DIV",
        isContentEditable: true,
        innerText: "Hello editor",
        textContent: "Hello editor fallback",
        id: "editor",
        getAttribute: (name: string) => name === "contenteditable" ? "true" : null,
        getBoundingClientRect: () => ({ x: 4, y: 8, width: 240, height: 120 }),
      },
    });

    expect(payloads[0]).toMatchObject({
      kind: "input",
      target: {
        tag_name: "div",
        input_type: "contenteditable",
      },
      value: { text: "Hello editor" },
    });
  });

  test("captures paste clipboard text as a recorder clipboard event", async () => {
    const page = new FakeCollectorPage();
    const collector = new RecordingEventCollector("rec_clipboard");

    await collector.attachPage(page);
    const { documentListeners, payloads } = runRecorderCaptureScript(page.initScripts[0]);
    documentListeners.get("paste")?.[0]?.({
      target: {
        tagName: "INPUT",
        type: "text",
        id: "paste-target",
        getAttribute: (name: string) =>
          name === "id" ? "paste-target" : name === "type" ? "text" : null,
        getBoundingClientRect: () => ({ x: 4, y: 8, width: 240, height: 36 }),
      },
      clipboardData: {
        getData: (format: string) => format === "text/plain" ? "copied text" : "",
      },
    });

    expect(payloads[0]).toMatchObject({
      kind: "clipboard",
      target: {
        tag_name: "input",
        input_type: "text",
      },
      value: { text: "copied text" },
      raw: { action: "paste" },
    });
  });

  test("observes main-frame navigation events from the backend page adapter", async () => {
    const page = new FakeCollectorPage();
    const collector = new RecordingEventCollector("rec_nav", {
      now: () => new Date("2026-05-27T10:00:00.000Z"),
    });

    await collector.attachPage(page);
    page.navigate("https://fixture.owned.test/next");

    expect(
      page.evaluatedScripts.filter((script) => script.includes("__wamRecorderInstalled")),
    ).toHaveLength(2);
    expect(collector.listEvents()).toMatchObject([
      {
        id: "rec_nav_evt_1",
        sequence: 1,
        kind: "navigation",
        page_url: "https://fixture.owned.test/next",
        frame_url: "https://fixture.owned.test/next",
      },
    ]);
  });

  test("ignores subframe navigation events from embedded third-party frames", async () => {
    const page = new FakeCollectorPage();
    const collector = new RecordingEventCollector("rec_iframe_nav", {
      now: () => new Date("2026-05-27T10:00:00.000Z"),
    });

    await collector.attachPage(page);
    page.navigateFrame("https://ads.fixture.test/user-sync", { mainFrame: false });
    page.navigateFrame("https://fixture.owned.test/next", { mainFrame: true });

    expect(collector.listEvents()).toMatchObject([
      {
        id: "rec_iframe_nav_evt_1",
        sequence: 1,
        kind: "navigation",
        page_url: "https://fixture.owned.test/next",
        frame_url: "https://fixture.owned.test/next",
      },
    ]);
  });

  test("observes backend tab, download, and dialog events", async () => {
    const page = new FakeCollectorPage();
    const context = new FakeCollectorContext(page);
    const collector = new RecordingEventCollector("rec_backend", {
      now: () => new Date("2026-05-27T10:00:00.000Z"),
    });

    await collector.attachContext(context);
    await collector.attachPage(page);
    const popup = new FakeCollectorPage();
    context.emitPage(popup);
    page.emitDownload("owned-report.csv");
    await page.emitDialog("confirm", "Continue?");

    expect(collector.listEvents()).toMatchObject([
      {
        id: "rec_backend_evt_1",
        sequence: 1,
        kind: "tab",
        raw: { action: "open", index: 1, url: null },
      },
      {
        id: "rec_backend_evt_2",
        sequence: 2,
        kind: "download",
        value: { file_names: ["owned-report.csv"] },
      },
      {
        id: "rec_backend_evt_3",
        sequence: 3,
        kind: "dialog",
        raw: { action: "dismiss", dialog_type: "confirm", message: "Continue?" },
        warnings: [
          expect.objectContaining({
            code: "dialog_auto_dismissed",
          }),
        ],
      },
    ]);
    expect(popup.initScripts).toHaveLength(1);
  });

  test("records newly created pages as open-tab events instead of switching to missing tabs", async () => {
    const page = new FakeCollectorPage();
    const context = new FakeCollectorContext(page);
    const collector = new RecordingEventCollector("rec_open_tab", {
      now: () => new Date("2026-05-27T10:00:00.000Z"),
    });

    await collector.attachContext(context);
    const popup = new FakeCollectorPage("https://fixture.owned.test/popup");
    context.emitPage(popup);

    expect(collector.listEvents()).toMatchObject([
      {
        id: "rec_open_tab_evt_1",
        sequence: 1,
        kind: "tab",
        raw: {
          action: "open",
          index: 1,
          url: "https://fixture.owned.test/popup",
        },
      },
    ]);
  });

  test("redacts sensitive text input values before they enter recording events", async () => {
    const page = new FakeCollectorPage();
    const collector = new RecordingEventCollector("rec_sensitive");

    await collector.attachPage(page);
    await page.emit({
      kind: "input",
      page_url: "https://fixture.owned.test/login",
      frame_url: "https://fixture.owned.test/login",
      target: {
        tag_name: "input",
        input_type: "password",
        accessible_name: "Password",
        locators: [{ kind: "test_id", value: "password", score: 1, reason: "Stable test id" }],
      },
      value: { text: "super-secret-password" },
      raw: {
        input_type: "password",
        typed_value: "super-secret-password",
        nested: { value: "super-secret-password" },
      },
      confidence: "high",
      warnings: [],
    });

    const [event] = collector.listEvents();

    expect(event.value).toEqual({ text: "" });
    expect(JSON.stringify(event)).not.toContain("super-secret-password");
    expect(event.raw).toMatchObject({ input_type: "password", value_redacted: true });
    expect(event.warnings).toEqual([
      expect.objectContaining({ code: "sensitive_input_redacted" }),
    ]);
    const [step] = normalizeRecordingEvents([event]);
    expect(step).toMatchObject({
      included: false,
      action: { type: "input_text", config: { text: "" } },
    });
    expect(step.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "sensitive_input_redacted" }),
      ]),
    );
  });

  test("redacts sensitive text from target metadata and locator candidates", async () => {
    const page = new FakeCollectorPage();
    const collector = new RecordingEventCollector("rec_sensitive_target");

    await collector.attachPage(page);
    await page.emit({
      kind: "input",
      page_url: "https://fixture.owned.test/login",
      frame_url: "https://fixture.owned.test/login",
      target: {
        tag_name: "input",
        input_type: "password",
        text_sample: "super-secret-password",
        accessible_name: "Password",
        locators: [
          {
            kind: "css",
            value: "[value='super-secret-password']",
            score: 0.5,
            reason: "Value fallback super-secret-password",
          },
        ],
      },
      value: { text: "super-secret-password" },
      raw: { input_type: "password" },
      confidence: "high",
      warnings: [],
    });

    const [event] = collector.listEvents();

    expect(event.value).toEqual({ text: "" });
    expect(JSON.stringify(event)).not.toContain("super-secret-password");
    expect(event.target?.text_sample).toBeNull();
    expect(event.target?.locators).toEqual([]);
  });

  test("redacts sensitive target metadata even when the event has no text value", async () => {
    const page = new FakeCollectorPage();
    const collector = new RecordingEventCollector("rec_sensitive_target_only");

    await collector.attachPage(page);
    await page.emit({
      kind: "click",
      page_url: "https://fixture.owned.test/login",
      frame_url: "https://fixture.owned.test/login",
      target: {
        tag_name: "input",
        input_type: "password",
        text_sample: "super-secret-password",
        accessible_name: "Password",
        locators: [
          {
            kind: "css",
            value: "[value='super-secret-password']",
            score: 0.5,
            reason: "Value fallback super-secret-password",
          },
        ],
      },
      value: null,
      raw: { input_type: "password" },
      confidence: "high",
      warnings: [],
    });

    const [event] = collector.listEvents();

    expect(JSON.stringify(event)).not.toContain("super-secret-password");
    expect(event.target?.text_sample).toBeNull();
    expect(event.target?.locators).toEqual([]);
  });

  test("redacts page-controlled raw fields with secret-like keys", async () => {
    const page = new FakeCollectorPage();
    const collector = new RecordingEventCollector("rec_sensitive_raw");

    await collector.attachPage(page);
    await page.emit({
      kind: "click",
      page_url: "https://fixture.owned.test/settings",
      frame_url: "https://fixture.owned.test/settings",
      target: { tag_name: "button", text_sample: "Save", locators: [] },
      value: null,
      raw: {
        api_key: "owned-api-key-secret",
        nested: { password: "owned-password-secret" },
      },
      confidence: "high",
      warnings: [],
    });

    const [event] = collector.listEvents();

    expect(JSON.stringify(event)).not.toContain("owned-api-key-secret");
    expect(JSON.stringify(event)).not.toContain("owned-password-secret");
    expect(event.raw).toMatchObject({
      api_key: "[redacted]",
      nested: { password: "[redacted]" },
    });
  });

  test("preserves literal text input values including whitespace and clearing", async () => {
    const page = new FakeCollectorPage();
    const collector = new RecordingEventCollector("rec_literal_text");

    await collector.attachPage(page);
    await page.emit({
      kind: "input",
      page_url: "https://fixture.owned.test/form",
      frame_url: "https://fixture.owned.test/form",
      target: { tag_name: "input", input_type: "text", locators: [] },
      value: { text: "  qa value  " },
      raw: {},
      confidence: "high",
      warnings: [],
    });
    await page.emit({
      kind: "input",
      page_url: "https://fixture.owned.test/form",
      frame_url: "https://fixture.owned.test/form",
      target: { tag_name: "input", input_type: "text", locators: [] },
      value: { text: "" },
      raw: {},
      confidence: "high",
      warnings: [],
    });

    const events = collector.listEvents();

    expect(events.map((event) => event.value?.text)).toEqual(["  qa value  ", ""]);
    expect(normalizeRecordingEvents(events)).toMatchObject([
      {
        action: {
          type: "input_text",
          config: { text: "" },
        },
      },
    ]);
  });

  test("flushes buffered page events on demand before disposal", async () => {
    const page = new FakeCollectorPage();
    const collector = new RecordingEventCollector("rec_buffered", {
      now: () => new Date("2026-05-27T10:00:00.000Z"),
    });

    await collector.attachPage(page);
    page.bufferRecorderPayload({
      kind: "click",
      page_url: "https://fixture.owned.test/form",
      frame_url: "https://fixture.owned.test/form",
      target: { tag_name: "button", text_sample: "Save", locators: [] },
      value: null,
      raw: {},
      confidence: "high",
      warnings: [],
    });
    await collector.flushBufferedEvents();
    collector.dispose();

    expect(collector.listEvents()).toMatchObject([
      {
        id: "rec_buffered_evt_1",
        kind: "click",
        page_url: "https://fixture.owned.test/form",
      },
    ]);
  });

  test("deeply bounds page-controlled raw payloads and warning messages", async () => {
    const page = new FakeCollectorPage();
    const collector = new RecordingEventCollector("rec_bounded");
    const hugeText = "x".repeat(10_000);
    const hugeUrl = `https://fixture.owned.test/${hugeText}`;

    await collector.attachPage(page);
    await page.emit({
      kind: "click",
      page_url: hugeUrl,
      frame_url: hugeUrl,
      target: { tag_name: "button", text_sample: "Save", locators: [] },
      value: null,
      raw: {
        hugeText,
        nested: {
          hugeText,
          list: Array.from({ length: 100 }, (_, index) => ({ index, hugeText })),
        },
      },
      confidence: "high",
      warnings: [
        {
          code: "page_warning",
          message: hugeText,
          severity: "warning",
        },
      ],
    });

    const [event] = collector.listEvents();
    const serialized = JSON.stringify(event);

    expect(serialized).not.toContain(hugeText);
    expect(serialized.length).toBeLessThan(8_000);
    expect(event.page_url?.length).toBeLessThanOrEqual(2_048);
    expect(event.frame_url?.length).toBeLessThanOrEqual(2_048);
    expect(String(event.raw.hugeText)).toHaveLength(500);
    expect(event.warnings[0]?.message).toHaveLength(500);
  });

  test("bounds unsupported page-controlled event kind warnings", async () => {
    const page = new FakeCollectorPage();
    const collector = new RecordingEventCollector("rec_bad_kind");
    const hugeKind = "unsupported-".concat("x".repeat(10_000));

    await collector.attachPage(page);
    await page.emit({
      kind: hugeKind,
      page_url: "https://fixture.owned.test/form",
      frame_url: "https://fixture.owned.test/form",
      raw: { hugeKind, token: "owned-token-secret" },
      confidence: "high",
      warnings: [],
    });

    const [event] = collector.listEvents();

    expect(event.kind).toBe("wait_marker");
    expect(event.warnings[0]?.message).not.toContain(hugeKind);
    expect(event.warnings[0]?.message.length).toBeLessThanOrEqual(160);
    expect(JSON.stringify(event)).not.toContain("owned-token-secret");
    expect(event.raw.token).toBe("[redacted]");
    expect(JSON.stringify(event).length).toBeLessThan(2_000);
  });

  test("caps page-controlled recording events per session", async () => {
    const page = new FakeCollectorPage();
    const collector = new RecordingEventCollector("rec_cap");

    await collector.attachPage(page);
    for (let index = 0; index < 1_105; index += 1) {
      await page.emit({
        kind: "click",
        page_url: "https://fixture.owned.test/form",
        frame_url: "https://fixture.owned.test/form",
        target: { tag_name: "button", text_sample: `Save ${index}`, locators: [] },
        value: null,
        raw: { index },
        confidence: "high",
        warnings: [],
      });
    }

    expect(collector.listEvents()).toHaveLength(1_000);
  });

  test("drops malformed locator candidates from page-controlled payloads", async () => {
    const page = new FakeCollectorPage();
    const collector = new RecordingEventCollector("rec_locators");

    await collector.attachPage(page);
    await page.emit({
      kind: "click",
      page_url: "https://fixture.owned.test/form",
      frame_url: "https://fixture.owned.test/form",
      target: {
        tag_name: "button",
        text_sample: "Submit",
        locators: [
          { kind: "test_id", value: "submit", score: 1, reason: "Stable test id" },
          { kind: "role", value: 42, score: 0.9, reason: "Malformed role" },
          { kind: "__proto__", value: "polluted", score: 1, reason: "Invalid kind" },
          { kind: "css", value: "x".repeat(1000), score: 0.1, reason: "Oversized fallback" },
        ],
      },
      value: null,
      raw: {},
      confidence: "high",
      warnings: [],
    });

    const [event] = collector.listEvents();

    expect(event.target?.locators).toEqual([
      { kind: "test_id", value: "submit", score: 1, reason: "Stable test id" },
      {
        kind: "css",
        value: "x".repeat(240),
        score: 0.1,
        reason: "Oversized fallback",
      },
    ]);
    expect(() => normalizeRecordingEvents([event])).not.toThrow();
  });
});

class FakeCollectorContext {
  private pagesList: FakeCollectorPage[];
  private pageHandler: ((page: FakeCollectorPage) => void) | null = null;

  constructor(page: FakeCollectorPage) {
    this.pagesList = [page];
  }

  pages() {
    return this.pagesList;
  }

  async newPage() {
    const page = new FakeCollectorPage();
    this.emitPage(page);
    return page;
  }

  async close() {
    return undefined;
  }

  on(eventName: string, handler: (page: FakeCollectorPage) => void) {
    if (eventName === "page") {
      this.pageHandler = handler;
    }
  }

  emitPage(page: FakeCollectorPage) {
    this.pagesList.push(page);
    this.pageHandler?.(page);
  }
}

function runRecorderCaptureScript(script: string) {
  const documentListeners = new Map<string, Array<(event: { target?: unknown; clipboardData?: unknown }) => void>>();
  const windowListeners = new Map<string, Array<() => void>>();
  const payloads: Array<Record<string, unknown>> = [];
  const addListener = <Args extends unknown[]>(
    listeners: Map<string, Array<(...args: Args) => void>>,
    eventName: string,
    handler: (...args: Args) => void,
  ) => {
    listeners.set(eventName, [...(listeners.get(eventName) ?? []), handler]);
  };
  const windowObject = {
    location: { href: "https://fixture.owned.test/editor" },
    __wamRecorderCapture: (payload: Record<string, unknown>) => {
      payloads.push(payload);
    },
    addEventListener: (eventName: string, handler: () => void) => {
      addListener(windowListeners, eventName, handler);
    },
  };
  const documentObject = {
    addEventListener: (
      eventName: string,
      handler: (event: { target?: unknown; clipboardData?: unknown }) => void,
    ) => {
      addListener(documentListeners, eventName, handler);
    },
  };

  vm.runInNewContext(script, {
    window: windowObject,
    document: documentObject,
  });

  return { documentListeners, payloads, windowListeners };
}

class FakeCollectorPage implements BrowserDriverPage {
  initScripts: string[] = [];
  evaluatedScripts: string[] = [];
  bufferedPayloads: Record<string, unknown>[] = [];
  private exposedCapture:
    | ((payload: Record<string, unknown>) => void | Promise<void>)
    | null = null;
  private frameNavigated: ((frame: { url(): string; parentFrame?(): unknown }) => void) | null = null;
  private downloadHandler: ((download: FakeDownload) => void) | null = null;
  private dialogHandler: ((dialog: FakeDialog) => void | Promise<void>) | null = null;

  constructor(private readonly currentUrl = "about:blank") {}

  async goto() {
    return undefined;
  }

  locator() {
    throw new Error("Not implemented");
  }

  async evaluate(script?: string | (() => unknown)) {
    if (typeof script === "string") {
      this.evaluatedScripts.push(script);
      if (script.includes("__wamRecorderBufferedEvents.splice")) {
        return this.bufferedPayloads.splice(0);
      }
    }
    return undefined;
  }

  async addInitScript(script: string) {
    this.initScripts.push(script);
  }

  async exposeFunction(
    name: string,
    callback: (payload: Record<string, unknown>) => void | Promise<void>,
  ) {
    if (name === "__wamRecorderCapture") {
      this.exposedCapture = callback;
    }
  }

  url() {
    return this.currentUrl;
  }

  on(eventName: string, handler: (...args: never[]) => void | Promise<void>) {
    if (eventName === "framenavigated") {
      this.frameNavigated = handler as (frame: { url(): string; parentFrame?(): unknown }) => void;
    }
    if (eventName === "download") {
      this.downloadHandler = handler as unknown as (download: FakeDownload) => void;
    }
    if (eventName === "dialog") {
      this.dialogHandler = handler as unknown as (dialog: FakeDialog) => void | Promise<void>;
    }
  }

  async emit(payload: Record<string, unknown>) {
    if (!this.exposedCapture) throw new Error("Recorder capture binding was not exposed");
    await this.exposedCapture(payload);
  }

  bufferRecorderPayload(payload: Record<string, unknown>) {
    this.bufferedPayloads.push(payload);
  }

  navigate(url: string) {
    this.frameNavigated?.({ url: () => url });
  }

  navigateFrame(url: string, options: { mainFrame: boolean }) {
    this.frameNavigated?.({
      url: () => url,
      parentFrame: () => (options.mainFrame ? null : {}),
    });
  }

  emitDownload(suggestedFilename: string) {
    this.downloadHandler?.({
      suggestedFilename: () => suggestedFilename,
    });
  }

  async emitDialog(type: string, message: string) {
    await this.dialogHandler?.(new FakeDialog(type, message));
  }
}

type FakeDownload = {
  suggestedFilename(): string;
};

class FakeDialog {
  dismissed = false;

  constructor(
    private readonly dialogType: string,
    private readonly dialogMessage: string,
  ) {}

  type() {
    return this.dialogType;
  }

  message() {
    return this.dialogMessage;
  }

  async accept() {
    return undefined;
  }

  async dismiss() {
    this.dismissed = true;
  }
}
