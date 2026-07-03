import type { GraphNodeType } from "../../../types/workflow";
import type {
  ActionFieldOptionReference,
  HelpFieldCategory,
} from "./stepHelpTypes";
import { englishGraphNodeHelpContent } from "./graphNodeHelpContent.en";
import { vietnameseGraphNodeHelpContent } from "./graphNodeHelpContent.vi";

export type GraphNodeHelpLanguage = "vi" | "en";

export type GraphNodeHelpContent = {
  title: string;
  summary: string;
  useWhen: string[];
  notFor?: string[];
  portSemantics?: Array<{
    port: string;
    kind: "input" | "branch" | "continuation" | "terminal";
    required: boolean;
    description: string;
  }>;
  fields: Array<{
    name: string;
    description: string;
    details: string[];
  }>;
  fieldReference?: GraphNodeFieldReference[];
  minimalConfig?: Array<{
    name: string;
    description: string;
  }>;
  workflowExamples?: Array<{
    title: string;
    steps: string[];
    notes?: string[];
  }>;
  examples: string[];
  relatedNodes?: Array<{
    node: string;
    relationship: string;
  }>;
  commonMistakes: string[];
};

export type BilingualGraphNodeHelp = Record<GraphNodeHelpLanguage, GraphNodeHelpContent>;

export type GraphNodeFieldReference = {
  name: string;
  category: HelpFieldCategory;
  description: string;
  requiredWhen: string;
  valueGuidance?: string;
  example?: string;
  mistakes?: string[];
  details: string[];
  options?: ActionFieldOptionReference[];
};

const baseGraphNodeHelpContent: Record<GraphNodeType, BilingualGraphNodeHelp> = {} as any;

for (const key of Object.keys(englishGraphNodeHelpContent) as GraphNodeType[]) {
  baseGraphNodeHelpContent[key] = {
    vi: vietnameseGraphNodeHelpContent[key],
    en: englishGraphNodeHelpContent[key],
  };
}

export const graphNodeHelpContent: Record<GraphNodeType, BilingualGraphNodeHelp> =
  Object.fromEntries(
    Object.entries(baseGraphNodeHelpContent).map(([nodeType, value]) => [
      nodeType,
      {
        vi: enrichGraphNodeHelp(nodeType as GraphNodeType, "vi", value.vi),
        en: enrichGraphNodeHelp(nodeType as GraphNodeType, "en", value.en),
      },
    ]),
  ) as Record<GraphNodeType, BilingualGraphNodeHelp>;

function enrichGraphNodeHelp(
  nodeType: GraphNodeType,
  language: GraphNodeHelpLanguage,
  content: GraphNodeHelpContent,
): GraphNodeHelpContent {
  return {
    ...content,
    portSemantics: graphNodePortSemantics(nodeType, language),
    fieldReference: graphNodeFieldReference(nodeType, language, content),
    minimalConfig: content.fields.map((field) => ({
      name: field.name,
      description: field.description,
    })),
    workflowExamples: graphNodeWorkflowExamples(nodeType, language, content),
    relatedNodes: relatedGraphNodes(nodeType, language),
    notFor: graphNodeNotFor(nodeType, language),
  };
}

function graphNodeFieldReference(
  nodeType: GraphNodeType,
  language: GraphNodeHelpLanguage,
  content: GraphNodeHelpContent,
): GraphNodeFieldReference[] {
  return content.fields.map((field) => ({
    name: field.name,
    category: graphNodeFieldCategory(nodeType, field.name),
    description: field.description,
    requiredWhen: graphNodeFieldRequiredWhen(nodeType, language, field.name),
    valueGuidance: graphNodeFieldValueGuidance(nodeType, language, field),
    example: graphNodeFieldExample(nodeType, language, field.name),
    mistakes: graphNodeFieldMistakes(language, field.name),
    details: field.details,
    options: graphNodeFieldOptions(nodeType, language, field.name),
  }));
}

function graphNodeFieldCategory(nodeType: GraphNodeType, fieldName: string): HelpFieldCategory {
  if (fieldName === "Ports") return "optional";
  if (
    fieldName.includes("Timeout") ||
    fieldName.includes("Delay") ||
    fieldName === "Loop max attempts" ||
    fieldName === "Loop timeout ms"
  ) {
    return "advanced";
  }
  if (
    fieldName.includes("port") ||
    fieldName === "Items" ||
    fieldName === "Array variable" ||
    fieldName === "Reason" ||
    fieldName === "Allowed domains"
  ) {
    return "optional";
  }
  if (
    nodeType === "try_catch" ||
    nodeType === "fallback" ||
    nodeType === "break_loop" ||
    nodeType === "continue_loop"
  ) {
    return "optional";
  }
  return "required";
}

function graphNodeFieldRequiredWhen(
  nodeType: GraphNodeType,
  language: GraphNodeHelpLanguage,
  fieldName: string,
) {
  const vi = language === "vi";
  if (fieldName === "Ports") {
    return vi
      ? "Không có field nhập liệu; cấu hình node bằng cách nối port."
      : "No input fields; configure this node by connecting ports.";
  }
  if (fieldName.includes("Timeout") || fieldName.includes("Delay")) {
    return vi
      ? "Tùy chọn; dùng để giới hạn thời gian hoặc nhịp chạy."
      : "Optional; use to limit time or pace execution.";
  }
  if (fieldName.includes("port")) {
    return vi
      ? "Port này được cấu hình trên canvas, không phải bằng text field."
      : "This port is configured on the canvas, not through a text field.";
  }
  return vi
    ? `${fieldName} cần có khi ${nodeType} phụ thuộc trực tiếp vào giá trị này để validate hoặc chạy.`
    : `${fieldName} is needed when ${nodeType} depends on this value directly for validation or execution.`;
}

function graphNodeFieldValueGuidance(
  nodeType: GraphNodeType,
  language: GraphNodeHelpLanguage,
  field: GraphNodeHelpContent["fields"][number],
) {
  if (field.name === "Ports") return undefined;
  const vi = language === "vi";
  if (field.name === "Condition") {
    return vi
      ? "Chọn condition theo dữ liệu đã có trước node này hoặc trạng thái trang hiện tại."
      : "Choose a condition based on data created before this node or the current page state.";
  }
  if (field.name === "Match") {
    return vi
      ? "Equals cần khớp chính xác; Contains phù hợp với text dài hoặc có phần động."
      : "Equals requires an exact match; Contains fits longer text or values with dynamic parts.";
  }
  if (
    field.name.includes("Timeout") ||
    field.name.includes("Delay") ||
    field.name.includes("attempts")
  ) {
    return vi
      ? "Nhập số đủ nhỏ để fail nhanh khi cấu hình sai, nhưng đủ lớn cho trang thật."
      : "Use a value small enough to fail fast on wrong config, but large enough for the real page.";
  }
  return (
    field.details[0] ??
    (vi
      ? `Nhập giá trị rõ ràng cho ${field.name} để node ${nodeType} dễ đọc trên canvas.`
      : `Enter a clear ${field.name} value so ${nodeType} stays readable on the canvas.`)
  );
}

function graphNodeFieldExample(
  nodeType: GraphNodeType,
  language: GraphNodeHelpLanguage,
  fieldName: string,
) {
  const vi = language === "vi";
  if (fieldName === "Condition")
    return vi ? "Output contains status = ready" : "Output contains status = ready";
  if (fieldName === "Match") return "Contains";
  if (fieldName.includes("Timeout")) return "5000";
  if (fieldName.includes("Delay")) return "250";
  if (fieldName.includes("Times") || fieldName.includes("attempts")) return "3";
  if (fieldName.includes("Output")) return "login_state";
  if (fieldName.includes("Item")) return "item";
  if (fieldName === "Allowed domains") return "example.com";
  if (fieldName === "Ports") return undefined;
  return vi
    ? `${fieldName}: giá trị mẫu cho ${nodeType}`
    : `${fieldName}: example value for ${nodeType}`;
}

function graphNodeFieldMistakes(language: GraphNodeHelpLanguage, fieldName: string) {
  const vi = language === "vi";
  if (fieldName === "Condition") {
    return [
      vi
        ? "Dùng output chưa được tạo trước node này."
        : "Using an output that has not been created before this node.",
    ];
  }
  if (fieldName.includes("port")) {
    return [
      vi
        ? "Cấu hình field nhưng quên nối required port trước khi validate/run."
        : "Configuring fields but forgetting required ports before validate/run.",
    ];
  }
  return undefined;
}

function graphNodeFieldOptions(
  nodeType: GraphNodeType,
  language: GraphNodeHelpLanguage,
  fieldName: string,
) {
  const vi = language === "vi";
  if (fieldName === "Condition") {
    return [
      graphOption(
        vi ? "Kiểm tra biến (boolean)" : "Check variable (boolean)",
        "variable_is_true",
        vi
          ? "Biến truyền vào phải mang giá trị true (hoặc truthy)."
          : "The variable must be true (or truthy).",
        vi
          ? "Dùng để kiểm tra kết quả từ node Kiểm tra điều kiện."
          : "Use to check the output of a Check Conditions node.",
        vi ? "Đảm bảo tên biến chính xác." : "Ensure the variable name is exact.",
      ),
      graphOption(
        "Text visible",
        "text_visible",
        vi ? "Trang hiện tại phải hiển thị text." : "The current page must show the text.",
        vi ? "Dùng khi trạng thái nằm trên UI." : "Use when the state is visible in the UI.",
        vi ? "Tránh với text theo ngôn ngữ động." : "Avoid locale-dependent text.",
      ),
      graphOption(
        "URL contains",
        "url_contains",
        vi ? "URL hiện tại chứa đoạn mong đợi." : "Current URL contains the expected fragment.",
        vi ? "Dùng sau login hoặc điều hướng." : "Use after login or navigation.",
        vi ? "Tránh với SPA không đổi URL." : "Avoid SPAs that do not change URL.",
      ),
      graphOption(
        "Element visible",
        "element_visible",
        vi
          ? "Element XPath hoặc Find Element ref phải visible."
          : "Element XPath or Find Element ref must be visible.",
        vi
          ? "Dùng khi nhánh phụ thuộc một control đang hiện."
          : "Use when branching depends on a visible control.",
        vi ? "Tránh nếu chỉ cần DOM presence." : "Avoid when DOM presence is enough.",
      ),
    ];
  }
  if (nodeType === "assert_output" && fieldName === "Match") {
    return [
      graphOption(
        "Equals",
        "equals",
        vi
          ? "Output phải bằng đúng expected value."
          : "Output must equal the expected value exactly.",
        vi ? "Dùng cho trạng thái hoặc mã cố định." : "Use for fixed states or codes.",
        vi ? "Tránh với text dài có số động." : "Avoid long text with dynamic numbers.",
      ),
      graphOption(
        "Contains",
        "contains",
        vi
          ? "Output chỉ cần chứa expected value."
          : "Output only needs to contain the expected value.",
        vi ? "Dùng cho đoạn text trong nội dung dài." : "Use for a fragment inside longer content.",
        vi ? "Tránh nếu cần khẳng định chính xác." : "Avoid when exact assertion is required.",
      ),
    ];
  }
  return undefined;
}

function graphOption(
  label: string,
  value: string,
  description: string,
  useWhen: string,
  avoidWhen: string,
): ActionFieldOptionReference {
  return { label, value, description, useWhen, avoidWhen };
}

function graphNodeNotFor(nodeType: GraphNodeType, language: GraphNodeHelpLanguage) {
  const vi = language === "vi";
  switch (nodeType) {
    case "break_loop":
    case "continue_loop":
      return [
        vi
          ? "Không dùng ngoài loop body; validation sẽ chặn run nếu node không nằm trong loop."
          : "Not for use outside a loop body; validation blocks runs when it is outside a loop.",
      ];
    case "retry":
      return [
        vi
          ? "Không dùng để rẽ nhánh theo điều kiện nghiệp vụ; dùng If hoặc Switch."
          : "Not for business-condition branching; use If or Switch.",
      ];
    default:
      return undefined;
  }
}

function graphNodePortSemantics(
  nodeType: GraphNodeType,
  language: GraphNodeHelpLanguage,
): GraphNodeHelpContent["portSemantics"] {
  const vi = language === "vi";
  const input = vi ? "Nhận luồng chạy từ node trước." : "Receives flow from the previous node.";
  const optionalDone = vi
    ? "Continuation optional; nếu không nối, path kết thúc thành công."
    : "Optional continuation; when unconnected, the path ends successfully.";

  switch (nodeType) {
    case "if":
      return [
        port("in", "input", true, input),
        port(
          "true",
          "branch",
          false,
          vi ? "Chạy khi condition đúng; thiếu link sẽ no-op." : "Runs when the condition is true; missing link no-ops.",
        ),
        port(
          "false",
          "branch",
          false,
          vi ? "Chạy khi condition sai; thiếu link sẽ no-op." : "Runs when the condition is false; missing link no-ops.",
        ),
        port("done", "continuation", false, optionalDone),
      ];
    case "switch":
      return [
        port("in", "input", true, input),
        port(
          "case_N",
          "branch",
          false,
          vi ? "Chạy case khớp expression." : "Runs the case that matches the expression.",
        ),
        port(
          "default",
          "branch",
          false,
          vi ? "Chạy khi không case nào khớp." : "Runs when no case matches.",
        ),
        port("done", "continuation", false, optionalDone),
      ];
    case "router":
      return [
        port("in", "input", true, input),
        port(
          "case_<id>",
          "branch",
          false,
          vi
            ? "Chạy case đầu tiên có condition khớp."
            : "Runs the first case whose condition matches.",
        ),
        port(
          "default",
          "branch",
          false,
          vi ? "Chạy khi không case nào khớp." : "Runs when no case matches.",
        ),
        port("done", "continuation", false, optionalDone),
      ];
    case "merge":
      return [
        port(
          "in",
          "input",
          true,
          vi ? "Nhận nhiều nhánh đi vào điểm hội tụ." : "Receives multiple branches at the convergence point.",
        ),
        port("out", "continuation", false, optionalDone),
      ];
    case "repeat_times":
    case "repeat_for_each":
    case "while":
      return [
        port("in", "input", true, input),
        port(
          "loop",
          "branch",
          true,
          vi ? "Body chạy trong vòng lặp." : "Loop body that runs inside the loop.",
        ),
        port("done", "continuation", false, optionalDone),
      ];
    case "repeat_until":
      return [
        port("in", "input", true, input),
        port(
          "loop",
          "branch",
          true,
          vi ? "Body chạy cho tới khi condition đúng." : "Body runs until the condition becomes true.",
        ),
        port("done", "continuation", false, optionalDone),
        port(
          "timeout",
          "branch",
          false,
          vi ? "Nhánh optional khi loop hết giới hạn." : "Optional branch when the loop reaches its limit.",
        ),
      ];
    case "retry":
      return [
        port("in", "input", true, input),
        port(
          "try",
          "branch",
          true,
          vi ? "Nhánh công việc cần retry." : "Work branch that should be retried.",
        ),
        port("success", "continuation", false, vi ? "Chạy khi Try thành công." : "Runs when Try succeeds."),
        port(
          "failed",
          "branch",
          false,
          vi
            ? "Optional; nếu thiếu và hết retry, workflow fail."
            : "Optional; when missing and retries are exhausted, the workflow fails.",
        ),
      ];
    case "break_loop":
    case "continue_loop":
      return [port("in", "input", true, input)];
    case "try_catch":
      return [
        port("in", "input", true, input),
        port(
          "try",
          "branch",
          true,
          vi ? "Nhánh chính cần bắt lỗi." : "Main branch whose errors are handled.",
        ),
        port(
          "error",
          "branch",
          false,
          vi ? "Nhánh xử lý lỗi optional." : "Optional error handling branch.",
        ),
        port("done", "continuation", false, optionalDone),
      ];
    case "fallback":
      return [
        port("in", "input", true, input),
        port(
          "primary",
          "branch",
          true,
          vi ? "Nhánh chính cần thử trước." : "Primary branch to try first.",
        ),
        port(
          "fallback",
          "branch",
          false,
          vi ? "Nhánh dự phòng optional." : "Optional fallback branch.",
        ),
        port("done", "continuation", false, optionalDone),
      ];
    default:
      return contentPorts(nodeType, language);
  }
}

function contentPorts(
  nodeType: GraphNodeType,
  language: GraphNodeHelpLanguage,
): GraphNodeHelpContent["portSemantics"] {
  const vi = language === "vi";
  if (nodeType === "start") {
    return [
      port(
        "out",
        "continuation",
        true,
        vi ? "Điểm bắt đầu workflow." : "Starts workflow flow.",
      ),
    ];
  }
  if (nodeType === "end_success" || nodeType === "end_failure") {
    return [port("in", "terminal", true, vi ? "Nhận path kết thúc." : "Receives the ending path.")];
  }
  return undefined;
}

function port(
  portName: string,
  kind: "input" | "branch" | "continuation" | "terminal",
  required: boolean,
  description: string,
) {
  return { port: portName, kind, required, description };
}

function graphNodeWorkflowExamples(
  nodeType: GraphNodeType,
  language: GraphNodeHelpLanguage,
  content: GraphNodeHelpContent,
) {
  const vi = language === "vi";
  switch (nodeType) {
    case "continue_loop":
      return [
        {
          title: vi ? "Bỏ qua item không hợp lệ" : "Skip invalid item",
          steps: [
            "Repeat For Each item",
            "loop -> If item_invalid",
            "true -> Continue Loop",
            "false -> Process item",
            "done -> Finish",
          ],
        },
      ];
    case "retry":
      return [
        {
          title: vi ? "Retry thao tác dễ fail" : "Retry flaky work",
          steps: [
            "Retry",
            "try -> Click Submit -> Wait Dashboard",
            "success -> Extract Result",
            "failed -> End Failure",
          ],
        },
      ];
    case "break_loop":
      return [
        {
          title: vi ? "Thoát loop khi đã tìm thấy dữ liệu" : "Exit when data is found",
          steps: [
            "Repeat For Each row",
            "loop -> If found",
            "true -> Break Loop",
            "done -> Finish",
          ],
        },
      ];
    default: {
      const firstStep = content.examples[0] ?? `${content.title} -> Done`;
      const step = firstStep.includes("->") ? firstStep : `${content.title} -> Done`;
      return [
        {
          title: vi ? "Luồng graph mẫu" : "Example graph flow",
          steps: [step],
        },
      ];
    }
  }
}

function relatedGraphNodes(nodeType: GraphNodeType, language: GraphNodeHelpLanguage) {
  const vi = language === "vi";
  switch (nodeType) {
    case "if":
      return [
        {
          node: "Switch",
          relationship: vi ? "Dùng khi có nhiều case." : "Use when there are many cases.",
        },
      ];
    case "break_loop":
    case "continue_loop":
      return [
        {
          node: "Repeat For Each",
          relationship: vi ? "Thường dùng bên trong loop." : "Commonly used inside a loop.",
        },
      ];
    default:
      return undefined;
  }
}
