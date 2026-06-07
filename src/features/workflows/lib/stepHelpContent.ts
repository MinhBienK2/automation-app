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
const graphInternalActionTypes = [
  "graph_noop",
  "switch_condition",
  "router_condition",
  "while_loop",
  "repeat_until",
  "try_catch",
  "fallback_block",
  "break_loop",
  "continue_loop",
  "transform_variable",
  "assert_output",
  "domain_allowlist",
] as const satisfies readonly ActionType[];
type GraphInternalActionType = (typeof graphInternalActionTypes)[number];
type PhaseOneActionType =
  | "double_click"
  | "right_click"
  | "drag_and_drop"
  | "focus_element"
  | "blur_element"
  | "type_sequence"
  | "set_clipboard"
  | "paste_clipboard"
  | "check"
  | "uncheck"
  | "toggle_checkbox"
  | "select_radio"
  | "upload_file"
  | "submit_form"
  | "select_custom_option"
  | "set_contenteditable"
  | "extract_text"
  | "extract_attribute"
  | "extract_input_value"
  | "extract_table"
  | "extract_list"
  | "take_screenshot"
  | "go_back"
  | "go_forward"
  | "reload"
  | "open_new_tab"
  | "switch_tab"
  | "close_tab"
  | "accept_dialog"
  | "dismiss_dialog"
  | "wait_for_download"
  | "set_variable"
  | "set_json_variables"
  | "assert_element"
  | "assert_text"
  | "graph_noop"
  | "if_condition"
  | "router_condition"
  | "random_choice"
  | "repeat_times"
  | "repeat_for_each"
  | "retry_block"
  | "stop_workflow"
  | "set_cookie"
  | "clear_cookies"
  | "set_viewport"
  | "set_geolocation"
  | "set_extra_headers"
  | "grant_permission"
  | "execute_js"
  | "wait_for_request"
  | "wait_for_response"
  | "block_request"
  | "mock_response"
  | "set_local_storage"
  | "set_session_storage";

const xpathField = {
  vi: "XPath chọn element cần thao tác. Nếu element nằm trong iframe, XPath này là XPath bên trong iframe.",
  en: "XPath selects the element to act on. If the element is inside an iframe, this XPath is evaluated inside that iframe.",
};

const iframeField = {
  vi: "Iframe XPath là XPath của thẻ iframe trên trang cha. Chỉ nhập khi element nằm bên trong iframe.",
  en: "Iframe XPath selects the iframe element on the parent page. Only use it when the target element is inside an iframe.",
};

const waitUntilField = {
  vi: "Wait until quyết định app đợi element đạt trạng thái nào trước khi thao tác: attached, visible, enabled, hoặc clickable.",
  en: "Wait until controls which element state the app waits for before acting: attached, visible, enabled, or clickable.",
};

const timeoutField = {
  vi: "Timeout ms là thời gian tối đa app chờ trước khi báo lỗi. 5000 nghĩa là 5 giây.",
  en: "Timeout ms is the maximum time to wait before failing. 5000 means 5 seconds.",
};

const scrollTimeoutField = {
  vi: "Timeout ms là thời gian tối đa để chờ/scroll tới target. Các mode target scroll mặc định 60000 ms, tức 1 phút.",
  en: "Timeout ms is the maximum time to wait/scroll to the target. Target scroll modes default to 60000 ms, or 1 minute.",
};

const baseStepHelpContent: Record<
  Exclude<ActionType, PhaseOneActionType | GraphInternalActionType>,
  BilingualStepHelp
> = {
  navigate: {
    vi: {
      title: "Trợ giúp Navigate",
      summary: "Mở một URL và chờ trang tải theo điều kiện bạn chọn.",
      useWhen: ["Dùng ở đầu workflow để đi tới trang cần tự động hóa.", "Dùng khi click trước đó chuyển sang trang mới và bạn muốn điều hướng trực tiếp."],
      fields: [
        { name: "URL", description: "Địa chỉ trang web đầy đủ, nên có https:// hoặc http://." },
        { name: "Wait until", description: "Load chờ tải cơ bản; DOMContentLoaded chờ HTML sẵn sàng; Network idle chờ mạng yên hơn." },
        { name: "Timeout ms", description: timeoutField.vi },
      ],
      examples: ["URL: https://example.com/login", "Wait until: Load, Timeout ms: 30000"],
      commonMistakes: ["Thiếu https:// ở đầu URL.", "Chọn Network idle cho trang có request chạy liên tục có thể làm step chờ lâu."],
    },
    en: {
      title: "Navigate Help",
      summary: "Open a URL and wait for the page using the selected load condition.",
      useWhen: ["Use at the start of a workflow to open the page you want to automate.", "Use when direct navigation is more reliable than clicking through."],
      fields: [
        { name: "URL", description: "The full page address, usually starting with https:// or http://." },
        { name: "Wait until", description: "Load waits for normal loading; DOMContentLoaded waits for HTML; Network idle waits for network activity to quiet down." },
        { name: "Timeout ms", description: timeoutField.en },
      ],
      examples: ["URL: https://example.com/login", "Wait until: Load, Timeout ms: 30000"],
      commonMistakes: ["Missing https:// at the start of the URL.", "Network idle can wait too long on pages that keep background requests open."],
    },
  },
  wait: {
    vi: {
      title: "Trợ giúp Wait",
      summary: "Chờ một điều kiện xảy ra trước khi chạy step tiếp theo.",
      useWhen: ["Dùng khi bạn biết chính xác cần chờ gì trước khi chạy step tiếp theo.", "Dùng để chờ element hiện, biến mất, URL đổi, text xuất hiện, hoặc trang tải."],
      fields: [
        { name: "Condition", description: "Điều kiện cần chờ: thời gian, element, text, URL, hoặc page load." },
        { name: "Duration ms", description: "Số mili-giây cần chờ khi Condition là Duration." },
        { name: "XPath", description: "XPath của element cần kiểm tra khi Condition là element_*." },
        { name: "Text", description: "Đoạn chữ cần thấy trên trang khi Condition là Text visible." },
        { name: "URL contains", description: "Đoạn URL cần xuất hiện khi Condition là URL contains." },
        { name: "Timeout ms", description: timeoutField.vi },
      ],
      examples: ["Condition: Element visible, XPath: //*[@id='result']", "Condition: URL contains, URL contains: /dashboard"],
      commonMistakes: ["Dùng Duration cố định trong khi Wait element visible sẽ ổn định hơn.", "XPath phải trỏ đúng element cần kiểm tra."],
    },
    en: {
      title: "Wait Help",
      summary: "Wait for a condition before running the next step.",
      useWhen: ["Use when you know what must happen before the next step runs.", "Use to wait for elements, text, URL changes, or page load."],
      fields: [
        { name: "Condition", description: "The condition to wait for: time, element state, text, URL, or page load." },
        { name: "Duration ms", description: "Milliseconds to wait when Condition is Duration." },
        { name: "XPath", description: "XPath of the element to check when Condition is element_*." },
        { name: "Text", description: "Text that must appear when Condition is Text visible." },
        { name: "URL contains", description: "URL fragment that must appear when Condition is URL contains." },
        { name: "Timeout ms", description: timeoutField.en },
      ],
      examples: ["Condition: Element visible, XPath: //*[@id='result']", "Condition: URL contains, URL contains: /dashboard"],
      commonMistakes: ["Using fixed Duration when Wait element visible would be more stable.", "XPath must point to the element being checked."],
    },
  },
  random_wait: {
    vi: {
      title: "Trợ giúp Random Wait",
      summary: "Chờ một khoảng thời gian ngẫu nhiên trong ngưỡng min/max trước khi chạy step tiếp theo.",
      useWhen: ["Dùng khi cần nhịp chạy tự nhiên hơn giữa các thao tác.", "Dùng thay cho Wait duration cố định khi muốn mỗi lần chạy có độ trễ khác nhau."],
      fields: [
        { name: "Minimum wait ms", description: "Ngưỡng thấp nhất, tính bằng mili-giây." },
        { name: "Maximum wait ms", description: "Ngưỡng cao nhất, tính bằng mili-giây; phải lớn hơn hoặc bằng Minimum wait ms." },
      ],
      examples: ["Minimum wait ms: 500, Maximum wait ms: 1500"],
      commonMistakes: ["Đặt maximum nhỏ hơn minimum.", "Dùng random wait để che lỗi timing thay vì chờ điều kiện cụ thể khi có thể dùng Wait element/text/URL."],
    },
    en: {
      title: "Random Wait Help",
      summary: "Wait for a random duration inside a configured min/max range before running the next step.",
      useWhen: ["Use when a workflow needs a less mechanical rhythm between actions.", "Use instead of a fixed duration wait when each run should vary the pause."],
      fields: [
        { name: "Minimum wait ms", description: "The shortest allowed pause, in milliseconds." },
        { name: "Maximum wait ms", description: "The longest allowed pause, in milliseconds; must be greater than or equal to Minimum wait ms." },
      ],
      examples: ["Minimum wait ms: 500, Maximum wait ms: 1500"],
      commonMistakes: ["Setting the maximum lower than the minimum.", "Using random wait to mask a timing bug when a condition-based Wait would be more reliable."],
    },
  },
  input_text: {
    vi: {
      title: "Trợ giúp Fill Field",
      summary: "Nhập text vào input, textarea, hoặc element có thể nhập liệu.",
      useWhen: ["Dùng cho form đăng nhập, search box, textarea, hoặc field cần nhập dữ liệu.", "Dùng khi cần hỗ trợ iframe, wait nâng cao, hoặc nhập giống người dùng hơn."],
      fields: [
        { name: "XPath", description: xpathField.vi },
        { name: "Text", description: "Nội dung cần nhập vào field." },
        { name: "Clear before input", description: "Yes sẽ xóa nội dung cũ trước khi nhập." },
        { name: "Typing mode", description: "Set value đặt giá trị nhanh; Type keys gõ từng phím giống người dùng hơn." },
        { name: "Iframe XPath", description: iframeField.vi },
        { name: "Delay ms", description: "Độ trễ giữa các phím khi dùng Type keys." },
        { name: "Wait until", description: waitUntilField.vi },
        { name: "Timeout ms", description: timeoutField.vi },
      ],
      examples: ["XPath: //*[@name='email']", "Iframe XPath: //*[@id='login-frame'], XPath: //*[@name='email']"],
      commonMistakes: ["XPath trỏ vào label hoặc div bọc ngoài thay vì input thật.", "Element trong iframe cần nhập cả Iframe XPath."],
    },
    en: {
      title: "Fill Field Help",
      summary: "Enter text into an input, textarea, or editable element.",
      useWhen: ["Use for login forms, search boxes, textareas, or fields that need text.", "Use when you need iframe support, advanced waiting, or more user-like typing."],
      fields: [
        { name: "XPath", description: xpathField.en },
        { name: "Text", description: "The text to enter into the field." },
        { name: "Clear before input", description: "Yes clears the old value before entering text." },
        { name: "Typing mode", description: "Set value is fast; Type keys behaves more like real keyboard input." },
        { name: "Iframe XPath", description: iframeField.en },
        { name: "Delay ms", description: "Delay between keystrokes when using Type keys." },
        { name: "Wait until", description: waitUntilField.en },
        { name: "Timeout ms", description: timeoutField.en },
      ],
      examples: ["XPath: //*[@name='email']", "Iframe XPath: //*[@id='login-frame'], XPath: //*[@name='email']"],
      commonMistakes: ["XPath points to a label or wrapper div instead of the real input.", "Elements inside iframes need Iframe XPath too."],
    },
  },
  clear_input: {
    vi: {
      title: "Trợ giúp Clear Input",
      summary: "Xóa nội dung trong một field nhập liệu.",
      useWhen: ["Dùng trước khi nhập lại text nếu field có sẵn giá trị.", "Dùng để reset search box hoặc textarea."],
      fields: [
        { name: "XPath", description: xpathField.vi },
        { name: "Iframe XPath", description: iframeField.vi },
        { name: "Wait until", description: waitUntilField.vi },
        { name: "Timeout ms", description: timeoutField.vi },
        { name: "Method", description: "Select all dùng Ctrl/Cmd+A; Backspace xóa bằng phím; DOM value đặt giá trị rỗng trực tiếp." },
      ],
      examples: ["XPath: //*[@name='email'], Method: Select all"],
      commonMistakes: ["XPath phải trỏ tới field nhập liệu, không phải text hiển thị."],
    },
    en: {
      title: "Clear Input Help",
      summary: "Clear the value from an input field.",
      useWhen: ["Use before entering new text when the field already has a value.", "Use to reset a search box or textarea."],
      fields: [
        { name: "XPath", description: xpathField.en },
        { name: "Iframe XPath", description: iframeField.en },
        { name: "Wait until", description: waitUntilField.en },
        { name: "Timeout ms", description: timeoutField.en },
        { name: "Method", description: "Select all uses Ctrl/Cmd+A; Backspace deletes with keys; DOM value directly sets an empty value." },
      ],
      examples: ["XPath: //*[@name='email'], Method: Select all"],
      commonMistakes: ["XPath must point to an editable field, not visible text."],
    },
  },
  click: {
    vi: {
      title: "Trợ giúp Click",
      summary: "Click vào một element như button, link, checkbox giả lập, hoặc menu.",
      useWhen: ["Dùng để bấm nút Submit, mở dropdown, chọn tab, hoặc click link.", "Dùng Real click khi muốn giống hành vi người dùng nhất."],
      fields: [
        { name: "Target source", description: "Use locator hiện field locator trực tiếp; Use Find Element ref chỉ dùng Target ref từ node Find Element trước đó." },
        { name: "Target ref", description: "Tên output của Find Element, ví dụ current_like. Khi có Target ref, action bỏ qua locator fields." },
        { name: "XPath", description: xpathField.vi },
        { name: "Mode", description: "Real click dùng chuột thật của browser; Force DOM click gọi click() trực tiếp khi element khó nhận chuột." },
        { name: "Click count", description: "Single click hoặc double click." },
        { name: "Button", description: "Nút chuột trái, phải, hoặc giữa." },
        { name: "Iframe XPath", description: iframeField.vi },
        { name: "Scroll into view", description: "Yes sẽ đưa element vào vùng nhìn thấy trước khi click." },
        { name: "Block / Inline", description: "Vị trí căn element khi scroll into view." },
        { name: "Position", description: "Điểm click trên element. Offset cho phép nhập tọa độ X/Y." },
        { name: "Offset X / Offset Y", description: "Tọa độ click tính từ góc trên trái element khi Position là Offset." },
        { name: "Wait until", description: waitUntilField.vi },
        { name: "Timeout ms", description: timeoutField.vi },
      ],
      examples: ["Target source: Use locator, XPath: //*[@type='submit']", "Target source: Use Find Element ref, Target ref: current_like"],
      commonMistakes: ["XPath trỏ vào text bên trong button thay vì button có thể click.", "Đã chọn Target ref thì Target visibility/contains/index của locator không còn tác dụng."],
    },
    en: {
      title: "Click Help",
      summary: "Click an element such as a button, link, custom checkbox, or menu.",
      useWhen: ["Use to press Submit, open dropdowns, select tabs, or click links.", "Use Real click when you want browser-like user behavior."],
      fields: [
        { name: "Target source", description: "Use locator shows direct locator fields; Use Find Element ref uses only Target ref from a previous Find Element node." },
        { name: "Target ref", description: "Find Element output name, for example current_like. When Target ref is set, the action ignores locator fields." },
        { name: "XPath", description: xpathField.en },
        { name: "Mode", description: "Real click uses browser mouse events; Force DOM click calls click() directly when mouse interaction is difficult." },
        { name: "Click count", description: "Single click or double click." },
        { name: "Button", description: "Left, right, or middle mouse button." },
        { name: "Iframe XPath", description: iframeField.en },
        { name: "Scroll into view", description: "Yes brings the element into view before clicking." },
        { name: "Block / Inline", description: "Controls alignment when scrolling into view." },
        { name: "Position", description: "Where to click on the element. Offset lets you enter X/Y coordinates." },
        { name: "Offset X / Offset Y", description: "Click coordinates from the element's top-left corner when Position is Offset." },
        { name: "Wait until", description: waitUntilField.en },
        { name: "Timeout ms", description: timeoutField.en },
      ],
      examples: ["Target source: Use locator, XPath: //*[@type='submit']", "Target source: Use Find Element ref, Target ref: current_like"],
      commonMistakes: ["XPath points to text inside a button instead of the clickable button.", "When Target ref is selected, locator visibility/contains/index fields no longer apply."],
    },
  },
  find_element: {
    vi: {
      title: "Trợ giúp Find Element",
      summary: "Tìm một element khớp locator, lọc/rank theo viewport, rồi lưu ref ngắn hạn cho step sau như Click.",
      useWhen: ["Dùng khi nhiều nút giống nhau tồn tại trong DOM nhưng bạn muốn chọn nút đang nằm trong màn hình.", "Dùng trước Click với Target ref để tách logic chọn element khỏi logic click."],
      fields: [
        { name: "Target locator", description: "Locator thật của các element ứng viên, ví dụ button Like trong mọi article." },
        { name: "Output name", description: "Tên ref runtime để step sau dùng qua Target ref." },
        { name: "In viewport", description: "Required chỉ chọn element đang giao với viewport hiện tại." },
        { name: "Rank", description: "Nearest viewport center chọn ứng viên gần tâm màn hình nhất; Largest visible area chọn ứng viên đang lộ nhiều nhất." },
      ],
      examples: ["Target locator: article button[aria-label^='Like video'][aria-pressed='false']", "Output name: current_like, Rank: Nearest viewport center"],
      commonMistakes: ["Dùng Target index thay vì Rank khi feed scroll/virtualize có thể click sai bài.", "Để In viewport off sẽ quay lại hành vi chọn phần tử đầu DOM."],
    },
    en: {
      title: "Find Element Help",
      summary: "Resolve a matching element, filter/rank it by viewport, and store a short-lived ref for a later step such as Click.",
      useWhen: ["Use when many similar buttons exist in the DOM but you need the one currently in view.", "Use before Click with Target ref to separate element selection from clicking."],
      fields: [
        { name: "Target locator", description: "The real locator for candidate elements, such as all Like buttons inside articles." },
        { name: "Output name", description: "Runtime ref name that the next step can use through Target ref." },
        { name: "In viewport", description: "Required only selects elements intersecting the current viewport." },
        { name: "Rank", description: "Nearest viewport center chooses the candidate closest to screen center; Largest visible area chooses the most exposed candidate." },
      ],
      examples: ["Target locator: article button[aria-label^='Like video'][aria-pressed='false']", "Output name: current_like, Rank: Nearest viewport center"],
      commonMistakes: ["Using Target index instead of Rank can click the wrong post on scrolling or virtualized feeds.", "Turning In viewport off returns to first-DOM-match behavior."],
    },
  },
  scroll: {
    vi: {
      title: "Trợ giúp Scroll",
      summary: "Cuộn trang theo pixel, đưa element có sẵn vào vùng nhìn thấy, hoặc cuộn để tìm element lazy-load.",
      useWhen: ["Dùng Page Scroll khi cần cuộn một lượng pixel cố định.", "Dùng Scroll To Element khi element đã có trên trang nhưng nằm ngoài màn hình.", "Dùng Scroll Until Element Visible khi cần cuộn trang để lazy-load tạo element."],
      fields: [
        { name: "Mode", description: "Page Scroll và các mode target dùng gesture gồm nhiều wheel pulse nhỏ, pause ngắn trong gesture và pause random dài hơn giữa các gesture." },
        { name: "Scroll style", description: "Human-like chia Page Scroll thành nhiều pulse/pause; Smooth single wheel gửi một wheel gesture đúng số pixel." },
        { name: "Direction", description: "Hướng cuộn Page Scroll hoặc hướng tìm kiếm của Scroll Until Element Visible: down, up, right, hoặc left." },
        { name: "Pixels", description: "Số pixel cho Page Scroll hoặc mỗi lần cuộn tìm kiếm. Thử 250-800 tùy trang." },
        { name: "Target locator", description: "Element đích cho Scroll To Element hoặc Scroll Until Element Visible." },
        { name: "Iframe XPath", description: "Chọn iframe trên trang cha nếu target nằm trong iframe legacy XPath." },
        { name: "Timeout ms", description: scrollTimeoutField.vi },
      ],
      examples: ["Mode: Page Scroll, Direction: Down, Pixels: 500", "Mode: Scroll To Element, Iframe XPath: //*[@id='main-frame'], Target locator: //h2[normalize-space(.)='Ready']", "Mode: Scroll Until Element Visible, Direction: Down, Pixels: 700, Target locator: lazy card"],
      commonMistakes: ["Nếu element nằm trong iframe, cần Iframe XPath của iframe và target bên trong iframe.", "Scroll To Element cần target đã tồn tại trong DOM; dùng Scroll Until Element Visible cho lazy-load.", "Target scroll tự tính chunk/pause human-like; không cần cấu hình step/pause thủ công."],
    },
    en: {
      title: "Scroll Help",
      summary: "Scroll the page by pixels, bring an existing element into view, or scroll to find a lazy-loaded element.",
      useWhen: ["Use Page Scroll for a fixed pixel-distance scroll.", "Use Scroll To Element when the element is already on the page but outside the viewport.", "Use Scroll Until Element Visible when page scrolling must trigger lazy-load DOM mounting."],
      fields: [
        { name: "Mode", description: "Page Scroll and target modes use gestures made of smaller wheel pulses, short pauses inside each gesture, and longer random pauses between gestures." },
        { name: "Scroll style", description: "Human-like splits Page Scroll into several pulses and pauses; Smooth single wheel sends one wheel gesture for the exact pixel distance." },
        { name: "Direction", description: "Page Scroll direction or Scroll Until Element Visible search direction: down, up, right, or left." },
        { name: "Pixels", description: "Pixel distance for Page Scroll or each search scroll. Try 250-800 depending on the page." },
        { name: "Target locator", description: "Target element for Scroll To Element or Scroll Until Element Visible." },
        { name: "Iframe XPath", description: "Selects the parent-page iframe when the target uses a legacy XPath inside a frame." },
        { name: "Timeout ms", description: scrollTimeoutField.en },
      ],
      examples: ["Mode: Page Scroll, Direction: Down, Pixels: 500", "Mode: Scroll To Element, Iframe XPath: //*[@id='main-frame'], Target locator: //h2[normalize-space(.)='Ready']", "Mode: Scroll Until Element Visible, Direction: Down, Pixels: 700, Target locator: lazy card"],
      commonMistakes: ["If the element is inside an iframe, set Iframe XPath for the iframe and the target locator inside that iframe.", "Scroll To Element needs the target to already exist in the DOM; use Scroll Until Element Visible for lazy-load pages.", "Target scroll calculates human-like chunks and pauses automatically."],
    },
  },
  select_option: {
    vi: {
      title: "Trợ giúp Select Option",
      summary: "Chọn một option trong thẻ select/dropdown HTML.",
      useWhen: ["Dùng cho dropdown native như country, category, status.", "Không dùng cho dropdown custom bằng div; trường hợp đó thường cần Click."],
      fields: [
        { name: "XPath", description: "XPath của thẻ select, không phải option." },
        { name: "Match by", description: "Label chọn theo chữ hiển thị; Value chọn theo thuộc tính value." },
        { name: "Value", description: "Nhãn hoặc value của option cần chọn, tùy Match by." },
        { name: "Iframe XPath", description: iframeField.vi },
        { name: "Wait until", description: waitUntilField.vi },
        { name: "Timeout ms", description: timeoutField.vi },
      ],
      examples: ["XPath: //*[@name='country'], Match by: Label, Value: Vietnam"],
      commonMistakes: ["XPath trỏ vào option thay vì select.", "Dropdown custom không phải thẻ select sẽ không dùng được step này."],
    },
    en: {
      title: "Select Option Help",
      summary: "Select an option from a native HTML select dropdown.",
      useWhen: ["Use for native dropdowns such as country, category, or status.", "Do not use for custom div dropdowns; those usually need Click steps."],
      fields: [
        { name: "XPath", description: "XPath of the select element, not the option." },
        { name: "Match by", description: "Label matches visible text; Value matches the option value attribute." },
        { name: "Value", description: "The label or value to select, depending on Match by." },
        { name: "Iframe XPath", description: iframeField.en },
        { name: "Wait until", description: waitUntilField.en },
        { name: "Timeout ms", description: timeoutField.en },
      ],
      examples: ["XPath: //*[@name='country'], Match by: Label, Value: Vietnam"],
      commonMistakes: ["XPath points to an option instead of the select.", "Custom dropdowns that are not select elements need a different step."],
    },
  },
  press_key: {
    vi: {
      title: "Trợ giúp Press Key",
      summary: "Bấm một phím đơn trên keyboard.",
      useWhen: ["Dùng để bấm Enter, Tab, Escape, ArrowDown sau một step khác.", "Dùng khi website phản ứng với phím thay vì click."],
      fields: [{ name: "Key", description: "Tên phím cần bấm, ví dụ Enter, Tab, Escape, ArrowDown." }],
      examples: ["Key: Enter", "Key: Escape"],
      commonMistakes: ["Step này bấm một phím; tổ hợp phím như Control+S nên dùng Hotkey."],
    },
    en: {
      title: "Press Key Help",
      summary: "Press one keyboard key.",
      useWhen: ["Use for Enter, Tab, Escape, or ArrowDown after another step.", "Use when the website reacts to keyboard input instead of clicks."],
      fields: [{ name: "Key", description: "The key name to press, for example Enter, Tab, Escape, ArrowDown." }],
      examples: ["Key: Enter", "Key: Escape"],
      commonMistakes: ["This presses one key; combinations like Control+S should use Hotkey."],
    },
  },
  hotkey: {
    vi: {
      title: "Trợ giúp Hotkey",
      summary: "Bấm một tổ hợp phím.",
      useWhen: ["Dùng cho Ctrl+S, Ctrl+A, Cmd+K, Alt+Enter.", "Dùng khi app web có shortcut keyboard."],
      fields: [{ name: "Keys", description: "Nhập các phím cách nhau bằng dấu +, ví dụ Control+S hoặc Meta+K." }],
      examples: ["Keys: Control+S", "Keys: Meta+K"],
      commonMistakes: ["Trên macOS, phím Command thường là Meta.", "Không thêm khoảng trắng thừa nếu không cần."],
    },
    en: {
      title: "Hotkey Help",
      summary: "Press a keyboard shortcut.",
      useWhen: ["Use for Ctrl+S, Ctrl+A, Cmd+K, Alt+Enter.", "Use when the web app has keyboard shortcuts."],
      fields: [{ name: "Keys", description: "Enter keys separated by +, for example Control+S or Meta+K." }],
      examples: ["Keys: Control+S", "Keys: Meta+K"],
      commonMistakes: ["On macOS, Command is usually Meta.", "Avoid unnecessary extra spaces."],
    },
  },
  hover: {
    vi: {
      title: "Trợ giúp Hover",
      summary: "Di chuột lên một element.",
      useWhen: ["Dùng để mở menu hover, tooltip, hoặc reveal button ẩn.", "Dùng trước Click nếu button chỉ hiện sau khi hover."],
      fields: [
        { name: "XPath", description: xpathField.vi },
        { name: "Iframe XPath", description: iframeField.vi },
        { name: "Wait until", description: waitUntilField.vi },
        { name: "Timeout ms", description: timeoutField.vi },
      ],
      examples: ["XPath: //*[@aria-label='User menu']"],
      commonMistakes: ["Hover chỉ di chuột, không click.", "Nếu menu mở bằng click, dùng Click thay vì Hover."],
    },
    en: {
      title: "Hover Help",
      summary: "Move the mouse over an element.",
      useWhen: ["Use to open hover menus, tooltips, or reveal hidden buttons.", "Use before Click when a button only appears after hover."],
      fields: [
        { name: "XPath", description: xpathField.en },
        { name: "Iframe XPath", description: iframeField.en },
        { name: "Wait until", description: waitUntilField.en },
        { name: "Timeout ms", description: timeoutField.en },
      ],
      examples: ["XPath: //*[@aria-label='User menu']"],
      commonMistakes: ["Hover only moves the mouse; it does not click.", "If a menu opens by click, use Click instead of Hover."],
    },
  },
};

const phaseOneStepHelpContent: Record<PhaseOneActionType, BilingualStepHelp> = {
  double_click: elementHelp("Double Click", "double click", "click hai lần", "double-click"),
  right_click: elementHelp("Right Click", "right click", "click chuột phải", "context menu"),
  focus_element: elementHelp("Focus Element", "focus", "focus vào element", "keyboard input"),
  blur_element: elementHelp("Blur Element", "blur", "bỏ focus khỏi element", "validation"),
  paste_clipboard: elementHelp("Paste Into Field", "paste clipboard text into a field", "dán clipboard vào field", "paste"),
  check: elementHelp("Check", "ensure a checkbox is checked", "bật checkbox", "checkbox"),
  uncheck: elementHelp("Uncheck", "ensure a checkbox is unchecked", "tắt checkbox", "checkbox"),
  toggle_checkbox: elementHelp("Toggle Checkbox", "toggle a checkbox", "đảo trạng thái checkbox", "checkbox"),
  select_radio: elementHelp("Select Radio", "select a radio option", "chọn radio", "radio"),
  upload_file: elementHelp("Upload File", "upload local files", "upload file", "file"),
  submit_form: elementHelp("Submit Form", "submit a form", "submit form", "submit"),
  select_custom_option: elementHelp(
    "Select Custom Option",
    "select a custom dropdown option",
    "chọn option trong custom dropdown",
    "combobox",
  ),
  set_contenteditable: elementHelp(
    "Set Contenteditable",
    "set rich text content",
    "nhập nội dung contenteditable",
    "editor",
  ),
  extract_text: elementHelp("Extract Text", "capture visible text", "lấy text", "output"),
  extract_attribute: elementHelp(
    "Extract Attribute",
    "capture an element attribute",
    "lấy attribute",
    "output",
  ),
  extract_input_value: elementHelp(
    "Extract Input Value",
    "capture an input value",
    "lấy giá trị input",
    "output",
  ),
  extract_table: elementHelp("Extract Table", "capture table rows", "lấy bảng", "output"),
  extract_list: elementHelp("Extract List", "capture list items", "lấy danh sách", "output"),
  go_back: elementHelp("Go Back", "go back in browser history", "quay lại trang trước", "history"),
  go_forward: elementHelp("Go Forward", "go forward in browser history", "đi tới trang sau", "history"),
  reload: elementHelp("Reload", "reload the current tab", "tải lại tab hiện tại", "browser"),
  open_new_tab: elementHelp("Open New Tab", "open a new browser tab", "mở tab mới", "tab"),
  switch_tab: elementHelp("Switch Tab", "switch to another browser tab", "chuyển tab", "tab"),
  close_tab: elementHelp("Close Tab", "close a browser tab", "đóng tab", "tab"),
  accept_dialog: elementHelp("Accept Dialog", "accept an alert, confirm, or prompt", "đồng ý dialog", "dialog"),
  dismiss_dialog: elementHelp("Dismiss Dialog", "dismiss an alert, confirm, or prompt", "hủy dialog", "dialog"),
  wait_for_download: elementHelp(
    "Wait For Download",
    "wait until a new downloaded file exists",
    "chờ file tải xong",
    "download",
  ),
  set_variable: elementHelp("Set Variables", "save reusable values", "lưu biến", "variable"),
  set_json_variables: elementHelp(
    "Set JSON Variables",
    "save structured JSON values",
    "lưu biến JSON",
    "variable",
  ),
  assert_element: elementHelp("Assert Element", "require an element state", "kiểm tra element", "assert"),
  assert_text: elementHelp("Assert Text", "require expected text", "kiểm tra text", "assert"),
  graph_noop: elementHelp("Graph No-op", "mark internal graph flow progress", "đánh dấu luồng graph", "logic"),
  if_condition: elementHelp("If Condition", "run steps when a condition matches", "rẽ nhánh", "logic"),
  router_condition: elementHelp("Router Condition", "run first matching router case", "router case đầu tiên", "logic"),
  random_choice: elementHelp("Random Choice", "choose one weighted branch", "chọn một nhánh theo weight", "logic"),
  repeat_times: elementHelp("Repeat Times", "repeat nested steps", "lặp số lần", "loop"),
  repeat_for_each: elementHelp("Repeat For Each", "repeat steps for each item", "lặp từng item", "loop"),
  retry_block: elementHelp("Retry Block", "retry nested steps after failure", "thử lại block", "retry"),
  stop_workflow: elementHelp("Stop Workflow", "stop the workflow intentionally", "dừng workflow", "stop"),
  set_cookie: elementHelp("Set Cookie", "set a visible browser cookie", "đặt cookie", "cookie"),
  clear_cookies: elementHelp("Clear Cookies", "clear visible browser cookies", "xóa cookie", "cookie"),
  set_viewport: elementHelp("Set Viewport", "set runtime viewport size", "đổi kích thước viewport", "device"),
  set_geolocation: elementHelp("Set Geolocation", "override browser geolocation", "đổi vị trí", "geo"),
  set_extra_headers: elementHelp("Set Extra Headers", "send extra HTTP headers", "thêm header", "headers"),
  grant_permission: elementHelp("Grant Permission", "grant browser permissions", "cấp quyền", "permission"),
  execute_js: elementHelp("Execute JS", "run advanced JavaScript", "chạy JavaScript nâng cao", "advanced"),
  wait_for_request: elementHelp("Wait For Request", "wait for a network request", "chờ request mạng", "network"),
  wait_for_response: elementHelp("Wait For Response", "wait for a network response", "chờ response mạng", "network"),
  block_request: elementHelp("Block Request", "block matching fetch requests", "chặn request khớp mẫu", "network"),
  mock_response: elementHelp("Mock Response", "mock a matching fetch response", "giả lập response khớp mẫu", "network"),
  set_local_storage: elementHelp("Set Local Storage", "set localStorage", "đặt localStorage", "storage"),
  set_session_storage: elementHelp("Set Session Storage", "set sessionStorage", "đặt sessionStorage", "storage"),
  take_screenshot: {
    vi: {
      title: "Trợ giúp Take Screenshot",
      summary: "Chụp ảnh trang hiện tại và lưu đường dẫn vào output nếu có Output name.",
      useWhen: ["Dùng để lưu bằng chứng màn hình sau một thao tác quan trọng."],
      fields: [
        { name: "Path", description: "Đường dẫn file PNG cần ghi." },
        { name: "Output name", description: "Tên biến output để lưu lại đường dẫn ảnh." },
        { name: "Full page", description: "Yes chụp toàn trang; No chụp viewport hiện tại." },
      ],
      examples: ["Path: /tmp/workflow-result.png, Output name: screenshot_path"],
      commonMistakes: ["Thư mục cha của Path phải tồn tại.", "File cũ cùng đường dẫn sẽ bị ghi đè."],
    },
    en: {
      title: "Take Screenshot Help",
      summary: "Capture the current page and save the path into outputs when Output name is set.",
      useWhen: ["Use to keep visual evidence after an important workflow action."],
      fields: [
        { name: "Path", description: "PNG file path to write." },
        { name: "Output name", description: "Output variable name that stores the screenshot path." },
        { name: "Full page", description: "Yes captures the full page; No captures the current viewport." },
      ],
      examples: ["Path: /tmp/workflow-result.png, Output name: screenshot_path"],
      commonMistakes: ["The parent folder of Path must exist.", "An existing file at the same path is overwritten."],
    },
  },
  drag_and_drop: {
    vi: {
      title: "Trợ giúp Drag and Drop",
      summary: "Kéo một element nguồn và thả vào element đích.",
      useWhen: ["Dùng để sắp xếp card, kéo item vào vùng drop, hoặc thao tác UI dạng kanban."],
      fields: [
        { name: "Source selection", description: "Chọn locator trực tiếp hoặc ref từ Find Element cho element cần kéo." },
        { name: "Source ref", description: "Output name của Find Element khi Drag source dùng ref runtime." },
        { name: "Source locator", description: "Locator của element cần kéo." },
        { name: "Drop target source", description: "Chọn locator trực tiếp hoặc ref từ Find Element cho vùng/element đích." },
        { name: "Drop target ref", description: "Output name của Find Element khi Drop target dùng ref runtime." },
        { name: "Target locator", description: "Locator của vùng hoặc element đích để thả." },
        { name: "Destination position", description: "Vị trí thả trong target: tâm target, phần trăm bên trong target, hoặc offset pixel từ góc trái trên của target." },
        { name: "X percent", description: "Tọa độ ngang trong target khi Destination position là Percent inside target." },
        { name: "Y percent", description: "Tọa độ dọc trong target khi Destination position là Percent inside target." },
        { name: "X offset px", description: "Số pixel ngang tính từ góc trái trên của target khi dùng Pixel offset." },
        { name: "Y offset px", description: "Số pixel dọc tính từ góc trái trên của target khi dùng Pixel offset." },
      ],
      examples: ["Source locator: card-1, Target locator: done-lane", "Destination position: Percent inside target, X percent: 82, Y percent: 50"],
      commonMistakes: ["Source và target phải là hai element đúng vai trò, ví dụ thumb cần kéo và track/vùng thả.", "Slider thường cần Percent inside target thay vì Center of target."],
    },
    en: {
      title: "Drag and Drop Help",
      summary: "Drag a source element and drop it onto a target element.",
      useWhen: ["Use for reordering cards, moving items into drop zones, or kanban-style UIs."],
      fields: [
        { name: "Source selection", description: "Choose a direct locator or Find Element ref for the element to drag." },
        { name: "Source ref", description: "Find Element output name when Drag source uses a runtime ref." },
        { name: "Source locator", description: "Locator for the element to drag." },
        { name: "Drop target source", description: "Choose a direct locator or Find Element ref for the destination element or area." },
        { name: "Drop target ref", description: "Find Element output name when Drop target uses a runtime ref." },
        { name: "Target locator", description: "Locator for the drop target element or area." },
        { name: "Destination position", description: "Drop point inside the target: target center, percent inside the target, or pixel offset from the target's top-left corner." },
        { name: "X percent", description: "Horizontal coordinate inside the target when Destination position is Percent inside target." },
        { name: "Y percent", description: "Vertical coordinate inside the target when Destination position is Percent inside target." },
        { name: "X offset px", description: "Horizontal pixels from the target's top-left corner when using Pixel offset." },
        { name: "Y offset px", description: "Vertical pixels from the target's top-left corner when using Pixel offset." },
      ],
      examples: ["Source locator: card-1, Target locator: done-lane", "Destination position: Percent inside target, X percent: 82, Y percent: 50"],
      commonMistakes: ["Source and target should be the right elements for their roles, such as the draggable thumb and the track/drop zone.", "Sliders usually need Percent inside target instead of Center of target."],
    },
  },
  type_sequence: {
    vi: {
      title: "Trợ giúp Type Sequence",
      summary: "Gõ từng ký tự vào element giống thao tác bàn phím.",
      useWhen: ["Dùng cho autocomplete, command palette, rich text editor, hoặc field phụ thuộc key events."],
      fields: [
        { name: "XPath", description: xpathField.vi },
        { name: "Text", description: "Chuỗi ký tự cần gõ." },
        { name: "Delay ms", description: "Độ trễ giữa các ký tự." },
        { name: "Iframe XPath", description: iframeField.vi },
        { name: "Wait until", description: waitUntilField.vi },
        { name: "Timeout ms", description: timeoutField.vi },
      ],
      examples: ["XPath: //*[@role='combobox'], Text: apple, Delay ms: 25"],
      commonMistakes: ["Dùng Fill Field cho field thường sẽ nhanh và ổn định hơn.", "Delay 0 không hợp lệ; bỏ trống nếu không cần delay."],
    },
    en: {
      title: "Type Sequence Help",
      summary: "Type text character by character with keyboard-like events.",
      useWhen: ["Use for autocomplete, command palettes, rich text editors, or fields that depend on key events."],
      fields: [
        { name: "XPath", description: xpathField.en },
        { name: "Text", description: "The characters to type." },
        { name: "Delay ms", description: "Delay between characters." },
        { name: "Iframe XPath", description: iframeField.en },
        { name: "Wait until", description: waitUntilField.en },
        { name: "Timeout ms", description: timeoutField.en },
      ],
      examples: ["XPath: //*[@role='combobox'], Text: apple, Delay ms: 25"],
      commonMistakes: ["Fill Field is faster and more stable for normal fields.", "Delay 0 is invalid; leave it blank when no delay is needed."],
    },
  },
  set_clipboard: {
    vi: {
      title: "Trợ giúp Set Clipboard",
      summary: "Đặt nội dung clipboard nội bộ của workflow để dùng ở step Paste Into Field.",
      useWhen: ["Dùng khi website xử lý paste tốt hơn nhập từng ký tự.", "Dùng trước Paste Into Field."],
      fields: [{ name: "Text", description: "Nội dung cần đưa vào clipboard workflow." }],
      examples: ["Text: Nội dung cần dán"],
      commonMistakes: ["Step này chỉ chuẩn bị nội dung; dùng Paste Into Field để dán vào field."],
    },
    en: {
      title: "Set Clipboard Help",
      summary: "Set the workflow clipboard text for a later Paste Into Field step.",
      useWhen: ["Use when the site handles paste better than typing.", "Use before Paste Into Field."],
      fields: [{ name: "Text", description: "The text to place into the workflow clipboard." }],
      examples: ["Text: Text to paste"],
      commonMistakes: ["This only prepares the text; use Paste Into Field to put it into a field."],
    },
  },
};

function elementHelp(
  title: string,
  enSummary: string,
  viSummary: string,
  example: string,
): BilingualStepHelp {
  return {
    vi: {
      title: `Trợ giúp ${title}`,
      summary: `Thực hiện ${viSummary} trên element theo XPath.`,
      useWhen: [`Dùng khi workflow cần ${viSummary} giống người dùng thật.`],
      fields: [
        { name: "XPath", description: xpathField.vi },
        { name: "Iframe XPath", description: iframeField.vi },
        { name: "Wait until", description: waitUntilField.vi },
        { name: "Timeout ms", description: timeoutField.vi },
      ],
      examples: [`XPath: //*[@data-action='${example}']`],
      commonMistakes: ["XPath phải trỏ đúng element thật đang nhận thao tác."],
    },
    en: {
      title: `${title} Help`,
      summary: `Perform ${enSummary} on an element selected by XPath.`,
      useWhen: [`Use when the workflow needs to ${enSummary} like a real user.`],
      fields: [
        { name: "XPath", description: xpathField.en },
        { name: "Iframe XPath", description: iframeField.en },
        { name: "Wait until", description: waitUntilField.en },
        { name: "Timeout ms", description: timeoutField.en },
      ],
      examples: [`XPath: //*[@data-action='${example}']`],
      commonMistakes: ["XPath must point to the real element that receives the action."],
    },
  };
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
    case "extract_attribute":
      return [...targetSourceFields, "Output name", "Attribute"];
    case "take_screenshot":
      return ["Path", "Output name", "Full page"];
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

const graphInternalStepHelpContent = Object.fromEntries(
  graphInternalActionTypes.map((actionType) => [
    actionType,
    graphInternalHelp(actionLabels[actionType]),
  ]),
) as Record<GraphInternalActionType, BilingualStepHelp>;

function graphInternalHelp(label: string): BilingualStepHelp {
  return {
    vi: {
      title: `Trợ giúp ${label}`,
      summary:
        "Action nội bộ do graph compiler tạo ra từ node logic hoặc node điều phối đã lưu.",
      useWhen: [
        "Giữ workflow cũ tương thích khi payload đã chứa action nội bộ này.",
        "Ưu tiên chỉnh logic bằng graph node tương ứng thay vì thêm action này trực tiếp.",
      ],
      fields: [{ name: "Config", description: "Cấu hình được sinh từ graph node tương ứng." }],
      examples: [`${label}: được tạo khi graph compile workflow.`],
      commonMistakes: ["Thêm trực tiếp action nội bộ thay vì dùng node graph dễ làm workflow khó đọc."],
    },
    en: {
      title: `${label} Help`,
      summary:
        "Internal executable action generated by the graph compiler from saved logic or orchestration nodes.",
      useWhen: [
        "Keep older workflows compatible when a payload already contains this internal action.",
        "Prefer editing the matching graph node instead of adding this action directly.",
      ],
      fields: [{ name: "Config", description: "Configuration generated from the matching graph node." }],
      examples: [`${label}: generated when the graph compiles the workflow.`],
      commonMistakes: ["Adding internal actions directly makes workflows harder to reason about."],
    },
  };
}

export const stepHelpContent: Record<ActionType, BilingualStepHelp> =
  addFieldReference(
    addDecisionGuidance(
      addFieldDetails({
        ...baseStepHelpContent,
        ...phaseOneStepHelpContent,
        ...graphInternalStepHelpContent,
      }),
    ),
  );
