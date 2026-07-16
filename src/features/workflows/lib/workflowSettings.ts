import type {
  WorkflowSettings,
  WorkflowSettingsSectionId,
} from "../../../types/workflow";
import { defaultWorkflowSettings } from "./workflowSettingsDefaults";

export {
  createDefaultBrowserProfileName,
  defaultWorkflowSettings,
  tagsFromInput,
  tagsToInput,
} from "./workflowSettingsDefaults";
export {
  variableRowsFromJsonText,
  variablesJsonFromRows,
} from "./workflowSettingsVariables";

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
  { id: "desktop_launch", label: "Desktop Launch" },
  { id: "environment", label: "Environment" },
];

export function withWorkflowSettingsDefaults(
  settings: WorkflowSettings,
  workflow: {
    workflowId: string;
    workflowName: string;
    createdAt?: string | null;
    updatedAt?: string | null;
  },
) {
  const defaults = defaultWorkflowSettings(workflow);
  return {
    ...defaults,
    ...settings,
    general: { ...defaults.general, ...settings.general },
    run_policy: { ...defaults.run_policy, ...settings.run_policy },
    browser_launch: { ...defaults.browser_launch, ...settings.browser_launch },
    graph_defaults: { ...defaults.graph_defaults, ...settings.graph_defaults },
    environment: { ...defaults.environment, ...settings.environment },
  };
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
  desktop_launch: {
    en: {
      title: "Desktop Launch Help",
      summary: "Desktop Launch configures desktop app automation executable paths and command-line arguments.",
      uiLabels: enLabels,
      bestFor: ["Specifying which application to run when starting desktop automation."],
      notFor: ["Web browser automation configurations."],
      precedence: ["Desktop settings apply to desktop automation workflows only."],
      fieldGuide: [
        {
          name: "App executable path",
          description: "The absolute path to the desktop application's executable binary file on your local system, which is required for the runner to start the desktop session.",
          whenToUse: "Provide the absolute path to the desktop app you want to automate. For example: /usr/bin/gnome-calculator or C:\\Program Files\\...",
        },
      ],
      safetyNotes: [],
      commonMistakes: [
        {
          mistake: "Using relative paths instead of absolute paths.",
          fix: "Provide the absolute path to the executable file, e.g. /usr/bin/calculator instead of calculator.",
        }
      ],
      workflowExamples: [],
    },
    vi: {
      title: "Cấu hình Desktop Launch",
      summary: "Cấu hình Desktop Launch dùng để thiết lập đường dẫn ứng dụng desktop và đối số dòng lệnh.",
      uiLabels: viLabels,
      bestFor: ["Cấu hình ứng dụng khởi chạy khi chạy desktop automation."],
      notFor: ["Cấu hình web browser automation."],
      precedence: ["Cài đặt desktop chỉ áp dụng cho các luồng desktop automation."],
      fieldGuide: [
        {
          name: "Đường dẫn ứng dụng",
          description: "Đường dẫn tuyệt đối đến tệp thực thi (executable binary) của ứng dụng trên máy tính của bạn, cần thiết để hệ thống có thể khởi chạy ứng dụng chính xác.",
          whenToUse: "Nhập đường dẫn tuyệt đối đến ứng dụng bạn muốn tự động hóa. Ví dụ: /usr/bin/gnome-calculator hoặc C:\\Program Files\\...",
        },
      ],
      safetyNotes: [],
      commonMistakes: [
        {
          mistake: "Sử dụng đường dẫn tương đối thay vì đường dẫn tuyệt đối.",
          fix: "Cung cấp đường dẫn tuyệt đối đến tệp thực thi, ví dụ /usr/bin/calculator thay vì calculator.",
        }
      ],
      workflowExamples: [],
    },
  },
  browser_launch: {
    en: {
      title: "Browser Profile Help",
      summary:
        "Browser Launch selects the project browser profile used before Chromium opens. The profile owns storage, fingerprint identity, managed fonts, location, network posture, humanization, and headed/headless defaults.",
      uiLabels: enLabels,
      bestFor: [
        "Choosing which approved browser profile a workflow should use for a run.",
        "Keeping account state and fingerprint posture reusable across workflows in the same project.",
      ],
      notFor: ["Changing browser identity halfway through a run, resizing pages after launch, or solving human challenge flows."],
      precedence: [
        "The selected profile is resolved before Chromium starts, so selection changes require saving settings and starting a new run.",
        "Create a new browser profile in Project Settings when a workflow needs a new identity/profile/fingerprint bundle.",
        "In-run graph actions can still change runtime browser context only after the browser has launched.",
      ],
      fieldGuide: [
        {
          name: "Browser profile",
          description:
            "Project-managed browser profile selected for this workflow. The profile carries persistent storage, fingerprint seed, persona, proxy/location posture, humanization, and launch defaults.",
          whenToUse:
            "Use separate profiles for separate approved accounts, regions, network posture, or identity experiments.",
        },
      ],
      workflowExamples: [
        {
          title: "Run with an approved profile",
          steps: ["Create or rename the profile in Project Settings", "Select it in Browser Launch", "Save settings before starting a new run"],
        },
      ],
      safetyNotes: [
        "Profiles must stay scoped to owned or explicitly authorized test environments.",
      ],
      commonMistakes: [
        {
          mistake: "Expecting a new identity after renaming a profile.",
          fix: "Create a new browser profile and select it for the workflow when a new identity/profile/fingerprint bundle is needed.",
        },
      ],
    },
    vi: {
      title: "Trợ giúp Browser Profile",
      summary:
        "Browser Launch chọn browser profile của project trước khi Chromium mở. Profile sở hữu storage, fingerprint identity, font, vị trí, network posture, humanization, và headed/headless defaults.",
      uiLabels: viLabels,
      bestFor: [
        "Chọn browser profile được phê duyệt cho workflow khi chạy.",
        "Giữ account state và fingerprint posture dùng lại được giữa các workflow trong cùng project.",
      ],
      notFor: ["Không dùng để đổi danh tính browser giữa run, resize trang sau launch, hoặc giải human challenge."],
      precedence: [
        "Profile được chọn sẽ resolve trước khi Chromium start, nên thay đổi cần save settings và bắt đầu run mới.",
        "Tạo browser profile mới trong Project Settings khi workflow cần identity/profile/fingerprint bundle mới.",
        "Graph action trong run chỉ có thể đổi runtime browser context sau khi browser đã mở.",
      ],
      fieldGuide: [
        {
          name: "Browser profile",
          description:
            "Browser profile do project quản lý được chọn cho workflow này. Profile chứa persistent storage, fingerprint seed, persona, proxy/location posture, humanization, và launch defaults.",
          whenToUse:
            "Dùng profile riêng cho account, region, network posture, hoặc identity experiment được phê duyệt.",
        },
      ],
      workflowExamples: [
        {
          title: "Run với profile được phê duyệt",
          steps: ["Tạo hoặc rename profile trong Project Settings", "Chọn profile trong Browser Launch", "Save settings trước khi bắt đầu run mới"],
        },
      ],
      safetyNotes: [
        "Profile phải giới hạn trong môi trường test thuộc sở hữu hoặc được ủy quyền rõ ràng.",
      ],
      commonMistakes: [
        {
          mistake: "Mong có identity mới sau khi rename profile.",
          fix: "Tạo browser profile mới và chọn nó cho workflow khi cần identity/profile/fingerprint bundle mới.",
        },
      ],
    },
  },
  graph_defaults: {
    en: {
      title: "Graph Settings Help",
      summary:
        "Graph settings control workflow detail run visibility and authoring conveniences for new links in this workflow. They do not rewrite existing links and they do not replace explicit Wait or Random Wait nodes.",
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
          name: "Live Run",
          description:
            "Controls whether workflow detail shows the Live Run navigator above the graph while a saved run is active, including current step, trail, and focus controls.",
          whenToUse:
            "Keep it enabled when operators need run progress directly inside Graph Builder during evidence capture.",
        },
        {
          name: "Follow current",
          description:
            "Sets the default state of the navigator follow toggle when Live Run is enabled, selecting and centering the current node as run state changes.",
          whenToUse:
            "Enable it when the graph view should automatically track execution instead of waiting for a manual focus action.",
        },
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
        "Graph settings điều khiển Live Run trong workflow detail và tiện ích khi author workflow: link mới có thể tự mang wait mặc định. Setting này không sửa link cũ và không thay thế Wait node rõ nghĩa.",
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
          name: "Live Run",
          description:
            "Điều khiển workflow detail có hiển thị Live Run navigator phía trên graph khi saved run đang chạy, gồm current step, execution trail, và focus control.",
          whenToUse:
            "Giữ bật khi operator cần xem tiến độ run ngay trong Graph Builder lúc debug hoặc thu evidence.",
        },
        {
          name: "Follow current",
          description:
            "Đặt trạng thái mặc định của follow toggle trong navigator khi Live Run bật, để chọn và đưa current node vào khung nhìn khi run state đổi.",
          whenToUse:
            "Bật khi graph view nên tự bám theo node đang chạy thay vì chờ operator bấm focus thủ công.",
        },
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
