import type {
  RecordingEvent,
  RecordingEventKind,
  RecordingLocatorCandidate,
  RecordingTarget,
  RecordingValue,
  RecordingWarning,
} from "../../../src/types/workflow.js";
import type {
  BrowserDriverContext,
  BrowserDriverPage,
} from "../browser/sessionManager.js";

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
  parentFrame?(): BrowserFrame | null;
};

type BrowserDownload = {
  suggestedFilename?(): string;
};

type BrowserDialog = {
  accept?(promptText?: string): Promise<void>;
  dismiss?(): Promise<void>;
  type?(): string;
  message?(): string;
  defaultValue?(): string;
};

type RecorderCapablePage = BrowserDriverPage & {
  exposeFunction?(
    name: string,
    callback: (payload: RecorderPayload) => void | Promise<void>,
  ): Promise<void>;
  on?(eventName: string, handler: (...args: never[]) => void | Promise<void>): void;
};

const RECORDER_CAPTURE_BINDING = "__wamRecorderCapture";
const MAX_RECORDING_EVENTS = 1_000;
const MAX_RAW_DEPTH = 3;
const MAX_RAW_OBJECT_ENTRIES = 16;
const MAX_RAW_ARRAY_ITEMS = 8;
const MAX_RAW_STRING_LENGTH = 500;
const MAX_WARNING_MESSAGE_LENGTH = 500;
const MAX_URL_STRING_LENGTH = 2_048;

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

const RECORDING_LOCATOR_KINDS = new Set<RecordingLocatorCandidate["kind"]>([
  "test_id",
  "role",
  "label",
  "placeholder",
  "text",
  "attribute",
  "css",
  "xpath",
]);

const SENSITIVE_FIELD_PATTERN = /(?:password|passwd|passcode|secret|token|api[-_ ]?key|access[-_ ]?key|private[-_ ]?key|credential)/i;
const SENSITIVE_INPUT_TYPES = new Set(["password"]);

export class RecordingEventCollector {
  private readonly events: RecordingEvent[] = [];
  private readonly now: () => Date;
  private readonly pollers: Array<ReturnType<typeof setInterval>> = [];
  private readonly attachedPages = new WeakSet<BrowserDriverPage>();
  private readonly attachedPageList: BrowserDriverPage[] = [];

  constructor(
    private readonly sessionId: string,
    options: RecordingEventCollectorOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
  }

  async attachPage(page: BrowserDriverPage) {
    if (this.attachedPages.has(page)) return;
    this.attachedPages.add(page);
    this.attachedPageList.push(page);
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
    recorderPage.on?.("framenavigated", ((frame: BrowserFrame) => {
      if (!isMainFrame(frame)) return;
      const url = frame.url();
      if (!url || url === "about:blank") return;
      this.recordNavigation(url);
      void this.installPageCapture(page);
    }) as (...args: never[]) => void);
    recorderPage.on?.("download", ((download: BrowserDownload) => {
      const suggestedFilename = download.suggestedFilename?.() ?? "download";
      this.recordPagePayload({
        kind: "download",
        frame_url: null,
        page_url: null,
        target: null,
        value: { file_names: [suggestedFilename] },
        raw: { suggested_filename: suggestedFilename },
        confidence: "medium",
        warnings: [],
      });
    }) as (...args: never[]) => void);
    recorderPage.on?.("dialog", (async (dialog: BrowserDialog) => {
      const dialogType = dialog.type?.() ?? null;
      const message = dialog.message?.() ?? null;
      this.recordPagePayload({
        kind: "dialog",
        frame_url: null,
        page_url: null,
        target: null,
        value: null,
        raw: {
          action: "dismiss",
          dialog_type: dialogType,
          message,
          default_value: dialog.defaultValue?.() ?? null,
        },
        confidence: "medium",
        warnings: [
          {
            code: "dialog_auto_dismissed",
            message:
              "Recorder dismissed a native browser dialog automatically; review the generated dialog action before replay.",
            severity: "warning",
          },
        ],
      });
      await dialog.dismiss?.().catch(() => undefined);
    }) as (...args: never[]) => Promise<void>);
  }

  async attachContext(context: BrowserDriverContext) {
    context.on?.("page", ((page: BrowserDriverPage) => {
      const pages = context.pages();
      const index = Math.max(0, pages.indexOf(page));
      this.recordPagePayload({
        kind: "tab",
        frame_url: null,
        page_url: null,
        target: null,
        value: null,
        raw: { action: "switch", index },
        confidence: "medium",
        warnings: [],
      });
      void this.attachPage(page);
    }) as (...args: never[]) => void);
  }

  listEvents(): RecordingEvent[] {
    return clone(this.events);
  }

  dispose() {
    for (const poller of this.pollers.splice(0)) {
      clearInterval(poller);
    }
  }

  async flushBufferedEvents() {
    for (const page of this.attachedPageList) {
      await this.flushBufferedPageEvents(page);
    }
  }

  async installPageCapture(page: BrowserDriverPage) {
    await page.evaluate(recorderCaptureScript()).catch(() => undefined);
    await this.flushBufferedPageEvents(page);
  }

  recordNavigation(url: string) {
    const publicUrl = boundedString(url, MAX_URL_STRING_LENGTH) ?? "";
    this.pushEvent({
      kind: "navigation",
      frame_url: publicUrl,
      page_url: publicUrl,
      target: null,
      value: null,
      raw: { url: publicUrl },
      confidence: "high",
      warnings: [],
    });
  }

  private recordPagePayload(payload: RecorderPayload) {
    const kind = typeof payload.kind === "string" ? payload.kind : null;
    if (!kind || !isRecordingEventKind(kind)) {
      this.pushEvent({
        kind: "wait_marker",
        frame_url: boundedString(payload.frame_url, MAX_URL_STRING_LENGTH),
        page_url: boundedString(payload.page_url, MAX_URL_STRING_LENGTH),
        target: null,
        value: null,
        raw: redactSensitiveRawFields(boundedRecord(payload.raw)),
        confidence: "low",
        warnings: [
          {
            code: "unsupported_recording_event",
            message: `Unsupported recorder event kind: ${boundedDisplayValue(payload.kind, 120)}`,
            severity: "warning",
          },
        ],
      });
      return;
    }
    const target = recordingTargetOrNull(payload.target);
    let value = recordingValueOrNull(payload.value);
    let raw = redactSensitiveRawFields(boundedRecord(payload.raw));
    let warnings = recordingWarnings(payload.warnings);
    const sensitiveTarget = isSensitiveTextTarget(target, raw);
    const sensitiveTextTarget = value?.text != null && sensitiveTarget;
    if (sensitiveTextTarget) {
      value = { text: "" };
      raw = {
        ...redactSensitiveRaw(raw),
        value_redacted: true,
      };
      warnings = [
        ...warnings,
        {
          code: "sensitive_input_redacted",
          message:
            "Recorder redacted a sensitive field value; review this step and provide a safe variable or test value before replay.",
          severity: "warning",
        },
      ];
    }
    const publicTarget = sensitiveTarget ? redactSensitiveTarget(target) : target;
    this.pushEvent({
      kind,
      frame_url: boundedString(payload.frame_url, MAX_URL_STRING_LENGTH),
      page_url: boundedString(payload.page_url, MAX_URL_STRING_LENGTH),
      target: publicTarget,
      value,
      raw,
      confidence:
        payload.confidence === "medium" || payload.confidence === "low"
          ? payload.confidence
          : "high",
      warnings,
    });
  }

  private pushEvent(
    input: Omit<RecordingEvent, "id" | "session_id" | "sequence" | "timestamp">,
  ) {
    if (this.events.length >= MAX_RECORDING_EVENTS) return;
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

function isMainFrame(frame: BrowserFrame) {
  if (typeof frame.parentFrame !== "function") return true;
  try {
    return frame.parentFrame() == null;
  } catch {
    return true;
  }
}

function recordingTargetOrNull(value: unknown, depth = 0): RecordingTarget | null {
  if (depth > MAX_RAW_DEPTH) return null;
  const raw = objectRecord(value);
  const tagName = stringOrNull(raw.tag_name)?.toLowerCase();
  if (!tagName) return null;
  return {
    tag_name: tagName,
    input_type: stringOrNull(raw.input_type),
    text_sample: boundedString(raw.text_sample),
    role: stringOrNull(raw.role),
    accessible_name: boundedString(raw.accessible_name),
    iframe: recordingTargetOrNull(raw.iframe, depth + 1),
    locators: recordingLocatorCandidates(raw.locators),
    bounding_box: boundingBoxOrNull(raw.bounding_box),
  };
}

function recordingLocatorCandidates(value: unknown): RecordingLocatorCandidate[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 16).flatMap((item) => {
    const raw = objectRecord(item);
    const kind = stringOrNull(raw.kind);
    const candidateValue = boundedString(raw.value, 240);
    const score = finiteNumber(raw.score);
    const reason = boundedString(raw.reason, 160);
    if (!kind || !isRecordingLocatorKind(kind) || !candidateValue || score == null || !reason) {
      return [];
    }
    const candidate: RecordingLocatorCandidate = {
      kind,
      value: candidateValue,
      score,
      reason,
    };
    const name = boundedString(raw.name, 160);
    const role = boundedString(raw.role, 80);
    const attribute = boundedString(raw.attribute, 80);
    if (name) candidate.name = name;
    if (role) candidate.role = role;
    if (attribute) candidate.attribute = attribute;
    return [candidate];
  }).slice(0, 8);
}

function isRecordingLocatorKind(value: string): value is RecordingLocatorCandidate["kind"] {
  return RECORDING_LOCATOR_KINDS.has(value as RecordingLocatorCandidate["kind"]);
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
      ? raw.keys
          .filter((key): key is string => typeof key === "string")
          .map((key) => key.slice(0, 80))
          .slice(0, 8)
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
    const code = boundedString(raw.code, 80);
    const message = boundedString(raw.message, MAX_WARNING_MESSAGE_LENGTH);
    if (!code || !message) return [];
    return [{
      code,
      message,
      event_id: boundedString(raw.event_id, 120),
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
    Object.entries(raw).slice(0, MAX_RAW_OBJECT_ENTRIES).map(([key, entry]) => [
      key.slice(0, 80),
      boundedUnknown(entry, 1),
    ]),
  );
}

function boundedUnknown(value: unknown, depth: number): unknown {
  if (typeof value === "string") return value.slice(0, MAX_RAW_STRING_LENGTH);
  if (
    value == null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    if (depth >= MAX_RAW_DEPTH) return `[${value.length} items]`;
    return value
      .slice(0, MAX_RAW_ARRAY_ITEMS)
      .map((entry) => boundedUnknown(entry, depth + 1));
  }
  if (typeof value === "object") {
    if (depth >= MAX_RAW_DEPTH) return "[object]";
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, MAX_RAW_OBJECT_ENTRIES)
        .map(([key, entry]) => [
          key.slice(0, 80),
          boundedUnknown(entry, depth + 1),
        ]),
    );
  }
  return String(value).slice(0, MAX_RAW_STRING_LENGTH);
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function boundedString(value: unknown, limit = 500) {
  const text = stringOrNull(value);
  return text ? text.slice(0, limit) : null;
}

function boundedDisplayValue(value: unknown, limit: number) {
  return String(value).slice(0, limit);
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isSensitiveTextTarget(
  target: RecordingTarget | null,
  raw: Record<string, unknown>,
) {
  const inputType =
    target?.input_type?.toLowerCase() ??
    stringOrNull(raw.input_type)?.toLowerCase();
  if (inputType && SENSITIVE_INPUT_TYPES.has(inputType)) return true;
  const locatorFields = target?.locators.flatMap((locator) => [
    locator.value,
    locator.name,
    locator.attribute,
    locator.reason,
  ]) ?? [];
  return [
    target?.accessible_name,
    target?.text_sample,
    ...locatorFields,
    ...Object.entries(raw).flatMap(([key, value]) => [
      key,
      typeof value === "string" ? value : null,
    ]),
  ].some((value) => typeof value === "string" && SENSITIVE_FIELD_PATTERN.test(value));
}

function redactSensitiveRaw(raw: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      key === "input_type" ? value : "[redacted]",
    ]),
  );
}

function redactSensitiveRawFields(raw: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      SENSITIVE_FIELD_PATTERN.test(key) ? "[redacted]" : redactSensitiveUnknown(value),
    ]),
  );
}

function redactSensitiveUnknown(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitiveUnknown(entry));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        SENSITIVE_FIELD_PATTERN.test(key) ? "[redacted]" : redactSensitiveUnknown(entry),
      ]),
    );
  }
  return value;
}

function redactSensitiveTarget(target: RecordingTarget | null): RecordingTarget | null {
  if (!target) return null;
  return {
    ...target,
    text_sample: null,
    locators: [],
    iframe: redactSensitiveTarget(target.iframe ?? null),
  };
}

function recorderCaptureScript() {
  return `(() => {
    if (window.__wamRecorderInstalled) return;
    window.__wamRecorderInstalled = true;
    const trim = (value, limit = 500) =>
      typeof value === "string" ? value.trim().slice(0, limit) : null;
    const sensitiveFieldPattern = /(?:password|passwd|passcode|secret|token|api[-_ ]?key|access[-_ ]?key|private[-_ ]?key|credential)/i;
    const isSensitiveInput = (target) => {
      if (!target) return false;
      const type = String(target.type || "").toLowerCase();
      if (type === "password") return true;
      return [target.name, target.id, target.placeholder, target.getAttribute && target.getAttribute("aria-label")]
        .some((value) => typeof value === "string" && sensitiveFieldPattern.test(value));
    };
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
      const textSample = trim(
        element.innerText || element.textContent || (isSensitiveInput(element) ? "" : element.value) || "",
        160
      );
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
      if (window.__wamRecorderBufferedEvents.length < ${MAX_RECORDING_EVENTS}) {
        window.__wamRecorderBufferedEvents.push(event);
      }
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
      if (event.detail && event.detail > 1) return;
      push({
        kind: "click",
        target: targetFor(event.target),
        value: null,
        raw: { button: event.button, detail: event.detail, click_type: "single" }
      });
    }, true);
    document.addEventListener("dblclick", (event) => {
      push({
        kind: "click",
        target: targetFor(event.target),
        value: null,
        raw: { button: event.button, detail: event.detail, click_type: "double" }
      });
    }, true);
    document.addEventListener("contextmenu", (event) => {
      push({
        kind: "click",
        target: targetFor(event.target),
        value: null,
        raw: { button: event.button, detail: event.detail, click_type: "right" }
      });
    }, true);
    document.addEventListener("keydown", (event) => {
      const key = event.key === " " ? "Space" : event.key;
      if (!key) return;
      const hasModifier = Boolean(event.ctrlKey || event.metaKey || event.altKey || event.shiftKey);
      if (!hasModifier && key.length === 1) return;
      const keys = [];
      if (event.ctrlKey) keys.push("Control");
      if (event.metaKey) keys.push("Meta");
      if (event.altKey) keys.push("Alt");
      if (event.shiftKey && key !== "Shift") keys.push("Shift");
      if (!["Control", "Meta", "Alt", "Shift"].includes(key)) keys.push(key);
      push({
        kind: "keyboard",
        target: targetFor(event.target),
        value: keys.length > 1 ? { keys } : { key: keys[0] || key },
        raw: { key, code: event.code || null, repeat: Boolean(event.repeat) }
      });
    }, true);
    document.addEventListener("input", (event) => {
      const target = event.target;
      if (!target) return;
      const tag = target.tagName ? target.tagName.toLowerCase() : "";
      const type = target.type || "";
      if (type === "file") {
        const fileNames = target.files ? Array.from(target.files).map((file) => file.name) : [];
        push({
          kind: "change",
          target: targetFor(target),
          value: { file_names: fileNames },
          raw: { input_type: "file", file_count: fileNames.length },
          warnings: [{
            code: "upload_requires_reviewed_file_path",
            message: "Native file chooser paths are not captured; review and enter local upload file paths before replay.",
            severity: "warning"
          }]
        });
        return;
      }
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
        value: { text: isSensitiveInput(target) ? "" : target.value || "" },
        raw: {
          input_type: type || null,
          value_redacted: isSensitiveInput(target) || undefined
        },
        warnings: isSensitiveInput(target) ? [{
          code: "sensitive_input_redacted",
          message: "Recorder redacted a sensitive field value; review this step and provide a safe variable or test value before replay.",
          severity: "warning"
        }] : []
      });
    }, true);
    document.addEventListener("change", (event) => {
      const target = event.target;
      if (!target) return;
      const tag = target.tagName ? target.tagName.toLowerCase() : "";
      const type = target.type || "";
      if (type === "file") {
        const fileNames = target.files ? Array.from(target.files).map((file) => file.name) : [];
        push({
          kind: "change",
          target: targetFor(target),
          value: { file_names: fileNames },
          raw: { source: "change", input_type: "file", file_count: fileNames.length },
          warnings: [{
            code: "upload_requires_reviewed_file_path",
            message: "Native file chooser paths are not captured; review and enter local upload file paths before replay.",
            severity: "warning"
          }]
        });
      } else if (tag === "select") {
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
    document.addEventListener("submit", (event) => {
      push({
        kind: "wait_marker",
        target: targetFor(event.target),
        value: null,
        raw: { action: "submit" }
      });
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
