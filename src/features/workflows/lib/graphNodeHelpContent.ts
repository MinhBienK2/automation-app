import type { GraphNodeType } from "../../../types/workflow";
import type {
  ActionFieldOptionReference,
  HelpFieldCategory,
} from "./stepHelpTypes";

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

type BilingualGraphNodeHelp = Record<GraphNodeHelpLanguage, GraphNodeHelpContent>;

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
  call_subflow: {
    vi: {
      title: "Call Subflow Help",
      summary: "Chạy một subflow cùng project trong cùng browser context và output store.",
      useWhen: ["Dùng để tái sử dụng đường graph đã chuẩn hóa như login hoặc setup account state."],
      fields: [
        field("Subflow id", "Subflow trong cùng project sẽ được gọi.", [
          "Subflow khác project hoặc bị xóa sẽ chặn validate/run.",
          "Subflow graph không được chứa Call Subflow trong MVP.",
        ]),
        field("Input mapping", "Danh sách input_name=value truyền vào subflow trước khi chạy.", [
          "Mỗi dòng ánh xạ một input.",
          "Value có thể dùng template output giống các field text khác.",
        ]),
        field("Output prefix", "Prefix tùy chọn cho output do subflow tạo.", [
          "Dùng khi nhiều lần gọi cùng một subflow và cần phân biệt output.",
        ]),
      ],
      examples: ["Subflow id: subflow-login", "Input mapping: email={{account.email}}"],
      commonMistakes: ["Gọi subflow thuộc project khác.", "Để trống Subflow id rồi validate/run."],
    },
    en: {
      title: "Call Subflow Help",
      summary: "Run a same-project subflow in the same browser context and output store.",
      useWhen: ["Use for reusable graph paths such as login or account-state setup."],
      fields: [
        field("Subflow id", "Same-project subflow to call.", [
          "A deleted or cross-project subflow blocks validate/run.",
          "Subflow graphs cannot contain Call Subflow nodes in the MVP.",
        ]),
        field("Input mapping", "input_name=value lines passed to the subflow before it runs.", [
          "Each line maps one input.",
          "Values may use output templates like other text fields.",
        ]),
        field("Output prefix", "Optional prefix for outputs created by the subflow.", [
          "Use it when calling the same subflow more than once and outputs need separation.",
        ]),
      ],
      examples: ["Subflow id: subflow-login", "Input mapping: email={{account.email}}"],
      commonMistakes: ["Calling a subflow from another project.", "Leaving Subflow id empty before validate/run."],
    },
  },
  merge: {
    vi: nodeWithFields("Merge", "Cho nhiều nhánh quay về một luồng chung mà không chờ nhánh khác.", [
      field("Ports", "Nối nhiều nhánh vào In và một continuation từ Out.", [
        "Merge không chạy browser action.",
        "Nhánh nào tới Merge sẽ đi tiếp qua Out; nếu Out bỏ trống thì path kết thúc thành công.",
      ]),
    ]),
    en: nodeWithFields("Merge", "Let multiple branches return to one shared path without waiting for other branches.", [
      field("Ports", "Connect many branches to In and one continuation from Out.", [
        "Merge does not run a browser action.",
        "The branch that reaches Merge continues through Out; when Out is blank, that path ends successfully.",
      ]),
    ], "en"),
  },
  router: {
    vi: nodeWithFields("Router", "Chọn case đầu tiên khớp trong bảng điều kiện ưu tiên.", [
      field("Condition", "Mỗi case có condition riêng và chạy theo thứ tự từ trên xuống.", [
        "Case đầu tiên khớp sẽ chạy; các case còn lại không chạy.",
        "Default chạy khi không case nào khớp.",
      ]),
      field("Done port", "Continuation sau khi branch được chọn hoàn tất.", [
        "Done optional; nếu không nối, workflow kết thúc thành công sau Router.",
      ]),
    ]),
    en: nodeWithFields("Router", "Choose the first matching case from a prioritized decision table.", [
      field("Condition", "Each case has its own condition and runs top to bottom.", [
        "The first matching case runs; later cases do not run.",
        "Default runs when no case matches.",
      ]),
      field("Done port", "Continuation after the selected branch finishes.", [
        "Done is optional; when blank, the workflow ends successfully after Router.",
      ]),
    ], "en"),
  },
  random_choice: {
    vi: nodeWithFields("Random Choice", "Chọn ngẫu nhiên một nhánh theo weight đã cấu hình.", [
      field("Choices", "Danh sách các nhánh có label và weight riêng.", [
        "Weight càng cao thì nhánh càng có khả năng được chọn.",
        "Branch bỏ trống sẽ no-op nếu được chọn.",
      ]),
      field("Output name", "Tên output nhận id choice đã được chọn.", [
        "Dùng output này để audit hoặc branch tiếp bằng Switch/Router.",
        "Done port chạy sau khi branch được chọn hoàn tất.",
      ]),
    ]),
    en: nodeWithFields("Random Choice", "Choose one branch at runtime using configured weights.", [
      field("Choices", "List of branches with labels and weights.", [
        "Higher weight means the branch is more likely to be selected.",
        "An unconnected branch no-ops if it is selected.",
      ]),
      field("Output name", "Output that stores the selected choice id.", [
        "Use this output for audit or later Switch/Router decisions.",
        "Done runs after the selected branch finishes.",
      ]),
    ], "en"),
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
    vi: nodeWithFields("Set Variables", "Lưu nhiều giá trị để các node sau dùng lại.", [
      field("Rows", "Mỗi dòng có Name, Type và Value.", ["Type phân biệt text, JSON, number và boolean."]),
      field("Name", "Tên biến hoặc dot-path cần lưu.", ["Dùng user.name để tạo biến có path rõ ràng."]),
    ]),
    en: nodeWithFields("Set Variables", "Store multiple values for later nodes.", [
      field("Rows", "Each row has Name, Type, and Value.", ["Type distinguishes text, JSON, number, and boolean."]),
      field("Name", "Variable name or dot path to store.", ["Use user.name for a clear path variable."]),
    ], "en"),
  },
  set_json_variables: {
    vi: nodeWithFields("Set JSON Variables", "Lưu biến từ một JSON object.", [
      field("JSON variables", "JSON root phải là object.", ["Object lồng nhau được flatten thành dot-path; array giữ nguyên."]),
    ]),
    en: nodeWithFields("Set JSON Variables", "Store variables from a JSON object.", [
      field("JSON variables", "The JSON root must be an object.", ["Nested objects flatten into dot paths; arrays stay whole."]),
    ], "en"),
  },
  evaluate_logic: {
    vi: nodeWithFields("Kiểm tra điều kiện", "Đánh giá các quy tắc logic trực quan hoặc mã JS và lưu kết quả dạng True/False.", [
      field("Result Output Variable Name", "Tên biến lưu kết quả.", ["Kết quả lưu dưới dạng boolean true hoặc false."]),
      field("Evaluation Mode", "Chọn chế độ visual rules hoặc viết mã JS.", ["Mã JS chạy trên ngữ cảnh browser và nhận outputs.", "Dùng {{name}} để chèn biến, hoặc outputs.name để truy cập trực tiếp."]),
    ]),
    en: nodeWithFields("Check Conditions", "Evaluate visual rules or JS expression and store the boolean result.", [
      field("Result Output Variable Name", "The name of the variable to store the output.", ["Saves the result as a boolean true or false."]),
      field("Evaluation Mode", "Choose between visual rules builder or JS script.", ["JS script evaluates in the browser context with outputs available.", "Use {{name}} to insert variables (resolved before execution), or outputs.name for direct access."]),
    ], "en"),
  },
  evaluate_expression: {
    vi: nodeWithFields("Tính toán giá trị", "Đánh giá một biểu thức JavaScript/Toán học và lưu kết quả thực tế (số, chuỗi, v.v.).", [
      field("Result Output Variable Name", "Tên biến lưu kết quả.", ["Kết quả lưu dưới dạng giá trị thực tế sau tính toán."]),
      field("JavaScript / Math Expression", "Biểu thức cần tính toán.", ["Biểu thức chạy trên ngữ cảnh browser và nhận outputs.", "Dùng {{name}} hoặc outputs.name để tham chiếu biến."]),
    ]),
    en: nodeWithFields("Calculate Value", "Evaluate a JavaScript/Math expression and store the raw result (number, string, etc.).", [
      field("Result Output Variable Name", "The name of the variable to store the output.", ["Saves the result as its actual evaluated type."]),
      field("JavaScript / Math Expression", "The expression to evaluate.", ["Evaluates in the browser context with outputs available.", "Use {{name}} to insert variables, or outputs.name for direct access."]),
    ], "en"),
  },
  update_number_variable: {
    vi: nodeWithFields("Cập nhật biến số", "Thực hiện phép toán (cộng, trừ, nhân, chia, tăng, giảm) trên một biến số.", [
      field("Variable name", "Tên biến số cần cập nhật.", []),
      field("Operation", "Phép toán cần thực hiện.", []),
      field("Value", "Giá trị toán hạng (đối với add, subtract, multiply, divide).", []),
    ]),
    en: nodeWithFields("Update Number Variable", "Perform math operations (add, subtract, multiply, divide, increment, decrement) on a number variable.", [
      field("Variable name", "Name of the number variable to update.", []),
      field("Operation", "The math operation to perform.", []),
      field("Value", "The operand value (for add, subtract, multiply, divide).", []),
    ], "en"),
  },
  update_text_variable: {
    vi: nodeWithFields("Cập nhật biến chữ", "Thực hiện xử lý chuỗi (thêm đầu, thêm cuối, thay thế, viết hoa, viết thường, cắt khoảng trắng) trên một biến chữ.", [
      field("Variable name", "Tên biến chữ cần cập nhật.", []),
      field("Operation", "Thao tác chuỗi cần thực hiện.", []),
      field("Search pattern", "Mẫu tìm kiếm (chuỗi hoặc regex) khi thay thế.", []),
      field("Value", "Giá trị chèn thêm hoặc giá trị thay thế.", []),
    ]),
    en: nodeWithFields("Update Text Variable", "Perform string operations (append, prepend, replace, uppercase, lowercase, trim) on a text variable.", [
      field("Variable name", "Name of the text variable to update.", []),
      field("Operation", "The string operation to perform.", []),
      field("Search pattern", "The search pattern (string or regex) for replace operation.", []),
      field("Value", "The value to append, prepend, or replace with.", []),
    ], "en"),
  },
  update_flag_variable: {
    vi: nodeWithFields("Cập nhật biến flag", "Cập nhật giá trị boolean (toggle, set true, set false) cho một biến flag.", [
      field("Variable name", "Tên biến flag cần cập nhật.", []),
      field("Operation", "Thao tác boolean (toggle, set_true, set_false).", []),
    ]),
    en: nodeWithFields("Update Flag Variable", "Update boolean flag variable (toggle, set_true, set_false).", [
      field("Variable name", "Name of the flag variable to update.", []),
      field("Operation", "The boolean operation to perform.", []),
    ], "en"),
  },
  update_list_variable: {
    vi: nodeWithFields("Cập nhật biến danh sách", "Thao tác với mảng (thêm, xóa phần tử, loại bỏ trùng lặp, gộp mảng).", [
      field("Variable name", "Tên biến danh sách cần cập nhật.", []),
      field("Operation", "Thao tác mảng (push, unshift, push_unique, pop, shift, remove_by_index, remove_by_value, merge, merge_unique).", []),
      field("Value type", "Kiểu dữ liệu của phần tử mới.", []),
      field("Value", "Giá trị phần tử cần thêm hoặc xóa.", []),
      field("Index", "Chỉ số phần tử cần xóa (dành cho remove_by_index).", []),
    ]),
    en: nodeWithFields("Update List Variable", "Perform array operations (push, unshift, push_unique, pop, shift, remove_by_index, remove_by_value, merge, merge_unique) on a list variable.", [
      field("Variable name", "Name of the list variable to update.", []),
      field("Operation", "The array operation to perform.", []),
      field("Value type", "The data type of the new element.", []),
      field("Value", "The element value to add or remove.", []),
      field("Index", "The 0-based index to remove (for remove_by_index).", []),
    ], "en"),
  },
  update_object_variable: {
    vi: nodeWithFields("Cập nhật biến đối tượng", "Thao tác trên đối tượng JSON (merge, set key, delete key).", [
      field("Variable name", "Tên biến đối tượng cần cập nhật.", []),
      field("Operation", "Thao tác đối tượng (merge, deep_merge, set_key, delete_key).", []),
      field("Value", "Giá trị JSON cần merge hoặc deep merge.", []),
      field("Property key", "Đường dẫn key cần thao tác (hỗ trợ dot-path).", []),
      field("Property value type", "Kiểu dữ liệu của key cần set.", []),
      field("Property value", "Giá trị của key cần set.", []),
    ]),
    en: nodeWithFields("Update Object Variable", "Perform JSON object operations (merge, deep_merge, set_key, delete_key) on an object variable.", [
      field("Variable name", "Name of the object variable to update.", []),
      field("Operation", "The object operation to perform.", []),
      field("Value", "The JSON string to merge/deep_merge.", []),
      field("Property key", "The property key path (supports dot-path).", []),
      field("Property value type", "The data type of the value to set.", []),
      field("Property value", "The value to set for the key.", []),
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
  domain_allowlist: {
    vi: nodeWithFields("Domain Allowlist", "Giới hạn workflow trong các domain được phép.", [
      field("Allowed domains", "Danh sách domain, mỗi dòng một domain.", ["Dùng domain không kèm path, ví dụ example.com.", "Nếu workflow rời khỏi allowlist, run phải bị chặn theo semantics hiện có."]),
    ]),
    en: nodeWithFields("Domain Allowlist", "Restrict the workflow to allowed domains.", [
      field("Allowed domains", "Allowed domains, one per line.", ["Use domains without paths, such as example.com.", "If the workflow leaves the allowlist, the run should be blocked by existing semantics."]),
    ], "en"),
  },
  get_current_url: {
    vi: nodeWithFields("Get Current URL", "Lấy URL trang hiện tại và lưu vào system.current_url.", [
      field("Output", "Dữ liệu URL được lưu vào system.current_url.", ["Không cần cấu hình thêm."]),
    ]),
    en: nodeWithFields("Get Current URL", "Capture the current page URL and store it in system.current_url.", [
      field("Output", "URL data is stored in system.current_url.", ["No additional configuration needed."]),
    ], "en"),
  },
  quarantined: {
    vi: nodeWithFields("Cách ly (Quarantined)", "Nút bị cách ly do schema không hợp lệ hoặc không được hỗ trợ.", [
      field("Trạng thái", "Nút bị giữ lại để tham khảo nhưng không được bi dịch hoặc thực thi.", ["Sửa hoặc thay thế payload hành động trước khi chạy lại."]),
    ]),
    en: nodeWithFields("Quarantined", "Node quarantined due to an invalid or unsupported schema.", [
      field("Status", "Node is retained for reference but not compiled or executed.", ["Fix or replace the action payload before running again."]),
    ]),
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
    fieldReference: graphNodeFieldReference(nodeType, language, content),
    minimalConfig: content.fields.map((field) => ({
      name: field.name,
      description: field.description,
    })),
    workflowExamples: graphNodeWorkflowExamples(nodeType, language, content),
    relatedNodes: relatedGraphNodes(nodeType, language),
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
  if (nodeType === "try_catch" || nodeType === "fallback" || nodeType === "break_loop" || nodeType === "continue_loop") {
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
  if (field.name.includes("Timeout") || field.name.includes("Delay") || field.name.includes("attempts")) {
    return vi
      ? "Nhập số đủ nhỏ để fail nhanh khi cấu hình sai, nhưng đủ lớn cho trang thật."
      : "Use a value small enough to fail fast on wrong config, but large enough for the real page.";
  }
  return field.details[0] ?? (vi
    ? `Nhập giá trị rõ ràng cho ${field.name} để node ${nodeType} dễ đọc trên canvas.`
    : `Enter a clear ${field.name} value so ${nodeType} stays readable on the canvas.`);
}

function graphNodeFieldExample(
  nodeType: GraphNodeType,
  language: GraphNodeHelpLanguage,
  fieldName: string,
) {
  const vi = language === "vi";
  if (fieldName === "Condition") return vi ? "Output contains status = ready" : "Output contains status = ready";
  if (fieldName === "Match") return "Contains";
  if (fieldName.includes("Timeout")) return "5000";
  if (fieldName.includes("Delay")) return "250";
  if (fieldName.includes("Times") || fieldName.includes("attempts")) return "3";
  if (fieldName.includes("Output")) return "login_state";
  if (fieldName.includes("Item")) return "item";
  if (fieldName === "Allowed domains") return "example.com";
  if (fieldName === "Ports") return undefined;
  return vi ? `${fieldName}: giá trị mẫu cho ${nodeType}` : `${fieldName}: example value for ${nodeType}`;
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
      graphOption(vi ? "Kiểm tra biến (boolean)" : "Check variable (boolean)", "variable_is_true", vi ? "Biến truyền vào phải mang giá trị true (hoặc truthy)." : "The variable must be true (or truthy).", vi ? "Dùng để kiểm tra kết quả từ node Kiểm tra điều kiện." : "Use to check the output of a Check Conditions node.", vi ? "Đảm bảo tên biến chính xác." : "Ensure the variable name is exact."),
      graphOption("Text visible", "text_visible", vi ? "Trang hiện tại phải hiển thị text." : "The current page must show the text.", vi ? "Dùng khi trạng thái nằm trên UI." : "Use when the state is visible in the UI.", vi ? "Tránh với text theo ngôn ngữ động." : "Avoid locale-dependent text."),
      graphOption("URL contains", "url_contains", vi ? "URL hiện tại chứa đoạn mong đợi." : "Current URL contains the expected fragment.", vi ? "Dùng sau login hoặc điều hướng." : "Use after login or navigation.", vi ? "Tránh với SPA không đổi URL." : "Avoid SPAs that do not change URL."),
      graphOption("Element visible", "element_visible", vi ? "Element XPath hoặc Find Element ref phải visible." : "Element XPath or Find Element ref must be visible.", vi ? "Dùng khi nhánh phụ thuộc một control đang hiện." : "Use when branching depends on a visible control.", vi ? "Tránh nếu chỉ cần DOM presence." : "Avoid when DOM presence is enough."),
    ];
  }
  if (nodeType === "assert_output" && fieldName === "Match") {
    return [
      graphOption("Equals", "equals", vi ? "Output phải bằng đúng expected value." : "Output must equal the expected value exactly.", vi ? "Dùng cho trạng thái hoặc mã cố định." : "Use for fixed states or codes.", vi ? "Tránh với text dài có số động." : "Avoid long text with dynamic numbers."),
      graphOption("Contains", "contains", vi ? "Output chỉ cần chứa expected value." : "Output only needs to contain the expected value.", vi ? "Dùng cho đoạn text trong nội dung dài." : "Use for a fragment inside longer content.", vi ? "Tránh nếu cần khẳng định chính xác." : "Avoid when exact assertion is required."),
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
    case "router":
      return [
        port("in", "input", true, input),
        port("case_<id>", "branch", false, vi ? "Chạy case đầu tiên có condition khớp." : "Runs the first case whose condition matches."),
        port("default", "branch", false, vi ? "Chạy khi không case nào khớp." : "Runs when no case matches."),
        port("done", "continuation", false, optionalDone),
      ];
    case "merge":
      return [
        port("in", "input", true, vi ? "Nhận nhiều nhánh đi vào điểm hội tụ." : "Receives multiple branches at the convergence point."),
        port("out", "continuation", false, optionalDone),
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
