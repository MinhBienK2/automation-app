import type { ActionType } from "../../../types/workflow";
import { actionLabels } from "../../../lib/workflowUi";
import type {
  BilingualStepHelp,
  HelpFieldCategory,
  StepHelpContent,
  StepHelpLanguage,
} from "./stepHelpTypes";
import {
  decisionAlternatives,
  fieldDetails,
  fieldOptions,
  isLocatorConstraintField,
  isLocatorTypeField,
  isLocatorValueField,
  outputGuidance,
  safetyNotes,
  workflowExamples,
} from "./stepHelpFieldGuidance";

export function enrichStepHelpContent(
  content: Record<ActionType, BilingualStepHelp>,
): Record<ActionType, BilingualStepHelp> {
  return addFieldReference(addDecisionGuidance(addFieldDetails(content)));
}

function addFieldDetails(
  content: Record<ActionType, BilingualStepHelp>,
): Record<ActionType, BilingualStepHelp> {
  const result = {} as Record<ActionType, BilingualStepHelp>;

  for (const actionType of Object.keys(content) as ActionType[]) {
    result[actionType] = {
      vi: addLanguageFieldDetails(actionType, "vi", content[actionType].vi),
      en: addLanguageFieldDetails(actionType, "en", content[actionType].en),
    };
  }

  return result;
}

function addLanguageFieldDetails(
  actionType: ActionType,
  language: StepHelpLanguage,
  content: StepHelpContent,
): StepHelpContent {
  const contentFields = new Map(content.fields.map((field) => [field.name, field]));

  return {
    ...content,
    fields: actualFieldNames(actionType).map((fieldName) => ({
      name: fieldName,
      description:
        contentFields.get(fieldName)?.description ??
        fieldDescription(actionType, language, fieldName),
      details:
        contentFields.get(fieldName)?.details ??
        fieldDetails(actionType, language, fieldName),
    })),
  };
}

function addDecisionGuidance(
  content: Record<ActionType, BilingualStepHelp>,
): Record<ActionType, BilingualStepHelp> {
  const result = {} as Record<ActionType, BilingualStepHelp>;

  for (const actionType of Object.keys(content) as ActionType[]) {
    result[actionType] = {
      vi: addLanguageDecisionGuidance(actionType, "vi", content[actionType].vi),
      en: addLanguageDecisionGuidance(actionType, "en", content[actionType].en),
    };
  }

  return result;
}

function addLanguageDecisionGuidance(
  actionType: ActionType,
  language: StepHelpLanguage,
  content: StepHelpContent,
): StepHelpContent {
  const label = actionLabels[actionType];
  const minimumNames = minimumFieldNames(content.fields);
  const minimalConfig = minimumNames.map((fieldName) => {
    const field = content.fields.find((item) => item.name === fieldName);
    return {
      name: fieldName,
      description: field?.description ?? fieldDescription(actionType, language, fieldName),
    };
  });
  const advancedConfig = content.fields.filter((field) => !minimumNames.includes(field.name)).map((field) => ({
    name: field.name,
    description: field.description,
    whenToUse:
      language === "vi"
        ? "Dùng khi tình huống thực tế cần tinh chỉnh thêm."
        : "Use when the real page needs extra tuning.",
  }));

  return {
    ...content,
    title:
      language === "vi"
        ? `Trợ giúp ${label}`
        : `${label} Help`,
    notFor: decisionNotFor(actionType, language),
    chooseInstead: decisionAlternatives(actionType, language),
    minimalConfig,
    advancedConfig: advancedConfig.length ? advancedConfig : undefined,
    portSemantics: actionPortSemantics(language),
    workflowExamples: workflowExamples(actionType, language, content),
    outputs: outputGuidance(actionType, language),
    safetyNotes: safetyNotes(actionType, language),
  };
}

function actionPortSemantics(language: StepHelpLanguage): StepHelpContent["portSemantics"] {
  return language === "vi"
    ? [
        {
          port: "In",
          kind: "input",
          required: true,
          description: "Nhận luồng chạy từ node trước đó. Nếu không có link vào, action này chỉ chạy khi nó là node đầu sau Start hoặc được chạy từ node được chọn.",
        },
        {
          port: "Out",
          kind: "continuation",
          required: false,
          description: "Tiếp tục sang node kế tiếp sau khi action thành công. Nếu không nối Out, nhánh hiện tại kết thúc thành công tại action này.",
        },
      ]
    : [
        {
          port: "In",
          kind: "input",
          required: true,
          description: "Receives execution from the previous node. Without an incoming link, this action runs only when it is the first node after Start or when execution starts from this selected node.",
        },
        {
          port: "Out",
          kind: "continuation",
          required: false,
          description: "Continues to the next node after the action succeeds. If Out is not connected, the current path ends successfully at this action.",
        },
      ];
}

function minimumFieldNames(fields: StepHelpContent["fields"]) {
  const nonConditionalFields = fields.filter(
    (field) => !field.name.endsWith("role") && !field.name.endsWith("attribute"),
  );
  return nonConditionalFields.slice(0, 3).map((field) => field.name);
}

function addFieldReference(
  content: Record<ActionType, BilingualStepHelp>,
): Record<ActionType, BilingualStepHelp> {
  const result = {} as Record<ActionType, BilingualStepHelp>;

  for (const actionType of Object.keys(content) as ActionType[]) {
    result[actionType] = {
      vi: addLanguageFieldReference(actionType, "vi", content[actionType].vi),
      en: addLanguageFieldReference(actionType, "en", content[actionType].en),
    };
  }

  return result;
}

function addLanguageFieldReference(
  actionType: ActionType,
  language: StepHelpLanguage,
  content: StepHelpContent,
): StepHelpContent {
  const contentFields = new Map(content.fields.map((field) => [field.name, field]));
  const fieldNames = actualFieldNames(actionType);

  return {
    ...content,
    fieldReference: fieldNames.map((fieldName) => ({
      name: fieldName,
      category: fieldCategory(actionType, fieldName),
      description: contentFields.get(fieldName)?.description ?? fieldDescription(actionType, language, fieldName),
      requiredWhen: fieldRequiredWhen(actionType, language, fieldName),
      valueGuidance: fieldValueGuidance(actionType, language, fieldName),
      example: fieldExample(actionType, language, fieldName),
      mistakes: fieldMistakes(actionType, language, fieldName),
      details: contentFields.get(fieldName)?.details ?? fieldDetails(actionType, language, fieldName),
      options: fieldOptions(actionType, language, fieldName),
    })),
  };
}

function actualFieldNames(actionType: ActionType): string[] {
  const targetFields = [
    "Target locator type",
    "Target locator",
    "Target role",
    "Target attribute",
    "Target visibility",
    "Target enabled",
    "Target contains text",
    "Target index",
  ];
  const targetSourceFields = ["Target source", "Target ref", ...targetFields];
  const scrollTargetFields = [
    "Target locator type",
    "Target locator",
    "Target role",
    "Target attribute",
  ];
  const scrollTargetSourceFields = ["Target source", "Target ref", ...scrollTargetFields];
  const sourceTargetFields = [
    "Source selection",
    "Source ref",
    "Source locator type",
    "Source locator",
  ];
  const dropTargetFields = [
    "Drop target source",
    "Drop target ref",
    "Target locator type",
    "Target locator",
  ];
  const dropPointFields = [
    "Destination position",
    "X percent",
    "Y percent",
    "X offset px",
    "Y offset px",
  ];
  const triggerTargetFields = [
    "Trigger source",
    "Trigger ref",
    "Trigger locator type",
    "Trigger locator",
    "Trigger visibility",
    "Trigger enabled",
    "Trigger contains text",
    "Trigger index",
  ];
  switch (actionType) {
    case "navigate":
      return ["URL"];
    case "wait":
      return ["Condition", "Duration ms", ...targetSourceFields, "Text", "URL contains"];
    case "random_wait":
      return ["Minimum wait ms", "Maximum wait ms"];
    case "input_text":
      return [...targetSourceFields, "Text"];
    case "clear_input":
      return targetSourceFields;
    case "click":
      return targetSourceFields;
    case "find_element":
      return [...targetFields, "Output name", "In viewport", "Rank"];
    case "scroll":
      return ["Mode", "Direction", "Pixels", ...scrollTargetSourceFields, "Iframe XPath", "Timeout ms"];
    case "select_option":
      return [...targetSourceFields, "Match by", "Value"];
    case "press_key":
      return ["Key"];
    case "hotkey":
      return ["Keys"];
    case "hover":
    case "double_click":
    case "right_click":
    case "focus_element":
    case "blur_element":
    case "paste_clipboard":
    case "check":
    case "uncheck":
    case "toggle_checkbox":
    case "select_radio":
      return targetSourceFields;
    case "drag_and_drop":
      return [...sourceTargetFields, ...dropTargetFields, ...dropPointFields];
    case "type_sequence":
      return [...targetSourceFields, "Text"];
    case "set_clipboard":
      return ["Text"];
    case "upload_file":
      return [...targetSourceFields, "Files"];
    case "submit_form":
      return targetSourceFields;
    case "select_custom_option":
      return [...triggerTargetFields, "Option text"];
    case "set_contenteditable":
      return [...targetSourceFields, "Text", "Clear before input"];
    case "extract_text":
    case "extract_input_value":
    case "extract_table":
    case "extract_list":
      return [...targetSourceFields, "Output name"];
    case "extract_regex_matches":
      return ["Source output", "Pattern", "Flags", "Output name", "Append", "Dedupe"];
    case "extract_attribute":
      return [...targetSourceFields, "Output name", "Attribute"];
    case "take_screenshot":
      return ["Path", "Output name", "Full page"];
    case "write_text_file":
      return ["Source output", "Path", "Separator", "Trailing newline", "Output name"];
    case "go_back":
    case "go_forward":
    case "reload":
    case "dismiss_dialog":
      return ["No fields"];
    case "open_new_tab":
      return ["URL"];
    case "switch_tab":
    case "close_tab":
      return ["Tab index"];
    case "accept_dialog":
      return ["Prompt text"];
    case "wait_for_download":
      return ["Output name", "Timeout ms"];
    case "set_variable":
      return ["Name", "Type", "Value"];
    case "set_json_variables":
      return ["JSON variables"];
    case "update_variable":
      return ["Variable name", "Operation", "Value", "Value type"];
    case "assert_element":
      return [...targetSourceFields, "State"];
    case "assert_text":
      return [...targetSourceFields, "Text", "Match mode", "Timeout ms"];
    case "graph_noop":
    case "if_condition":
      return ["No fields"];
    case "router_condition":
      return ["Cases", "Default steps"];
    case "random_choice":
      return ["Choices", "Output name"];
    case "repeat_times":
      return ["Times"];
    case "repeat_for_each":
      return ["Items source", "Item name", "Items", "Array variable"];
    case "retry_block":
      return ["Max attempts", "Delay ms"];
    case "switch_condition":
      return ["Expression", "Cases", "Default steps"];
    case "while_loop":
    case "repeat_until":
      return ["Condition", "Max attempts", "Timeout ms"];
    case "try_catch":
      return ["Try steps", "Success steps", "Error steps", "Finally steps"];
    case "fallback_block":
      return ["Primary steps", "Fallback steps"];
    case "break_loop":
    case "continue_loop":
      return ["No fields"];
    case "stop_workflow":
      return ["Status", "Reason"];
    case "transform_variable":
      return ["Source name", "Target name", "Expression"];
    case "assert_output":
      return ["Name", "Match mode", "Value"];
    case "domain_allowlist":
      return ["Domains"];
    case "set_cookie":
      return ["Name", "Value", "Domain", "Path"];
    case "clear_cookies":
      return ["Domain"];
    case "set_viewport":
      return ["Width", "Height"];
    case "set_geolocation":
      return ["Latitude", "Longitude", "Accuracy"];
    case "set_extra_headers":
      return ["Headers"];
    case "grant_permission":
      return ["Origin", "Permissions"];
    case "execute_js":
      return ["Script", "Output name", "Timeout ms"];
    case "wait_for_request":
      return ["URL contains", "Timeout ms"];
    case "wait_for_response":
      return ["URL contains", "Status", "Timeout ms"];
    case "block_request":
      return ["URL patterns"];
    case "mock_response":
      return ["URL contains", "Status", "Body", "Content type"];
    case "set_local_storage":
    case "set_session_storage":
      return ["Key", "Value"];
  }
}

function decisionNotFor(actionType: ActionType, language: StepHelpLanguage) {
  const vi = language === "vi";
  switch (actionType) {
    case "input_text":
      return [
        vi
          ? "Không dùng khi website cần từng sự kiện bàn phím thật, autocomplete, mask, hoặc listener theo từng phím."
          : "Not for fields that require real keyboard events, autocomplete, masks, or per-key listeners.",
        vi
          ? "Không dùng cho contenteditable hoặc rich text editor."
          : "Not for contenteditable or rich text editors.",
      ];
    case "type_sequence":
      return [
        vi
          ? "Không dùng cho field thường khi Fill Field ổn định và nhanh hơn."
          : "Not for ordinary fields when Fill Field is faster and stable.",
      ];
    case "paste_clipboard":
      return [
        vi
          ? "Không dùng khi website chặn paste hoặc cần từng phím thật."
          : "Not when the site blocks paste or needs real key-by-key typing.",
      ];
    case "set_contenteditable":
      return [
        vi
          ? "Không dùng cho input hoặc textarea thường."
          : "Not for normal input or textarea fields.",
      ];
    case "toggle_checkbox":
      return [
        vi
          ? "Không dùng khi trạng thái cuối cùng phải chắc chắn checked hoặc unchecked."
          : "Not when the final checked state must be guaranteed.",
      ];
    default:
      return undefined;
  }
}

function fieldRequiredWhen(
  actionType: ActionType,
  language: StepHelpLanguage,
  fieldName: string,
) {
  const vi = language === "vi";
  const key = `${actionType}:${fieldName}`;
  const specific: Record<string, string> = vi
    ? {
        "wait:Duration ms": "Bắt buộc khi Condition là Duration.",
        "wait:XPath": "Bắt buộc khi Condition kiểm tra element.",
        "wait:Text": "Bắt buộc khi Condition là Text visible.",
        "wait:URL contains": "Bắt buộc khi Condition là URL contains.",
        "navigate:URL": "Bắt buộc; đây là trang workflow sẽ mở.",
        "navigate:Wait until": "Tùy chọn; mặc định là Load.",
        "scroll:Target locator": "Bắt buộc với Scroll To Element và Scroll Until Element Visible; không cần với Page Scroll.",
        "click:Offset X / Offset Y": "Chỉ bắt buộc khi Position là Offset.",
        "drag_and_drop:Destination position": "Tùy chọn; mặc định là Center of target.",
        "drag_and_drop:X percent": "Bắt buộc khi Destination position là Percent inside target.",
        "drag_and_drop:Y percent": "Bắt buộc khi Destination position là Percent inside target.",
        "drag_and_drop:X offset px": "Bắt buộc khi Destination position là Pixel offset inside target.",
        "drag_and_drop:Y offset px": "Bắt buộc khi Destination position là Pixel offset inside target.",
        "go_back:No fields": "Action này không có field cấu hình.",
        "go_forward:No fields": "Action này không có field cấu hình.",
        "reload:No fields": "Action này không có field cấu hình.",
        "dismiss_dialog:No fields": "Action này không có field cấu hình.",
        "if_condition:No fields": "Compatibility action này không có field trong form hiện tại.",
      }
    : {
        "wait:Duration ms": "Required when Condition is Duration.",
        "wait:XPath": "Required when Condition checks an element.",
        "wait:Text": "Required when Condition is Text visible.",
        "wait:URL contains": "Required when Condition is URL contains.",
        "navigate:URL": "Required; this is the page the workflow opens.",
        "navigate:Wait until": "Optional; defaults to Load.",
        "scroll:Target locator": "Required for Scroll To Element and Scroll Until Element Visible; not needed for Page Scroll.",
        "click:Offset X / Offset Y": "Required only when Position is Offset.",
        "drag_and_drop:Destination position": "Optional; defaults to Center of target.",
        "drag_and_drop:X percent": "Required when Destination position is Percent inside target.",
        "drag_and_drop:Y percent": "Required when Destination position is Percent inside target.",
        "drag_and_drop:X offset px": "Required when Destination position is Pixel offset inside target.",
        "drag_and_drop:Y offset px": "Required when Destination position is Pixel offset inside target.",
        "go_back:No fields": "This action has no configurable fields.",
        "go_forward:No fields": "This action has no configurable fields.",
        "reload:No fields": "This action has no configurable fields.",
        "dismiss_dialog:No fields": "This action has no configurable fields.",
        "if_condition:No fields": "This graph-internal action has no fields in the current form.",
      };

  if (specific[key]) return specific[key];
  if (
    fieldName === "Target source" ||
    fieldName === "Source selection" ||
    fieldName === "Drop target source" ||
    fieldName === "Trigger source"
  ) {
    return vi
      ? "Bắt buộc; chọn Use locator để nhập locator trực tiếp hoặc Use Find Element ref để dùng ref runtime từ node Find Element trước đó."
      : "Required; choose Use locator for direct locator fields or Use Find Element ref for a runtime ref from a previous Find Element node.";
  }
  if (
    fieldName === "Target ref" ||
    fieldName === "Source ref" ||
    fieldName === "Drop target ref" ||
    fieldName === "Trigger ref"
  ) {
    return vi
      ? "Bắt buộc khi endpoint chọn Use Find Element ref; bỏ trống khi dùng locator trực tiếp."
      : "Required when the endpoint uses Find Element ref; leave blank when using a direct locator.";
  }
  if (isLocatorTypeField(fieldName) || isLocatorValueField(fieldName)) {
    return vi
      ? "Bắt buộc khi action cần tìm một element trên trang; để trống chỉ khi action hoặc mode không cần target."
      : "Required when the action needs to find a page element; leave blank only when the action or mode does not need a target.";
  }
  if (isLocatorConstraintField(fieldName)) {
    return vi
      ? "Tùy chọn; dùng khi cần lọc locator theo trạng thái, text, hoặc vị trí khớp."
      : "Optional; use when the locator must be constrained by state, text, or match position.";
  }
  if (fieldName.includes("XPath") && fieldName !== "Iframe XPath") {
    return vi
      ? "Bắt buộc khi action cần chọn element cụ thể."
      : "Required when the action needs a specific target element.";
  }
  if (fieldName === "Iframe XPath") {
    return vi
      ? "Chỉ nhập khi target nằm bên trong iframe."
      : "Only set when the target is inside an iframe.";
  }
  if (fieldName.includes("Timeout") || fieldName.includes("Delay") || fieldName.includes("Wait")) {
    return vi
      ? "Tùy chọn; dùng để điều chỉnh timing khi trang tải chậm hoặc xử lý không ổn định."
      : "Optional; use to tune timing when the page is slow or unstable.";
  }
  return vi
    ? `${fieldName} cần có khi ${actionLabels[actionType]} phụ thuộc trực tiếp vào giá trị này; nếu không nhập, action dùng mặc định hiện có.`
    : `${fieldName} is needed when ${actionLabels[actionType]} depends on this value directly; otherwise the action uses its current default.`;
}

function fieldDescription(
  actionType: ActionType,
  language: StepHelpLanguage,
  fieldName: string,
) {
  const vi = language === "vi";
  if (fieldName === "No fields") {
    return vi
      ? "Action này chạy ngay theo trạng thái browser hiện tại và không cần thêm input."
      : "This action runs against the current browser state and needs no extra input.";
  }
  if (fieldName === "Wait until" && actionType === "navigate") {
    return vi
      ? "Chọn mốc tải trang mà Navigate sẽ chờ trước khi chạy action tiếp theo."
      : "Choose which page-load milestone Navigate waits for before the next action runs.";
  }
  if (fieldName === "Tab index") {
    return vi
      ? "Số thứ tự tab, bắt đầu từ 0."
      : "Tab number, starting at 0.";
  }
  if (fieldName === "Prompt text") {
    return vi
      ? "Text sẽ nhập vào prompt dialog trước khi accept."
      : "Text entered into a prompt dialog before accepting it.";
  }
  if (actionType === "random_choice" && fieldName === "Choices") {
    return vi
      ? "Danh sách các nhánh có label và weight để runner chọn một nhánh khi chạy."
      : "Weighted branch list used by the runner to choose one path at runtime.";
  }
  if (actionType === "random_choice" && fieldName === "Output name") {
    return vi
      ? "Tên output lưu id choice đã được chọn để audit hoặc dùng ở node logic sau."
      : "Output name that stores the selected choice id for audit or later logic nodes.";
  }
  if (
    fieldName === "Target source" ||
    fieldName === "Source selection" ||
    fieldName === "Drop target source" ||
    fieldName === "Trigger source"
  ) {
    return vi
      ? "Chọn nguồn target cho action: locator trực tiếp hoặc ref đã resolve từ Find Element."
      : "Chooses the action target source: a direct locator or a resolved Find Element ref.";
  }
  if (
    fieldName === "Target ref" ||
    fieldName === "Source ref" ||
    fieldName === "Drop target ref" ||
    fieldName === "Trigger ref"
  ) {
    return vi
      ? "Tên output_name của node Find Element đã chạy trước trong cùng run."
      : "The output_name from a previous Find Element node in the same run.";
  }
  if (isLocatorTypeField(fieldName)) {
    return vi
      ? "Loại locator dùng để tìm element, ví dụ Test ID, Role, Label, Placeholder, Text, CSS, XPath, hoặc Attribute."
      : "Locator kind used to find the element, such as Test ID, Role, Label, Placeholder, Text, CSS, XPath, or Attribute.";
  }
  if (isLocatorValueField(fieldName)) {
    return vi
      ? "Giá trị locator tương ứng với loại đã chọn, ví dụ test id, label hiển thị, CSS selector, hoặc XPath."
      : "Locator value matching the selected kind, such as a test id, visible label, CSS selector, or XPath.";
  }
  if (fieldName.endsWith("role")) {
    return vi
      ? "Role ARIA dùng khi Locator type là Role, ví dụ button, textbox, link, hoặc checkbox."
      : "ARIA role used when Locator type is Role, for example button, textbox, link, or checkbox.";
  }
  if (fieldName.endsWith("attribute")) {
    return vi
      ? "Tên attribute dùng khi Locator type là Attribute, ví dụ data-state hoặc aria-label."
      : "Attribute name used when Locator type is Attribute, for example data-state or aria-label.";
  }
  if (fieldName.endsWith("visibility")) {
    return vi
      ? "Ràng buộc element phải visible, hidden, hoặc bỏ qua trạng thái visibility."
      : "Constraint for whether the element must be visible, hidden, or accepted in any visibility state.";
  }
  if (fieldName.endsWith("enabled")) {
    return vi
      ? "Ràng buộc element phải enabled, disabled, hoặc bỏ qua trạng thái enabled."
      : "Constraint for whether the element must be enabled, disabled, or accepted in either state.";
  }
  if (fieldName.endsWith("contains text")) {
    return vi
      ? "Text con mà element khớp locator phải chứa thêm, dùng để lọc các kết quả tương tự nhau."
      : "Additional text the matched element must contain, useful when several locator matches look similar.";
  }
  if (fieldName.endsWith("index")) {
    return vi
      ? "Vị trí match theo số bắt đầu từ 0 khi locator có nhiều kết quả hợp lệ."
      : "Zero-based match position when the locator returns multiple valid elements.";
  }
  return vi
    ? `${fieldName} điều khiển cách ${actionLabels[actionType]} chạy trong browser. Đọc quy tắc bắt buộc và ví dụ để nhập đúng kiểu giá trị.`
    : `${fieldName} controls how ${actionLabels[actionType]} runs in the browser. Use the requirement rule and example to enter the right value.`;
}

function fieldCategory(actionType: ActionType, fieldName: string): HelpFieldCategory {
  if (fieldName === "No fields") return "optional";
  if (actionType === "drag_and_drop" && fieldName === "Destination position") return "optional";
  if (actionType === "drag_and_drop" && (fieldName === "X offset px" || fieldName === "Y offset px")) {
    return "advanced";
  }
  if (actionType === "drag_and_drop" && (fieldName === "X percent" || fieldName === "Y percent")) {
    return "optional";
  }
  if (isLocatorTypeField(fieldName) || isLocatorValueField(fieldName)) return "required";
  if (fieldName.endsWith("role") || fieldName.endsWith("attribute") || isLocatorConstraintField(fieldName)) {
    return "optional";
  }
  if (
    fieldName.includes("Timeout") ||
    fieldName.includes("Delay") ||
    fieldName.includes("Wait") ||
    fieldName === "Iframe XPath" ||
    fieldName === "Username" ||
    fieldName === "Password" ||
    fieldName === "Accuracy" ||
    fieldName === "Block" ||
    fieldName === "Inline" ||
    fieldName === "Offset X / Offset Y"
  ) {
    return "advanced";
  }
  if (
    fieldName === "Reason" ||
    fieldName === "Prompt text" ||
    fieldName === "Screenshot path" ||
    fieldName === "Path" ||
    fieldName === "Output name" ||
    fieldName === "Full page" ||
    fieldName === "Scroll into view" ||
    fieldName === "Position" ||
    fieldName === "Button" ||
    fieldName === "Click count" ||
    fieldName === "Method" ||
    fieldName === "Clear before input" ||
    fieldName === "Typing mode" ||
    fieldName === "Items source" ||
    fieldName === "Array variable"
  ) {
    return "optional";
  }
  if (actionType === "wait" && ["Duration ms", "XPath", "Text", "URL contains"].includes(fieldName)) {
    return "optional";
  }
  return "required";
}

function fieldValueGuidance(
  actionType: ActionType,
  language: StepHelpLanguage,
  fieldName: string,
) {
  const vi = language === "vi";
  const details = fieldDetails(actionType, language, fieldName);
  if (fieldName === "No fields") return undefined;
  if (
    fieldName === "Target source" ||
    fieldName === "Source selection" ||
    fieldName === "Drop target source" ||
    fieldName === "Trigger source"
  ) {
    return vi
      ? "Dùng locator cho target tĩnh; dùng Find Element ref khi cần chọn một element đã được lọc/rank theo viewport hoặc danh sách động."
      : "Use locator for static targets; use Find Element ref when the target was filtered/ranked by viewport or a dynamic list.";
  }
  if (
    fieldName === "Target ref" ||
    fieldName === "Source ref" ||
    fieldName === "Drop target ref" ||
    fieldName === "Trigger ref"
  ) {
    return vi
      ? "Nhập chính xác Output name của Find Element, ví dụ current_card."
      : "Enter the exact Find Element Output name, for example current_card.";
  }
  if (isLocatorTypeField(fieldName)) {
    return vi
      ? "Mặc định là XPath; đổi sang Test ID, Role, Label, hoặc Placeholder khi trang có selector ổn định hơn."
      : "Defaults to XPath; switch to Test ID, Role, Label, or Placeholder when the page exposes a more stable selector.";
  }
  if (isLocatorValueField(fieldName)) {
    return vi
      ? "Nhập đúng giá trị cho locator type đã chọn; để trống sẽ xóa structured target hiện tại."
      : "Enter the value for the selected locator kind; leaving it blank clears the current structured target.";
  }
  if (fieldName.endsWith("visibility") || fieldName.endsWith("enabled")) {
    return vi
      ? "Giữ Any nếu không cần lọc; chọn trạng thái cụ thể khi có nhiều element giống nhau."
      : "Keep Any unless the state matters; choose a specific state when several similar elements match.";
  }
  if (fieldName.endsWith("contains text")) {
    return vi
      ? "Nhập đoạn text ngắn ổn định bên trong element cần phân biệt."
      : "Enter a short stable text fragment inside the element you need to distinguish.";
  }
  if (fieldName.endsWith("index")) {
    return vi
      ? "Nhập số bắt đầu từ 0, chỉ dùng khi locator cố ý khớp nhiều element."
      : "Enter a zero-based number, only when the locator intentionally matches multiple elements.";
  }
  if (fieldName.includes("XPath")) {
    return vi
      ? "Copy XPath ổn định của element thật; nếu ở iframe, dùng thêm Iframe XPath."
      : "Copy a stable XPath for the real element; add Iframe XPath when the target is inside a frame.";
  }
  if (fieldName.includes("Timeout") || fieldName.includes("Delay") || fieldName.includes("Wait")) {
    return vi
      ? "Nhập mili-giây, ví dụ 1000 = 1 giây. Tăng vừa đủ theo trang thật."
      : "Enter milliseconds, for example 1000 = 1 second. Increase only as much as the page needs.";
  }
  if (fieldName === "URL" || fieldName === "Origin" || fieldName === "Server") {
    return vi
      ? "Dùng URL đầy đủ hoặc origin/server đúng định dạng, không thêm khoảng trắng."
      : "Use a full URL or correctly formatted origin/server without extra spaces.";
  }
  if (fieldName === "Output name" || fieldName === "Name" || fieldName === "Key") {
    return vi
      ? "Dùng tên ổn định, ngắn, dễ đọc lại trong template hoặc node logic."
      : "Use a stable, short name that is easy to read in templates or logic nodes.";
  }
  if (fieldName === "JSON variables") {
    return vi
      ? "Nhập JSON object hợp lệ; object lồng nhau được lưu thành dot path."
      : "Enter a valid JSON object; nested objects are stored as dot paths.";
  }
  return details[0] ?? (vi
    ? `${fieldName} nên khớp đúng ý nghĩa field trong form ${actionLabels[actionType]}.`
    : `${fieldName} should match the field's meaning in the ${actionLabels[actionType]} form.`);
}

function fieldExample(
  actionType: ActionType,
  language: StepHelpLanguage,
  fieldName: string,
) {
  const vi = language === "vi";
  if (
    fieldName === "Target source" ||
    fieldName === "Source selection" ||
    fieldName === "Drop target source" ||
    fieldName === "Trigger source"
  ) {
    return "Use locator";
  }
  if (fieldName === "Target ref" || fieldName === "Source ref") return "current_card";
  if (fieldName === "Trigger ref") return "current_dropdown";
  if (fieldName === "Drop target ref") return "current_lane";
  if (actionType === "drag_and_drop" && fieldName === "Destination position") {
    return "Percent inside target";
  }
  if (actionType === "drag_and_drop" && fieldName === "X percent") return "82";
  if (actionType === "drag_and_drop" && fieldName === "Y percent") return "50";
  if (actionType === "drag_and_drop" && fieldName === "X offset px") return "180";
  if (actionType === "drag_and_drop" && fieldName === "Y offset px") return "12";
  if (isLocatorTypeField(fieldName)) return "XPath";
  if (isLocatorValueField(fieldName)) return "//*[@id='submit']";
  if (fieldName.endsWith("visibility")) return "Visible";
  if (fieldName.endsWith("enabled")) return "Enabled";
  if (fieldName.endsWith("contains text")) return vi ? "Đăng nhập" : "Sign in";
  if (fieldName.endsWith("index")) return "0";
  if (fieldName.includes("XPath")) return "//*[@data-testid='submit']";
  if (actionType === "scroll" && fieldName.includes("Timeout")) {
    return vi ? "60000 nghĩa là 1 phút." : "60000 means 1 minute.";
  }
  if (fieldName.includes("Timeout")) return vi ? "5000 nghĩa là 5 giây." : "5000 means 5 seconds.";
  if (fieldName.includes("Delay") || fieldName.includes("Wait")) return "100";
  if (fieldName === "URL") return "https://example.com/login";
  if (fieldName === "Text") return vi ? "Nguyen Van A" : "Jane Smith";
  if (fieldName === "Key") return "Enter";
  if (fieldName === "Keys") return "Control+S";
  if (fieldName === "Value") return "premium";
  if (fieldName === "Condition" && actionType === "wait") return "Element visible";
  return undefined;
}

function fieldMistakes(
  actionType: ActionType,
  language: StepHelpLanguage,
  fieldName: string,
) {
  const vi = language === "vi";
  const mistakes = fieldDetails(actionType, language, fieldName).slice(0, 2);
  if (isLocatorValueField(fieldName)) {
    return [
      vi
        ? "Nhập giá trị không khớp với locator type, ví dụ dán CSS selector khi đang chọn Test ID."
        : "Entering a value that does not match the locator type, such as a CSS selector while Test ID is selected.",
      ...mistakes,
    ];
  }
  if (fieldName.includes("XPath")) {
    return [
      vi
        ? "Copy XPath của wrapper quá rộng thay vì element thật cần thao tác."
        : "Copying a broad wrapper XPath instead of the real target element.",
      ...mistakes,
    ];
  }
  if (fieldName.includes("Timeout")) {
    return [
      vi
        ? "Tăng timeout để che lỗi XPath sai; hãy kiểm tra target trước."
        : "Increasing timeout to hide a wrong XPath; check the target first.",
      ...mistakes,
    ];
  }
  return mistakes;
}
