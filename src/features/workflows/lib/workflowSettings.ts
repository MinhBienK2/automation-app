import type {
  VariableAssignment,
  VariableValueType,
  WorkflowBrowserConfig,
  WorkflowSettings,
  WorkflowSettingsSectionId,
} from "../../../types/workflow";

export type WorkflowSettingsSection = {
  id: WorkflowSettingsSectionId;
  label: string;
};

export type WorkflowSettingsHelpContent = {
  title: string;
  summary: string;
  uiLabels: {
    bestFor: string;
    notFor: string;
    precedence: string;
    fieldGuide: string;
    commonMistakes: string;
    safetyNotes: string;
  };
  bestFor: string[];
  notFor?: string[];
  precedence?: string[];
  fieldGuide: Array<{
    name: string;
    description: string;
    whenToUse?: string;
    overrideBehavior?: string;
  }>;
  workflowExamples: Array<{
    title: string;
    steps: string[];
    notes?: string[];
  }>;
  relatedGraphActions?: Array<{
    action: string;
    relationship: "default" | "runtime_override" | "compatibility";
    explanation: string;
  }>;
  safetyNotes?: string[];
  commonMistakes: Array<{
    mistake: string;
    fix: string;
  }>;
};

export type WorkflowSettingsHelpLanguage = "en" | "vi";

export type WorkflowSettingsLocalizedHelp = Record<
  WorkflowSettingsHelpLanguage,
  WorkflowSettingsHelpContent
>;

export const workflowSettingsSections: WorkflowSettingsSection[] = [
  { id: "general", label: "General" },
  { id: "execution", label: "Execution" },
  { id: "browser", label: "Browser" },
  { id: "environment", label: "Environment" },
  { id: "inputs", label: "Variables" },
  { id: "triggers", label: "Triggers" },
  { id: "advanced", label: "Advanced" },
];

export type BrowserDeviceProfileId =
  | "default"
  | "desktop_chrome"
  | "android_chrome"
  | "iphone_safari"
  | "custom";

type BrowserDeviceConfig = Pick<
  WorkflowBrowserConfig,
  "user_agent" | "viewport_width" | "viewport_height" | "mobile" | "touch"
>;

type BrowserDevicePreset = {
  id: Exclude<BrowserDeviceProfileId, "custom">;
  label: string;
  config: BrowserDeviceConfig;
};

export const browserDeviceProfilePresets: BrowserDevicePreset[] = [
  {
    id: "default",
    label: "Default browser",
    config: {
      user_agent: null,
      viewport_width: null,
      viewport_height: null,
      mobile: false,
      touch: false,
    },
  },
  {
    id: "desktop_chrome",
    label: "Desktop Chrome",
    config: {
      user_agent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      viewport_width: 1365,
      viewport_height: 768,
      mobile: false,
      touch: false,
    },
  },
  {
    id: "android_chrome",
    label: "Android Chrome",
    config: {
      user_agent:
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
      viewport_width: 390,
      viewport_height: 844,
      mobile: true,
      touch: true,
    },
  },
  {
    id: "iphone_safari",
    label: "iPhone Safari",
    config: {
      user_agent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
      viewport_width: 390,
      viewport_height: 844,
      mobile: true,
      touch: true,
    },
  },
];

export const browserDeviceProfileOptions = [
  ...browserDeviceProfilePresets.map(({ id, label }) => ({ id, label })),
  { id: "custom" as const, label: "Custom user agent" },
];

export function createDefaultBrowserProfileName(seed = randomProfileSeed()) {
  const safeSeed = seed
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `profile-${safeSeed || randomProfileSeed()}`;
}

function randomProfileSeed() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

export function applyBrowserDeviceProfile<T extends BrowserDeviceConfig>(
  config: T,
  profileId: BrowserDeviceProfileId,
): T {
  const preset = browserDeviceProfilePresets.find((candidate) => candidate.id === profileId);
  if (!preset) return config;
  return { ...config, ...preset.config };
}

export function detectBrowserDeviceProfile(config: BrowserDeviceConfig): BrowserDeviceProfileId {
  const preset = browserDeviceProfilePresets.find((candidate) =>
    browserDeviceConfigMatches(config, candidate.config),
  );
  return preset?.id ?? "custom";
}

function browserDeviceConfigMatches(config: BrowserDeviceConfig, preset: BrowserDeviceConfig) {
  return (
    (config.user_agent ?? null) === preset.user_agent &&
    (config.viewport_width ?? null) === preset.viewport_width &&
    (config.viewport_height ?? null) === preset.viewport_height &&
    config.mobile === preset.mobile &&
    config.touch === preset.touch
  );
}

export function variableRowsFromJsonText(
  text: string,
): { rows: VariableAssignment[]; error: string | null } {
  const trimmed = text.trim();
  if (!trimmed) return { rows: [], error: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    return {
      rows: [],
      error: error instanceof Error ? error.message : "Invalid JSON",
    };
  }

  if (!isPlainObject(parsed)) {
    return { rows: [], error: "Variables JSON must be an object." };
  }

  return { rows: flattenVariablesObject(parsed), error: null };
}

export function variablesJsonFromRows(rows: VariableAssignment[]) {
  const root: Record<string, unknown> = {};
  for (const row of rows) {
    const path = row.name
      .split(".")
      .map((part) => part.trim())
      .filter(Boolean);
    if (!path.length) continue;
    setNestedValue(root, path, variableRowValue(row));
  }
  return JSON.stringify(root, null, 2);
}

function flattenVariablesObject(
  object: Record<string, unknown>,
  prefix = "",
): VariableAssignment[] {
  const rows: VariableAssignment[] = [];
  for (const [key, value] of Object.entries(object)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value) && Object.keys(value).length > 0) {
      rows.push(...flattenVariablesObject(value, path));
      continue;
    }
    rows.push({
      name: path,
      value_type: variableValueType(value),
      value: variableValueText(value),
    });
  }
  return rows;
}

function variableValueType(value: unknown): VariableValueType {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string") return "text";
  return "json";
}

function variableValueText(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function variableRowValue(row: VariableAssignment): unknown {
  switch (row.value_type) {
    case "number": {
      const parsed = Number(row.value);
      return Number.isFinite(parsed) ? parsed : row.value;
    }
    case "boolean":
      return row.value.trim().toLowerCase() === "true";
    case "json":
      try {
        return JSON.parse(row.value);
      } catch {
        return row.value;
      }
    case "text":
    default:
      return row.value;
  }
}

function setNestedValue(root: Record<string, unknown>, path: string[], value: unknown) {
  let target = root;
  for (const key of path.slice(0, -1)) {
    const current = target[key];
    if (!isPlainObject(current)) {
      target[key] = {};
    }
    target = target[key] as Record<string, unknown>;
  }
  target[path[path.length - 1]] = value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function defaultWorkflowSettings({
  workflowId,
  workflowName,
  createdAt = null,
  updatedAt = null,
}: {
  workflowId: string;
  workflowName: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}): WorkflowSettings {
  return {
    workflow_id: workflowId,
    version: 1,
    general: {
      name: workflowName,
      description: "",
      tags: [],
      notes: "",
      created_at: createdAt,
      updated_at: updatedAt,
    },
    execution: {
      default_action_timeout_ms: null,
      default_retry_attempts: null,
      default_retry_interval_ms: null,
      max_workflow_duration_ms: null,
      browser_retention: "retain",
      failure_policy: "stop_on_first_failure",
      interaction_fidelity: "standard",
      direct_dom_fallback: "allowed_with_trace",
      timing_profile: "balanced",
      wait_between_nodes_enabled: false,
      wait_between_nodes_random: false,
      wait_between_nodes_ms: null,
      wait_between_nodes_min_ms: null,
      wait_between_nodes_max_ms: null,
      batch_concurrency_limit: null,
      batch_headless: false,
      batch_stop_on_first_failed_row: false,
      output_retention_days: null,
    },
    browser: {
      profile_name: null,
      proxy_enabled: false,
      proxy_server: null,
      proxy_username: null,
      proxy_password: null,
      user_agent: null,
      viewport_width: null,
      viewport_height: null,
      mobile: false,
      touch: false,
      challenge_policy: "none",
      headless: false,
      fingerprint_preflight_enabled: false,
      fingerprint_probe_url: null,
      fingerprint_profile_id: null,
      fingerprint_allowed_origins: [],
      fingerprint_proxy_label: null,
      fingerprint_proxy_region: null,
    },
    environment: {
      geolocation: null,
      permissions: [],
      extra_http_headers: [],
      locale: null,
      timezone: null,
      download_directory: null,
      cookies: [],
      local_storage: [],
      session_storage: [],
      session_restore_ref: null,
    },
    inputs: {
      input_schema: [],
      initial_variables: [],
      batch_mapping: [],
    },
    triggers: {
      enabled: false,
      mode: "manual",
      interval_seconds: null,
      once_at: null,
      input_source: null,
      batch_source_ref: null,
      missed_run_policy: "skip",
      concurrency_policy: "skip_if_running",
      last_run_at: null,
      next_run_at: null,
    },
    advanced: {
      compatibility_warnings: [],
      debug_logging_level: "off",
      experimental_flags: [],
    },
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export function workflowBrowserConfigFromSettings(settings: WorkflowSettings) {
  return {
    workflow_id: settings.workflow_id,
    profile_name: settings.browser.profile_name,
    proxy_enabled: settings.browser.proxy_enabled,
    proxy_server: settings.browser.proxy_server,
    proxy_username: settings.browser.proxy_username,
    proxy_password: settings.browser.proxy_password,
    user_agent: settings.browser.user_agent,
    viewport_width: settings.browser.viewport_width,
    viewport_height: settings.browser.viewport_height,
    mobile: settings.browser.mobile,
    touch: settings.browser.touch,
    challenge_policy: settings.browser.challenge_policy,
  };
}

export function tagsFromInput(value: string) {
  const seen = new Set<string>();
  return value
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => {
      if (!tag || seen.has(tag)) return false;
      seen.add(tag);
      return true;
    });
}

export function tagsToInput(tags: string[]) {
  return tags.join(", ");
}

const enLabels = {
  bestFor: "Use it when",
  notFor: "Do not use it for",
  precedence: "Precedence and overrides",
  fieldGuide: "Field guide",
  commonMistakes: "Common mistakes",
  safetyNotes: "Safety notes",
};

const viLabels = {
  bestFor: "Nên dùng khi",
  notFor: "Không dùng cho",
  precedence: "Thứ tự ưu tiên và ghi đè",
  fieldGuide: "Giải thích từng field",
  commonMistakes: "Lỗi thường gặp",
  safetyNotes: "Lưu ý an toàn",
};

export const workflowSettingsHelp: Record<
  WorkflowSettingsSectionId,
  WorkflowSettingsLocalizedHelp
> = {
  general: {
    en: {
      title: "General Settings Help",
      summary:
        "General settings describe what this workflow is, who should recognize it, and how it appears in lists, headers, exports, duplicates, and future shared workspaces without changing how the graph runs.",
      uiLabels: enLabels,
      bestFor: [
        "Creating a readable name that operators can recognize without opening the graph.",
        "Adding description, tags, and notes that make search, handoff, and review easier.",
      ],
      notFor: [
        "Changing browser launch behavior, proxy routing, retries, schedules, or graph execution order.",
      ],
      precedence: [
        "General metadata travels with the workflow, but runner decisions come from Execution, Browser, Environment, Variables, Triggers, and graph nodes.",
      ],
      fieldGuide: [
        {
          name: "Workflow name",
          description:
            "Required display name used by the workflow list, breadcrumb, detail header, save feedback, export labels, duplicate flows, and any future shared workspace references.",
          whenToUse:
            "Use a business-flow name such as Checkout smoke test instead of a technical note, so another user can pick the right workflow quickly.",
        },
        {
          name: "Description",
          description:
            "Short human explanation of what the workflow proves, which system it touches, and what a successful run means. It is for orientation, not validation.",
          whenToUse:
            "Use it when the workflow name alone is not enough to explain scope, environment, expected user journey, or ownership.",
        },
        {
          name: "Tags",
          description:
            "Comma-separated search labels normalized to lowercase and deduplicated, useful for grouping workflows by team, environment, feature area, or smoke-suite purpose.",
          whenToUse:
            "Use tags for filtering and scanning, not for values that the runner needs at execution time.",
        },
        {
          name: "Notes",
          description:
            "Free-form operator context for maintenance reminders, assumptions, external ticket links, or review notes that should stay with the workflow draft.",
          whenToUse:
            "Use notes for human handoff details; move stable runtime values into Variables instead.",
        },
      ],
      workflowExamples: [
        {
          title: "QA login workflow",
          steps: ["Name it after the business flow", "Add tags such as qa, login, and smoke"],
        },
      ],
      commonMistakes: [
        {
          mistake: "Putting required email, password, or environment values only in notes.",
          fix: "Define stable values under Variables so graph templates can reference them consistently.",
        },
      ],
    },
    vi: {
      title: "Trợ giúp Cài đặt Chung",
      summary:
        "Cài đặt Chung mô tả workflow này là gì, người dùng nên nhận ra nó ra sao, và nó xuất hiện thế nào trong danh sách, tiêu đề, export, bản sao, hoặc workspace dùng chung sau này mà không làm thay đổi cách graph chạy.",
      uiLabels: viLabels,
      bestFor: [
        "Đặt tên rõ để người vận hành nhận ra workflow mà không cần mở graph.",
        "Thêm mô tả, tag, và ghi chú để tìm kiếm, bàn giao, và review dễ hơn.",
      ],
      notFor: [
        "Không dùng mục này để đổi cách mở browser, proxy, retry, lịch chạy, hoặc thứ tự chạy của graph.",
      ],
      precedence: [
        "Metadata ở General đi cùng workflow, còn quyết định runtime nằm ở Execution, Browser, Environment, Variables, Triggers, và các node trong graph.",
      ],
      fieldGuide: [
        {
          name: "Tên workflow",
          description:
            "Tên hiển thị bắt buộc, được dùng ở danh sách workflow, breadcrumb, header chi tiết, trạng thái save, export, duplicate, và các tham chiếu workspace sau này.",
          whenToUse:
            "Đặt theo luồng nghiệp vụ như Checkout smoke test thay vì ghi chú kỹ thuật, để người khác chọn đúng workflow nhanh hơn.",
        },
        {
          name: "Mô tả",
          description:
            "Phần giải thích ngắn về workflow kiểm tra điều gì, chạm tới hệ thống nào, và một lần chạy thành công có ý nghĩa gì. Đây là định hướng cho người đọc, không phải rule validate.",
          whenToUse:
            "Dùng khi tên workflow chưa đủ để nói rõ phạm vi, môi trường, hành trình người dùng, hoặc người chịu trách nhiệm.",
        },
        {
          name: "Tags",
          description:
            "Danh sách nhãn phân tách bằng dấu phẩy, được chuẩn hóa chữ thường và loại trùng, giúp gom workflow theo team, môi trường, tính năng, hoặc bộ smoke test.",
          whenToUse:
            "Dùng tag để lọc và scan danh sách; đừng dùng tag cho giá trị mà runner cần khi chạy.",
        },
        {
          name: "Ghi chú",
          description:
            "Vùng ghi tự do cho nhắc nhở bảo trì, giả định, link ticket bên ngoài, hoặc ghi chú review cần đi kèm bản nháp workflow.",
          whenToUse:
            "Dùng cho thông tin bàn giao giữa người với người; giá trị runtime ổn định nên đưa vào Variables.",
        },
      ],
      workflowExamples: [
        {
          title: "Workflow đăng nhập QA",
          steps: ["Đặt tên theo luồng nghiệp vụ", "Thêm tag như qa, login, và smoke"],
        },
      ],
      commonMistakes: [
        {
          mistake: "Chỉ ghi email, password, hoặc environment bắt buộc trong ghi chú.",
          fix: "Đưa giá trị ổn định vào Variables để graph template tham chiếu nhất quán.",
        },
      ],
    },
  },
  execution: {
    en: {
      title: "Execution Settings Help",
      summary:
        "Execution settings define the workflow-level run policy used when graph actions, batch requests, or terminal nodes do not provide a more specific timeout, retry, browser-retention, or failure behavior.",
      uiLabels: enLabels,
      bestFor: [
        "Setting baseline action limits for workflows where most steps have similar tolerance.",
        "Controlling batch defaults and what happens to the browser after a terminal outcome.",
      ],
      notFor: ["Per-selector waits, browser launch identity, scheduled dispatch, or app editor preferences."],
      precedence: [
        "Workflow settings apply before per-run overrides.",
        "Action-level timeout and retry fields override these defaults for that one action.",
      ],
      fieldGuide: [
        {
          name: "Default action timeout ms",
          description:
            "Maximum time a normal action should wait before it is considered failed when that action has no explicit timeout of its own.",
          whenToUse:
            "Use it to give the whole workflow a sane baseline for pages that are consistently fast, slow, or unstable.",
        },
        {
          name: "Default retry attempts",
          description:
            "Number of extra tries an action can receive by default after a recoverable failure, before the workflow applies the failure policy.",
          whenToUse:
            "Use it for transient staging flakiness, and keep it low when failures should reveal product regressions quickly.",
        },
        {
          name: "Default retry interval ms",
          description:
            "Delay between default retry attempts, measured in milliseconds, so repeated actions do not immediately hit the same temporary failure.",
          whenToUse:
            "Use it with retry attempts when backend queues, slow UI transitions, or short network hiccups need breathing room.",
        },
        {
          name: "Max workflow duration ms",
          description:
            "Upper bound for the whole run, covering all graph steps, retries, waits, and terminal handling, regardless of individual action limits.",
          whenToUse:
            "Use it as a guardrail so a workflow cannot run forever when a loop, slow page, or hidden failure keeps it alive.",
        },
        {
          name: "Browser retention",
          description:
            "Default decision for whether the browser session remains available after success, failure, or stop when terminal nodes do not choose otherwise.",
          whenToUse:
            "Choose retain for debugging or manual inspection, and close for unattended runs where cleanup matters more.",
        },
        {
          name: "Failure policy",
          description:
            "Workflow-level rule for what happens after an unrecovered action failure. The current policy stops on the first failure to keep diagnostics clear.",
          whenToUse:
            "Use it to understand why later branches did not run; broader continue policies should only be added when reporting can stay explicit.",
        },
        {
          name: "Wait between nodes",
          description:
            "Optional pause inserted between graph nodes when neither side is an explicit Wait or Random Wait node. Fixed mode uses one duration; random mode picks a duration inside the configured min/max range.",
          whenToUse:
            "Use it when most node transitions need the same pacing, and add explicit Wait or Random Wait nodes where one transition needs a different delay.",
        },
        {
          name: "Batch concurrency limit",
          description:
            "Maximum number of batch rows that may run at the same time when a workflow is executed over multiple input rows.",
          whenToUse:
            "Use it to protect test environments, third-party services, local CPU, and account limits from too many simultaneous browser sessions.",
        },
        {
          name: "Batch headless default",
          description:
            "Default browser visibility for batch rows. Headless runs without visible windows, while non-headless keeps browser windows available.",
          whenToUse:
            "Use headless for routine unattended batches, and visible mode when you need to observe or debug the row behavior.",
        },
        {
          name: "Stop batch on first failed row",
          description:
            "Batch control that stops launching or continuing further rows after one row fails, instead of collecting failures across the batch.",
          whenToUse:
            "Use it when one failure likely means shared setup is broken and continuing would waste time or create noisy side effects.",
        },
      ],
      workflowExamples: [
        {
          title: "Slow staging site",
          steps: ["Set a higher default action timeout", "Use action overrides for one known slow step"],
        },
      ],
      commonMistakes: [
        {
          mistake: "Using max workflow duration as a replacement for action timeouts.",
          fix: "Use max duration for the whole run, and action timeouts for individual waits and selectors.",
        },
      ],
    },
    vi: {
      title: "Trợ giúp Cài đặt Thực thi",
      summary:
        "Cài đặt Thực thi định nghĩa chính sách chạy cấp workflow, được dùng khi action trong graph, batch request, hoặc terminal node chưa đặt timeout, retry, giữ browser, hoặc cách xử lý lỗi cụ thể hơn.",
      uiLabels: viLabels,
      bestFor: [
        "Đặt giới hạn mặc định cho workflow có phần lớn step chịu timeout và retry giống nhau.",
        "Điều khiển mặc định của batch và việc browser còn mở hay đóng sau khi kết thúc.",
      ],
      notFor: ["Không dùng cho wait từng selector, danh tính browser khi launch, lịch trigger, hoặc preference của editor."],
      precedence: [
        "Workflow Settings áp dụng trước override của từng lần chạy.",
        "Timeout và retry đặt trực tiếp trong action sẽ ghi đè default này cho action đó.",
      ],
      fieldGuide: [
        {
          name: "Default action timeout ms",
          description:
            "Thời gian tối đa một action thông thường được chờ trước khi bị tính là failed, nếu action đó không có timeout riêng.",
          whenToUse:
            "Dùng để đặt nền chung cho workflow chạy trên trang luôn nhanh, luôn chậm, hoặc hay dao động.",
        },
        {
          name: "Default retry attempts",
          description:
            "Số lần thử lại mặc định sau một lỗi có thể phục hồi, trước khi workflow áp dụng failure policy.",
          whenToUse:
            "Dùng cho môi trường staging hay lỗi tạm thời; giữ thấp nếu bạn muốn lỗi sản phẩm lộ ra nhanh.",
        },
        {
          name: "Default retry interval ms",
          description:
            "Khoảng nghỉ giữa các lần retry mặc định, tính bằng mili giây, để action không đập lại ngay vào cùng một lỗi tạm thời.",
          whenToUse:
            "Dùng cùng retry attempts khi backend queue, chuyển trạng thái UI chậm, hoặc mạng chập chờn cần thêm thời gian.",
        },
        {
          name: "Max workflow duration ms",
          description:
            "Giới hạn tổng cho cả lần chạy, bao gồm mọi graph step, retry, wait, và xử lý terminal, bất kể từng action đặt timeout thế nào.",
          whenToUse:
            "Dùng như hàng rào an toàn để workflow không chạy mãi khi loop, trang chậm, hoặc lỗi ẩn giữ run còn sống.",
        },
        {
          name: "Browser retention",
          description:
            "Quyết định mặc định browser còn được giữ sau success, failure, hoặc stop hay không, khi terminal node chưa đặt lựa chọn riêng.",
          whenToUse:
            "Chọn retain khi cần debug hoặc xem lại màn hình; chọn close cho run tự động cần dọn session.",
        },
        {
          name: "Failure policy",
          description:
            "Luật cấp workflow cho việc xử lý một action fail sau khi đã hết retry. Hiện tại chính sách dừng ở lỗi đầu tiên để diagnostic rõ ràng.",
          whenToUse:
            "Dùng để hiểu vì sao các nhánh sau không chạy; chỉ thêm continue policy khi báo cáo lỗi vẫn đủ rõ.",
        },
        {
          name: "Wait between nodes",
          description:
            "Khoảng nghỉ tùy chọn được chèn giữa các node trong graph khi hai bên không phải node Wait hoặc Random Wait rõ ràng. Chế độ cố định dùng một thời lượng; chế độ random chọn thời lượng trong ngưỡng min/max.",
          whenToUse:
            "Dùng khi hầu hết chuyển tiếp giữa node cần cùng nhịp chờ, và thêm node Wait hoặc Random Wait riêng ở vị trí cần delay khác.",
        },
        {
          name: "Batch concurrency limit",
          description:
            "Số dòng batch tối đa được chạy đồng thời khi workflow chạy trên nhiều dòng input, trực tiếp ảnh hưởng tới số browser session mở cùng lúc.",
          whenToUse:
            "Dùng để bảo vệ môi trường test, dịch vụ bên thứ ba, CPU local, và giới hạn tài khoản khỏi quá nhiều browser cùng lúc.",
        },
        {
          name: "Batch headless default",
          description:
            "Mặc định browser có hiển thị cửa sổ hay chạy ẩn khi chạy batch. Headless không mở cửa sổ, non-headless cho phép quan sát.",
          whenToUse:
            "Dùng headless cho batch tự động thường lệ; dùng hiện cửa sổ khi cần quan sát hoặc debug hành vi từng dòng.",
        },
        {
          name: "Stop batch on first failed row",
          description:
            "Điều khiển batch dừng chạy các dòng tiếp theo sau khi một dòng fail, thay vì tiếp tục gom lỗi của cả batch.",
          whenToUse:
            "Dùng khi một lỗi thường nghĩa là setup chung đã hỏng và chạy tiếp chỉ tốn thời gian hoặc tạo side effect nhiễu.",
        },
      ],
      workflowExamples: [
        {
          title: "Site staging chậm",
          steps: ["Tăng default action timeout", "Đặt override riêng cho một step chậm đã biết"],
        },
      ],
      commonMistakes: [
        {
          mistake: "Dùng max workflow duration thay cho timeout của từng action.",
          fix: "Dùng max duration cho toàn run, và dùng action timeout cho từng wait hoặc selector cụ thể.",
        },
      ],
    },
  },
  browser: {
    en: {
      title: "Browser Settings Help",
      summary:
        "Browser settings are launch-level defaults for Chromium: profile identity, authorized proxy routing, coherent device profile, user agent, viewport, touch behavior, headless mode, and safe handling of human challenge checkpoints.",
      uiLabels: enLabels,
      bestFor: [
        "Making browser launch behavior repeatable across manual, batch, and triggered runs.",
        "Keeping profile, proxy, device, and checkpoint behavior in one audited place.",
      ],
      notFor: [
        "Bypassing challenges, evading site protections, or changing proxy and profile halfway through a run.",
      ],
      precedence: [
        "Browser settings are resolved before Chromium launches, so profile and proxy changes need a new run.",
        "Graph actions such as Set Viewport may override context later when that action explicitly runs.",
      ],
      fieldGuide: [
        {
          name: "Reuse login session",
          description:
            "Checkbox that decides whether the run opens a persistent named browser profile or a clean temporary profile. Turning it on generates a stable profile name when the field is empty.",
          whenToUse:
            "Use it for approved accounts that should stay signed in between runs; turn it off when every run should start from a fresh browser state.",
        },
        {
          name: "Profile name",
          description:
            "Named browser profile to launch with saved cookies, storage, and identity state where supported. The app can generate this value when Reuse login session is enabled.",
          whenToUse:
            "Keep one stable profile name per account and device profile, such as tiktok-main-desktop, so login state and device identity do not drift across runs.",
        },
        {
          name: "Proxy enabled",
          description:
            "Master switch for proxy routing. When off, proxy server, username, and password are ignored even if values remain saved.",
          whenToUse:
            "Use it to temporarily disable authorized proxy routing without deleting the server and credential fields.",
        },
        {
          name: "Proxy server",
          description:
            "Full proxy endpoint used at browser launch, such as http://proxy.local:8080. It should point to infrastructure you are allowed to use.",
          whenToUse:
            "Use it for corporate, QA, geo, or network-isolated test routes that must be consistent from the first request.",
        },
        {
          name: "Proxy username",
          description:
            "Optional account name sent to the configured proxy when that proxy requires authentication separate from the server URL.",
          whenToUse:
            "Use it when your proxy provider issues credentials separately; leave blank for unauthenticated proxies.",
        },
        {
          name: "Proxy password",
          description:
            "Optional secret for proxy authentication. Treat it as sensitive run configuration and avoid placing this value in notes or screenshots.",
          whenToUse:
            "Use it only for authorized proxy accounts, and rotate it according to the same policy as other shared test secrets.",
        },
        {
          name: "Device profile",
          description:
            "Preset that keeps user agent, viewport size, mobile emulation, and touch capability aligned as one launch identity instead of asking operators to paste a raw user-agent string.",
          whenToUse:
            "Use Default for normal desktop Chromium, Desktop Chrome for stable desktop testing, Android Chrome or iPhone Safari for mobile-layout runs, and Custom only when you know the exact client identity required.",
        },
        {
          name: "User agent",
          description:
            "Browser user-agent string presented to pages at launch. Presets fill this automatically; direct editing is reserved for Custom so the string does not drift away from viewport and touch settings.",
          whenToUse:
            "Use Custom only when the target app has a documented desktop, mobile, bot, or legacy-browser code path that must be tested explicitly.",
        },
        {
          name: "Viewport width and height",
          description:
            "Initial browser viewport size in pixels. Width and height together control responsive layouts before any graph viewport action runs.",
          whenToUse:
            "Use fixed dimensions when selectors, screenshots, or responsive UI branches must start from a predictable canvas size.",
        },
        {
          name: "Mobile viewport",
          description:
            "Flag that asks the browser context to emulate mobile viewport behavior in addition to the numeric width and height.",
          whenToUse:
            "Use it when validating mobile-specific layout or browser behavior, not just a narrow desktop window.",
        },
        {
          name: "Touch input",
          description:
            "Flag that enables touch-capable input behavior for pages that distinguish touch interaction from mouse interaction.",
          whenToUse:
            "Use it for mobile menus, drag handles, or components that only expose behavior when touch support exists.",
        },
        {
          name: "Challenge policy",
          description:
            "Controls safe handling of authorized human checkpoints: ignore, detect only, or pause for a human. It does not solve or bypass protections.",
          whenToUse:
            "Use detect only for reporting checkpoints and pause for human when an approved operator must continue the test manually.",
        },
        {
          name: "Headless default",
          description:
            "Default launch visibility for this workflow. Headless runs without a visible browser window; non-headless opens a visible browser.",
          whenToUse:
            "Use headless for routine automation and visible mode when debugging, reviewing, or handling manual checkpoints.",
        },
      ],
      workflowExamples: [
        {
          title: "Mobile viewport run",
          steps: ["Set viewport dimensions", "Enable mobile", "Enable touch when testing touch-only UI"],
        },
      ],
      relatedGraphActions: [
        {
          action: "Set Viewport",
          relationship: "runtime_override",
          explanation: "Changes viewport later in the workflow after the browser has launched.",
        },
      ],
      safetyNotes: [
        "Proxy and challenge controls are for authorized testing and repeatable environments.",
      ],
      commonMistakes: [
        {
          mistake: "Expecting proxy changes to apply after the run starts.",
          fix: "Save Browser settings and start a new run because launch-level values are resolved before Chromium opens.",
        },
        {
          mistake: "Randomizing user agents on a profile that stores a signed-in session.",
          fix: "Keep one stable device profile per browser profile, for example tiktok-main-desktop and tiktok-main-mobile as separate profiles.",
        },
      ],
    },
    vi: {
      title: "Trợ giúp Cài đặt Trình duyệt",
      summary:
        "Cài đặt Trình duyệt là default ở thời điểm mở Chromium: hồ sơ đăng nhập, proxy được phép dùng, device profile nhất quán, user agent, viewport, touch, headless, và cách xử lý an toàn các checkpoint cần con người.",
      uiLabels: viLabels,
      bestFor: [
        "Giữ hành vi mở browser lặp lại giống nhau cho manual, batch, và triggered runs.",
        "Gom profile, proxy, thiết bị, và checkpoint vào một nơi dễ kiểm tra.",
      ],
      notFor: [
        "Không dùng mục này để vượt qua CAPTCHA, né cơ chế bảo vệ website, hoặc đổi proxy/profile giữa chừng trong một run.",
      ],
      precedence: [
        "Browser settings được resolve trước khi Chromium mở, nên thay profile hoặc proxy cần bắt đầu run mới.",
        "Graph action như Set Viewport có thể ghi đè context sau đó, nếu action đó thực sự chạy.",
      ],
      fieldGuide: [
        {
          name: "Lưu lại phiên đăng nhập",
          description:
            "Checkbox quyết định run sẽ mở browser profile có tên để lưu state lâu dài hay dùng profile tạm sạch. Khi bật mà tên profile đang trống, app sẽ tự sinh một tên ổn định.",
          whenToUse:
            "Dùng cho tài khoản được phép cần giữ đăng nhập giữa các lần chạy; tắt khi mỗi run cần bắt đầu từ browser state sạch.",
        },
        {
          name: "Tên hồ sơ",
          description:
            "Tên profile browser dùng khi launch, có thể mang theo cookie, storage, và trạng thái đăng nhập đã lưu nếu backend hỗ trợ. App có thể tự sinh giá trị này khi bật Lưu lại phiên đăng nhập.",
          whenToUse:
            "Giữ một tên profile ổn định cho mỗi tài khoản và device profile, ví dụ tiktok-main-desktop, để state đăng nhập và danh tính thiết bị không đổi qua lại giữa các run.",
        },
        {
          name: "Bật proxy",
          description:
            "Công tắc tổng cho routing qua proxy. Khi tắt, máy chủ proxy, username, và password sẽ bị bỏ qua dù giá trị vẫn còn lưu.",
          whenToUse:
            "Dùng để tạm ngưng proxy được phép dùng mà không phải xóa server và credential đã nhập.",
        },
        {
          name: "Máy chủ proxy",
          description:
            "Endpoint proxy đầy đủ dùng ngay lúc browser mở, ví dụ http://proxy.local:8080. Giá trị này phải trỏ tới hạ tầng bạn có quyền sử dụng.",
          whenToUse:
            "Dùng cho mạng công ty, QA, geo test, hoặc tuyến mạng cô lập cần nhất quán từ request đầu tiên.",
        },
        {
          name: "Tên đăng nhập proxy",
          description:
            "Tên tài khoản tùy chọn gửi tới proxy khi proxy yêu cầu xác thực tách riêng khỏi URL máy chủ.",
          whenToUse:
            "Dùng khi nhà cung cấp proxy cấp credential riêng; để trống nếu proxy không cần xác thực.",
        },
        {
          name: "Mật khẩu proxy",
          description:
            "Secret tùy chọn cho xác thực proxy. Hãy coi đây là cấu hình nhạy cảm và tránh đưa giá trị này vào notes hoặc ảnh chụp màn hình.",
          whenToUse:
            "Chỉ dùng cho tài khoản proxy được phép, và xoay vòng secret theo chính sách giống các secret test dùng chung.",
        },
        {
          name: "Device profile",
          description:
            "Preset giữ user agent, kích thước viewport, mô phỏng mobile, và khả năng touch đi cùng nhau như một danh tính launch thống nhất thay vì bắt operator tự paste chuỗi user-agent thô.",
          whenToUse:
            "Dùng Default cho Chromium desktop bình thường, Desktop Chrome cho test desktop ổn định, Android Chrome hoặc iPhone Safari cho layout mobile, và Custom chỉ khi biết chính xác client identity cần dùng.",
        },
        {
          name: "User agent",
          description:
            "Chuỗi user-agent browser gửi cho trang ngay từ lúc launch. Preset sẽ tự điền field này; chỉ edit trực tiếp khi chọn Custom để chuỗi không lệch khỏi viewport và touch settings.",
          whenToUse:
            "Chỉ dùng Custom khi app đích có nhánh desktop, mobile, bot, hoặc browser cũ được tài liệu hóa và cần test rõ ràng.",
        },
        {
          name: "Chiều rộng và chiều cao viewport",
          description:
            "Kích thước viewport ban đầu theo pixel. Width và height cùng quyết định layout responsive trước khi graph chạy bất kỳ action đổi viewport nào.",
          whenToUse:
            "Dùng kích thước cố định khi selector, screenshot, hoặc nhánh responsive phải bắt đầu từ một canvas dự đoán được.",
        },
        {
          name: "Viewport mobile",
          description:
            "Cờ yêu cầu browser context mô phỏng hành vi viewport mobile, ngoài việc đặt width và height bằng số.",
          whenToUse:
            "Dùng khi kiểm tra layout hoặc hành vi mobile thật sự, không chỉ là cửa sổ desktop hẹp.",
        },
        {
          name: "Touch input",
          description:
            "Cờ bật hành vi input có touch cho những trang phân biệt tương tác chạm với tương tác chuột.",
          whenToUse:
            "Dùng cho menu mobile, drag handle, hoặc component chỉ mở hành vi khi browser báo có touch support.",
        },
        {
          name: "Chính sách thử thách",
          description:
            "Điều khiển cách xử lý checkpoint cần con người: bỏ qua, chỉ phát hiện, hoặc pause để người thật thao tác. Nó không giải hay bypass bảo vệ của website.",
          whenToUse:
            "Dùng detect only để ghi nhận checkpoint; dùng pause for human khi operator được phê duyệt cần tiếp tục test thủ công.",
        },
        {
          name: "Mặc định headless",
          description:
            "Mặc định browser có hiển thị cửa sổ hay chạy ẩn cho workflow này. Headless không mở cửa sổ; non-headless mở browser nhìn thấy được.",
          whenToUse:
            "Dùng headless cho automation thường lệ; dùng hiện cửa sổ khi debug, review, hoặc xử lý checkpoint thủ công.",
        },
      ],
      workflowExamples: [
        {
          title: "Run viewport mobile",
          steps: ["Đặt width và height", "Bật mobile", "Bật touch khi UI cần tương tác chạm"],
        },
      ],
      relatedGraphActions: [
        {
          action: "Set Viewport",
          relationship: "runtime_override",
          explanation: "Có thể đổi viewport sau khi browser đã mở, đúng tại vị trí node đó chạy trong graph.",
        },
      ],
      safetyNotes: [
        "Proxy và challenge control chỉ dành cho kiểm thử được phép và môi trường lặp lại được.",
      ],
      commonMistakes: [
        {
          mistake: "Nghĩ rằng đổi proxy sẽ áp dụng ngay khi run đang chạy.",
          fix: "Hãy save Browser settings và bắt đầu run mới, vì giá trị launch-level được resolve trước khi Chromium mở.",
        },
        {
          mistake: "Random user agent trên một profile đang lưu session đăng nhập.",
          fix: "Giữ một device profile ổn định cho mỗi browser profile, ví dụ tiktok-main-desktop và tiktok-main-mobile là hai profile riêng.",
        },
      ],
    },
  },
  environment: {
    en: {
      title: "Environment Settings Help",
      summary:
        "Environment settings apply browser-context defaults after launch and before the first graph step, shaping location, permissions, headers, downloads, cookies, and storage without changing browser launch identity.",
      uiLabels: enLabels,
      bestFor: ["Setting stable locale, timezone, geolocation, permissions, headers, and seeded browser state."],
      notFor: ["Proxy, profile, user-agent launch identity, or values that change many times during the graph."],
      precedence: [
        "Environment defaults apply before graph execution.",
        "Graph environment actions may override these values later by execution order.",
      ],
      fieldGuide: [
        {
          name: "Locale and timezone",
          description:
            "Locale controls language and regional formatting; timezone controls date and time behavior exposed to the page context.",
          whenToUse:
            "Use them when pages render prices, dates, language, or regional content differently across markets.",
        },
        {
          name: "Latitude and longitude",
          description:
            "Geolocation coordinates seeded before the graph starts, usually paired with a geolocation permission grant.",
          whenToUse:
            "Use them for maps, store locators, delivery coverage, or flows whose UI changes by physical location.",
        },
        {
          name: "Permissions",
          description:
            "Comma-separated browser permissions granted before the first graph step, such as geolocation or notifications where supported.",
          whenToUse:
            "Use stable permissions here when every run needs them; use graph actions only when permission timing is part of the test.",
        },
        {
          name: "Download directory",
          description:
            "Default local folder where downloaded files should be written for this workflow, when the runtime supports controlled downloads.",
          whenToUse:
            "Use it when the workflow validates generated reports, invoices, exports, or other downloaded artifacts.",
        },
        {
          name: "Extra HTTP headers",
          description:
            "Additional request headers injected before graph execution, written one header per line as Name: Value.",
          whenToUse:
            "Use them for test routing, feature flags, correlation ids, or approved environment selectors that must exist from the first request.",
        },
        {
          name: "Cookies and storage",
          description:
            "Seeded browser state for cookies, local storage, session storage, and restore references before the graph starts.",
          whenToUse:
            "Use it when a workflow needs known context but should not spend graph steps recreating the same state every run.",
        },
      ],
      workflowExamples: [
        {
          title: "Regional smoke run",
          steps: ["Set locale", "Set timezone", "Grant required permissions"],
        },
      ],
      commonMistakes: [
        {
          mistake: "Adding setup nodes for values that never change.",
          fix: "Move stable defaults into Environment settings and keep graph nodes for values that change by execution order.",
        },
      ],
    },
    vi: {
      title: "Trợ giúp Cài đặt Môi trường",
      summary:
        "Cài đặt Môi trường áp dụng default cho browser context sau khi launch và trước graph step đầu tiên, gồm vị trí, permission, header, download, cookie, và storage mà không đổi danh tính launch của browser.",
      uiLabels: viLabels,
      bestFor: ["Đặt locale, timezone, geolocation, permission, header, và state browser ổn định."],
      notFor: ["Không dùng cho proxy, profile, user-agent lúc launch, hoặc giá trị thay đổi nhiều lần trong graph."],
      precedence: [
        "Environment defaults áp dụng trước khi graph chạy.",
        "Graph action về environment có thể ghi đè các giá trị này sau đó theo đúng thứ tự execution.",
      ],
      fieldGuide: [
        {
          name: "Locale và timezone",
          description:
            "Locale điều khiển ngôn ngữ và định dạng vùng; timezone điều khiển hành vi ngày giờ mà page context nhìn thấy.",
          whenToUse:
            "Dùng khi trang hiển thị giá, ngày tháng, ngôn ngữ, hoặc nội dung vùng khác nhau theo thị trường.",
        },
        {
          name: "Latitude và longitude",
          description:
            "Tọa độ geolocation được seed trước khi graph bắt đầu, thường đi kèm permission geolocation.",
          whenToUse:
            "Dùng cho bản đồ, tìm cửa hàng, vùng giao hàng, hoặc flow có UI thay đổi theo vị trí thực.",
        },
        {
          name: "Permissions",
          description:
            "Danh sách permission browser phân tách bằng dấu phẩy, được cấp trước graph step đầu tiên, ví dụ geolocation hoặc notifications nếu runtime hỗ trợ.",
          whenToUse:
            "Dùng permission ổn định ở đây khi mọi run đều cần; chỉ dùng graph action nếu thời điểm xin quyền là một phần của test.",
        },
        {
          name: "Download directory",
          description:
            "Thư mục local mặc định để ghi file download cho workflow này, khi runtime hỗ trợ điều khiển download.",
          whenToUse:
            "Dùng khi workflow cần validate report, invoice, export, hoặc artifact tải xuống.",
        },
        {
          name: "Extra HTTP headers",
          description:
            "Header request bổ sung được inject trước khi graph chạy, nhập mỗi dòng theo dạng Name: Value.",
          whenToUse:
            "Dùng cho test routing, feature flag, correlation id, hoặc selector môi trường đã được phê duyệt cần có từ request đầu tiên.",
        },
        {
          name: "Cookies và storage",
          description:
            "State browser được seed cho cookies, local storage, session storage, và session restore reference trước khi graph bắt đầu.",
          whenToUse:
            "Dùng khi workflow cần context đã biết nhưng không nên tốn graph step để dựng lại cùng một state mỗi lần chạy.",
        },
      ],
      workflowExamples: [
        {
          title: "Smoke test theo vùng",
          steps: ["Đặt locale", "Đặt timezone", "Cấp permission cần thiết"],
        },
      ],
      commonMistakes: [
        {
          mistake: "Thêm setup node cho giá trị không bao giờ thay đổi.",
          fix: "Chuyển default ổn định vào Environment settings và giữ graph node cho giá trị thay đổi theo thứ tự chạy.",
        },
      ],
    },
  },
  inputs: {
    en: {
      title: "Variables Settings Help",
      summary:
        "Variables define initial typed values loaded before execution, so graph actions can reference stable workflow context without adding setup nodes at the start of every graph.",
      uiLabels: enLabels,
      bestFor: ["Seeding stable text, JSON, number, and boolean values before the first graph step."],
      notFor: ["Changing values after graph execution has already begun; use Set Variables nodes for that."],
      precedence: [
        "Saved Variables load before graph execution.",
        "Graph Set Variables writes override prior values by execution order.",
        "Rows and JSON mode edit the same saved initial variables.",
      ],
      fieldGuide: [
        {
          name: "Rows mode",
          description:
            "Table editor for adding one variable per row with an explicit name, type, and value, matching the Set Variables node editing model.",
          whenToUse:
            "Use it for normal editing when operators should add, remove, or scan individual variable values without writing JSON by hand.",
        },
        {
          name: "JSON mode",
          description:
            "Structured JSON textarea for editing the same variables as an object. Nested object keys become dot-path variables and arrays or objects are stored as JSON values.",
          whenToUse:
            "Use it when pasting a prepared variable object or when nested values are easier to review as JSON than as rows.",
        },
        {
          name: "Variable type",
          description:
            "Type controls how the runner parses the stored value before graph execution: text stays a string, JSON parses arrays or objects, number parses numeric values, and boolean parses true or false.",
          whenToUse:
            "Use JSON for arrays or objects, number for numeric comparisons, boolean for flags, and text for template strings or ordinary scalar values.",
        },
        {
          name: "Dot paths",
          description:
            "Nested JSON fields convert to dot-path variable names such as user.email, and dot-path rows convert back into nested JSON when switching modes.",
          whenToUse:
            "Use dot paths to keep related variables grouped while still letting action templates reference a precise value.",
        },
      ],
      workflowExamples: [
        {
          title: "Seed login constants",
          steps: ["Add base_url as text", "Add retry_count as number", "Add feature flags as JSON"],
        },
      ],
      commonMistakes: [
        {
          mistake: "Using Variables for values that should change halfway through a graph.",
          fix: "Use Variables for initial context and Set Variables nodes for runtime changes that depend on earlier steps.",
        },
      ],
    },
    vi: {
      title: "Trợ giúp Variables",
      summary:
        "Variables định nghĩa các giá trị typed được load trước khi chạy, để graph action tham chiếu context ổn định mà không cần thêm setup node ở đầu mỗi graph.",
      uiLabels: viLabels,
      bestFor: ["Seed giá trị text, JSON, number, và boolean ổn định trước graph step đầu tiên."],
      notFor: ["Không dùng để đổi giá trị sau khi graph đã bắt đầu; hãy dùng Set Variables node cho việc đó."],
      precedence: [
        "Variables đã lưu được load trước khi graph chạy.",
        "Graph Set Variables ghi đè giá trị trước đó theo đúng thứ tự execution.",
        "Rows mode và JSON mode cùng sửa một danh sách initial variables.",
      ],
      fieldGuide: [
        {
          name: "Rows mode",
          description:
            "Bảng nhập mỗi biến một dòng với name, type, và value rõ ràng, cùng model với editor của node Set Variables.",
          whenToUse:
            "Dùng cho chỉnh sửa thông thường khi operator cần thêm, xóa, hoặc scan từng biến mà không phải tự viết JSON.",
        },
        {
          name: "JSON mode",
          description:
            "Textarea JSON có cấu trúc để sửa cùng danh sách biến dưới dạng object. Object lồng nhau thành dot-path variables, còn array/object được lưu như JSON values.",
          whenToUse:
            "Dùng khi paste một object variables đã chuẩn bị sẵn hoặc khi nested values dễ review bằng JSON hơn bằng bảng.",
        },
        {
          name: "Loại biến",
          description:
            "Type quyết định runner parse value thế nào trước khi graph chạy: text giữ nguyên string, JSON parse array/object, number parse số, boolean parse true hoặc false.",
          whenToUse:
            "Dùng JSON cho array/object, number cho so sánh số, boolean cho flag, và text cho template string hoặc scalar thông thường.",
        },
        {
          name: "Dot paths",
          description:
            "Field JSON lồng nhau convert thành tên biến dot-path như user.email, và row dot-path convert ngược lại thành JSON lồng nhau khi đổi mode.",
          whenToUse:
            "Dùng dot path để nhóm biến liên quan nhưng vẫn cho action template tham chiếu đúng một giá trị cụ thể.",
        },
      ],
      workflowExamples: [
        {
          title: "Seed constant cho login",
          steps: ["Thêm base_url dạng text", "Thêm retry_count dạng number", "Thêm feature flags dạng JSON"],
        },
      ],
      commonMistakes: [
        {
          mistake: "Dùng Variables cho giá trị cần đổi giữa chừng trong graph.",
          fix: "Dùng Variables cho context ban đầu và dùng node Set Variables cho runtime changes phụ thuộc step trước đó.",
        },
      ],
    },
  },
  triggers: {
    en: {
      title: "Triggers Settings Help",
      summary:
        "Triggers store orchestration intent for manual-only, one-time, interval, and future scheduled runs, using the saved graph and saved Workflow Settings at dispatch time.",
      uiLabels: enLabels,
      bestFor: ["Saving schedule intent, missed-run behavior, trigger input source, and already-running behavior."],
      notFor: ["Running unsaved graph drafts, replacing manual runs, or changing graph validation rules."],
      precedence: ["Triggered runs use the saved graph and saved settings, not unsaved editor state."],
      fieldGuide: [
        {
          name: "Trigger enabled",
          description:
            "Master switch for automatic dispatch. When disabled, trigger details can remain saved but should not start runs.",
          whenToUse:
            "Use it to pause a schedule without deleting interval, input source, or concurrency policy choices.",
        },
        {
          name: "Mode",
          description:
            "Dispatch style for the trigger: manual keeps automation off, once stores a one-time time, and interval stores repeated cadence.",
          whenToUse:
            "Use manual for drafts, once for a planned single run, and interval for recurring health checks.",
        },
        {
          name: "Interval seconds",
          description:
            "Cadence for interval mode, measured in seconds, controlling how often the scheduler should attempt a run.",
          whenToUse:
            "Use it for recurring checks, and keep the interval longer than typical workflow duration unless concurrency policy is intentional.",
        },
        {
          name: "Once at",
          description:
            "Target timestamp for one-time mode, representing when the scheduler should attempt the saved workflow run.",
          whenToUse:
            "Use it for planned validation windows, release checks, or delayed tests where manual clicking is not desired.",
        },
        {
          name: "Input source and batch source",
          description:
            "Saved references describing where trigger-supplied input values or batch rows should come from when dispatch happens.",
          whenToUse:
            "Use them when the scheduled run should pull a known input set instead of relying only on defaults.",
        },
        {
          name: "Missed-run policy",
          description:
            "Rule for what the scheduler should do if a planned run time was missed while the app or scheduler was unavailable.",
          whenToUse:
            "Use skip when stale runs are not useful; use catch-up only when late execution still has business value.",
        },
        {
          name: "Concurrency policy",
          description:
            "Rule for what a trigger should do when the workflow is already running at the next dispatch time.",
          whenToUse:
            "Use skip if overlapping browser sessions would corrupt data, overload services, or confuse run results.",
        },
      ],
      workflowExamples: [
        {
          title: "Hourly availability check",
          steps: ["Enable triggers", "Choose interval", "Set interval seconds"],
        },
      ],
      commonMistakes: [
        {
          mistake: "Expecting triggers to run unsaved graph edits.",
          fix: "Save the graph and settings before relying on trigger dispatch.",
        },
      ],
    },
    vi: {
      title: "Trợ giúp Triggers",
      summary:
        "Triggers lưu ý định điều phối cho run manual-only, one-time, interval, và các kiểu schedule sau này, dùng graph đã save và Workflow Settings đã save tại thời điểm dispatch.",
      uiLabels: viLabels,
      bestFor: ["Lưu lịch chạy, cách xử lý missed run, nguồn input của trigger, và hành vi khi workflow đang chạy."],
      notFor: ["Không dùng để chạy draft graph chưa save, thay thế manual run, hoặc đổi rule validate graph."],
      precedence: ["Triggered run dùng graph và settings đã save, không dùng state editor chưa lưu."],
      fieldGuide: [
        {
          name: "Bật trigger",
          description:
            "Công tắc tổng cho dispatch tự động. Khi tắt, chi tiết trigger vẫn có thể được lưu nhưng không nên khởi chạy run.",
          whenToUse:
            "Dùng để tạm dừng schedule mà không xóa interval, nguồn input, hoặc concurrency policy đã chọn.",
        },
        {
          name: "Mode",
          description:
            "Kiểu dispatch của trigger: manual tắt tự động, once lưu một thời điểm chạy một lần, interval lưu chu kỳ lặp.",
          whenToUse:
            "Dùng manual cho draft, once cho một run đã lên kế hoạch, và interval cho health check định kỳ.",
        },
        {
          name: "Interval seconds",
          description:
            "Chu kỳ của interval mode, tính bằng giây, quyết định scheduler thử chạy workflow thường xuyên thế nào.",
          whenToUse:
            "Dùng cho check lặp lại; nên để interval dài hơn thời gian workflow thường chạy trừ khi concurrency policy đã được cân nhắc.",
        },
        {
          name: "Once at",
          description:
            "Timestamp mục tiêu cho once mode, biểu thị lúc scheduler nên thử chạy workflow đã save và dùng settings đã persist tại thời điểm đó.",
          whenToUse:
            "Dùng cho khung validation đã hẹn, release check, hoặc test trì hoãn khi không muốn bấm thủ công.",
        },
        {
          name: "Input source và batch source",
          description:
            "Tham chiếu đã lưu mô tả trigger lấy input value hoặc batch row từ đâu khi dispatch xảy ra, thay vì nhập tay trước mỗi run.",
          whenToUse:
            "Dùng khi scheduled run cần kéo một bộ input đã biết thay vì chỉ dựa vào default.",
        },
        {
          name: "Missed-run policy",
          description:
            "Luật cho scheduler khi bỏ lỡ một thời điểm chạy vì app hoặc scheduler không khả dụng, ví dụ bỏ qua hoặc xử lý bù tùy giá trị nghiệp vụ.",
          whenToUse:
            "Dùng skip khi run muộn không còn hữu ích; chỉ dùng catch-up khi chạy trễ vẫn có giá trị nghiệp vụ.",
        },
        {
          name: "Concurrency policy",
          description:
            "Luật cho trigger khi workflow vẫn đang chạy tại thời điểm dispatch tiếp theo, giúp tránh nhiều run chồng lấn cùng sửa một hệ thống.",
          whenToUse:
            "Dùng skip nếu nhiều browser session chồng nhau có thể làm hỏng dữ liệu, quá tải dịch vụ, hoặc gây nhiễu kết quả.",
        },
      ],
      workflowExamples: [
        {
          title: "Check availability mỗi giờ",
          steps: ["Bật triggers", "Chọn interval", "Đặt interval seconds"],
        },
      ],
      commonMistakes: [
        {
          mistake: "Nghĩ trigger sẽ chạy graph edit chưa save.",
          fix: "Hãy save graph và settings trước khi dựa vào trigger dispatch.",
        },
      ],
    },
  },
  advanced: {
    en: {
      title: "Advanced Settings Help",
      summary:
        "Advanced settings collect compatibility warnings, diagnostics, debug logging, experimental flags, and future migration helpers for rare troubleshooting rather than normal workflow configuration.",
      uiLabels: enLabels,
      bestFor: ["Reviewing compatibility warnings, enabling targeted diagnostics, and understanding migration hints."],
      notFor: ["Everyday browser, input, environment, schedule, or execution configuration."],
      precedence: ["Advanced warnings explain conflicts but do not replace the section that owns the actual setting."],
      fieldGuide: [
        {
          name: "Compatibility warnings",
          description:
            "Read-only warnings that highlight legacy setup nodes or saved data that overlap with modern Workflow Settings sections.",
          whenToUse:
            "Use them when a workflow behaves unexpectedly after import, migration, or loading an older graph.",
        },
        {
          name: "Debug logging level",
          description:
            "Diagnostic verbosity intended for troubleshooting runner, settings, and integration behavior while keeping secret values redacted.",
          whenToUse:
            "Use it briefly while investigating a concrete issue, then return it to off to reduce noise and sensitive context exposure.",
        },
        {
          name: "Experimental flags",
          description:
            "Feature gates for unfinished or compatibility-sensitive behavior that should not be required for normal workflow authoring.",
          whenToUse:
            "Use only when a migration note, developer instruction, or controlled test explicitly asks for a flag.",
        },
        {
          name: "Settings diagnostics",
          description:
            "Troubleshooting context such as JSON previews, migration hints, or exportable state that helps compare saved settings with UI expectations.",
          whenToUse:
            "Use it to verify what is persisted when the form, saved graph, and runtime behavior appear out of sync.",
        },
      ],
      workflowExamples: [
        {
          title: "Legacy setup cleanup",
          steps: ["Review warnings", "Move stable launch values into Browser settings"],
        },
      ],
      commonMistakes: [
        {
          mistake: "Treating Advanced as the default settings page.",
          fix: "Use the owning section for normal configuration and keep Advanced for diagnostics or compatibility review.",
        },
      ],
    },
    vi: {
      title: "Trợ giúp Cài đặt Nâng cao",
      summary:
        "Cài đặt Nâng cao gom compatibility warning, diagnostics, debug logging, experimental flags, và helper migration sau này cho các tình huống troubleshooting hiếm, không phải cấu hình thường ngày.",
      uiLabels: viLabels,
      bestFor: ["Review compatibility warning, bật diagnostic có mục tiêu, và hiểu gợi ý migration."],
      notFor: ["Không dùng cho cấu hình browser, input, environment, schedule, hoặc execution thường ngày."],
      precedence: ["Warning ở Advanced giải thích xung đột nhưng không thay thế section sở hữu setting thật."],
      fieldGuide: [
        {
          name: "Compatibility warnings",
          description:
            "Các cảnh báo chỉ đọc, chỉ ra setup node legacy hoặc dữ liệu đã lưu bị trùng trách nhiệm với Workflow Settings hiện đại.",
          whenToUse:
            "Dùng khi workflow hành xử lạ sau import, migration, hoặc khi mở một graph cũ.",
        },
        {
          name: "Debug logging level",
          description:
            "Mức độ chi tiết log để troubleshoot runner, settings, và integration, đồng thời vẫn phải redact secret value.",
          whenToUse:
            "Chỉ bật tạm thời khi điều tra một lỗi cụ thể, rồi trả về off để giảm nhiễu và giảm lộ ngữ cảnh nhạy cảm.",
        },
        {
          name: "Experimental flags",
          description:
            "Feature gate cho hành vi chưa hoàn thiện hoặc nhạy cảm về compatibility, không nên bắt buộc trong authoring workflow bình thường.",
          whenToUse:
            "Chỉ dùng khi migration note, developer instruction, hoặc controlled test yêu cầu rõ một flag.",
        },
        {
          name: "Settings diagnostics",
          description:
            "Ngữ cảnh troubleshooting như JSON preview, migration hint, hoặc state có thể export để so saved settings với kỳ vọng UI.",
          whenToUse:
            "Dùng để xác minh dữ liệu đã persist khi form, graph đã save, và hành vi runtime có vẻ không khớp nhau.",
        },
      ],
      workflowExamples: [
        {
          title: "Dọn setup legacy",
          steps: ["Review warnings", "Chuyển launch value ổn định vào Browser settings"],
        },
      ],
      commonMistakes: [
        {
          mistake: "Xem Advanced là trang settings mặc định.",
          fix: "Dùng đúng section sở hữu cấu hình thường ngày và giữ Advanced cho diagnostics hoặc compatibility review.",
        },
      ],
    },
  },
};
