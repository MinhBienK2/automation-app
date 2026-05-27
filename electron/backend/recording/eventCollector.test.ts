// @vitest-environment node

import { describe, expect, test } from "vitest";
import type { BrowserDriverPage } from "../browser/sessionManager";
import { RecordingEventCollector } from "./eventCollector";

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
        raw: { action: "switch", index: 1 },
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

class FakeCollectorPage implements BrowserDriverPage {
  initScripts: string[] = [];
  evaluatedScripts: string[] = [];
  private exposedCapture:
    | ((payload: Record<string, unknown>) => void | Promise<void>)
    | null = null;
  private frameNavigated: ((frame: { url(): string }) => void) | null = null;
  private downloadHandler: ((download: FakeDownload) => void) | null = null;
  private dialogHandler: ((dialog: FakeDialog) => void | Promise<void>) | null = null;

  async goto() {
    return undefined;
  }

  locator() {
    throw new Error("Not implemented");
  }

  async evaluate(script?: string | (() => unknown)) {
    if (typeof script === "string") {
      this.evaluatedScripts.push(script);
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

  on(eventName: string, handler: (...args: never[]) => void | Promise<void>) {
    if (eventName === "framenavigated") {
      this.frameNavigated = handler as (frame: { url(): string }) => void;
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

  navigate(url: string) {
    this.frameNavigated?.({ url: () => url });
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
