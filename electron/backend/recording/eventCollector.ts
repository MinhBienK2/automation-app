import type {
  RecordingEvent,
  RecordingEventKind,
  RecordingTarget,
  RecordingValue,
  RecordingWarning,
} from "../../../src/types/workflow.js";
import type { BrowserDriverPage } from "../browser/sessionManager.js";

type RecordingEventCollectorOptions = {
  now?: () => Date;
};

type RecorderPayload = {
  kind?: unknown;
  frame_url?: unknown;
  page_url?: unknown;
  target?: unknown;
  value?: unknown;
  raw?: unknown;
  confidence?: unknown;
  warnings?: unknown;
};

type BrowserFrame = {
  url(): string;
};

type RecorderCapablePage = BrowserDriverPage & {
  exposeFunction?(
    name: string,
    callback: (payload: RecorderPayload) => void | Promise<void>,
  ): Promise<void>;
  on?(eventName: "framenavigated", handler: (frame: BrowserFrame) => void): void;
};

const RECORDER_CAPTURE_BINDING = "__wamRecorderCapture";

const RECORDABLE_EVENT_KINDS = new Set<RecordingEventKind>([
  "navigation",
  "click",
  "input",
  "change",
  "select",
  "checkbox",
  "radio",
  "scroll",
  "keyboard",
  "download",
  "dialog",
  "tab",
  "wait_marker",
]);

export class RecordingEventCollector {
  private readonly events: RecordingEvent[] = [];
  private readonly now: () => Date;
  private readonly pollers: Array<ReturnType<typeof setInterval>> = [];

  constructor(
    private readonly sessionId: string,
    options: RecordingEventCollectorOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
  }

  async attachPage(page: BrowserDriverPage) {
    const recorderPage = page as RecorderCapablePage;
    await recorderPage.exposeFunction?.(RECORDER_CAPTURE_BINDING, (payload) => {
      this.recordPagePayload(payload);
    });
    await page.addInitScript?.(recorderCaptureScript());
    await this.installPageCapture(page);
    const poller = setInterval(() => {
      void this.flushBufferedPageEvents(page);
    }, 100);
    poller.unref?.();
    this.pollers.push(poller);
    recorderPage.on?.("framenavigated", (frame) => {
      const url = frame.url();
      if (!url || url === "about:blank") return;
      this.recordNavigation(url);
      void this.installPageCapture(page);
    });
  }

  listEvents(): RecordingEvent[] {
    return clone(this.events);
  }

  dispose() {
    for (const poller of this.pollers.splice(0)) {
      clearInterval(poller);
    }
  }

  async installPageCapture(page: BrowserDriverPage) {
    await page.evaluate(recorderCaptureScript()).catch(() => undefined);
    await this.flushBufferedPageEvents(page);
  }

  recordNavigation(url: string) {
    this.pushEvent({
      kind: "navigation",
      frame_url: url,
      page_url: url,
      target: null,
      value: null,
      raw: { url },
      confidence: "high",
      warnings: [],
    });
  }

  private recordPagePayload(payload: RecorderPayload) {
    const kind = typeof payload.kind === "string" ? payload.kind : null;
    if (!kind || !isRecordingEventKind(kind)) {
      this.pushEvent({
        kind: "wait_marker",
        frame_url: stringOrNull(payload.frame_url),
        page_url: stringOrNull(payload.page_url),
        target: null,
        value: null,
        raw: boundedRecord(payload.raw),
        confidence: "low",
        warnings: [
          {
            code: "unsupported_recording_event",
            message: `Unsupported recorder event kind: ${String(payload.kind)}`,
            severity: "warning",
          },
        ],
      });
      return;
    }
    this.pushEvent({
      kind,
      frame_url: stringOrNull(payload.frame_url),
      page_url: stringOrNull(payload.page_url),
      target: recordingTargetOrNull(payload.target),
      value: recordingValueOrNull(payload.value),
      raw: boundedRecord(payload.raw),
      confidence:
        payload.confidence === "medium" || payload.confidence === "low"
          ? payload.confidence
          : "high",
      warnings: recordingWarnings(payload.warnings),
    });
  }

  private pushEvent(
    input: Omit<RecordingEvent, "id" | "session_id" | "sequence" | "timestamp">,
  ) {
    const sequence = this.events.length + 1;
    this.events.push({
      id: `${this.sessionId}_evt_${sequence}`,
      session_id: this.sessionId,
      sequence,
      timestamp: this.now().toISOString(),
      ...input,
    });
  }

  private async flushBufferedPageEvents(page: BrowserDriverPage) {
    try {
      const payloads = await page.evaluate<RecorderPayload[]>(`(() => {
        const buffered = Array.isArray(window.__wamRecorderBufferedEvents)
          ? window.__wamRecorderBufferedEvents.splice(0)
          : [];
        return buffered;
      })()`);
      for (const payload of Array.isArray(payloads) ? payloads : []) {
        this.recordPagePayload(payload);
      }
    } catch {
      // Page may be navigating or already closed; the next poll or session stop will handle it.
    }
  }
}

function isRecordingEventKind(value: string): value is RecordingEventKind {
  return RECORDABLE_EVENT_KINDS.has(value as RecordingEventKind);
}

function recordingTargetOrNull(value: unknown): RecordingTarget | null {
  const raw = objectRecord(value);
  const tagName = stringOrNull(raw.tag_name)?.toLowerCase();
  if (!tagName) return null;
  return {
    tag_name: tagName,
    input_type: stringOrNull(raw.input_type),
    text_sample: boundedString(raw.text_sample),
    role: stringOrNull(raw.role),
    accessible_name: boundedString(raw.accessible_name),
    iframe: recordingTargetOrNull(raw.iframe),
    locators: Array.isArray(raw.locators) ? clone(raw.locators).slice(0, 8) : [],
    bounding_box: boundingBoxOrNull(raw.bounding_box),
  };
}

function recordingValueOrNull(value: unknown): RecordingValue | null {
  const raw = objectRecord(value);
  if (!Object.keys(raw).length) return null;
  return {
    text: boundedString(raw.text),
    checked: typeof raw.checked === "boolean" ? raw.checked : null,
    selected_value: boundedString(raw.selected_value),
    selected_label: boundedString(raw.selected_label),
    key: boundedString(raw.key),
    keys: Array.isArray(raw.keys)
      ? raw.keys.filter((key): key is string => typeof key === "string").slice(0, 8)
      : null,
    scroll: scrollOrNull(raw.scroll),
    file_names: Array.isArray(raw.file_names)
      ? raw.file_names
          .filter((name): name is string => typeof name === "string")
          .map((name) => name.slice(0, 160))
          .slice(0, 12)
      : null,
  };
}

function recordingWarnings(value: unknown): RecordingWarning[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).flatMap((item) => {
    const raw = objectRecord(item);
    const code = stringOrNull(raw.code);
    const message = stringOrNull(raw.message);
    if (!code || !message) return [];
    return [{
      code,
      message,
      event_id: stringOrNull(raw.event_id),
      severity:
        raw.severity === "error" || raw.severity === "info"
          ? raw.severity
          : "warning",
    }];
  });
}

function boundingBoxOrNull(value: unknown) {
  const raw = objectRecord(value);
  const x = finiteNumber(raw.x);
  const y = finiteNumber(raw.y);
  const width = finiteNumber(raw.width);
  const height = finiteNumber(raw.height);
  if (x == null || y == null || width == null || height == null) return null;
  return { x, y, width, height };
}

function scrollOrNull(value: unknown) {
  const raw = objectRecord(value);
  const x = finiteNumber(raw.x);
  const y = finiteNumber(raw.y);
  if (x == null || y == null) return null;
  return { x, y };
}

function boundedRecord(value: unknown): Record<string, unknown> {
  const raw = objectRecord(value);
  return Object.fromEntries(
    Object.entries(raw).slice(0, 24).map(([key, entry]) => [
      key.slice(0, 80),
      typeof entry === "string" ? entry.slice(0, 500) : entry,
    ]),
  );
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function boundedString(value: unknown) {
  const text = stringOrNull(value);
  return text ? text.slice(0, 500) : null;
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function recorderCaptureScript() {
  return `(() => {
    if (window.__wamRecorderInstalled) return;
    window.__wamRecorderInstalled = true;
    const trim = (value, limit = 500) =>
      typeof value === "string" ? value.trim().slice(0, limit) : null;
    const attrSelector = (name, value) =>
      "[" + name + "='" + String(value).replace(/'/g, "\\\\'") + "']";
    const locatorCandidatesFor = (element, tag, textSample, accessibleName) => {
      const locators = [];
      const testId = element.getAttribute && (element.getAttribute("data-testid") || element.getAttribute("data-test"));
      const role = element.getAttribute && element.getAttribute("role");
      const label = element.labels && element.labels.length ? trim(element.labels[0].innerText || element.labels[0].textContent || "", 160) : null;
      const placeholder = element.getAttribute && element.getAttribute("placeholder");
      const name = element.getAttribute && element.getAttribute("name");
      if (testId) locators.push({ kind: "test_id", value: testId, score: 1, reason: "Element test id" });
      if (role && accessibleName) locators.push({ kind: "role", value: role, name: accessibleName, score: 0.86, reason: "Accessible role and name" });
      if (label) locators.push({ kind: "label", value: label, score: 0.84, reason: "Associated label" });
      if (placeholder) locators.push({ kind: "placeholder", value: placeholder, score: 0.78, reason: "Field placeholder" });
      if (textSample && textSample.length <= 80) locators.push({ kind: "text", value: textSample, score: 0.62, reason: "Short visible text" });
      if (element.id) locators.push({ kind: "css", value: attrSelector("id", element.id), score: 0.55, reason: "Element id fallback" });
      if (name) locators.push({ kind: "attribute", attribute: "name", value: name, score: 0.52, reason: "Name attribute fallback" });
      locators.push({ kind: "css", value: tag, score: 0.2, reason: "Tag fallback" });
      return locators;
    };
    const targetFor = (element) => {
      if (!element || !element.tagName) return null;
      const rect = element.getBoundingClientRect ? element.getBoundingClientRect() : null;
      const tag = element.tagName.toLowerCase();
      const textSample = trim(element.innerText || element.textContent || element.value || "", 160);
      const accessibleName = trim(
        (element.getAttribute && (element.getAttribute("aria-label") || element.getAttribute("name") || element.getAttribute("placeholder"))) || "",
        160
      );
      return {
        tag_name: tag,
        input_type: trim(element.getAttribute && element.getAttribute("type"), 80),
        text_sample: textSample,
        role: trim(element.getAttribute && element.getAttribute("role"), 80),
        accessible_name: accessibleName,
        locators: locatorCandidatesFor(element, tag, textSample, accessibleName),
        bounding_box: rect
          ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          : null
      };
    };
    const bufferEvent = (event) => {
      window.__wamRecorderBufferedEvents = Array.isArray(window.__wamRecorderBufferedEvents)
        ? window.__wamRecorderBufferedEvents
        : [];
      window.__wamRecorderBufferedEvents.push(event);
    };
    const push = (payload) => {
      const capture = window.__wamRecorderCapture;
      const event = {
        frame_url: window.location.href,
        page_url: window.location.href,
        confidence: "high",
        warnings: [],
        ...payload
      };
      if (typeof capture === "function") {
        try {
          const result = capture(event);
          if (result && typeof result.catch === "function") {
            result.catch(() => bufferEvent(event));
          }
        } catch {
          bufferEvent(event);
        }
        return;
      }
      bufferEvent(event);
    };
    document.addEventListener("click", (event) => {
      push({
        kind: "click",
        target: targetFor(event.target),
        value: null,
        raw: { button: event.button, detail: event.detail }
      });
    }, true);
    document.addEventListener("input", (event) => {
      const target = event.target;
      if (!target) return;
      const tag = target.tagName ? target.tagName.toLowerCase() : "";
      const type = target.type || "";
      if (tag === "select") {
        push({
          kind: "select",
          target: targetFor(target),
          value: {
            selected_value: target.value || null,
            selected_label: target.options && target.selectedIndex >= 0
              ? target.options[target.selectedIndex].text
              : null
          },
          raw: {}
        });
        return;
      }
      if (type === "checkbox" || type === "radio") {
        push({
          kind: type,
          target: targetFor(target),
          value: { checked: Boolean(target.checked) },
          raw: {}
        });
        return;
      }
      push({
        kind: "input",
        target: targetFor(target),
        value: { text: target.value || "" },
        raw: { input_type: type || null }
      });
    }, true);
    document.addEventListener("change", (event) => {
      const target = event.target;
      if (!target) return;
      const tag = target.tagName ? target.tagName.toLowerCase() : "";
      const type = target.type || "";
      if (tag === "select") {
        push({
          kind: "select",
          target: targetFor(target),
          value: {
            selected_value: target.value || null,
            selected_label: target.options && target.selectedIndex >= 0
              ? target.options[target.selectedIndex].text
              : null
          },
          raw: { source: "change" }
        });
      } else if (type === "checkbox" || type === "radio") {
        push({
          kind: type,
          target: targetFor(target),
          value: { checked: Boolean(target.checked) },
          raw: { source: "change" }
        });
      }
    }, true);
    let lastScrollAt = 0;
    window.addEventListener("scroll", () => {
      const now = Date.now();
      if (now - lastScrollAt < 250) return;
      lastScrollAt = now;
      push({
        kind: "scroll",
        target: null,
        value: { scroll: { x: window.scrollX, y: window.scrollY } },
        raw: {}
      });
    }, true);
  })()`;
}
