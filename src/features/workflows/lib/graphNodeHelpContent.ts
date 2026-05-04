import type { GraphNodeType } from "../../../types/workflow";

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

type BilingualGraphNodeHelp = Record<GraphNodeHelpLanguage, GraphNodeHelpContent>;

const noConfigFields = {
  vi: [
    {
      name: "Ports",
      description: "Node này chủ yếu được cấu hình bằng cách nối các port trên canvas.",
      details: [
        "Input port nhận luồng chạy từ node trước.",
        "Output port quyết định workflow đi tiếp theo nhánh nào.",
        "Port bắt buộc thiếu link sẽ chặn validate/run; port optional thiếu link sẽ no-op hoặc kết thúc nhánh thành công.",
      ],
    },
  ],
  en: [
    {
      name: "Ports",
      description: "This node is mainly configured by connecting named ports on the canvas.",
      details: [
        "Input ports receive execution from previous nodes.",
        "Output ports decide where the workflow continues.",
        "Missing required ports block validate/run; missing optional ports no-op or end the path successfully.",
      ],
    },
  ],
};

const conditionField = {
  vi: field("Condition", "Điều kiện dùng để quyết định nhánh hoặc vòng lặp.", [
    "Output equals/contains kiểm tra output đã tạo trước đó.",
    "Text visible, URL contains, Element visible kiểm tra trạng thái trang hiện tại.",
    "Nếu condition dựa trên output, hãy chắc chắn output đó được tạo trước node logic này.",
  ]),
  en: field("Condition", "Condition used to choose a branch or loop state.", [
    "Output equals/contains checks an output created earlier.",
    "Text visible, URL contains, and Element visible inspect the current page.",
    "When using output-based conditions, make sure the output is created before this node.",
  ]),
};

const baseGraphNodeHelpContent: Record<GraphNodeType, BilingualGraphNodeHelp> = {
  start: simpleNodeHelp("Start", "Bắt đầu workflow graph.", "Start the workflow graph."),
  end_success: simpleNodeHelp("Success End", "Kết thúc workflow thành công.", "End the workflow successfully."),
  end_failure: {
    vi: {
      title: "End Failure Help",
      summary: "Kết thúc workflow với trạng thái thất bại và lý do rõ ràng.",
      useWhen: ["Dùng ở nhánh lỗi có chủ đích.", "Dùng khi graph phát hiện điều kiện không thể tiếp tục."],
      fields: [
        {
          name: "Failure reason",
          description: "Thông báo lỗi sẽ hiện khi workflow kết thúc tại node này.",
          details: ["Viết ngắn gọn nhưng đủ để người dùng biết nhánh nào đã fail.", "Reason này đi vào trạng thái run failed."],
        },
      ],
      examples: ["Failure reason: Login failed after retry"],
      commonMistakes: ["Không nối nhánh lỗi tới node này nên workflow không bao giờ tới failure end."],
    },
    en: {
      title: "End Failure Help",
      summary: "End the workflow with a failure status and a clear reason.",
      useWhen: ["Use for intentional error paths.", "Use when the graph detects a condition that should stop execution."],
      fields: [
        {
          name: "Failure reason",
          description: "Failure message shown when the workflow ends here.",
          details: ["Keep it short but specific enough to identify the failed branch.", "This reason becomes part of the failed run state."],
        },
      ],
      examples: ["Failure reason: Login failed after retry"],
      commonMistakes: ["Not connecting the error branch to this node, so the failure end is never reached."],
    },
  },
  action: {
    vi: {
      title: "Action Node Help",
      summary: "Chạy một action cụ thể. Sau khi chọn Action type, popup help sẽ dùng nội dung chi tiết của action đó.",
      useWhen: ["Dùng cho các thao tác browser, data, session, network, reliability, hoặc advanced."],
      fields: [
        {
          name: "Action type",
          description: "Loại action sẽ chạy ở node này.",
          details: ["Chọn action type trước khi run.", "Khi đổi action type, config action được reset về default của type mới."],
        },
      ],
      examples: ["Action type: Click, XPath: //*[@type='submit']"],
      commonMistakes: ["Để New node chưa chọn action type; graph vẫn lưu được nhưng validate/run sẽ bị chặn."],
    },
    en: {
      title: "Action Node Help",
      summary: "Run one concrete action. After choosing Action type, this popup uses that action's detailed help.",
      useWhen: ["Use for browser, data, session, network, reliability, or advanced actions."],
      fields: [
        {
          name: "Action type",
          description: "The action type that this node runs.",
          details: ["Choose an action type before running.", "Changing the action type resets config to the new type's defaults."],
        },
      ],
      examples: ["Action type: Click, XPath: //*[@type='submit']"],
      commonMistakes: ["Leaving a New node unconfigured; the graph can be saved but validate/run will be blocked."],
    },
  },
  if: {
    vi: {
      title: "If Help",
      summary: "Rẽ workflow sang nhánh True hoặc False dựa trên một condition.",
      useWhen: ["Dùng khi workflow cần quyết định đường đi theo output, text, URL, hoặc element.", "Dùng cho logic như đã đăng nhập/chưa đăng nhập, có dữ liệu/không có dữ liệu."],
      fields: [
        conditionField.vi,
        {
          name: "True port",
          description: "Nhánh chạy khi condition đúng.",
          details: ["True branch is optional; missing link will no-op.", "Nối các action cần chạy khi điều kiện khớp vào port này."],
        },
        {
          name: "False port",
          description: "Nhánh chạy khi condition sai.",
          details: ["False branch is optional; missing link will no-op.", "Dùng cho fallback, thông báo lỗi, hoặc đường xử lý khác."],
        },
        {
          name: "Done port",
          description: "Luồng tiếp tục sau khi nhánh True/False hoàn tất.",
          details: ["Done continuation is optional; workflow ends successfully here.", "Nối vào đây nếu cả hai nhánh đều cần quay lại flow chính."],
        },
      ],
      examples: ["Condition: Output equals logged_in = true; True -> dashboard actions; False -> login actions; Done -> extract result"],
      commonMistakes: ["Nối step tiếp theo vào True/False thay vì Done, làm flow chỉ chạy ở một nhánh.", "Đặt condition theo output chưa được tạo trước đó."],
    },
    en: {
      title: "If Help",
      summary: "Branch the workflow into True or False paths based on a condition.",
      useWhen: ["Use when the workflow must choose a path from output, text, URL, or element state."],
      fields: [
        conditionField.en,
        {
          name: "True port",
          description: "Path that runs when the condition is true.",
          details: ["True branch is optional; missing link will no-op.", "Connect actions that should run when the condition matches."],
        },
        {
          name: "False port",
          description: "Path that runs when the condition is false.",
          details: ["False branch is optional; missing link will no-op.", "Use for fallback, error handling, or alternate work."],
        },
        {
          name: "Done port",
          description: "Continuation after True/False branch work completes.",
          details: ["Done continuation is optional; workflow ends successfully here.", "Connect this when both branches should return to the main flow."],
        },
      ],
      examples: ["Condition: Output equals logged_in = true; True -> dashboard actions; False -> login actions; Done -> extract result"],
      commonMistakes: ["Connecting main-flow work to True/False instead of Done.", "Checking an output that has not been created yet."],
    },
  },
  switch: {
    vi: nodeWithFields("Switch", "Chọn một nhánh theo giá trị expression và danh sách cases.", [
      field("Switch expression", "Giá trị hoặc tên output dùng để so với các case.", ["Thường là tên output đã được extract/set trước đó."]),
      field("Switch cases", "Mỗi dòng là một case và tạo một output port tương ứng.", ["Default port chạy khi không case nào khớp.", "Done port là continuation sau khi case branch hoàn tất."]),
    ]),
    en: nodeWithFields("Switch", "Route execution to one case branch from an expression.", [
      field("Switch expression", "Value or output name compared against cases.", ["Usually an output created earlier."]),
      field("Switch cases", "Each line becomes a case output port.", ["Default runs when no case matches.", "Done continues after case branch work completes."]),
    ], "en"),
  },
  repeat_times: {
    vi: nodeWithFields("Repeat Times", "Lặp body một số lần cố định.", [
      field("Times", "Số lần chạy body.", ["Phải lớn hơn 0.", "Body port là phần được lặp; Done port chạy sau khi lặp xong."]),
    ]),
    en: nodeWithFields("Repeat Times", "Repeat the body a fixed number of times.", [
      field("Times", "How many times to run the body.", ["Must be greater than 0.", "Body is repeated; Done runs after the loop finishes."]),
    ], "en"),
  },
  repeat_for_each: {
    vi: nodeWithFields("Repeat For Each", "Lặp body cho từng item trong danh sách.", [
      field("Item name", "Tên biến đại diện item hiện tại.", ["Dùng tên dễ hiểu như product, row, email."]),
      field("Items", "Danh sách item, mỗi dòng một giá trị.", ["Body chạy một lần cho mỗi dòng không trống.", "Done chạy sau item cuối cùng."]),
    ]),
    en: nodeWithFields("Repeat For Each", "Repeat the body once for each item.", [
      field("Item name", "Variable name for the current item.", ["Use a clear name such as product, row, or email."]),
      field("Items", "Item list, one value per line.", ["Body runs once per non-empty line.", "Done runs after the final item."]),
    ], "en"),
  },
  repeat_until: loopHelp("Repeat Until", "Lặp body cho tới khi condition đúng hoặc chạm giới hạn.", "Repeat until the condition becomes true or a limit is reached."),
  while: loopHelp("While", "Lặp body khi condition còn đúng.", "Repeat while the condition stays true."),
  retry: {
    vi: nodeWithFields("Retry", "Thử lại nhánh Try khi nó fail.", [
      field("Max attempts", "Số lần thử tối đa.", ["Try port là bắt buộc trước khi run.", "Success port chạy khi Try thành công."]),
      field("Delay ms", "Thời gian nghỉ giữa các lần retry.", ["Failed port optional; nếu thiếu và retry hết lần, workflow fail."]),
    ]),
    en: nodeWithFields("Retry", "Retry the Try branch when it fails.", [
      field("Max attempts", "Maximum number of attempts.", ["Try port is required before run.", "Success runs when Try succeeds."]),
      field("Delay ms", "Delay between retry attempts.", ["Failed is optional; if missing and attempts are exhausted, the workflow fails."]),
    ], "en"),
  },
  try_catch: simplePortsNodeHelp("Try Catch", "Tách luồng chạy thường, lỗi, và cleanup.", "Separate normal work, errors, and cleanup."),
  fallback: simplePortsNodeHelp("Fallback", "Thử primary trước, nếu fail thì chạy fallback.", "Try primary work first, then fallback if needed."),
  break_loop: simplePortsNodeHelp("Break Loop", "Thoát khỏi vòng lặp hiện tại.", "Exit the current loop."),
  continue_loop: simplePortsNodeHelp("Continue Loop", "Bỏ qua phần còn lại của iteration hiện tại.", "Skip to the next loop iteration."),
  stop_workflow: {
    vi: nodeWithFields("Stop Workflow", "Dừng workflow có chủ đích với success hoặc failure.", [
      field("Status", "Trạng thái kết thúc: Success hoặc Failure.", ["Success kết thúc hợp lệ; Failure đánh dấu run thất bại."]),
      field("Reason", "Lý do dừng workflow.", ["Nên viết rõ để người dùng hiểu vì sao flow dừng."]),
    ]),
    en: nodeWithFields("Stop Workflow", "Stop the workflow intentionally as success or failure.", [
      field("Status", "Final status: Success or Failure.", ["Success ends normally; Failure marks the run failed."]),
      field("Reason", "Reason for stopping.", ["Keep it clear so users understand why the flow stopped."]),
    ], "en"),
  },
  set_variable: {
    vi: nodeWithFields("Set Variable", "Lưu một giá trị để các node sau dùng lại.", [
      field("Variable name", "Tên biến/output cần lưu.", ["Dùng tên ổn định, không có khoảng trắng nếu muốn template dễ hơn."]),
      field("Value", "Giá trị lưu vào biến.", ["Có thể là text cố định hoặc template theo output trước đó nếu runner hỗ trợ."]),
    ]),
    en: nodeWithFields("Set Variable", "Store a value for later nodes.", [
      field("Variable name", "Variable/output name to store.", ["Use a stable name without spaces for easier templates."]),
      field("Value", "Value to store.", ["Can be fixed text or a template from previous outputs when supported."]),
    ], "en"),
  },
  transform_variable: {
    vi: nodeWithFields("Transform Variable", "Tạo output mới từ output có sẵn.", [
      field("Source output", "Output đầu vào.", ["Phải được tạo trước khi node này chạy."]),
      field("Target output", "Tên output mới.", ["Các node sau đọc giá trị qua tên này."]),
      field("Expression", "Biểu thức transform.", ["Giữ biểu thức đơn giản và dễ kiểm tra."]),
    ]),
    en: nodeWithFields("Transform Variable", "Create a new output from an existing value.", [
      field("Source output", "Input output name.", ["Must be created before this node runs."]),
      field("Target output", "New output name.", ["Later nodes read this value by name."]),
      field("Expression", "Transform expression.", ["Keep it simple and testable."]),
    ], "en"),
  },
  assert_output: {
    vi: nodeWithFields("Assert Output", "Yêu cầu output khớp giá trị mong đợi.", [
      field("Output name", "Output cần kiểm tra.", ["Output phải tồn tại trước khi assert."]),
      field("Match", "Equals khớp chính xác; Contains chỉ cần chứa đoạn text.", ["Chọn Contains cho text dài hoặc thay đổi nhẹ."]),
      field("Expected value", "Giá trị mong đợi.", ["Kiểm tra cả khoảng trắng và chữ hoa/thường."]),
    ]),
    en: nodeWithFields("Assert Output", "Require an output to match an expected value.", [
      field("Output name", "Output to check.", ["The output must exist before assertion."]),
      field("Match", "Equals matches exactly; Contains accepts a substring.", ["Use Contains for longer or slightly changing text."]),
      field("Expected value", "Expected value.", ["Check whitespace and letter case."]),
    ], "en"),
  },
  run_subworkflow: {
    vi: nodeWithFields("Run Subworkflow", "Chạy một workflow khác từ graph hiện tại.", [
      field("Workflow id", "ID workflow con cần chạy.", ["Workflow con phải tồn tại và tự validate được."]),
    ]),
    en: nodeWithFields("Run Subworkflow", "Run another workflow from this graph.", [
      field("Workflow id", "Workflow id to run.", ["The child workflow must exist and validate on its own."]),
    ], "en"),
  },
  manual_approval: {
    vi: nodeWithFields("Manual Approval", "Tạm dừng để người dùng kiểm tra thủ công.", [
      field("Approval reason", "Nội dung giải thích vì sao cần duyệt.", ["Đây là checkpoint người dùng, không phải cơ chế bypass challenge."]),
      field("Timeout ms", "Thời gian tối đa chờ người dùng.", ["0 hoặc trống nghĩa là không đặt giới hạn khi được hỗ trợ."]),
    ]),
    en: nodeWithFields("Manual Approval", "Pause for a human checkpoint.", [
      field("Approval reason", "Why approval is needed.", ["This is a user checkpoint, not challenge bypass."]),
      field("Timeout ms", "Maximum time to wait for the user.", ["0 or blank means no limit when supported."]),
    ], "en"),
  },
  rate_limit: {
    vi: nodeWithFields("Rate Limit", "Thêm khoảng nghỉ an toàn trước khi đi tiếp.", [
      field("Delay ms", "Thời gian nghỉ.", ["Dùng để giảm tốc độ thao tác hoặc chờ hệ thống ổn định."]),
    ]),
    en: nodeWithFields("Rate Limit", "Add safe pacing before continuing.", [
      field("Delay ms", "Delay duration.", ["Use to slow actions or let the system settle."]),
    ], "en"),
  },
  domain_allowlist: {
    vi: nodeWithFields("Domain Allowlist", "Giới hạn workflow trong các domain được phép.", [
      field("Allowed domains", "Danh sách domain, mỗi dòng một domain.", ["Dùng domain không kèm path, ví dụ example.com.", "Nếu workflow rời khỏi allowlist, run phải bị chặn theo semantics hiện có."]),
    ]),
    en: nodeWithFields("Domain Allowlist", "Restrict the workflow to allowed domains.", [
      field("Allowed domains", "Allowed domains, one per line.", ["Use domains without paths, such as example.com.", "If the workflow leaves the allowlist, the run should be blocked by existing semantics."]),
    ], "en"),
  },
};

export const graphNodeHelpContent: Record<GraphNodeType, BilingualGraphNodeHelp> =
  addGraphNodeDecisionGuidance(baseGraphNodeHelpContent);

function addGraphNodeDecisionGuidance(
  content: Record<GraphNodeType, BilingualGraphNodeHelp>,
): Record<GraphNodeType, BilingualGraphNodeHelp> {
  const result = {} as Record<GraphNodeType, BilingualGraphNodeHelp>;
  for (const nodeType of Object.keys(content) as GraphNodeType[]) {
    result[nodeType] = {
      vi: addGraphNodeLanguageDecisionGuidance(nodeType, "vi", content[nodeType].vi),
      en: addGraphNodeLanguageDecisionGuidance(nodeType, "en", content[nodeType].en),
    };
  }
  return result;
}

function addGraphNodeLanguageDecisionGuidance(
  nodeType: GraphNodeType,
  language: GraphNodeHelpLanguage,
  content: GraphNodeHelpContent,
): GraphNodeHelpContent {
  return {
    ...content,
    notFor: graphNodeNotFor(nodeType, language),
    portSemantics: graphNodePortSemantics(nodeType, language),
    minimalConfig: content.fields.map((field) => ({
      name: field.name,
      description: field.description,
    })),
    workflowExamples: graphNodeWorkflowExamples(nodeType, language, content),
    relatedNodes: relatedGraphNodes(nodeType, language),
  };
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
        port("true", "branch", false, vi ? "Chạy khi condition đúng; thiếu link sẽ no-op." : "Runs when the condition is true; missing link no-ops."),
        port("false", "branch", false, vi ? "Chạy khi condition sai; thiếu link sẽ no-op." : "Runs when the condition is false; missing link no-ops."),
        port("done", "continuation", false, optionalDone),
      ];
    case "switch":
      return [
        port("in", "input", true, input),
        port("case_N", "branch", false, vi ? "Chạy case khớp expression." : "Runs the case that matches the expression."),
        port("default", "branch", false, vi ? "Chạy khi không case nào khớp." : "Runs when no case matches."),
        port("done", "continuation", false, optionalDone),
      ];
    case "repeat_times":
    case "repeat_for_each":
    case "while":
      return [
        port("in", "input", true, input),
        port("loop", "branch", true, vi ? "Body chạy trong vòng lặp." : "Loop body that runs inside the loop."),
        port("done", "continuation", false, optionalDone),
      ];
    case "repeat_until":
      return [
        port("in", "input", true, input),
        port("loop", "branch", true, vi ? "Body chạy cho tới khi condition đúng." : "Body runs until the condition becomes true."),
        port("done", "continuation", false, optionalDone),
        port("timeout", "branch", false, vi ? "Nhánh optional khi loop hết giới hạn." : "Optional branch when the loop reaches its limit."),
      ];
    case "retry":
      return [
        port("in", "input", true, input),
        port("try", "branch", true, vi ? "Nhánh công việc cần retry." : "Work branch that should be retried."),
        port("success", "continuation", false, vi ? "Chạy khi Try thành công." : "Runs when Try succeeds."),
        port("failed", "branch", false, vi ? "Optional; nếu thiếu và hết retry, workflow fail." : "Optional; when missing and retries are exhausted, the workflow fails."),
      ];
    case "break_loop":
    case "continue_loop":
      return [port("in", "input", true, input)];
    case "try_catch":
      return [
        port("in", "input", true, input),
        port("try", "branch", true, vi ? "Nhánh chính cần bắt lỗi." : "Main branch whose errors are handled."),
        port("error", "branch", false, vi ? "Nhánh xử lý lỗi optional." : "Optional error handling branch."),
        port("done", "continuation", false, optionalDone),
      ];
    case "fallback":
      return [
        port("in", "input", true, input),
        port("primary", "branch", true, vi ? "Nhánh chính cần thử trước." : "Primary branch to try first."),
        port("fallback", "branch", false, vi ? "Nhánh dự phòng optional." : "Optional fallback branch."),
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
    return [port("out", "continuation", true, vi ? "Điểm bắt đầu workflow." : "Starts workflow flow.")];
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
          steps: ["Repeat For Each row", "loop -> If found", "true -> Break Loop", "done -> Finish"],
        },
      ];
    default:
      {
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

function field(name: string, description: string, details: string[]) {
  return { name, description, details };
}

function nodeWithFields(
  title: string,
  summary: string,
  fields: GraphNodeHelpContent["fields"],
  language: GraphNodeHelpLanguage = "vi",
): GraphNodeHelpContent {
  return {
    title: `${title} Help`,
    summary,
    useWhen: [
      language === "vi"
        ? "Dùng khi logic graph cần node này để diễn đạt flow rõ hơn."
        : "Use when the graph needs this node to express flow clearly.",
    ],
    fields,
    examples: [
      language === "vi"
        ? `${title}: cấu hình field trong inspector, rồi nối các port cần thiết trên canvas.`
        : `${title}: configure fields in the inspector, then connect the required ports on the canvas.`,
    ],
    commonMistakes: [
      language === "vi"
        ? "Chỉ cấu hình field nhưng quên nối required port trước khi validate/run."
        : "Configuring fields but forgetting required ports before validate/run.",
    ],
  };
}

function loopHelp(title: string, viSummary: string, enSummary: string): BilingualGraphNodeHelp {
  return {
    vi: nodeWithFields(title, viSummary, [
      conditionField.vi,
      field("Loop max attempts", "Số lần lặp tối đa để tránh vòng lặp vô hạn.", ["Phải lớn hơn 0.", "Tăng vừa đủ theo dữ liệu thực tế."]),
      field("Loop timeout ms", "Thời gian tối đa cho loop.", ["0 hoặc trống nghĩa là không đặt timeout riêng khi được hỗ trợ.", "Body port là phần được lặp; Done port chạy sau loop."]),
    ]),
    en: nodeWithFields(title, enSummary, [
      conditionField.en,
      field("Loop max attempts", "Maximum loop iterations to avoid infinite loops.", ["Must be greater than 0.", "Increase only as much as real data needs."]),
      field("Loop timeout ms", "Maximum time for the loop.", ["0 or blank means no separate timeout when supported.", "Body is repeated; Done runs after the loop."]),
    ], "en"),
  };
}

function simpleNodeHelp(title: string, viSummary: string, enSummary: string): BilingualGraphNodeHelp {
  return {
    vi: {
      title: `${title} Help`,
      summary: viSummary,
      useWhen: ["Dùng như điểm điều hướng rõ ràng trong graph."],
      fields: noConfigFields.vi,
      examples: [`${title}: nối port để điều hướng flow.`],
      commonMistakes: ["Xóa hoặc bỏ nối node quan trọng làm graph không còn reachable."],
    },
    en: {
      title: `${title} Help`,
      summary: enSummary,
      useWhen: ["Use as a clear navigation point in the graph."],
      fields: noConfigFields.en,
      examples: [`${title}: connect ports to route flow.`],
      commonMistakes: ["Deleting or disconnecting key nodes can make graph paths unreachable."],
    },
  };
}

function simplePortsNodeHelp(title: string, viSummary: string, enSummary: string): BilingualGraphNodeHelp {
  return {
    vi: {
      title: `${title} Help`,
      summary: viSummary,
      useWhen: ["Dùng khi control flow cần hành vi này."],
      fields: noConfigFields.vi,
      examples: [`${title}: nối các port được đặt tên trên canvas.`],
      commonMistakes: ["Để node ngoài ngữ cảnh hợp lệ, ví dụ break/continue bên ngoài loop body."],
    },
    en: {
      title: `${title} Help`,
      summary: enSummary,
      useWhen: ["Use when control flow needs this behavior."],
      fields: noConfigFields.en,
      examples: [`${title}: connect the named ports on the canvas.`],
      commonMistakes: ["Placing a node outside a valid context, such as break/continue outside a loop body."],
    },
  };
}
