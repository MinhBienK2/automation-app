import type {
  VariableAssignment,
  VariableValueType,
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
  { id: "run_policy", label: "Run Policy" },
  { id: "browser_launch", label: "Browser Launch" },
  { id: "environment", label: "Environment" },
  { id: "owned_test_gates", label: "Owned Test Gates" },
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
    version: 2,
    general: {
      name: workflowName,
      description: "",
      tags: [],
      notes: "",
      created_at: createdAt,
      updated_at: updatedAt,
    },
    run_policy: {
      max_workflow_duration_ms: null,
      browser_retention: "retain",
      batch_concurrency_limit: 1,
      batch_headless: false,
      batch_stop_on_first_failed_row: false,
    },
    browser_launch: {
      session_mode: "temporary",
      profile_name: null,
      proxy_enabled: false,
      proxy_server: null,
      proxy_username: null,
      proxy_password: null,
      headless: false,
    },
    environment: {
      initial_variables: [],
    },
    owned_test_gates: {
      fingerprint_preflight_enabled: false,
      fingerprint_probe_url: null,
      fingerprint_profile_id: null,
      fingerprint_allowed_origins: [],
      fingerprint_proxy_label: null,
      fingerprint_proxy_region: null,
    },
    migration_notes: [],
    created_at: createdAt,
    updated_at: updatedAt,
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
        "General settings identify the workflow for operators, reviews, exports, duplicates, and handoffs without changing graph execution, browser launch, environment variables, or run policy.",
      uiLabels: enLabels,
      bestFor: [
        "Giving the workflow a name and description that make its owned target and purpose recognizable.",
        "Adding tags and notes that help operators review, group, and maintain the workflow.",
      ],
      notFor: ["Runtime values, browser launch state, proxy routing, run limits, or owned test gates."],
      precedence: [
        "General metadata is saved with the workflow, while run behavior comes from the graph and the other Workflow Settings sections.",
      ],
      fieldGuide: [
        {
          name: "Workflow name",
          description:
            "Required display name shown in the workflow list, detail header, Settings dialog, duplicate flow, and package metadata so users can identify the workflow without opening the graph.",
          whenToUse:
            "Use a concise business-flow name such as Checkout smoke test or Login owned-account audit.",
        },
        {
          name: "Description",
          description:
            "Human-readable summary of what the workflow validates, which owned system it touches, and what a successful run proves for reviewers or operators.",
          whenToUse:
            "Use it when the name alone does not capture scope, environment, expected journey, or ownership.",
        },
        {
          name: "Tags",
          description:
            "Comma-separated labels normalized to lowercase and deduplicated, useful for grouping workflows by team, environment, feature area, or review purpose.",
          whenToUse:
            "Use tags for scanning and grouping; keep values needed by the runner in Environment instead.",
        },
        {
          name: "Notes",
          description:
            "Free-form operator context for assumptions, maintenance reminders, external ticket references, or review notes that should stay with the workflow draft.",
          whenToUse:
            "Use notes for human handoff context, not for secrets or values that graph templates must read.",
        },
      ],
      workflowExamples: [
        {
          title: "Owned login audit",
          steps: ["Name the business flow", "Add environment and owner tags", "Record review assumptions in notes"],
        },
      ],
      commonMistakes: [
        {
          mistake: "Putting runtime values only in Notes.",
          fix: "Store values that actions must read under Environment initial variables or graph Set Variables nodes.",
        },
      ],
    },
    vi: {
      title: "Trợ giúp Cài đặt Chung",
      summary:
        "Cài đặt Chung định danh workflow cho người vận hành, review, export, nhân bản, và bàn giao mà không đổi cách graph chạy, mở browser, nạp biến, hay áp dụng run policy.",
      uiLabels: viLabels,
      bestFor: [
        "Đặt tên và mô tả giúp nhận ra mục tiêu thuộc sở hữu và mục đích kiểm thử của workflow.",
        "Thêm tag và ghi chú để người vận hành review, gom nhóm, và bảo trì dễ hơn.",
      ],
      notFor: ["Không dùng cho giá trị runtime, trạng thái launch browser, proxy, giới hạn run, hoặc owned test gates."],
      precedence: [
        "Metadata ở General được lưu cùng workflow; hành vi chạy đến từ graph và các section Workflow Settings khác.",
      ],
      fieldGuide: [
        {
          name: "Tên workflow",
          description:
            "Tên hiển thị bắt buộc trong danh sách workflow, header chi tiết, Settings dialog, duplicate flow, và package metadata để người dùng nhận diện workflow mà không cần mở graph.",
          whenToUse:
            "Đặt tên ngắn theo luồng nghiệp vụ như Checkout smoke test hoặc Login owned-account audit.",
        },
        {
          name: "Mô tả",
          description:
            "Tóm tắt cho người đọc biết workflow xác minh điều gì, chạm hệ thống thuộc sở hữu nào, và một lần chạy thành công chứng minh điều gì.",
          whenToUse:
            "Dùng khi tên workflow chưa đủ để nói rõ phạm vi, môi trường, hành trình kỳ vọng, hoặc chủ sở hữu.",
        },
        {
          name: "Tags",
          description:
            "Các nhãn phân tách bằng dấu phẩy, được chuẩn hóa chữ thường và bỏ trùng, giúp gom workflow theo team, môi trường, tính năng, hoặc mục đích review.",
          whenToUse:
            "Dùng tag để scan và gom nhóm; giá trị runner cần đọc nên đặt trong Environment.",
        },
        {
          name: "Ghi chú",
          description:
            "Ngữ cảnh tự do cho giả định, nhắc nhở bảo trì, link ticket, hoặc ghi chú review cần đi cùng bản nháp workflow.",
          whenToUse:
            "Dùng cho bàn giao giữa người với người, không dùng cho secret hoặc giá trị template trong graph.",
        },
      ],
      workflowExamples: [
        {
          title: "Audit đăng nhập owned",
          steps: ["Đặt tên theo business flow", "Thêm tag environment và owner", "Ghi giả định review trong notes"],
        },
      ],
      commonMistakes: [
        {
          mistake: "Chỉ để giá trị runtime trong Ghi chú.",
          fix: "Đưa giá trị action cần đọc vào Environment initial variables hoặc node Set Variables trong graph.",
        },
      ],
    },
  },
  run_policy: {
    en: {
      title: "Run Policy Settings Help",
      summary:
        "Run Policy settings define workflow-level limits and batch defaults: maximum run duration, browser retention after terminal outcomes, row concurrency, batch headless mode, and stop-on-first-failure behavior.",
      uiLabels: enLabels,
      bestFor: [
        "Setting guardrails that apply to the whole workflow run rather than one graph node.",
        "Choosing default batch behavior when a batch request omits row-level execution options.",
      ],
      notFor: ["Per-action waits, selector recovery, browser identity, proxy details, or initial template variables."],
      precedence: [
        "Run Policy is read when a run starts; save settings before running to apply changes.",
        "Terminal graph nodes can still request browser closure at the point where they end execution.",
      ],
      fieldGuide: [
        {
          name: "Max workflow duration ms",
          description:
            "Optional upper bound for the full run, covering graph actions, waits, loops, cancellation, terminal handling, and evidence capture before the run is failed as overlong.",
          whenToUse:
            "Use it to stop accidental infinite loops, stuck pages, or test-environment hangs from running indefinitely.",
        },
        {
          name: "Browser retention",
          description:
            "Default terminal policy deciding whether the Chromium session remains open for inspection or closes after success, failure, or stop when no terminal node overrides it.",
          whenToUse:
            "Choose retain for debugging and evidence review; choose close for unattended runs where cleanup matters more.",
        },
        {
          name: "Batch concurrency limit",
          description:
            "Maximum number of input rows the batch runner may execute at the same time. Current backend validation rejects values above one until row isolation is implemented.",
          whenToUse:
            "Keep it at one for current runs so browser profiles, outputs, and owned test accounts stay isolated.",
        },
        {
          name: "Batch runs are headless",
          description:
            "Default browser visibility for batch rows. Headless rows run without visible windows, while non-headless rows can be observed during debugging.",
          whenToUse:
            "Enable it for routine unattended batches; leave it off when investigating row behavior or collecting visual evidence.",
        },
        {
          name: "Stop batch on first failed row",
          description:
            "Batch policy that stops scheduling later rows after the first row fails instead of continuing through every row and collecting all failures.",
          whenToUse:
            "Use it when one row failure likely means shared setup is broken and further rows would create noisy side effects.",
        },
      ],
      workflowExamples: [
        {
          title: "Bound a smoke run",
          steps: ["Set a max duration", "Retain browser for inspection", "Stop batch after the first failed row"],
        },
      ],
      commonMistakes: [
        {
          mistake: "Expecting Run Policy to add pacing between graph nodes.",
          fix: "Use explicit Wait or Random Wait nodes where business flow needs a pause.",
        },
      ],
    },
    vi: {
      title: "Trợ giúp Run Policy",
      summary:
        "Run Policy định nghĩa giới hạn và mặc định batch cấp workflow: thời lượng tối đa, giữ hay đóng browser sau kết thúc, concurrency theo dòng, headless cho batch, và dừng batch khi dòng đầu tiên fail.",
      uiLabels: viLabels,
      bestFor: [
        "Đặt guardrail áp dụng cho cả lần chạy workflow thay vì một node graph riêng lẻ.",
        "Chọn mặc định batch khi request batch không truyền option cụ thể cho từng lần chạy.",
      ],
      notFor: ["Không dùng cho wait từng action, selector recovery, danh tính browser, proxy, hoặc biến template ban đầu."],
      precedence: [
        "Run Policy được đọc khi run bắt đầu; hãy save settings trước khi chạy để áp dụng thay đổi.",
        "Terminal node trong graph vẫn có thể yêu cầu đóng browser tại điểm kết thúc của nó.",
      ],
      fieldGuide: [
        {
          name: "Max workflow duration ms",
          description:
            "Giới hạn tùy chọn cho toàn bộ run, bao gồm graph actions, waits, loops, cancellation, terminal handling, và evidence capture trước khi run bị đánh dấu quá thời gian.",
          whenToUse:
            "Dùng để chặn vòng lặp vô hạn, trang bị kẹt, hoặc môi trường test treo khiến workflow chạy mãi.",
        },
        {
          name: "Browser retention",
          description:
            "Chính sách terminal mặc định quyết định Chromium còn mở để kiểm tra hay đóng sau success, failure, hoặc stop khi terminal node không ghi đè.",
          whenToUse:
            "Chọn retain khi cần debug và review evidence; chọn close cho run tự động cần dọn dẹp.",
        },
        {
          name: "Batch concurrency limit",
          description:
            "Số dòng input tối đa batch runner được chạy cùng lúc. Backend hiện reject giá trị lớn hơn một cho tới khi có cô lập từng dòng.",
          whenToUse:
            "Giữ ở một trong trạng thái hiện tại để browser profile, output, và test account thuộc sở hữu không bị lẫn nhau.",
        },
        {
          name: "Batch runs are headless",
          description:
            "Mặc định browser có hiện cửa sổ khi chạy batch hay không. Headless không mở cửa sổ; non-headless cho phép quan sát khi debug.",
          whenToUse:
            "Bật cho batch tự động thường lệ; tắt khi cần điều tra hành vi từng dòng hoặc thu evidence trực quan.",
        },
        {
          name: "Stop batch on first failed row",
          description:
            "Chính sách batch dừng lên lịch các dòng sau khi dòng đầu tiên fail, thay vì tiếp tục chạy toàn bộ và gom mọi lỗi.",
          whenToUse:
            "Dùng khi một dòng fail thường nghĩa là setup chung đã hỏng và chạy tiếp chỉ tạo side effect nhiễu.",
        },
      ],
      workflowExamples: [
        {
          title: "Giới hạn một smoke run",
          steps: ["Đặt max duration", "Giữ browser để kiểm tra", "Dừng batch sau dòng fail đầu tiên"],
        },
      ],
      commonMistakes: [
        {
          mistake: "Nghĩ Run Policy tự thêm delay giữa các node graph.",
          fix: "Dùng node Wait hoặc Random Wait rõ ràng tại vị trí business flow cần pause.",
        },
      ],
    },
  },
  browser_launch: {
    en: {
      title: "Browser Launch Settings Help",
      summary:
        "Browser Launch settings control values that must be known before Chromium opens: temporary versus persistent profile, authorized proxy route, proxy credentials, and headed or headless launch mode.",
      uiLabels: enLabels,
      bestFor: [
        "Making session and network posture repeatable from the first browser request.",
        "Keeping launch-level profile and proxy controls in one auditable settings section.",
      ],
      notFor: ["Changing browser identity halfway through a run, editing page viewport later, or solving human challenge flows."],
      precedence: [
        "Browser Launch values are resolved before Chromium starts, so changes require saving settings and starting a new run.",
        "In-run graph actions can still change runtime browser context only after the browser has launched.",
      ],
      fieldGuide: [
        {
          name: "Reuse login session",
          description:
            "Switch that chooses a persistent named browser profile instead of a temporary clean profile. Turning it on generates a profile name when none is saved.",
          whenToUse:
            "Use it for named approved test accounts that should keep login state between runs.",
        },
        {
          name: "Profile name",
          description:
            "Persistent browser profile identifier used to store Chromium user data under the app data directory when Reuse login session is enabled.",
          whenToUse:
            "Use one stable profile name per authorized account or test identity to avoid mixing session state.",
        },
        {
          name: "Use proxy",
          description:
            "Switch that enables or disables the saved proxy route. When off, saved server and credential values remain stored but are ignored at launch.",
          whenToUse:
            "Use it to temporarily disable an authorized proxy without deleting the configured endpoint.",
        },
        {
          name: "Proxy server",
          description:
            "Full proxy endpoint used when Chromium launches, such as http://proxy.local:8080, pointing to infrastructure the operator is allowed to use.",
          whenToUse:
            "Use it when tests must start from a specific corporate, staging, regional, or isolated network route.",
        },
        {
          name: "Proxy username",
          description:
            "Optional username sent to the configured proxy when that proxy requires authentication separate from the proxy server URL.",
          whenToUse:
            "Use it only for authorized proxy accounts that issue separate credentials; leave it blank otherwise.",
        },
        {
          name: "Proxy password",
          description:
            "Optional secret paired with Proxy username for proxy authentication. It is saved as sensitive workflow configuration and omitted from sanitized package exports.",
          whenToUse:
            "Use it only when the authorized proxy requires a password and avoid placing the value in notes or screenshots.",
        },
        {
          name: "Headless browser",
          description:
            "Switch that launches Chromium without a visible window when enabled, or headed with a visible browser window when disabled.",
          whenToUse:
            "Use headed mode for debugging, review, and fingerprint preflight gates; use headless only for routine runs that do not need visual inspection.",
        },
      ],
      workflowExamples: [
        {
          title: "Persistent owned account run",
          steps: ["Enable Reuse login session", "Choose a stable profile name", "Keep headed mode for review"],
        },
      ],
      safetyNotes: [
        "Proxy and profile settings must stay scoped to owned or explicitly authorized test environments.",
      ],
      commonMistakes: [
        {
          mistake: "Changing proxy settings while a browser is already running.",
          fix: "Save Browser Launch settings and start a new run because launch-level values are applied before Chromium opens.",
        },
      ],
    },
    vi: {
      title: "Trợ giúp Browser Launch",
      summary:
        "Browser Launch điều khiển các giá trị phải biết trước khi Chromium mở: dùng profile tạm hay persistent, tuyến proxy được phép, credential proxy, và chế độ headed/headless.",
      uiLabels: viLabels,
      bestFor: [
        "Giữ session và network posture lặp lại được ngay từ request đầu tiên của browser.",
        "Gom profile và proxy ở cấp launch vào một section dễ audit.",
      ],
      notFor: ["Không dùng để đổi danh tính browser giữa run, chỉnh viewport sau launch, hoặc giải human challenge."],
      precedence: [
        "Browser Launch được resolve trước khi Chromium start, nên thay đổi cần save settings và bắt đầu run mới.",
        "Graph action trong run chỉ có thể đổi runtime browser context sau khi browser đã mở.",
      ],
      fieldGuide: [
        {
          name: "Reuse login session",
          description:
            "Switch chọn browser profile persistent có tên thay cho profile tạm sạch. Khi bật mà chưa có tên profile, app sẽ tự sinh tên.",
          whenToUse:
            "Dùng cho test account được phê duyệt cần giữ login state giữa các lần chạy.",
        },
        {
          name: "Profile name",
          description:
            "Định danh browser profile persistent dùng để lưu Chromium user data dưới app data directory khi Reuse login session được bật.",
          whenToUse:
            "Dùng một tên profile ổn định cho mỗi account hoặc test identity được phép để tránh trộn session state.",
        },
        {
          name: "Use proxy",
          description:
            "Switch bật hoặc tắt tuyến proxy đã lưu. Khi tắt, server và credential vẫn được lưu nhưng bị bỏ qua lúc launch.",
          whenToUse:
            "Dùng để tạm tắt proxy được phép mà không xóa endpoint đã cấu hình.",
        },
        {
          name: "Proxy server",
          description:
            "Endpoint proxy đầy đủ dùng khi Chromium launch, ví dụ http://proxy.local:8080, trỏ tới hạ tầng operator có quyền sử dụng.",
          whenToUse:
            "Dùng khi test phải bắt đầu từ mạng công ty, staging, regional, hoặc tuyến mạng cô lập cụ thể.",
        },
        {
          name: "Proxy username",
          description:
            "Username tùy chọn gửi tới proxy khi proxy yêu cầu xác thực tách riêng khỏi URL proxy server.",
          whenToUse:
            "Chỉ dùng cho proxy account được phép có credential riêng; nếu không thì để trống.",
        },
        {
          name: "Proxy password",
          description:
            "Secret tùy chọn đi cùng Proxy username để xác thực proxy. Đây là cấu hình workflow nhạy cảm và bị bỏ khỏi package export đã sanitize.",
          whenToUse:
            "Chỉ dùng khi proxy được phép yêu cầu password và tránh đưa giá trị này vào notes hoặc screenshot.",
        },
        {
          name: "Headless browser",
          description:
            "Switch launch Chromium không hiện cửa sổ khi bật, hoặc headed với cửa sổ browser nhìn thấy được khi tắt.",
          whenToUse:
            "Dùng headed khi debug, review, hoặc chạy fingerprint preflight gate; chỉ dùng headless cho run thường lệ không cần quan sát.",
        },
      ],
      workflowExamples: [
        {
          title: "Run bằng owned account persistent",
          steps: ["Bật Reuse login session", "Chọn profile name ổn định", "Giữ headed mode để review"],
        },
      ],
      safetyNotes: [
        "Profile và proxy phải giới hạn trong môi trường test thuộc sở hữu hoặc được ủy quyền rõ ràng.",
      ],
      commonMistakes: [
        {
          mistake: "Đổi proxy khi browser đang chạy.",
          fix: "Save Browser Launch settings và bắt đầu run mới vì launch-level values được áp dụng trước khi Chromium mở.",
        },
      ],
    },
  },
  environment: {
    en: {
      title: "Environment Settings Help",
      summary:
        "Environment settings seed initial typed variables before graph execution, giving templates, conditions, loops, and later actions stable values without adding setup nodes to every workflow.",
      uiLabels: enLabels,
      bestFor: [
        "Providing stable text, JSON, number, and boolean values before the first graph action runs.",
        "Keeping reusable workflow context close to settings while allowing graph nodes to mutate values later.",
      ],
      notFor: ["Browser launch identity, proxy routing, cookies, storage rows, or values that should change midway through the graph."],
      precedence: [
        "Environment initial variables are applied before graph actions.",
        "Graph Set Variables and Set JSON Variables nodes overwrite earlier values by execution order.",
      ],
      fieldGuide: [
        {
          name: "Variable name",
          description:
            "Dot-path variable key such as user.email or base_url that templates and graph conditions can reference after settings setup runs.",
          whenToUse:
            "Use stable names that match how graph fields will reference values inside {{variable}} templates.",
        },
        {
          name: "Variable type",
          description:
            "Type selector controlling how the runner parses the saved value: text remains a string, JSON parses arrays or objects, number parses finite values, and boolean parses true or false.",
          whenToUse:
            "Use JSON for arrays and objects, number for numeric comparisons, boolean for flags, and text for ordinary strings.",
        },
        {
          name: "Variable value",
          description:
            "Saved initial value loaded into the run output store before the graph begins, then available to templates, conditions, and loop inputs.",
          whenToUse:
            "Use it for stable environment context such as base URLs, approved test account labels, feature flags, or fixture ids.",
        },
      ],
      workflowExamples: [
        {
          title: "Seed reusable context",
          steps: ["Add base_url as text", "Add flags as JSON", "Reference {{base_url}} in Navigate"],
        },
      ],
      commonMistakes: [
        {
          mistake: "Using Environment for a value that should change after an extraction step.",
          fix: "Use a graph Set Variables node after the extraction so execution order is explicit.",
        },
      ],
    },
    vi: {
      title: "Trợ giúp Environment",
      summary:
        "Environment seed các biến typed ban đầu trước khi graph chạy, để template, condition, loop, và action sau có giá trị ổn định mà không cần thêm setup node vào mọi workflow.",
      uiLabels: viLabels,
      bestFor: [
        "Cung cấp giá trị text, JSON, number, và boolean ổn định trước action graph đầu tiên.",
        "Giữ context dùng lại của workflow trong settings nhưng vẫn cho graph node ghi đè về sau.",
      ],
      notFor: ["Không dùng cho danh tính browser launch, proxy, cookie, storage row, hoặc giá trị cần đổi giữa graph."],
      precedence: [
        "Environment initial variables được áp dụng trước graph actions.",
        "Node Set Variables và Set JSON Variables trong graph ghi đè giá trị trước đó theo thứ tự chạy.",
      ],
      fieldGuide: [
        {
          name: "Tên biến",
          description:
            "Key biến dạng dot-path như user.email hoặc base_url để template và condition trong graph tham chiếu sau khi settings setup chạy.",
          whenToUse:
            "Dùng tên ổn định khớp với cách field trong graph sẽ gọi qua template {{variable}}.",
        },
        {
          name: "Loại biến",
          description:
            "Selector type quyết định runner parse giá trị đã lưu ra sao: text giữ string, JSON parse array/object, number parse số hữu hạn, boolean parse true hoặc false.",
          whenToUse:
            "Dùng JSON cho array/object, number cho so sánh số, boolean cho flag, và text cho chuỗi thông thường.",
        },
        {
          name: "Giá trị biến",
          description:
            "Giá trị initial được nạp vào output store của run trước khi graph bắt đầu, rồi template, condition, và loop input có thể dùng.",
          whenToUse:
            "Dùng cho context môi trường ổn định như base URL, nhãn test account được phép, feature flag, hoặc fixture id.",
        },
      ],
      workflowExamples: [
        {
          title: "Seed context dùng lại",
          steps: ["Thêm base_url dạng text", "Thêm flags dạng JSON", "Tham chiếu {{base_url}} trong Navigate"],
        },
      ],
      commonMistakes: [
        {
          mistake: "Dùng Environment cho giá trị cần đổi sau một bước extraction.",
          fix: "Dùng node Set Variables trong graph sau extraction để thứ tự execution rõ ràng.",
        },
      ],
    },
  },
  owned_test_gates: {
    en: {
      title: "Owned Test Gates Help",
      summary:
        "Owned Test Gates define pre-run controls for authorized environments, currently the fingerprint preflight probe that must pass before graph actions execute when enabled.",
      uiLabels: enLabels,
      bestFor: [
        "Blocking a workflow before actions run when the owned probe says the browser identity is not acceptable for the test.",
        "Recording compact verdict evidence that security and trust teams can review with run outputs.",
      ],
      notFor: ["Bypassing CAPTCHA, solving challenges, expanding target scope, or running against unapproved origins."],
      precedence: [
        "Fingerprint preflight runs after browser launch and Environment variables, but before user graph actions.",
        "When enabled, the probe URL, identity profile, allowed origins, and headed browser mode must validate before run start.",
      ],
      fieldGuide: [
        {
          name: "Fingerprint preflight",
          description:
            "Switch that enables an owned JSON probe before graph actions. A malformed, blocked, or failed verdict stops execution before user actions run.",
          whenToUse:
            "Use it when a workflow must prove the test browser identity is inside an approved posture before touching the target flow.",
        },
        {
          name: "Probe URL",
          description:
            "HTTP or HTTPS endpoint under an allowed origin that returns the preflight verdict JSON consumed by the runner before graph actions start.",
          whenToUse:
            "Use an owned staging or production diagnostics endpoint that is explicitly approved for this workflow.",
        },
        {
          name: "Identity profile",
          description:
            "Operator-supplied profile identifier expected by the probe verdict, used to tie evidence to a named browser identity configuration.",
          whenToUse:
            "Use a stable id that reviewers can map back to the approved test profile and account state.",
        },
        {
          name: "Allowed origins",
          description:
            "Newline-separated origins that constrain which probe URLs are acceptable when fingerprint preflight is enabled.",
          whenToUse:
            "List only owned or explicitly authorized origins that should be valid for this workflow's probe.",
        },
        {
          name: "Proxy label",
          description:
            "Optional human-readable proxy metadata stored with the preflight configuration so evidence can describe the intended network route without exposing secrets.",
          whenToUse:
            "Use it when review needs to distinguish corporate, staging, regional, or isolated proxy routes.",
        },
        {
          name: "Proxy region",
          description:
            "Optional region or locality metadata for the proxy route, stored for evidence context and operator review rather than browser launch behavior.",
          whenToUse:
            "Use it when preflight evidence should show which approved region the workflow expected.",
        },
      ],
      workflowExamples: [
        {
          title: "Gate a production-owned test",
          steps: ["Enable preflight", "Use an allowlisted probe URL", "Run headed so the gate can inspect browser identity"],
        },
      ],
      safetyNotes: [
        "Owned Test Gates are audit controls for approved systems, not challenge bypass or third-party account controls.",
      ],
      commonMistakes: [
        {
          mistake: "Enabling preflight while Browser Launch is headless.",
          fix: "Use headed browser mode because current validation requires headed mode for fingerprint preflight.",
        },
      ],
    },
    vi: {
      title: "Trợ giúp Owned Test Gates",
      summary:
        "Owned Test Gates định nghĩa control trước run cho môi trường được ủy quyền, hiện là fingerprint preflight probe phải pass trước khi graph actions chạy nếu được bật.",
      uiLabels: viLabels,
      bestFor: [
        "Chặn workflow trước khi action chạy khi owned probe báo browser identity không đạt posture kiểm thử.",
        "Ghi compact verdict evidence để đội security và trust review cùng run outputs.",
      ],
      notFor: ["Không dùng để bypass CAPTCHA, giải challenge, mở rộng scope target, hoặc chạy origin chưa được duyệt."],
      precedence: [
        "Fingerprint preflight chạy sau browser launch và Environment variables, nhưng trước user graph actions.",
        "Khi bật, probe URL, identity profile, allowed origins, và headed browser mode phải validate trước khi run start.",
      ],
      fieldGuide: [
        {
          name: "Fingerprint preflight",
          description:
            "Switch bật owned JSON probe trước graph actions. Verdict lỗi, malformed, hoặc không pass sẽ dừng execution trước khi user actions chạy.",
          whenToUse:
            "Dùng khi workflow phải chứng minh test browser identity ở posture được duyệt trước khi chạm target flow.",
        },
        {
          name: "Probe URL",
          description:
            "Endpoint HTTP hoặc HTTPS thuộc allowed origin, trả JSON verdict để runner đọc trước khi graph actions bắt đầu.",
          whenToUse:
            "Dùng endpoint diagnostics thuộc staging hoặc production owned đã được duyệt rõ cho workflow này.",
        },
        {
          name: "Identity profile",
          description:
            "Định danh profile do operator nhập và probe verdict kỳ vọng, giúp evidence gắn với cấu hình browser identity cụ thể.",
          whenToUse:
            "Dùng id ổn định để reviewer map về test profile và account state đã được phê duyệt.",
        },
        {
          name: "Allowed origins",
          description:
            "Danh sách origin mỗi dòng một giá trị, giới hạn probe URL nào được chấp nhận khi fingerprint preflight bật.",
          whenToUse:
            "Chỉ liệt kê origin thuộc sở hữu hoặc được ủy quyền rõ ràng hợp lệ cho probe của workflow này.",
        },
        {
          name: "Proxy label",
          description:
            "Metadata proxy dạng người đọc được lưu cùng preflight config để evidence mô tả network route dự kiến mà không lộ secret.",
          whenToUse:
            "Dùng khi review cần phân biệt tuyến proxy corporate, staging, regional, hoặc isolated.",
        },
        {
          name: "Proxy region",
          description:
            "Metadata region hoặc locality tùy chọn cho tuyến proxy, dùng cho evidence context và operator review thay vì điều khiển browser launch.",
          whenToUse:
            "Dùng khi preflight evidence nên thể hiện region được phê duyệt mà workflow kỳ vọng.",
        },
      ],
      workflowExamples: [
        {
          title: "Gate kiểm thử production owned",
          steps: ["Bật preflight", "Dùng probe URL allowlisted", "Chạy headed để gate kiểm tra browser identity"],
        },
      ],
      safetyNotes: [
        "Owned Test Gates là audit control cho hệ thống đã duyệt, không phải challenge bypass hay third-party account control.",
      ],
      commonMistakes: [
        {
          mistake: "Bật preflight trong khi Browser Launch đang headless.",
          fix: "Dùng headed browser mode vì validation hiện yêu cầu headed mode cho fingerprint preflight.",
        },
      ],
    },
  },
};
