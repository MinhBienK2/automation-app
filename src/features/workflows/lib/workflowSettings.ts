import type {
  GraphEdgeDelay,
  VariableAssignment,
  VariableValueType,
  WorkflowSettings,
  WorkflowSettingsBrowserLaunch,
  WorkflowSettingsSectionId,
} from "../../../types/workflow";
import { personaForSeed } from "../../../lib/personaCatalog";

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
    relationship: "default" | "runtime_override" | "related";
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
  { id: "graph_defaults", label: "Graph" },
  { id: "run_policy", label: "Run Policy" },
  { id: "browser_launch", label: "Browser Launch" },
  { id: "environment", label: "Environment" },
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
  return `local-${Date.now().toString(36)}`;
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
  const identityId = createDefaultBrowserIdentityId(workflowId);
  const persona = personaForSeed(identityId);
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
      execute_js_enabled: true,
      run_from_selected_enabled: false,
      run_from_selected_mode: "from_selected",
      batch_concurrency_limit: 1,
      batch_headless: false,
      batch_stop_on_first_failed_row: false,
    },
    browser_launch: {
      session_mode: "persistent_profile",
      identity_id: identityId,
      display_name: `${workflowName} identity`,
      persona_id: persona.id,
      persona,
      profile_dir: identityId,
      fingerprint_seed: stableFingerprintSeed(identityId),
      profile_name: identityId,
      fingerprint_fonts_dir: persona.font_bundle.path ?? null,
      timezone: null,
      locale: null,
      geoip: true,
      proxy_bypass: null,
      webrtc_policy: persona.webrtc_mode,
      webrtc_ip: null,
      proxy_enabled: false,
      proxy_server: null,
      proxy_username: null,
      proxy_password: null,
      headless: false,
      humanize: true,
      human_preset: persona.behavioral_timing_profile,
    },
    graph_defaults: {
      default_edge_delay: null,
    },
    environment: {
      initial_variables: [],
    },
    migration_notes: [],
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function createDefaultBrowserIdentityId(seed: string) {
  const safeSeed = seed
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `bi_${safeSeed || "default"}`;
}

function stableFingerprintSeed(seed: string) {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) % 90000;
  }
  return String(10000 + hash).padStart(5, "0");
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

export type WorkflowSettingsPresentationRow = {
  label: string;
  value: string;
};

export function validateDefaultEdgeDelay(delay: GraphEdgeDelay | null | undefined) {
  if (!delay) return null;
  if (delay.type === "fixed") {
    if (!Number.isFinite(delay.duration_ms) || delay.duration_ms < 0) {
      return "Fixed wait must be zero or greater.";
    }
    return null;
  }
  if (!Number.isFinite(delay.min_ms) || delay.min_ms < 0) {
    return "Minimum wait must be zero or greater.";
  }
  if (!Number.isFinite(delay.max_ms) || delay.max_ms < 0) {
    return "Maximum wait must be zero or greater.";
  }
  if (delay.max_ms < delay.min_ms) {
    return "Maximum wait must be greater than or equal to minimum wait.";
  }
  return null;
}

export function getWorkflowSettingsSectionWarnings(
  settings: WorkflowSettings,
  section: WorkflowSettingsSectionId,
) {
  const warnings: string[] = [];

  if (section === "general" && !settings.general.name.trim()) {
    warnings.push("Workflow name is required before settings can be saved.");
  }

  if (section === "graph_defaults") {
    const delayWarning = validateDefaultEdgeDelay(settings.graph_defaults.default_edge_delay);
    if (delayWarning) warnings.push(delayWarning);
  }

  if (section === "run_policy") {
    if (
      settings.run_policy.run_from_selected_enabled &&
      settings.browser_launch.session_mode !== "persistent_profile"
    ) {
      warnings.push("Run from selected requires Reuse login session.");
    }
    if (
      settings.run_policy.run_from_selected_enabled &&
      settings.run_policy.browser_retention !== "retain"
    ) {
      warnings.push("Run from selected requires Browser retention set to retain.");
    }
  }

  if (section === "browser_launch") {
    const locationIncomplete =
      !settings.browser_launch.geoip &&
      (!settings.browser_launch.timezone?.trim() || !settings.browser_launch.locale?.trim());
    if (locationIncomplete) {
      warnings.push(
        "GeoIP is off. Add explicit timezone and locale before running this workflow.",
      );
    }
    if (settings.browser_launch.proxy_enabled && locationIncomplete) {
      warnings.push(
        "Proxy is enabled while GeoIP is off. Keep timezone and locale aligned with the proxy exit.",
      );
    }
    if (settings.browser_launch.fingerprint_fonts_dir?.trim()) {
      warnings.push(
        "A configured fingerprint fonts directory can create a stable font hash across identities.",
      );
    }
  }

  if (
    section === "environment" &&
    settings.environment.initial_variables.some((row) => !row.name.trim())
  ) {
    warnings.push(
      "Initial variable rows need names before they can become runtime context.",
    );
  }

  return warnings;
}

export function describeBrowserIdentityPosture(
  browserLaunch: WorkflowSettingsBrowserLaunch,
): WorkflowSettingsPresentationRow[] {
  const persona = browserLaunch.persona;
  if (!persona) return [];

  return [
    { label: "Persona", value: `${persona.label} (${persona.id})` },
    {
      label: "OS/browser",
      value: `${persona.os_bucket} / ${persona.browser_channel_bucket}`,
    },
    { label: "Region rationale", value: persona.rationale },
    {
      label: "Font bundle",
      value: persona.font_bundle.label || "Not configured",
    },
  ];
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
      notFor: ["Runtime values, browser launch state, proxy routing, or run limits."],
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
      notFor: ["Không dùng cho giá trị runtime, trạng thái launch browser, proxy, hoặc giới hạn run."],
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
        "Run Policy settings define workflow-level limits and terminal browser retention. Batch controls are paused until Batch Run UI is ready.",
      uiLabels: enLabels,
      bestFor: [
        "Setting guardrails that apply to the whole workflow run rather than one graph node.",
        "Choosing default batch behavior when a batch request omits row-level execution options.",
      ],
      notFor: ["Per-action waits, selector recovery, browser identity, proxy details, or initial template variables."],
      precedence: [
        "Run Policy is read when a run starts; save settings before running to apply changes.",
        "Terminal graph nodes can still request browser closure at the point where they end execution.",
        "Batch controls are paused until Batch Run UI is ready; saved batch defaults remain visible but are not editable here.",
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
          name: "Allow Run JavaScript",
          description:
            "Policy switch that permits or rejects Run JavaScript actions before their script body reaches the browser page. Rejected steps fail with explicit run evidence.",
          whenToUse:
            "Leave it on for authorized flows that need direct page inspection; turn it off for lower-risk profiles that must avoid direct DOM scripting.",
        },
        {
          name: "Enable Run from selected",
          description:
            "Shows the Run from selected workflow action when the workflow uses a retained persistent browser session.",
          whenToUse:
            "Use it after a retained full run when operators need to rerun one selected main-path node or continue from that node without reopening Chromium.",
        },
        {
          name: "Run from selected scope",
          description:
            "Selects whether Run from selected executes only the selected node or the selected node plus the downstream main-path nodes.",
          whenToUse:
            "Choose selected-only for a focused retry of one node; choose downstream when the rest of the workflow depends on that node's fresh output.",
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
        "Run Policy định nghĩa giới hạn cấp workflow và chính sách giữ browser sau kết thúc. Các batch control đang tạm dừng cho tới khi Batch Run UI sẵn sàng.",
      uiLabels: viLabels,
      bestFor: [
        "Đặt guardrail áp dụng cho cả lần chạy workflow thay vì một node graph riêng lẻ.",
        "Chọn mặc định batch khi request batch không truyền option cụ thể cho từng lần chạy.",
      ],
      notFor: ["Không dùng cho wait từng action, selector recovery, danh tính browser, proxy, hoặc biến template ban đầu."],
      precedence: [
        "Run Policy được đọc khi run bắt đầu; hãy save settings trước khi chạy để áp dụng thay đổi.",
        "Terminal node trong graph vẫn có thể yêu cầu đóng browser tại điểm kết thúc của nó.",
        "Các batch control đang tạm dừng cho tới khi Batch Run UI sẵn sàng; các mặc định batch đã lưu vẫn hiển thị nhưng không chỉnh ở đây.",
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
          name: "Allow Run JavaScript",
          description:
            "Công tắc policy cho phép hoặc từ chối node Run JavaScript trước khi script được đưa vào trang browser. Step bị từ chối sẽ fail với evidence rõ ràng.",
          whenToUse:
            "Bật cho flow được ủy quyền cần kiểm tra trực tiếp trong page; tắt cho profile rủi ro thấp không được dùng direct DOM scripting.",
        },
        {
          name: "Enable Run from selected",
          description:
            "Hiển thị action Run from selected khi workflow dùng browser session persistent đang được giữ lại.",
          whenToUse:
            "Dùng sau một full run được retain khi operator cần chạy lại một node main-path được chọn hoặc chạy tiếp từ node đó mà không mở lại Chromium.",
        },
        {
          name: "Run from selected scope",
          description:
            "Chọn Run from selected chỉ chạy node được chọn, hoặc chạy node đó cùng các node main-path phía sau.",
          whenToUse:
            "Chọn selected-only để retry đúng một node; chọn downstream khi phần còn lại của workflow phụ thuộc output mới từ node đó.",
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
      title: "Browser Identity Settings Help",
      summary:
        "Browser Identity settings control the stable CloakBrowser identity resolved before Chromium opens: profile storage, fingerprint seed, managed fingerprint fonts, location, and network posture.",
      uiLabels: enLabels,
      bestFor: [
        "Making session and network posture repeatable from the first browser request.",
        "Keeping launch-level profile and proxy controls in one auditable settings section.",
      ],
      notFor: ["Changing browser identity halfway through a run, resizing pages after launch, or solving human challenge flows."],
      precedence: [
        "Browser Launch values are resolved before Chromium starts, so changes require saving settings and starting a new run.",
        "In-run graph actions can still change runtime browser context only after the browser has launched.",
      ],
      fieldGuide: [
        {
          name: "Reuse login session",
          description:
            "Switch that chooses whether the workflow uses the identity's persistent Chromium profile storage or a temporary clean context while keeping the same browser fingerprint seed.",
          whenToUse:
            "Use it for named approved test accounts that should keep login state; turn it off for fresh storage without rotating the device identity.",
        },
        {
          name: "Identity display name",
          description:
            "Operator-facing label for the browser identity. Renaming it changes only metadata and never moves profile storage or changes the fingerprint seed.",
          whenToUse:
            "Use readable names that describe the approved account, region, or workflow purpose without treating rename as a reset.",
        },
        {
          name: "Fingerprint seed",
          description:
            "Stable CloakBrowser fingerprint seed passed at launch so the same identity keeps coherent canvas, WebGL, audio, screen, hardware, and related device signals across runs.",
          whenToUse:
            "Keep it fixed for persistent login identities; reset the identity explicitly when the test needs a new device persona.",
        },
        {
          name: "Fingerprint fonts directory",
          description:
            "Optional readable directory of managed fonts passed to CloakBrowser at launch so owned test identities can use an explicit font inventory instead of host defaults.",
          whenToUse:
            "Use it only with an approved, versioned font bundle that belongs to the test environment.",
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
          name: "Proxy bypass",
          description:
            "Optional comma-separated domains that should connect directly instead of through the configured proxy, such as .internal.test, localhost, or 127.0.0.1.",
          whenToUse:
            "Use it when a workflow needs the proxy for external targets but must still reach approved local, staging, or internal hosts directly.",
        },
        {
          name: "Timezone",
          description:
            "Optional IANA timezone passed through CloakBrowser's launch-level fingerprint flag. When blank and GeoIP is off, launch uses the detected timezone of this machine.",
          whenToUse:
            "Set it explicitly when the proxy or account region is known and must be reproducible across machines.",
        },
        {
          name: "Locale",
          description:
            "Optional BCP 47 locale passed at launch. When blank and GeoIP is off, launch uses the detected locale of this machine.",
          whenToUse:
            "Set it with timezone and proxy region when production detection expects a specific regional browser profile.",
        },
        {
          name: "GeoIP location",
          description:
            "CloakBrowser GeoIP mode that derives timezone and locale from the current public or proxy exit IP when the mmdb-lib dependency is installed.",
          whenToUse:
            "Keep it enabled by default when explicit timezone and locale values are unknown.",
        },
        {
          name: "Humanize browser input",
          description:
            "Launch-level CloakBrowser humanization toggle and preset. The default preset uses normal human-like mouse, keyboard, and scroll timing; careful uses slower, more deliberate movement.",
          whenToUse:
            "Keep it enabled for production-like owned tests; choose careful when a workflow should move more slowly and cautiously through sensitive screens.",
        },
        {
          name: "Headless browser",
          description:
            "Switch that launches Chromium without a visible window when enabled, or headed with a visible browser window when disabled.",
          whenToUse:
            "Use headed mode for debugging, visual review, and production-like probes; use headless only when the selected identity policy allows it.",
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
      title: "Trợ giúp Browser Identity",
      summary:
        "Browser Identity điều khiển danh tính CloakBrowser ổn định trước khi Chromium mở: profile storage, fingerprint seed, bộ font fingerprint được quản lý, vị trí, và network posture.",
      uiLabels: viLabels,
      bestFor: [
        "Giữ session và network posture lặp lại được ngay từ request đầu tiên của browser.",
        "Gom profile và proxy ở cấp launch vào một section dễ audit.",
      ],
      notFor: ["Không dùng để đổi danh tính browser giữa run, resize trang sau launch, hoặc giải human challenge."],
      precedence: [
        "Browser Launch được resolve trước khi Chromium start, nên thay đổi cần save settings và bắt đầu run mới.",
        "Graph action trong run chỉ có thể đổi runtime browser context sau khi browser đã mở.",
      ],
      fieldGuide: [
        {
          name: "Reuse login session",
          description:
            "Switch chọn workflow dùng Chromium profile persistent của identity hay context tạm sạch, trong khi vẫn giữ cùng fingerprint seed của browser/device identity.",
          whenToUse:
            "Dùng cho test account được phê duyệt cần giữ login state; tắt khi muốn storage sạch mà không đổi device identity.",
        },
        {
          name: "Identity display name",
          description:
            "Nhãn operator nhìn thấy cho browser identity. Rename chỉ đổi metadata, không move profile storage và không đổi fingerprint seed.",
          whenToUse:
            "Dùng tên dễ đọc mô tả account, region, hoặc mục đích workflow mà không coi rename là reset identity.",
        },
        {
          name: "Fingerprint seed",
          description:
            "Seed CloakBrowser ổn định được truyền lúc launch để cùng identity giữ canvas, WebGL, audio, screen, hardware, và các device signal liên quan qua nhiều run.",
          whenToUse:
            "Giữ cố định cho identity có login persistent; reset identity rõ ràng khi test cần device persona mới.",
        },
        {
          name: "Fingerprint fonts directory",
          description:
            "Thư mục font managed tùy chọn, có thể đọc được, được truyền cho CloakBrowser lúc launch để identity test owned dùng inventory font rõ ràng thay vì default của host.",
          whenToUse:
            "Chỉ dùng với font bundle đã được phê duyệt, version rõ ràng, thuộc môi trường test.",
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
          name: "Proxy bypass",
          description:
            "Danh sách domain phân tách bằng dấu phẩy sẽ kết nối trực tiếp thay vì đi qua proxy đã cấu hình, ví dụ .internal.test, localhost, hoặc 127.0.0.1.",
          whenToUse:
            "Dùng khi workflow cần proxy cho target bên ngoài nhưng vẫn phải truy cập trực tiếp host local, staging, hoặc nội bộ được phép.",
        },
        {
          name: "Timezone",
          description:
            "Timezone IANA tùy chọn được truyền qua launch-level fingerprint flag của CloakBrowser. Khi để trống và GeoIP tắt, launch dùng timezone phát hiện từ máy hiện tại.",
          whenToUse:
            "Set rõ khi proxy hoặc account region đã biết và phải lặp lại được trên nhiều máy.",
        },
        {
          name: "Locale",
          description:
            "Locale BCP 47 tùy chọn được truyền lúc launch. Khi để trống và GeoIP tắt, launch dùng locale phát hiện từ máy hiện tại.",
          whenToUse:
            "Set cùng timezone và proxy region khi production detection kỳ vọng một regional browser profile cụ thể.",
        },
        {
          name: "GeoIP location",
          description:
            "Chế độ GeoIP của CloakBrowser để suy ra timezone và locale từ public IP hoặc proxy exit IP hiện tại khi dependency mmdb-lib đã được cài.",
          whenToUse:
            "Giữ bật mặc định khi chưa có timezone và locale rõ ràng.",
        },
        {
          name: "Humanize browser input",
          description:
            "Toggle và preset humanization cấp launch của CloakBrowser. Preset default dùng timing chuột, bàn phím, scroll giống người bình thường; careful chậm hơn và thận trọng hơn.",
          whenToUse:
            "Giữ bật cho test owned gần production; chọn careful khi workflow cần thao tác chậm và cẩn trọng hơn trên màn hình nhạy cảm.",
        },
        {
          name: "Headless browser",
          description:
            "Switch launch Chromium không hiện cửa sổ khi bật, hoặc headed với cửa sổ browser nhìn thấy được khi tắt.",
          whenToUse:
            "Dùng headed để debug, review trực quan, và production-like probes; chỉ dùng headless khi identity policy cho phép.",
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
  graph_defaults: {
    en: {
      title: "Graph Settings Help",
      summary:
        "Graph settings control authoring conveniences for new links in this workflow. They do not rewrite existing links and they do not replace explicit Wait or Random Wait nodes.",
      uiLabels: enLabels,
      bestFor: [
        "Use it when most transitions in one workflow should pause briefly before the next node starts.",
        "Use it to keep visual graphs compact when the pause is only transition timing, not a named workflow step.",
      ],
      notFor: [
        "Do not use it for waiting on page state, visible elements, text, URLs, downloads, or business checkpoints.",
      ],
      fieldGuide: [
        {
          name: "New link wait",
          description:
            "Chooses whether newly created graph links start with no wait, a fixed duration wait, or a randomized duration wait that compiles before the target node.",
          whenToUse:
            "Turn it on when the workflow needs a consistent human-paced pause between most connected nodes.",
        },
        {
          name: "Duration ms",
          description:
            "Stores a single millisecond duration on each new link, producing a simple duration wait before the linked target node executes.",
          whenToUse:
            "Use fixed duration when repeatability matters more than variation during local debugging and evidence capture.",
        },
        {
          name: "Minimum/maximum wait ms",
          description:
            "Stores a minimum and maximum millisecond range on each new link, producing a randomized wait before the linked target node executes.",
          whenToUse:
            "Use random duration when a workflow should avoid identical transition timing while staying inside operator-approved bounds.",
        },
      ],
      workflowExamples: [
        {
          title: "Human-paced form flow",
          steps: [
            "Set default link wait to a small random range",
            "Connect form actions normally",
            "Use explicit Wait nodes only for page or element readiness",
          ],
        },
      ],
      relatedGraphActions: [
        {
          action: "Wait",
          relationship: "related",
          explanation:
            "Use a Wait node when the pause has business meaning or waits for a specific browser/page condition.",
        },
        {
          action: "Random Wait",
          relationship: "related",
          explanation:
            "Use a Random Wait node when the randomized pause should appear as a named workflow step.",
        },
      ],
      commonMistakes: [
        {
          mistake: "Expecting this setting to update links that already exist.",
          fix: "Change existing links directly or reconnect them after choosing the new default.",
        },
      ],
    },
    vi: {
      title: "Trợ giúp Graph",
      summary:
        "Graph settings là tiện ích khi author workflow: link mới có thể tự mang wait mặc định. Setting này không sửa link cũ và không thay thế Wait node rõ nghĩa.",
      uiLabels: viLabels,
      bestFor: [
        "Dùng khi phần lớn transition trong workflow cần dừng nhẹ trước khi node kế tiếp chạy.",
        "Dùng để graph gọn hơn khi khoảng chờ chỉ là timing giữa hai node, không phải một bước nghiệp vụ.",
      ],
      notFor: [
        "Không dùng để chờ trạng thái page, element visible, text, URL, download, hoặc checkpoint cần đặt tên.",
      ],
      fieldGuide: [
        {
          name: "New link wait",
          description:
            "Chọn link mới sẽ không có wait, có fixed wait, hoặc random wait; wait này được compile trước node đích của link.",
          whenToUse:
            "Bật khi workflow cần nhịp chờ nhất quán giữa phần lớn các node vừa được nối.",
        },
        {
          name: "Duration ms",
          description:
            "Lưu một thời lượng millisecond trên mỗi link mới, tạo duration wait đơn giản trước khi node đích chạy.",
          whenToUse:
            "Dùng fixed duration khi cần kết quả dễ lặp lại lúc debug hoặc thu evidence.",
        },
        {
          name: "Minimum/maximum wait ms",
          description:
            "Lưu khoảng min và max millisecond trên mỗi link mới, tạo random wait trước khi node đích chạy.",
          whenToUse:
            "Dùng random duration khi workflow cần tránh timing giống hệt nhau nhưng vẫn trong giới hạn operator duyệt.",
        },
      ],
      workflowExamples: [
        {
          title: "Form flow có nhịp người dùng",
          steps: [
            "Đặt default link wait thành random range nhỏ",
            "Nối các action form như bình thường",
            "Chỉ dùng Wait node rõ ràng cho page hoặc element readiness",
          ],
        },
      ],
      relatedGraphActions: [
        {
          action: "Wait",
          relationship: "related",
          explanation:
            "Dùng Wait node khi khoảng chờ có ý nghĩa nghiệp vụ hoặc cần chờ một điều kiện browser/page cụ thể.",
        },
        {
          action: "Random Wait",
          relationship: "related",
          explanation:
            "Dùng Random Wait node khi random pause cần hiện thành một bước workflow có tên.",
        },
      ],
      commonMistakes: [
        {
          mistake: "Nghĩ setting này sẽ tự sửa các link đã tồn tại.",
          fix: "Sửa trực tiếp link cũ hoặc nối lại link sau khi chọn default mới.",
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
};
