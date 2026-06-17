import type { ActionType } from "../../../types/workflow";
import { actionLabels } from "../../../lib/workflowUi";
import type {
  BilingualStepHelp,
} from "./stepHelpTypes";
import { enrichStepHelpContent } from "./stepHelpEnrichment";
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
  "evaluate_logic",
  "evaluate_expression",
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
  | "count_elements"
  | "extract_regex_matches"
  | "take_screenshot"
  | "write_text_file"
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
  | "update_number_variable"
  | "update_text_variable"
  | "update_flag_variable"
  | "update_list_variable"
  | "update_object_variable"
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
  count_elements: elementHelp("Count Elements", "count matching elements", "đếm số lượng phần tử", "output"),
  extract_regex_matches: {
    vi: {
      title: "Trợ giúp Extract Regex Matches",
      summary: "Đọc một output đã có, lấy các đoạn khớp regex, rồi lưu danh sách match vào output mới hoặc output hiện có.",
      useWhen: ["Dùng sau Extract Text hoặc Extract List khi cần lọc URL, username, mã đơn, hoặc token từ text đã capture."],
      fields: [
        { name: "Source output", description: "Tên output đầu vào cần đọc, ví dụ post_text hoặc comment_text." },
        { name: "Pattern", description: "Regex dùng để tìm các match trong Source output." },
        { name: "Flags", description: "Regex flags như g, i, m; g sẽ được dùng để lấy nhiều match." },
        { name: "Output name", description: "Tên output lưu danh sách match." },
        { name: "Append", description: "Bật để thêm match vào danh sách output hiện có thay vì ghi đè." },
        { name: "Dedupe", description: "Bật để giữ mỗi match một lần trong danh sách output." },
      ],
      examples: ["Source output: comment_text, Pattern: @[A-Za-z0-9._-]+, Output name: tiktok_targets"],
      commonMistakes: ["Pattern sai cú pháp sẽ làm validation fail.", "Tắt Append trong loop sẽ chỉ giữ kết quả vòng lặp cuối."],
    },
    en: {
      title: "Extract Regex Matches Help",
      summary: "Read an existing output, collect regex matches, and save the matches into a new or existing output.",
      useWhen: ["Use after Extract Text or Extract List when you need URLs, usernames, order ids, or tokens from captured text."],
      fields: [
        { name: "Source output", description: "Input output name to read, such as post_text or comment_text." },
        { name: "Pattern", description: "Regex pattern used to find matches in the source output." },
        { name: "Flags", description: "Regex flags such as g, i, m; g is used so multiple matches can be collected." },
        { name: "Output name", description: "Output name that stores the match list." },
        { name: "Append", description: "Enable to add matches to an existing output list instead of replacing it." },
        { name: "Dedupe", description: "Enable to keep each matched value once in the output list." },
      ],
      examples: ["Source output: comment_text, Pattern: @[A-Za-z0-9._-]+, Output name: tiktok_targets"],
      commonMistakes: ["Invalid regex syntax fails validation.", "Turning Append off inside a loop keeps only the last loop result."],
    },
  },
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
  write_text_file: {
    vi: {
      title: "Trợ giúp Write Text File",
      summary: "Ghi một output thành file text trong thư mục evidence của run và lưu đường dẫn artifact vào output.",
      useWhen: ["Dùng ở cuối workflow để xuất danh sách URL, username, log ngắn, hoặc dữ liệu đã capture."],
      fields: [
        { name: "Source output", description: "Tên output cần ghi ra file." },
        { name: "Path", description: "Tên file artifact an toàn, ví dụ tiktok-usernames.txt." },
        { name: "Separator", description: "Ký tự nối các item khi Source output là array; dùng \\n cho mỗi item một dòng." },
        { name: "Trailing newline", description: "Bật để thêm newline cuối file." },
        { name: "Output name", description: "Tên output lưu đường dẫn relative của file evidence." },
      ],
      examples: ["Source output: tiktok_targets, Path: tiktok-usernames.txt, Output name: tiktok_username_file"],
      commonMistakes: ["Path chỉ là tên file artifact, không phải đường dẫn filesystem.", "Source output trống sẽ tạo file rỗng."],
    },
    en: {
      title: "Write Text File Help",
      summary: "Write an output as a text file inside the run evidence directory and store the artifact path in an output.",
      useWhen: ["Use at the end of a workflow to export captured URLs, usernames, short logs, or collected data."],
      fields: [
        { name: "Source output", description: "Output name to write into the file." },
        { name: "Path", description: "Safe artifact file name, for example tiktok-usernames.txt." },
        { name: "Separator", description: "String used between array items; use \\n for one item per line." },
        { name: "Trailing newline", description: "Enable to append a final newline to the file." },
        { name: "Output name", description: "Output name that stores the evidence-relative file path." },
      ],
      examples: ["Source output: tiktok_targets, Path: tiktok-usernames.txt, Output name: tiktok_username_file"],
      commonMistakes: ["Path is only an artifact file name, not a filesystem path.", "An empty source output creates an empty file."],
    },
  },
  set_variable: elementHelp("Set Variables", "save reusable values", "lưu biến", "variable"),
  set_json_variables: elementHelp(
    "Set JSON Variables",
    "save structured JSON values",
    "lưu biến JSON",
    "variable",
  ),
  update_number_variable: variableHelp(
    "Update Number Variable",
    "perform math operations on a number variable",
    "thực hiện phép toán trên biến số",
  ),
  update_text_variable: variableHelp(
    "Update Text Variable",
    "perform string operations on a text variable",
    "thực hiện xử lý chuỗi trên biến chữ",
  ),
  update_flag_variable: variableHelp(
    "Update Flag Variable",
    "update boolean flag variable",
    "cập nhật biến flag",
  ),
  update_list_variable: variableHelp(
    "Update List Variable",
    "perform array operations on a list variable",
    "thực hiện thao tác mảng trên biến danh sách",
  ),
  update_object_variable: variableHelp(
    "Update Object Variable",
    "perform JSON object operations on an object variable",
    "thực hiện thao tác đối tượng trên biến đối tượng",
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

function variableHelp(
  title: string,
  enSummary: string,
  viSummary: string,
): BilingualStepHelp {
  return {
    vi: {
      title: `Trợ giúp ${title}`,
      summary: viSummary,
      useWhen: ["Dùng để quản lý trạng thái và dữ liệu trong quá trình chạy."],
      fields: [],
      examples: [],
      commonMistakes: [],
    },
    en: {
      title: `${title} Help`,
      summary: enSummary,
      useWhen: ["Use to manage state and data during execution."],
      fields: [],
      examples: [],
      commonMistakes: [],
    },
  };
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
  enrichStepHelpContent({
    ...baseStepHelpContent,
    ...phaseOneStepHelpContent,
    ...graphInternalStepHelpContent,
  });
