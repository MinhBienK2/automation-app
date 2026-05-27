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
});

class FakeCollectorPage implements BrowserDriverPage {
  initScripts: string[] = [];
  evaluatedScripts: string[] = [];
  private exposedCapture:
    | ((payload: Record<string, unknown>) => void | Promise<void>)
    | null = null;
  private frameNavigated: ((frame: { url(): string }) => void) | null = null;

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

  on(eventName: "framenavigated", handler: (frame: { url(): string }) => void) {
    if (eventName === "framenavigated") {
      this.frameNavigated = handler;
    }
  }

  async emit(payload: Record<string, unknown>) {
    if (!this.exposedCapture) throw new Error("Recorder capture binding was not exposed");
    await this.exposedCapture(payload);
  }

  navigate(url: string) {
    this.frameNavigated?.({ url: () => url });
  }
}
