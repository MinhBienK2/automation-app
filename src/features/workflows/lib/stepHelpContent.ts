import type { ActionType } from "../../../types/workflow";
import { actionLabels } from "../../../lib/workflowUi";

export type StepHelpLanguage = "vi" | "en";
export type HelpFieldCategory = "required" | "optional" | "advanced";

export type StepHelpContent = {
  title: string;
  summary: string;
  useWhen: string[];
  notFor?: string[];
  chooseInstead?: Array<{
    action: string;
    when: string;
  }>;
  fields: Array<{
    name: string;
    description: string;
    details?: string[];
  }>;
  fieldReference?: ActionFieldReference[];
  minimalConfig?: Array<{
    name: string;
    description: string;
  }>;
  advancedConfig?: Array<{
    name: string;
    description: string;
    whenToUse?: string;
  }>;
  workflowExamples?: Array<{
    title: string;
    steps: string[];
    notes?: string[];
  }>;
  outputs?: Array<{
    name: string;
    description: string;
    usedBy: string[];
  }>;
  examples: string[];
  commonMistakes: string[];
  safetyNotes?: string[];
};

export type ActionFieldReference = {
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

export type ActionFieldOptionReference = {
  label: string;
  value?: string;
  description: string;
  useWhen: string;
  avoidWhen?: string;
  example?: string;
};

type BilingualStepHelp = Record<StepHelpLanguage, StepHelpContent>;
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
  | "switch_frame"
  | "accept_dialog"
  | "dismiss_dialog"
  | "set_download_directory"
  | "wait_for_download"
  | "set_variable"
  | "set_json_variables"
  | "assert_element"
  | "assert_text"
  | "if_condition"
  | "repeat_times"
  | "repeat_for_each"
  | "retry_block"
  | "stop_workflow"
  | "use_profile"
  | "save_session"
  | "load_session"
  | "set_cookie"
  | "clear_cookies"
  | "set_secret"
  | "use_proxy"
  | "set_user_agent"
  | "set_viewport"
  | "set_geolocation"
  | "set_extra_headers"
  | "grant_permission"
  | "detect_challenge"
  | "pause_for_human"
  | "resume_when_condition"
  | "fallback_selector"
  | "retry_step"
  | "checkpoint"
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

const baseStepHelpContent: Record<Exclude<ActionType, PhaseOneActionType>, BilingualStepHelp> = {
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
        { name: "Retry interval ms", description: "Khoảng nghỉ giữa các lần thử lại khi element chưa click được." },
        { name: "Post-click wait ms", description: "Chờ thêm sau khi click, hữu ích khi click mở animation hoặc chuyển trạng thái." },
      ],
      examples: ["XPath: //*[@type='submit']", "Iframe XPath: //*[@id='frame'], XPath: //*[@id='buy']"],
      commonMistakes: ["XPath trỏ vào text bên trong button thay vì button có thể click.", "Element bị che sẽ làm Real click thất bại; thử scroll hoặc kiểm tra overlay."],
    },
    en: {
      title: "Click Help",
      summary: "Click an element such as a button, link, custom checkbox, or menu.",
      useWhen: ["Use to press Submit, open dropdowns, select tabs, or click links.", "Use Real click when you want browser-like user behavior."],
      fields: [
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
        { name: "Retry interval ms", description: "Delay between retries while the element is not clickable yet." },
        { name: "Post-click wait ms", description: "Extra wait after clicking, useful for animations or state changes." },
      ],
      examples: ["XPath: //*[@type='submit']", "Iframe XPath: //*[@id='frame'], XPath: //*[@id='buy']"],
      commonMistakes: ["XPath points to text inside a button instead of the clickable button.", "Covered elements can fail Real click; check overlays or scrolling."],
    },
  },
  scroll: {
    vi: {
      title: "Trợ giúp Scroll",
      summary: "Cuộn cho đến khi element đích hiện ra, hoặc cuộn trang, iframe, container theo cấu hình.",
      useWhen: ["Dùng khi element nằm dưới màn hình.", "Dùng để cuộn trong iframe hoặc vùng có scrollbar riêng.", "Dùng Until Visible khi muốn app tự cuộn cho tới khi thấy một element cụ thể."],
      fields: [
        { name: "Mode", description: "Page cuộn trang; Container cuộn box có scrollbar; Into View đưa element vào màn hình; Until Visible cuộn lặp tới khi element đích visible." },
        { name: "Direction", description: "Hướng cuộn: down, up, right, hoặc left." },
        { name: "Pixels", description: "Số pixel mỗi lần cuộn. Thử 250-800 tùy trang." },
        { name: "XPath", description: "Với Container: XPath là box scroll. Với Into View/Until Visible: XPath là element đích cần đưa vào vùng nhìn thấy." },
        { name: "Max attempts", description: "Số lần cuộn tối đa cho Until Visible." },
        { name: "Wait ms", description: "Thời gian chờ giữa mỗi lần cuộn trong Until Visible." },
        { name: "Iframe XPath", description: "Chọn iframe trên trang cha. Khi có iframe, XPath được hiểu là element bên trong iframe." },
        { name: "Behavior", description: "Instant cuộn ngay; Smooth cuộn mượt hơn nhưng có thể chậm hơn." },
        { name: "Block / Inline", description: "Dùng với Into View để căn element theo chiều dọc/ngang." },
      ],
      examples: ["Iframe XPath: //*[@id='main']/div[3]/iframe", "Until Visible XPath: //h2[normalize-space(.)='HTML Quiz Test']", "Container XPath: //*[@id='scroll-box']"],
      commonMistakes: ["Until Visible dùng XPath là element đích cần thấy, không phải box scroll.", "Nếu element nằm trong iframe, cần Iframe XPath của iframe và XPath của element bên trong iframe.", "Dùng /html/body cho Until Visible thường không cuộn vì body đã visible sẵn."],
    },
    en: {
      title: "Scroll Help",
      summary: "Scroll a page, iframe, container, or Scroll until the target element becomes visible.",
      useWhen: ["Use when an element is below the visible area.", "Use to scroll inside an iframe or a box with its own scrollbar.", "Use Until Visible when you want the app to keep scrolling until a specific element is visible."],
      fields: [
        { name: "Mode", description: "Page scrolls the page; Container scrolls a scrollable box; Into View brings an element into view; Until Visible keeps scrolling until the target element is visible." },
        { name: "Direction", description: "Scroll direction: down, up, right, or left." },
        { name: "Pixels", description: "Pixels per scroll. Try 250-800 depending on the page." },
        { name: "XPath", description: "For Container, XPath is the scroll box. For Into View/Until Visible, XPath is the target element to bring into view." },
        { name: "Max attempts", description: "Maximum scroll attempts for Until Visible." },
        { name: "Wait ms", description: "Delay between scroll attempts in Until Visible." },
        { name: "Iframe XPath", description: "Selects the iframe on the parent page. With an iframe set, XPath is evaluated inside the iframe." },
        { name: "Behavior", description: "Instant scrolls immediately; Smooth animates scrolling but can be slower." },
        { name: "Block / Inline", description: "Used by Into View to align the element vertically and horizontally." },
      ],
      examples: ["Iframe XPath: //*[@id='main']/div[3]/iframe", "Until Visible XPath: //h2[normalize-space(.)='HTML Quiz Test']", "Container XPath: //*[@id='scroll-box']"],
      commonMistakes: ["Until Visible uses XPath as the target element, not the scroll box.", "If the element is inside an iframe, use Iframe XPath for the iframe and XPath for the element inside it.", "Using /html/body for Until Visible often does not scroll because body is already visible."],
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
  set_checkbox: {
    vi: {
      title: "Trợ giúp Set Checkbox",
      summary: "Đặt checkbox về trạng thái checked hoặc unchecked.",
      useWhen: ["Dùng cho checkbox đồng ý điều khoản, filter, setting bật/tắt.", "Dùng khi muốn trạng thái cuối cùng chắc chắn, không chỉ toggle."],
      fields: [
        { name: "XPath", description: "XPath của input type=checkbox." },
        { name: "Iframe XPath", description: iframeField.vi },
        { name: "Wait until", description: waitUntilField.vi },
        { name: "Timeout ms", description: timeoutField.vi },
        { name: "State", description: "Checked để bật; Unchecked để tắt." },
      ],
      examples: ["XPath: //*[@type='checkbox' and @name='terms'], State: Checked"],
      commonMistakes: ["XPath trỏ vào label thay vì input checkbox thật.", "Nếu checkbox là UI custom không có input checkbox, có thể cần Click."],
    },
    en: {
      title: "Set Checkbox Help",
      summary: "Set a checkbox to checked or unchecked.",
      useWhen: ["Use for terms checkboxes, filters, or on/off settings.", "Use when you need a guaranteed final state, not just a toggle."],
      fields: [
        { name: "XPath", description: "XPath of the input type=checkbox element." },
        { name: "Iframe XPath", description: iframeField.en },
        { name: "Wait until", description: waitUntilField.en },
        { name: "Timeout ms", description: timeoutField.en },
        { name: "State", description: "Checked turns it on; Unchecked turns it off." },
      ],
      examples: ["XPath: //*[@type='checkbox' and @name='terms'], State: Checked"],
      commonMistakes: ["XPath points to the label instead of the real checkbox input.", "Custom checkbox UI without an input may need Click instead."],
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
  switch_frame: elementHelp("Switch Frame", "set the active iframe context", "chọn iframe", "iframe"),
  accept_dialog: elementHelp("Accept Dialog", "accept an alert, confirm, or prompt", "đồng ý dialog", "dialog"),
  dismiss_dialog: elementHelp("Dismiss Dialog", "dismiss an alert, confirm, or prompt", "hủy dialog", "dialog"),
  set_download_directory: elementHelp(
    "Set Download Directory",
    "choose where downloads are saved",
    "chọn thư mục tải xuống",
    "download",
  ),
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
  if_condition: elementHelp("If Condition", "run steps when a condition matches", "rẽ nhánh", "logic"),
  repeat_times: elementHelp("Repeat Times", "repeat nested steps", "lặp số lần", "loop"),
  repeat_for_each: elementHelp("Repeat For Each", "repeat steps for each item", "lặp từng item", "loop"),
  retry_block: elementHelp("Retry Block", "retry nested steps after failure", "thử lại block", "retry"),
  stop_workflow: elementHelp("Stop Workflow", "stop the workflow intentionally", "dừng workflow", "stop"),
  use_profile: elementHelp("Use Profile", "run with a persistent browser profile", "dùng profile", "session"),
  save_session: elementHelp("Save Session", "save browser storage state", "lưu phiên", "session"),
  load_session: elementHelp("Load Session", "restore browser storage state", "khôi phục phiên", "session"),
  set_cookie: elementHelp("Set Cookie", "set a visible browser cookie", "đặt cookie", "cookie"),
  clear_cookies: elementHelp("Clear Cookies", "clear visible browser cookies", "xóa cookie", "cookie"),
  set_secret: elementHelp("Set Secret", "store a redacted secret variable", "lưu secret", "secret"),
  use_proxy: elementHelp("Use Proxy", "route browser traffic through a proxy", "dùng proxy", "proxy"),
  set_user_agent: elementHelp("Set User Agent", "override the browser user agent", "đổi user agent", "network"),
  set_viewport: elementHelp("Set Viewport", "emulate viewport and device shape", "đổi viewport", "device"),
  set_geolocation: elementHelp("Set Geolocation", "override browser geolocation", "đổi vị trí", "geo"),
  set_extra_headers: elementHelp("Set Extra Headers", "send extra HTTP headers", "thêm header", "headers"),
  grant_permission: elementHelp("Grant Permission", "grant browser permissions", "cấp quyền", "permission"),
  detect_challenge: elementHelp("Detect Challenge", "detect human verification UI", "phát hiện xác minh", "challenge"),
  pause_for_human: elementHelp("Pause For Human", "pause for manual verification", "tạm dừng cho người xử lý", "human"),
  resume_when_condition: elementHelp("Resume When Condition", "resume after a clear condition", "tiếp tục khi đủ điều kiện", "resume"),
  fallback_selector: elementHelp("Fallback Selector", "choose the first matching selector", "chọn selector dự phòng đầu tiên khớp", "fallback"),
  retry_step: elementHelp("Retry Step", "retry one flaky step", "thử lại một step dễ lỗi", "retry"),
  checkpoint: elementHelp("Checkpoint", "mark progress and optionally capture a screenshot", "đánh dấu tiến trình và có thể chụp ảnh", "checkpoint"),
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
        { name: "Source XPath", description: "XPath của element cần kéo." },
        { name: "Target XPath", description: "XPath của vùng hoặc element đích để thả." },
        { name: "Iframe XPath", description: iframeField.vi },
        { name: "Wait until", description: waitUntilField.vi },
        { name: "Timeout ms", description: timeoutField.vi },
      ],
      examples: ["Source XPath: //*[@id='card-1'], Target XPath: //*[@id='done-lane']"],
      commonMistakes: ["XPath nguồn và đích phải là hai element khác nhau.", "Một số app custom có thể cần selector ổn định hơn absolute XPath."],
    },
    en: {
      title: "Drag and Drop Help",
      summary: "Drag a source element and drop it onto a target element.",
      useWhen: ["Use for reordering cards, moving items into drop zones, or kanban-style UIs."],
      fields: [
        { name: "Source XPath", description: "XPath of the element to drag." },
        { name: "Target XPath", description: "XPath of the drop target element or area." },
        { name: "Iframe XPath", description: iframeField.en },
        { name: "Wait until", description: waitUntilField.en },
        { name: "Timeout ms", description: timeoutField.en },
      ],
      examples: ["Source XPath: //*[@id='card-1'], Target XPath: //*[@id='done-lane']"],
      commonMistakes: ["Source and target XPath should point to different elements.", "Some custom apps need a more stable selector than absolute XPath."],
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
  return {
    ...content,
    fields: content.fields.map((field) => ({
      ...field,
      details: field.details ?? fieldDetails(actionType, language, field.name),
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
  const minimalConfig = content.fields.slice(0, 3).map((field) => ({
    name: field.name,
    description: field.description,
  }));
  const advancedConfig = content.fields.slice(3).map((field) => ({
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
    workflowExamples: workflowExamples(actionType, language, content),
    outputs: outputGuidance(actionType, language),
    safetyNotes: safetyNotes(actionType, language),
  };
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
  const elementTargetFields = ["XPath", "Iframe XPath", "Wait until", "Timeout ms"];
  switch (actionType) {
    case "navigate":
      return ["URL", "Wait until", "Timeout ms"];
    case "wait":
      return ["Condition", "Duration ms", "XPath", "Text", "URL contains", "Timeout ms"];
    case "input_text":
      return ["XPath", "Text", "Clear before input", "Typing mode", "Iframe XPath", "Delay ms", "Wait until", "Timeout ms"];
    case "clear_input":
      return [...elementTargetFields, "Method"];
    case "click":
      return ["XPath", "Mode", "Click count", "Button", "Iframe XPath", "Scroll into view", "Block", "Inline", "Position", "Offset X / Offset Y", "Wait until", "Timeout ms", "Retry interval ms", "Post-click wait ms"];
    case "scroll":
      return ["Mode", "Direction", "Pixels", "XPath", "Max attempts", "Wait ms", "Iframe XPath", "Behavior", "Block", "Inline"];
    case "select_option":
      return ["XPath", "Match by", "Value", "Iframe XPath", "Wait until", "Timeout ms"];
    case "set_checkbox":
      return [...elementTargetFields, "State"];
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
      return elementTargetFields;
    case "drag_and_drop":
      return ["Source XPath", "Target XPath", "Iframe XPath", "Wait until", "Timeout ms"];
    case "type_sequence":
      return ["XPath", "Text", "Delay ms", "Iframe XPath", "Wait until", "Timeout ms"];
    case "set_clipboard":
      return ["Text"];
    case "upload_file":
      return ["XPath", "Files", "Iframe XPath", "Wait until", "Timeout ms"];
    case "submit_form":
      return ["XPath", "Iframe XPath", "Wait until", "Timeout ms"];
    case "select_custom_option":
      return ["Trigger XPath", "Option text", "Iframe XPath", "Timeout ms"];
    case "set_contenteditable":
      return ["XPath", "Text", "Clear before input", "Iframe XPath", "Wait until", "Timeout ms"];
    case "extract_text":
    case "extract_input_value":
    case "extract_table":
    case "extract_list":
      return ["XPath", "Output name", "Iframe XPath", "Timeout ms"];
    case "extract_attribute":
      return ["XPath", "Output name", "Iframe XPath", "Timeout ms", "Attribute"];
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
    case "switch_frame":
      return ["XPath"];
    case "accept_dialog":
      return ["Prompt text"];
    case "set_download_directory":
      return ["Path"];
    case "wait_for_download":
      return ["Output name", "Timeout ms"];
    case "set_variable":
      return ["Name", "Type", "Value"];
    case "set_json_variables":
      return ["JSON variables"];
    case "assert_element":
      return ["XPath", "State", "Iframe XPath", "Timeout ms"];
    case "assert_text":
      return ["XPath", "Text", "Match mode", "Timeout ms"];
    case "if_condition":
      return ["No fields"];
    case "repeat_times":
      return ["Times"];
    case "repeat_for_each":
      return ["Items source", "Item name", "Items", "Array variable"];
    case "retry_block":
      return ["Max attempts", "Delay ms"];
    case "stop_workflow":
      return ["Status", "Reason"];
    case "use_profile":
      return ["Name"];
    case "save_session":
    case "load_session":
      return ["Path"];
    case "set_cookie":
      return ["Name", "Value", "Domain", "Path"];
    case "clear_cookies":
      return ["Domain"];
    case "set_secret":
      return ["Name", "Value"];
    case "use_proxy":
      return ["Server", "Username", "Password"];
    case "set_user_agent":
      return ["User agent"];
    case "set_viewport":
      return ["Width", "Height", "Device scale factor", "Mobile", "Touch"];
    case "set_geolocation":
      return ["Latitude", "Longitude", "Accuracy"];
    case "set_extra_headers":
      return ["Headers"];
    case "grant_permission":
      return ["Origin", "Permissions"];
    case "detect_challenge":
      return ["Output name", "Patterns", "Timeout ms"];
    case "pause_for_human":
      return ["Reason", "Timeout ms"];
    case "resume_when_condition":
      return ["Timeout ms"];
    case "fallback_selector":
      return ["Output name", "XPaths", "Timeout ms"];
    case "retry_step":
      return ["Max attempts", "Delay ms"];
    case "checkpoint":
      return ["Name", "Screenshot path"];
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
        "scroll:XPath": "Bắt buộc với Container, Into View, và Until Visible; không cần với Page.",
        "click:Offset X / Offset Y": "Chỉ bắt buộc khi Position là Offset.",
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
        "scroll:XPath": "Required for Container, Into View, and Until Visible; not needed for Page.",
        "click:Offset X / Offset Y": "Required only when Position is Offset.",
        "go_back:No fields": "This action has no configurable fields.",
        "go_forward:No fields": "This action has no configurable fields.",
        "reload:No fields": "This action has no configurable fields.",
        "dismiss_dialog:No fields": "This action has no configurable fields.",
        "if_condition:No fields": "This compatibility action has no fields in the current form.",
      };

  if (specific[key]) return specific[key];
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
  return vi
    ? `${fieldName} điều khiển cách ${actionLabels[actionType]} chạy trong browser. Đọc quy tắc bắt buộc và ví dụ để nhập đúng kiểu giá trị.`
    : `${fieldName} controls how ${actionLabels[actionType]} runs in the browser. Use the requirement rule and example to enter the right value.`;
}

function fieldCategory(actionType: ActionType, fieldName: string): HelpFieldCategory {
  if (fieldName === "No fields") return "optional";
  if (
    fieldName.includes("Timeout") ||
    fieldName.includes("Delay") ||
    fieldName.includes("Wait") ||
    fieldName === "Iframe XPath" ||
    fieldName === "Username" ||
    fieldName === "Password" ||
    fieldName === "Accuracy" ||
    fieldName === "Device scale factor" ||
    fieldName === "Block" ||
    fieldName === "Inline" ||
    fieldName === "Offset X / Offset Y" ||
    fieldName === "Post-click wait ms" ||
    fieldName === "Retry interval ms"
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
    fieldName === "Mobile" ||
    fieldName === "Touch" ||
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
  if (fieldName.includes("XPath")) return "//*[@data-testid='submit']";
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

function fieldOptions(
  actionType: ActionType,
  language: StepHelpLanguage,
  fieldName: string,
) {
  const key = `${actionType}:${fieldName}`;
  return specificFieldOptions[language][key] ?? commonFieldOptions[language][fieldName];
}

function option(
  label: string,
  description: string,
  useWhen: string,
  avoidWhen?: string,
  example?: string,
  value?: string,
): ActionFieldOptionReference {
  return { label, value, description, useWhen, avoidWhen, example };
}

const specificFieldOptions: Record<StepHelpLanguage, Record<string, ActionFieldOptionReference[]>> = {
  vi: {
    "navigate:Wait until": [
      option("Load", "Chờ sự kiện load của trang.", "Dùng mặc định cho hầu hết trang sau khi nhập URL.", "Tránh nếu trang cần dữ liệu từ request chạy sau load.", "Wait until: Load", "load"),
      option("DOMContentLoaded", "Chờ HTML được parse xong, không nhất thiết chờ ảnh/tài nguyên phụ.", "Dùng khi cần bắt đầu nhanh và element chính có sớm trong DOM.", "Tránh nếu action sau cần ảnh, font, hoặc widget tải muộn.", "Wait until: DOMContentLoaded", "dom_content_loaded"),
      option("Network idle", "Chờ network tương đối yên trước khi đi tiếp.", "Dùng với trang tải dữ liệu qua API sau khi mở.", "Tránh với trang có polling, analytics, websocket, hoặc request nền liên tục.", "Wait until: Network idle", "network_idle"),
    ],
    "scroll:Mode": [
      option("Page", "Cuộn trang chính hoặc document trong iframe nếu có Iframe XPath.", "Dùng khi toàn bộ trang cần cuộn.", "Tránh khi chỉ một div/list bên trong trang có scrollbar riêng.", "Mode: Page", "page"),
      option("Container", "Cuộn một box có scrollbar riêng; XPath là box đó.", "Dùng cho danh sách, bảng, modal body, hoặc panel có overflow.", "Tránh khi XPath là element đích cần nhìn thấy; khi đó dùng Into View hoặc Until Visible.", "XPath: //*[@id='result-list']", "container"),
      option("Into View", "Đưa một element cụ thể vào vùng nhìn thấy.", "Dùng trước Click/Hover khi element đã tồn tại nhưng nằm ngoài màn hình.", "Tránh khi element chưa render; hãy Wait trước.", "XPath: //*[@data-row='42']", "into_view"),
      option("Until Visible", "Cuộn lặp lại cho tới khi element đích visible hoặc hết Max attempts.", "Dùng cho lazy-load/infinite-scroll khi target sẽ xuất hiện sau vài lần cuộn.", "Tránh dùng XPath của scroll box; XPath phải là target cần thấy.", "XPath: //button[text()='Load more']", "until_visible"),
    ],
    "wait:Condition": [
      option("Duration", "Chờ cố định theo Duration ms.", "Dùng khi không có tín hiệu DOM/URL rõ ràng và chỉ cần nghỉ ngắn.", "Tránh dùng thay cho wait element nếu có thể kiểm tra element.", "Duration ms: 500", "duration"),
      option("Element visible", "Chờ element nhìn thấy được.", "Dùng khi bước sau cần người dùng nhìn/click được element.", "Tránh khi element chỉ cần tồn tại trong DOM.", "XPath: //*[@id='dashboard']", "element_visible"),
      option("Element hidden", "Chờ element biến mất khỏi vùng nhìn thấy.", "Dùng sau loading spinner, modal, hoặc toast.", "Tránh nếu element bị remove khỏi DOM hoàn toàn; dùng detached nếu cần.", "XPath: //*[@role='progressbar']", "element_hidden"),
      option("Element attached", "Chờ element tồn tại trong DOM.", "Dùng khi element có thể chưa visible nhưng cần có mặt để JS xử lý.", "Tránh nếu action sau cần click/input.", undefined, "element_attached"),
      option("Element detached", "Chờ element bị remove khỏi DOM.", "Dùng khi modal/spinner bị xóa khỏi trang.", "Tránh nếu element chỉ bị ẩn bằng CSS.", undefined, "element_detached"),
      option("Text visible", "Chờ text xuất hiện trên trang.", "Dùng khi kết quả chỉ nhận biết bằng chữ hiển thị.", "Tránh với text thay đổi theo ngôn ngữ hoặc khoảng trắng khó đoán.", "Text: Success", "text_visible"),
      option("URL contains", "Chờ URL chứa một đoạn text.", "Dùng sau login, redirect, hoặc điều hướng.", "Tránh nếu app là SPA không đổi URL.", "URL contains: /dashboard", "url_contains"),
      option("Page load", "Chờ tải trang theo trạng thái browser.", "Dùng sau navigate/reload rõ ràng.", "Tránh với trang có request nền chạy liên tục.", undefined, "page_load"),
      option("Element enabled", "Chờ element không còn disabled.", "Dùng trước click/input vào control bị disable tạm thời.", "Tránh nếu chỉ cần element visible.", undefined, "element_enabled"),
      option("Element disabled", "Chờ element chuyển sang disabled.", "Dùng để xác nhận submit đang xử lý hoặc control bị khóa.", "Tránh nếu cần kiểm tra biến mất.", undefined, "element_disabled"),
    ],
    "click:Mode": [
      option("Real click", "Gửi click qua browser giống người dùng hơn.", "Dùng mặc định cho button, link, checkbox, menu.", "Tránh khi website có overlay giả hoặc cần fallback DOM có chủ đích.", undefined, "real"),
      option("Force DOM click", "Gọi trực tiếp click() trên element.", "Chỉ dùng khi Real click bị UI custom chặn nhưng website vẫn xử lý click() đúng.", "Tránh dùng mặc định vì không giống thao tác người dùng thật.", undefined, "force_dom"),
    ],
    "assert_element:State": [
      option("Visible", "Element phải nhìn thấy được.", "Dùng khi cần xác nhận UI đang hiện cho người dùng.", "Tránh nếu chỉ cần element tồn tại trong DOM.", undefined, "visible"),
      option("Hidden", "Element không được nhìn thấy.", "Dùng để xác nhận spinner/modal/message đã ẩn.", "Tránh nếu element bị xóa khỏi DOM và bạn muốn kiểm tra attached/detached.", undefined, "hidden"),
      option("Attached", "Element phải tồn tại trong DOM.", "Dùng khi visibility không quan trọng.", "Tránh nếu action sau cần click/input.", undefined, "attached"),
      option("Enabled", "Element không bị disabled.", "Dùng để xác nhận control đã sẵn sàng.", "Tránh nếu chỉ cần visible.", undefined, "enabled"),
      option("Disabled", "Element bị disabled.", "Dùng để xác nhận control bị khóa hoặc đang submit.", "Tránh nếu cần xác nhận biến mất.", undefined, "disabled"),
    ],
  },
  en: {
    "navigate:Wait until": [
      option("Load", "Waits for the page load event.", "Use by default for most pages after entering a URL.", "Avoid when the page needs data from requests that run after load.", "Wait until: Load", "load"),
      option("DOMContentLoaded", "Waits until the HTML document has been parsed, without waiting for every image or secondary asset.", "Use when the main elements appear early and you want navigation to continue sooner.", "Avoid when the next action needs images, fonts, or late widgets.", "Wait until: DOMContentLoaded", "dom_content_loaded"),
      option("Network idle", "Waits until network activity is relatively quiet before continuing.", "Use when the page fills important data through API requests after opening.", "Avoid pages with polling, analytics, websockets, or continuous background requests.", "Wait until: Network idle", "network_idle"),
    ],
    "scroll:Mode": [
      option("Page", "Scrolls the main page or the iframe document when Iframe XPath is set.", "Use for main page scrolling.", "Avoid when only a nested div/list has its own scrollbar.", "Mode: Page", "page"),
      option("Container", "Scrolls one scrollable box; XPath is that box.", "Use for lists, tables, modal bodies, or panels with overflow.", "Avoid when XPath is the target element; use Into View or Until Visible for target scrolling.", "XPath: //*[@id='result-list']", "container"),
      option("Into View", "Brings one target element into the viewport.", "Use before Click/Hover when the element exists but is off-screen.", "Avoid when the element has not rendered yet; Wait first.", "XPath: //*[@data-row='42']", "into_view"),
      option("Until Visible", "Repeatedly scrolls until the target element is visible or Max attempts runs out.", "Use for lazy-load or infinite-scroll pages where the target appears after scrolling.", "Avoid using the scroll box XPath; XPath must be the target to see.", "XPath: //button[text()='Load more']", "until_visible"),
    ],
    "wait:Condition": [
      option("Duration", "Waits for a fixed Duration ms.", "Use for a fixed short pause when there is no reliable DOM/URL signal.", "Avoid replacing element waits when a target can be checked.", "Duration ms: 500", "duration"),
      option("Element visible", "Waits until an element can be seen.", "Use when the next step needs to see or click the element.", "Avoid when the element only needs to exist in the DOM.", "XPath: //*[@id='dashboard']", "element_visible"),
      option("Element hidden", "Waits until an element is no longer visible.", "Use after loading spinners, modals, or toasts.", "Avoid when the element is removed from DOM; use detached when needed.", "XPath: //*[@role='progressbar']", "element_hidden"),
      option("Element attached", "Waits until an element exists in the DOM.", "Use when the element may not be visible yet but must exist for JS.", "Avoid when the next action needs click/input.", undefined, "element_attached"),
      option("Element detached", "Waits until an element is removed from DOM.", "Use when a modal or spinner is deleted from the page.", "Avoid when the element is only hidden with CSS.", undefined, "element_detached"),
      option("Text visible", "Waits until text appears on the page.", "Use when the result is only visible as page text.", "Avoid text that changes by locale or unpredictable spacing.", "Text: Success", "text_visible"),
      option("URL contains", "Waits until the URL contains a fragment.", "Use after login, redirects, or navigation.", "Avoid when the app is an SPA that does not change URL.", "URL contains: /dashboard", "url_contains"),
      option("Page load", "Waits for browser page-load state.", "Use after clear navigate/reload events.", "Avoid pages with continuous background requests.", undefined, "page_load"),
      option("Element enabled", "Waits until an element is no longer disabled.", "Use before clicking or typing into a temporarily disabled control.", "Avoid when visible is enough.", undefined, "element_enabled"),
      option("Element disabled", "Waits until an element becomes disabled.", "Use to confirm submit processing or a locked control.", "Avoid when you need disappearance instead.", undefined, "element_disabled"),
    ],
    "click:Mode": [
      option("Real click", "Sends a browser click that behaves more like a user.", "Use by default for buttons, links, checkboxes, and menus.", "Avoid only when a custom UI intentionally needs the DOM fallback.", undefined, "real"),
      option("Force DOM click", "Calls click() directly on the element.", "Use only when Real click is blocked by custom UI but the site handles click() correctly.", "Avoid as the default because it is less like a real user action.", undefined, "force_dom"),
    ],
    "assert_element:State": [
      option("Visible", "Element must be visible.", "Use when you need to confirm the UI is shown to the user.", "Avoid when DOM presence is enough.", undefined, "visible"),
      option("Hidden", "Element must not be visible.", "Use to confirm a spinner, modal, or message is hidden.", "Avoid when the element is removed from DOM and you specifically need attachment state.", undefined, "hidden"),
      option("Attached", "Element must exist in the DOM.", "Use when visibility does not matter.", "Avoid when a later action needs click/input.", undefined, "attached"),
      option("Enabled", "Element must not be disabled.", "Use to confirm a control is ready.", "Avoid when visible is enough.", undefined, "enabled"),
      option("Disabled", "Element must be disabled.", "Use to confirm a control is locked or submitting.", "Avoid when you need disappearance instead.", undefined, "disabled"),
    ],
  },
};

const commonFieldOptions: Record<StepHelpLanguage, Record<string, ActionFieldOptionReference[]>> = {
  vi: {
    "Wait until": [
      option("Clickable", "Element visible, enabled, và có thể nhận thao tác.", "Dùng trước click hoặc nhập liệu quan trọng.", "Tránh chỉ khi website có UI đặc biệt cần fallback.", undefined, "clickable"),
      option("Visible", "Element hiển thị trên trang.", "Dùng khi cần đọc hoặc nhìn thấy element.", "Tránh khi cần đảm bảo click được.", undefined, "visible"),
      option("Enabled", "Element không bị disabled.", "Dùng cho input/button cần sẵn sàng.", "Tránh nếu element có thể bị che.", undefined, "enabled"),
      option("Attached", "Element tồn tại trong DOM.", "Dùng khi chỉ cần DOM có element.", "Tránh trước click/input nếu element có thể chưa visible.", undefined, "attached"),
    ],
    "Typing mode": [
      option("Set value", "Đặt value nhanh bằng automation.", "Dùng cho input/textarea thường.", "Tránh khi website cần key event thật.", undefined, "set_value"),
      option("Type keys", "Gõ từng phím giống người dùng hơn.", "Dùng cho autocomplete, mask, listener theo phím.", "Tránh với text rất dài nếu paste/fill ổn định hơn.", undefined, "type"),
    ],
    "Clear before input": [
      option("Yes", "Xóa nội dung cũ trước khi nhập.", "Dùng khi field có autofill hoặc giá trị cũ.", "Tránh nếu muốn nhập nối thêm.", undefined, "true"),
      option("No", "Giữ nội dung hiện tại và nhập thêm.", "Dùng khi cần append text.", "Tránh nếu field phải có giá trị chính xác.", undefined, "false"),
    ],
    Method: [
      option("Select all", "Chọn toàn bộ rồi xóa.", "Dùng mặc định cho input thường.", "Tránh khi website cần từng phím backspace.", undefined, "select_all"),
      option("Backspace", "Xóa bằng phím.", "Dùng khi website xử lý key events.", "Tránh field rất dài nếu cần nhanh.", undefined, "backspace"),
      option("DOM value", "Đặt value rỗng trực tiếp.", "Dùng khi cần nhanh và app chấp nhận DOM update.", "Tránh khi framework cần event thật.", undefined, "dom"),
    ],
    Button: [
      option("Left", "Click chuột trái.", "Dùng cho hầu hết button/link.", "Tránh khi cần mở context menu.", undefined, "left"),
      option("Right", "Click chuột phải.", "Dùng cho menu ngữ cảnh custom.", "Tránh cho submit hoặc link thường.", undefined, "right"),
      option("Middle", "Click chuột giữa.", "Dùng cho hành vi tab/link đặc biệt.", "Tránh nếu không chắc website hỗ trợ.", undefined, "middle"),
    ],
    Position: [
      option("Center", "Click giữa element.", "Dùng mặc định cho đa số element.", "Tránh nếu vùng giữa không phải vùng nhận click.", undefined, "center"),
      option("Top left", "Click góc trên trái.", "Dùng khi vùng click nằm ở góc.", "Tránh element nhỏ dễ lệch.", undefined, "top_left"),
      option("Top right", "Click góc trên phải.", "Dùng cho icon/action ở góc phải.", "Tránh nếu có padding lớn.", undefined, "top_right"),
      option("Bottom left", "Click góc dưới trái.", "Dùng với control lớn có vùng dưới.", "Tránh nếu element có border bo hoặc khoảng trống.", undefined, "bottom_left"),
      option("Bottom right", "Click góc dưới phải.", "Dùng với resize handle hoặc control góc phải.", "Tránh nếu không cần chính xác.", undefined, "bottom_right"),
      option("Offset", "Click tọa độ X/Y cụ thể trong element.", "Dùng khi cần điểm exact trong canvas, map, hoặc control phức tạp.", "Tránh khi center/corner đủ ổn định.", undefined, "offset"),
    ],
    Block: [
      option("Start", "Căn element về đầu trục dọc.", "Dùng khi muốn target ở gần mép trên.", "Tránh nếu header sticky che target.", undefined, "start"),
      option("Center", "Căn giữa theo trục dọc.", "Dùng mặc định để target ít bị che.", "Tránh nếu cần cuộn ít nhất.", undefined, "center"),
      option("End", "Căn element về cuối trục dọc.", "Dùng khi cần thấy phần sau target.", "Tránh nếu footer sticky che target.", undefined, "end"),
      option("Nearest", "Cuộn ít nhất để target visible theo trục dọc.", "Dùng khi muốn giảm nhảy layout.", "Tránh nếu cần vị trí chính xác.", undefined, "nearest"),
    ],
    Inline: [
      option("Start", "Căn element về đầu trục ngang.", "Dùng khi target cần sát mép trái.", "Tránh nếu không cần căn ngang.", undefined, "start"),
      option("Center", "Căn giữa theo trục ngang.", "Dùng khi target nằm trong vùng ngang rộng.", "Tránh nếu muốn cuộn ít nhất.", undefined, "center"),
      option("End", "Căn element về cuối trục ngang.", "Dùng khi cần thấy phần bên phải target.", "Tránh nếu không cần căn ngang.", undefined, "end"),
      option("Nearest", "Cuộn ít nhất để target visible theo trục ngang.", "Dùng mặc định để tránh nhảy ngang mạnh.", "Tránh nếu cần vị trí ngang chính xác.", undefined, "nearest"),
    ],
    Direction: [
      option("Down", "Cuộn xuống.", "Dùng để tìm nội dung phía dưới.", "Tránh nếu target ở trên.", undefined, "down"),
      option("Up", "Cuộn lên.", "Dùng để quay lại nội dung phía trên.", "Tránh nếu target ở dưới.", undefined, "up"),
      option("Left", "Cuộn sang trái.", "Dùng với bảng/panel ngang.", "Tránh page dọc thông thường.", undefined, "left"),
      option("Right", "Cuộn sang phải.", "Dùng với bảng/panel ngang.", "Tránh page dọc thông thường.", undefined, "right"),
    ],
    Behavior: [
      option("Instant", "Cuộn ngay.", "Dùng mặc định cho automation ổn định.", "Tránh nếu website cần animation tự nhiên.", undefined, "instant"),
      option("Smooth", "Cuộn mượt.", "Dùng khi page phụ thuộc animation/scroll listener.", "Tránh nếu cần tốc độ và tính dự đoán.", undefined, "smooth"),
    ],
    "Match by": [
      option("Label", "Khớp text hiển thị của option.", "Dùng khi biết chữ người dùng nhìn thấy.", "Tránh khi label thay đổi theo ngôn ngữ.", undefined, "label"),
      option("Value", "Khớp attribute value trong HTML.", "Dùng khi biết value ổn định.", "Tránh khi chỉ biết text hiển thị.", undefined, "value"),
    ],
    State: [
      option("Checked", "Đảm bảo checkbox bật.", "Dùng khi trạng thái cuối phải là bật.", "Tránh nếu chỉ muốn đảo trạng thái.", undefined, "checked"),
      option("Unchecked", "Đảm bảo checkbox tắt.", "Dùng khi trạng thái cuối phải là tắt.", "Tránh nếu chỉ muốn đảo trạng thái.", undefined, "unchecked"),
    ],
    "Full page": [
      option("Yes", "Chụp toàn bộ trang từ đầu tới cuối.", "Dùng khi cần bằng chứng đầy đủ.", "Tránh với trang rất dài nếu file lớn hoặc chậm.", undefined, "true"),
      option("No", "Chỉ chụp viewport hiện tại.", "Dùng khi chỉ cần phần đang nhìn thấy.", "Tránh nếu kết quả nằm ngoài màn hình.", undefined, "false"),
    ],
    Mobile: [
      option("False", "Viewport desktop/tablet thông thường.", "Dùng mặc định cho website desktop.", "Tránh khi cần kiểm tra layout mobile.", undefined, "false"),
      option("True", "Bật mô phỏng mobile viewport.", "Dùng khi workflow chạy trên layout mobile.", "Tránh nếu website desktop là mục tiêu.", undefined, "true"),
    ],
    Touch: [
      option("False", "Không mô phỏng touch input.", "Dùng mặc định cho desktop.", "Tránh khi website chỉ hiện UI touch trên mobile.", undefined, "false"),
      option("True", "Bật khả năng touch.", "Dùng cùng Mobile khi site phụ thuộc touch.", "Tránh nếu workflow dùng desktop interactions.", undefined, "true"),
    ],
    "Match mode": [
      option("Contains", "Text thực tế chỉ cần chứa đoạn mong đợi.", "Dùng khi text có tiền tố/hậu tố hoặc số động.", "Tránh khi cần khớp tuyệt đối.", undefined, "contains"),
      option("Equals", "Text thực tế phải bằng đúng text mong đợi.", "Dùng khi cần kiểm tra chính xác.", "Tránh khi text có khoảng trắng hoặc nội dung động.", undefined, "equals"),
    ],
    Status: [
      option("Success", "Kết thúc workflow thành công.", "Dùng khi dừng có chủ đích và không phải lỗi.", "Tránh cho nhánh lỗi.", undefined, "success"),
      option("Failure", "Kết thúc workflow thất bại.", "Dùng cho nhánh lỗi có chủ đích.", "Tránh nếu đây là kết thúc hợp lệ.", undefined, "failure"),
    ],
    "Click count": [
      option("Single", "Click một lần.", "Dùng cho hầu hết button/link.", "Tránh UI yêu cầu double-click.", undefined, "1"),
      option("Double", "Click hai lần.", "Dùng cho list/file item cần mở bằng double-click.", "Tránh submit button thông thường.", undefined, "2"),
    ],
    "Scroll into view": [
      option("Yes", "Đưa element vào màn hình trước khi click.", "Dùng mặc định để giảm lỗi element ngoài viewport.", "Tránh nếu page tự xử lý scroll đặc biệt.", undefined, "true"),
      option("No", "Không tự scroll trước.", "Dùng khi click theo trạng thái hiện tại của page.", "Tránh nếu element có thể nằm ngoài màn hình.", undefined, "false"),
    ],
    "Block / Inline": [
      option("Start", "Căn về đầu trục.", "Dùng khi cần element sát đầu viewport/container.", "Tránh nếu header sticky che mất element.", undefined, "start"),
      option("Center", "Căn giữa trục.", "Dùng khi muốn target dễ nhìn và ít bị che.", "Tránh nếu cần giữ scroll ít nhất.", undefined, "center"),
      option("End", "Căn về cuối trục.", "Dùng khi cần thấy nội dung ngay sau target.", "Tránh nếu footer/sticky che.", undefined, "end"),
      option("Nearest", "Cuộn ít nhất để element visible.", "Dùng khi muốn giảm nhảy layout.", "Tránh nếu cần vị trí chính xác.", undefined, "nearest"),
    ],
  },
  en: {
    "Wait until": [
      option("Clickable", "Element is visible, enabled, and can receive the action.", "Use before important click or input work.", "Avoid only when a special UI requires fallback behavior.", undefined, "clickable"),
      option("Visible", "Element is visible on the page.", "Use when you need to read or see the element.", "Avoid when you must guarantee clickability.", undefined, "visible"),
      option("Enabled", "Element is not disabled.", "Use for controls that must be ready.", "Avoid when the element may be covered.", undefined, "enabled"),
      option("Attached", "Element exists in the DOM.", "Use when DOM presence is enough.", "Avoid before click/input when the element may not be visible.", undefined, "attached"),
    ],
    "Typing mode": [
      option("Set value", "Sets the value quickly through automation.", "Use for ordinary input and textarea fields.", "Avoid when the site needs real key events.", undefined, "set_value"),
      option("Type keys", "Types one key at a time like a user.", "Use for autocomplete, masks, or per-key listeners.", "Avoid for very long text when paste/fill is stable.", undefined, "type"),
    ],
    "Clear before input": [
      option("Yes", "Clears the old value before entering text.", "Use when the field has autofill or an old value.", "Avoid when you want to append text.", undefined, "true"),
      option("No", "Keeps the current value and adds text.", "Use when you need to append text.", "Avoid when the field must have one exact value.", undefined, "false"),
    ],
    Method: [
      option("Select all", "Selects all text and clears it.", "Use by default for ordinary inputs.", "Avoid when the site needs backspace key events.", undefined, "select_all"),
      option("Backspace", "Deletes with keyboard events.", "Use when the site handles key events.", "Avoid long values when speed matters.", undefined, "backspace"),
      option("DOM value", "Directly sets an empty value.", "Use when speed matters and the app accepts DOM updates.", "Avoid when framework listeners need real events.", undefined, "dom"),
    ],
    Button: [
      option("Left", "Normal left mouse click.", "Use for almost all buttons and links.", "Avoid when opening a context menu.", undefined, "left"),
      option("Right", "Right mouse click.", "Use for custom context menus.", "Avoid ordinary submit buttons or links.", undefined, "right"),
      option("Middle", "Middle mouse click.", "Use for special tab/link behavior.", "Avoid unless the website supports it.", undefined, "middle"),
    ],
    Position: [
      option("Center", "Clicks the element center.", "Use by default for most elements.", "Avoid when the center is not the clickable region.", undefined, "center"),
      option("Top left", "Clicks the top-left corner.", "Use when the clickable area is in that corner.", "Avoid tiny elements where this may miss.", undefined, "top_left"),
      option("Top right", "Clicks the top-right corner.", "Use for icons or actions on the right edge.", "Avoid elements with large padding.", undefined, "top_right"),
      option("Bottom left", "Clicks the bottom-left corner.", "Use for large controls with a bottom region.", "Avoid rounded borders or empty space.", undefined, "bottom_left"),
      option("Bottom right", "Clicks the bottom-right corner.", "Use for resize handles or right-corner controls.", "Avoid when exact targeting is unnecessary.", undefined, "bottom_right"),
      option("Offset", "Clicks a specific X/Y coordinate inside the element.", "Use when you need an exact point in canvas, maps, or complex controls.", "Avoid when center or corners are stable enough.", undefined, "offset"),
    ],
    Block: [
      option("Start", "Aligns the element to the vertical start.", "Use when the target should sit near the top.", "Avoid if a sticky header covers the target.", undefined, "start"),
      option("Center", "Centers the element vertically.", "Use by default to reduce overlap.", "Avoid if minimum scrolling matters.", undefined, "center"),
      option("End", "Aligns the element to the vertical end.", "Use when content after the target should be visible.", "Avoid sticky footers.", undefined, "end"),
      option("Nearest", "Scrolls the least amount needed vertically.", "Use to reduce layout jumping.", "Avoid when exact placement matters.", undefined, "nearest"),
    ],
    Inline: [
      option("Start", "Aligns the element to the horizontal start.", "Use when the target should sit near the left edge.", "Avoid when horizontal alignment does not matter.", undefined, "start"),
      option("Center", "Centers the element horizontally.", "Use when the target is inside a wide horizontal area.", "Avoid if minimum scrolling matters.", undefined, "center"),
      option("End", "Aligns the element to the horizontal end.", "Use when content to the right of the target should be visible.", "Avoid when horizontal alignment does not matter.", undefined, "end"),
      option("Nearest", "Scrolls the least amount needed horizontally.", "Use by default to avoid large horizontal jumps.", "Avoid when exact horizontal placement matters.", undefined, "nearest"),
    ],
    Direction: [
      option("Down", "Scrolls downward.", "Use to find content below.", "Avoid when the target is above.", undefined, "down"),
      option("Up", "Scrolls upward.", "Use to return to content above.", "Avoid when the target is below.", undefined, "up"),
      option("Left", "Scrolls left.", "Use for horizontal tables or panels.", "Avoid ordinary vertical pages.", undefined, "left"),
      option("Right", "Scrolls right.", "Use for horizontal tables or panels.", "Avoid ordinary vertical pages.", undefined, "right"),
    ],
    Behavior: [
      option("Instant", "Scrolls immediately.", "Use by default for predictable automation.", "Avoid if the site depends on natural animation.", undefined, "instant"),
      option("Smooth", "Scrolls with animation.", "Use when the page depends on animation or scroll listeners.", "Avoid when speed and predictability matter.", undefined, "smooth"),
    ],
    "Match by": [
      option("Label", "Matches the visible option text.", "Use when you know what the user sees.", "Avoid when labels change by language.", undefined, "label"),
      option("Value", "Matches the HTML value attribute.", "Use when you know a stable value.", "Avoid when you only know visible text.", undefined, "value"),
    ],
    State: [
      option("Checked", "Ensures the checkbox is on.", "Use when the final state must be checked.", "Avoid when you only want to flip the current state.", undefined, "checked"),
      option("Unchecked", "Ensures the checkbox is off.", "Use when the final state must be unchecked.", "Avoid when you only want to flip the current state.", undefined, "unchecked"),
    ],
    "Full page": [
      option("Yes", "Captures the whole page from top to bottom.", "Use when complete visual evidence is needed.", "Avoid very long pages when file size or speed matters.", undefined, "true"),
      option("No", "Captures only the current viewport.", "Use when the visible area is enough.", "Avoid when the result is off-screen.", undefined, "false"),
    ],
    Mobile: [
      option("False", "Uses a normal desktop/tablet viewport.", "Use by default for desktop sites.", "Avoid when testing mobile layout.", undefined, "false"),
      option("True", "Enables mobile viewport emulation.", "Use when the workflow targets mobile layout.", "Avoid when desktop layout is the target.", undefined, "true"),
    ],
    Touch: [
      option("False", "Does not emulate touch input.", "Use by default for desktop.", "Avoid when the site only exposes touch UI on mobile.", undefined, "false"),
      option("True", "Enables touch capability.", "Use with Mobile when the site depends on touch.", "Avoid when the workflow uses desktop interactions.", undefined, "true"),
    ],
    "Match mode": [
      option("Contains", "Actual text only needs to contain the expected text.", "Use when text has dynamic prefix/suffix or numbers.", "Avoid when exact matching is required.", undefined, "contains"),
      option("Equals", "Actual text must exactly equal the expected text.", "Use when exact text matters.", "Avoid text with dynamic spacing or values.", undefined, "equals"),
    ],
    Status: [
      option("Success", "Ends the workflow successfully.", "Use for intentional non-error stopping.", "Avoid for error branches.", undefined, "success"),
      option("Failure", "Ends the workflow as failed.", "Use for intentional error branches.", "Avoid when this is a valid ending.", undefined, "failure"),
    ],
    "Click count": [
      option("Single", "Clicks once.", "Use for most buttons and links.", "Avoid UI that requires double-click.", undefined, "1"),
      option("Double", "Clicks twice.", "Use for list or file items that open on double-click.", "Avoid ordinary submit buttons.", undefined, "2"),
    ],
    "Scroll into view": [
      option("Yes", "Brings the element into view before clicking.", "Use by default to reduce off-viewport failures.", "Avoid when the page handles scroll in a special way.", undefined, "true"),
      option("No", "Does not scroll before clicking.", "Use when clicking must respect current page state.", "Avoid when the element may be off-screen.", undefined, "false"),
    ],
    "Block / Inline": [
      option("Start", "Aligns to the start of the axis.", "Use when the element should sit near the start.", "Avoid if a sticky header covers the element.", undefined, "start"),
      option("Center", "Aligns to the center of the axis.", "Use when the target should be easy to see and less covered.", "Avoid if minimal scrolling matters.", undefined, "center"),
      option("End", "Aligns to the end of the axis.", "Use when content after the target should be visible.", "Avoid sticky footers.", undefined, "end"),
      option("Nearest", "Scrolls the least amount needed to reveal the element.", "Use to reduce layout jumping.", "Avoid when you need exact placement.", undefined, "nearest"),
    ],
  },
};

function decisionAlternatives(actionType: ActionType, language: StepHelpLanguage) {
  const vi = language === "vi";
  switch (actionType) {
    case "input_text":
      return [
        {
          action: "Type Keys",
          when: vi
            ? "Website phụ thuộc key events, autocomplete, mask, hoặc listener từng phím."
            : "The site depends on key events, autocomplete, masks, or per-key listeners.",
        },
        {
          action: "Paste Into Field",
          when: vi
            ? "Text dài hoặc paste đáng tin cậy hơn gõ."
            : "The text is long or paste is more reliable than typing.",
        },
        {
          action: "Fill Rich Text",
          when: vi
            ? "Element là contenteditable hoặc rich text editor."
            : "The element is contenteditable or a rich text editor.",
        },
      ];
    case "type_sequence":
      return [
        {
          action: "Fill Field",
          when: vi
            ? "Field thường không cần từng sự kiện bàn phím."
            : "The field is ordinary and does not need per-key events.",
        },
      ];
    case "paste_clipboard":
      return [
        {
          action: "Fill Field",
          when: vi ? "Nhập trực tiếp ổn định hơn paste." : "Direct fill is more stable than paste.",
        },
        {
          action: "Type Keys",
          when: vi ? "Website cần sự kiện phím thật." : "The site needs real keyboard events.",
        },
      ];
    case "set_contenteditable":
      return [
        {
          action: "Fill Field",
          when: vi ? "Đích là input hoặc textarea thường." : "The target is a normal input or textarea.",
        },
      ];
    case "toggle_checkbox":
      return [
        {
          action: "Check",
          when: vi ? "Cần đảm bảo checkbox bật." : "You need to ensure the checkbox is checked.",
        },
        {
          action: "Uncheck",
          when: vi ? "Cần đảm bảo checkbox tắt." : "You need to ensure the checkbox is unchecked.",
        },
      ];
    default:
      return undefined;
  }
}

function workflowExamples(
  actionType: ActionType,
  language: StepHelpLanguage,
  content: StepHelpContent,
) {
  const vi = language === "vi";
  if (outputActionTypes.has(actionType)) {
    return [
      {
        title: vi ? "Tạo output rồi dùng ở bước sau" : "Create an output and use it later",
        steps: [
          vi ? "Navigate trang nguồn" : "Navigate to source page",
          `${actionLabels[actionType]} ${vi ? "tạo output" : "creates output"}`,
          vi ? "If hoặc action sau đọc output đó" : "If or a later action reads that output",
        ],
      },
    ];
  }

  return [
    {
      title: vi ? "Luồng cơ bản" : "Basic workflow",
      steps: [
        vi ? "Navigate tới trang cần thao tác" : "Navigate to the target page",
        `${actionLabels[actionType]}: ${content.examples[0] ?? content.summary}`,
        vi ? "Wait hoặc action tiếp theo xác nhận kết quả" : "Wait or the next action confirms the result",
      ],
    },
  ];
}

const outputActionTypes = new Set<ActionType>([
  "extract_text",
  "extract_attribute",
  "extract_input_value",
  "extract_table",
  "extract_list",
  "take_screenshot",
  "wait_for_download",
  "execute_js",
]);

function outputGuidance(actionType: ActionType, language: StepHelpLanguage) {
  if (!outputActionTypes.has(actionType)) return undefined;
  const vi = language === "vi";
  return [
    {
      name: outputNameForAction(actionType),
      description: vi
        ? "Tên output được lưu trong output store của workflow để node hoặc action sau đọc lại."
        : "Output name stored in the workflow output store for later nodes or actions.",
      usedBy: ["If", "Assertions", "Variables", "Later actions"],
    },
  ];
}

function outputNameForAction(actionType: ActionType) {
  switch (actionType) {
    case "take_screenshot":
      return "screenshot_path";
    case "wait_for_download":
      return "download_path";
    case "execute_js":
      return "js_result";
    default:
      return "output_name";
  }
}

function safetyNotes(actionType: ActionType, language: StepHelpLanguage) {
  const vi = language === "vi";
  const advancedActions = new Set<ActionType>([
    "execute_js",
    "use_proxy",
    "set_extra_headers",
    "wait_for_request",
    "wait_for_response",
    "block_request",
    "mock_response",
  ]);
  const humanActions = new Set<ActionType>([
    "detect_challenge",
    "pause_for_human",
    "resume_when_condition",
  ]);

  if (advancedActions.has(actionType)) {
    return [
      vi
        ? "Action nâng cao: chỉ dùng cho workflow được phép và khi action thường không đủ."
        : "Advanced action: use only for authorized workflows when normal actions are not enough.",
    ];
  }

  if (humanActions.has(actionType)) {
    return [
      vi
        ? "Action này tạm dừng cho người xử lý hợp lệ; không dùng để vượt qua CAPTCHA hoặc kiểm soát tài khoản bên thứ ba."
        : "This action pauses for authorized human handling; it does not solve CAPTCHA or third-party account controls.",
    ];
  }

  return undefined;
}

function fieldDetails(
  actionType: ActionType,
  language: StepHelpLanguage,
  fieldName: string,
) {
  const key = `${actionType}:${fieldName}`;
  const specific = specificFieldDetails[language][key];
  if (specific) return specific;

  return commonFieldDetails[language][fieldName] ?? commonFieldDetails[language].default;
}

const specificFieldDetails: Record<StepHelpLanguage, Record<string, string[]>> = {
  vi: {
    "scroll:Mode": [
      "Page: cuộn trang chính. Nếu có Iframe XPath, app cuộn document bên trong iframe đó.",
      "Container: XPath là box/thẻ có scrollbar riêng, ví dụ một div danh sách có overflow.",
      "Into View: XPath là element bạn muốn đưa vào vùng nhìn thấy; mode này không dùng Direction/Pixels.",
      "Until Visible: XPath là element đích cần thấy. App sẽ cuộn theo Direction/Pixels nhiều lần tới khi element visible hoặc hết Max attempts.",
    ],
    "scroll:XPath": [
      "Với Container, XPath là vùng cần cuộn, ví dụ //*[@id='scroll-box'].",
      "Với Into View, XPath là element muốn kéo vào màn hình.",
      "Với Until Visible, XPath là element đích cần thấy, không phải box scroll.",
      "Nếu đang dùng Iframe XPath, XPath này được lấy bên trong iframe, không phải từ trang cha.",
    ],
    "click:Mode": [
      "Real click tạo mouse event thật hơn, phù hợp với đa số button/link và kiểm tra element có bị che hay không.",
      "Force DOM click gọi trực tiếp element.click(), có thể hữu ích với UI khó click nhưng kém giống người dùng thật.",
      "Nên thử Real click trước. Chỉ dùng Force DOM khi bạn hiểu website vẫn xử lý click() trực tiếp.",
    ],
    "wait:Condition": [
      "Duration chờ theo thời gian cố định bằng mili-giây.",
      "Element visible/hidden kiểm tra element có đang nhìn thấy hay không.",
      "Element attached/detached kiểm tra element có tồn tại trong DOM hay không, kể cả chưa visible.",
      "URL contains chờ địa chỉ trình duyệt chứa một đoạn text, hữu ích sau login hoặc chuyển trang.",
    ],
  },
  en: {
    "scroll:Mode": [
      "Page: scrolls the main page. If Iframe XPath is set, it scrolls the document inside that iframe.",
      "Container: XPath is the scrollable box, for example a list div with overflow.",
      "Into View: XPath is the element you want to bring into view; this mode does not use Direction/Pixels.",
      "Until Visible: XPath is the target element. The app scrolls by Direction/Pixels until it is visible or Max attempts is exhausted.",
    ],
    "scroll:XPath": [
      "For Container, XPath is the scroll area, for example //*[@id='scroll-box'].",
      "For Into View, XPath is the element to bring into the viewport.",
      "For Until Visible, XPath is the target element to see, not the scroll box.",
      "When Iframe XPath is set, this XPath is copied from inside the iframe, not from the parent page.",
    ],
    "click:Mode": [
      "Real click sends browser-like mouse events and checks whether the element can receive the click.",
      "Force DOM click directly calls element.click(); it can help with difficult UI but is less like a real user.",
      "Try Real click first. Use Force DOM only when the website handles click() directly.",
    ],
    "wait:Condition": [
      "Duration waits for a fixed time in milliseconds.",
      "Element visible/hidden checks whether an element can or cannot be seen.",
      "Element attached/detached checks whether the element exists in the DOM, even if it is not visible.",
      "URL contains waits until the browser URL contains text, useful after login or navigation.",
    ],
  },
};

const commonFieldDetails: Record<StepHelpLanguage, Record<string, string[]>> = {
  vi: {
    default: [
      "Field này ảnh hưởng trực tiếp tới cách step chạy trong browser.",
      "Nếu step fail, hãy kiểm tra lại giá trị field này trước khi tăng timeout.",
    ],
    URL: [
      "Nên nhập URL đầy đủ như https://example.com/path.",
      "Nếu URL thiếu https:// hoặc có khoảng trắng thừa, browser có thể mở sai trang.",
    ],
    "Wait until": [
      "Attached nghĩa là element tồn tại trong DOM, nhưng có thể chưa nhìn thấy.",
      "Visible nghĩa là element có kích thước và nằm trong viewport.",
      "Enabled nghĩa là element không bị disabled.",
      "Clickable là lựa chọn an toàn nhất cho thao tác click/input vì element phải có thể nhận hành động.",
    ],
    "Timeout ms": [
      "Đơn vị là mili-giây: 1000 = 1 giây, 5000 = 5 giây.",
      "Timeout quá ngắn dễ fail trên mạng chậm; timeout quá dài làm workflow đợi lâu khi XPath sai.",
    ],
    Condition: [
      "Chọn điều kiện đúng giúp workflow ổn định hơn Duration cố định.",
      "Nếu cần chờ element trong iframe, hiện Wait chưa có Iframe XPath; hãy dùng timing phù hợp hoặc step khác hỗ trợ iframe.",
    ],
    "Duration ms": [
      "Đơn vị là mili-giây, ví dụ 500 là nửa giây.",
      "Chỉ dùng khi Condition là Duration.",
    ],
    XPath: [
      "XPath nên trỏ đúng element cần thao tác, không trỏ vào wrapper quá rộng nếu không cần.",
      "Ưu tiên XPath ổn định dựa trên id, name, placeholder, aria-label, text, hoặc attribute ít thay đổi.",
      "Tránh XPath tuyệt đối quá dài như /html/body/div[3]/div[2] nếu website hay đổi layout.",
    ],
    Text: [
      "Đây là nội dung app sẽ nhập hoặc chờ thấy, tùy step.",
      "Kiểm tra khoảng trắng, chữ hoa/thường, và ký tự đặc biệt nếu kết quả không đúng.",
    ],
    "URL contains": [
      "Chỉ nhập đoạn URL cần khớp, ví dụ /dashboard, không nhất thiết nhập cả URL.",
      "Hữu ích sau khi login, redirect, hoặc click chuyển trang.",
    ],
    "Clear before input": [
      "Yes phù hợp khi field có giá trị cũ hoặc browser tự fill.",
      "No phù hợp khi bạn muốn nhập nối thêm vào nội dung hiện có.",
    ],
    "Typing mode": [
      "Set value nhanh và ổn định với nhiều form thông thường.",
      "Type keys giống người dùng hơn, phù hợp với field có autocomplete, mask, hoặc listener theo phím.",
    ],
    "Iframe XPath": [
      "Field này chọn thẻ iframe trên trang cha.",
      "Sau khi có Iframe XPath, XPath chính phải được lấy từ bên trong iframe đó.",
      "Nếu element không nằm trong iframe thì để trống field này.",
    ],
    "Delay ms": [
      "Chỉ quan trọng khi dùng Type keys.",
      "Tăng delay nếu website xử lý từng phím chậm hoặc có autocomplete.",
    ],
    Method: [
      "Select all thường giống thao tác người dùng và an toàn cho input thông thường.",
      "Backspace hữu ích khi website cần sự kiện phím.",
      "DOM value nhanh nhưng có thể không kích hoạt đầy đủ listener của một số framework.",
    ],
    "Click count": [
      "Single là click một lần, dùng cho đa số button/link.",
      "Double dùng cho UI yêu cầu double-click như mở item trong danh sách.",
    ],
    Button: [
      "Left là nút chuột trái thông thường.",
      "Right mở context menu nếu website có hỗ trợ.",
      "Middle hiếm dùng, thường dành cho hành vi mở tab/link đặc biệt.",
    ],
    "Scroll into view": [
      "Yes giúp đưa element vào màn hình trước khi click.",
      "Nếu website tự quản lý scroll hoặc click theo vị trí đặc biệt, có thể thử No.",
    ],
    "Block / Inline": [
      "Block điều khiển căn dọc: start, center, end, nearest.",
      "Inline điều khiển căn ngang: start, center, end, nearest.",
      "Center thường dễ hiểu nhất; nearest ít làm trang nhảy hơn.",
    ],
    Position: [
      "Center click vào giữa element, phù hợp với đa số trường hợp.",
      "Top/Bottom corners hữu ích khi element lớn hoặc có vùng click riêng.",
      "Offset cho phép click vào tọa độ cụ thể bên trong element.",
    ],
    "Offset X / Offset Y": [
      "Chỉ dùng khi Position là Offset.",
      "X/Y tính từ góc trên bên trái của element.",
      "Dùng khi cần click chính xác vào một điểm bên trong canvas, map, hoặc control phức tạp.",
    ],
    "Retry interval ms": [
      "Khoảng nghỉ giữa các lần thử lại khi element chưa sẵn sàng.",
      "Giá trị nhỏ phản ứng nhanh hơn; giá trị lớn giảm tải cho trang.",
    ],
    "Post-click wait ms": [
      "Chờ thêm sau click trước khi step tiếp theo chạy.",
      "Hữu ích khi click mở modal, dropdown, animation, hoặc trigger request ngắn.",
    ],
    Mode: [
      "Mode quyết định ý nghĩa của các field còn lại.",
      "Khi đổi Mode, hãy đọc lại mô tả XPath vì mỗi mode có thể hiểu XPath khác nhau.",
    ],
    Direction: [
      "Down/Up cuộn theo chiều dọc; Left/Right cuộn theo chiều ngang.",
      "Direction dùng trong Page, Container, và Until Visible.",
    ],
    Pixels: [
      "Pixels là khoảng cách cuộn mỗi lần.",
      "250-800 thường hợp lý; quá nhỏ sẽ cần nhiều attempts, quá lớn có thể nhảy qua nội dung.",
    ],
    "Max attempts": [
      "Số lần app thử cuộn trong Until Visible.",
      "Tổng quãng cuộn xấp xỉ Pixels nhân Max attempts.",
    ],
    "Wait ms": [
      "Khoảng nghỉ giữa mỗi lần cuộn để browser kịp render nội dung mới.",
      "Tăng giá trị này nếu trang lazy-load hoặc animation chậm.",
    ],
    Behavior: [
      "Instant nhanh và dễ đoán hơn cho automation.",
      "Smooth nhìn tự nhiên hơn nhưng có thể làm step kéo dài hơn.",
    ],
    "Match by": [
      "Label khớp chữ người dùng nhìn thấy trong dropdown.",
      "Value khớp attribute value trong HTML, thường ổn định hơn nếu bạn biết value.",
    ],
    Value: [
      "Giá trị này phải khớp với Label hoặc Value tùy Match by.",
      "Nếu không chọn được, inspect option để kiểm tra text hiển thị và value thật.",
    ],
    State: [
      "Checked đảm bảo checkbox được bật.",
      "Unchecked đảm bảo checkbox được tắt.",
      "Step này đặt trạng thái cuối cùng, không đơn giản là click toggle.",
    ],
    Key: [
      "Nhập tên phím theo cách browser hiểu, ví dụ Enter, Escape, Tab, ArrowDown.",
      "Dùng khi focus hiện tại đang ở đúng element cần nhận phím.",
    ],
    Keys: [
      "Nhập tổ hợp bằng dấu +, ví dụ Control+S hoặc Meta+K.",
      "Control thường là Ctrl; Meta thường là Command trên macOS.",
    ],
  },
  en: {
    default: [
      "This field directly changes how the step runs in the browser.",
      "If the step fails, check this field before only increasing timeout.",
    ],
    URL: [
      "Use a full URL such as https://example.com/path.",
      "Missing https:// or extra spaces can make the browser open the wrong page.",
    ],
    "Wait until": [
      "Attached means the element exists in the DOM but may not be visible.",
      "Visible means the element has size and is inside the viewport.",
      "Enabled means the element is not disabled.",
      "Clickable is the safest choice for click/input because the element must receive the action.",
    ],
    "Timeout ms": [
      "Unit is milliseconds: 1000 = 1 second, 5000 = 5 seconds.",
      "Too short can fail on slow pages; too long makes wrong XPath failures slower.",
    ],
    Condition: [
      "Choosing the right condition makes workflows more stable than fixed Duration.",
      "Wait currently has no Iframe XPath; use timing carefully or a step that supports iframe when needed.",
    ],
    "Duration ms": [
      "Unit is milliseconds, for example 500 is half a second.",
      "Only used when Condition is Duration.",
    ],
    XPath: [
      "XPath should point to the exact element you want to act on, not a broad wrapper unless intended.",
      "Prefer stable XPath based on id, name, placeholder, aria-label, text, or stable attributes.",
      "Avoid long absolute XPath such as /html/body/div[3]/div[2] when the page layout changes often.",
    ],
    Text: [
      "This is the text the app enters or waits for, depending on the step.",
      "Check whitespace, letter case, and special characters if the result is wrong.",
    ],
    "URL contains": [
      "Enter only the URL fragment to match, such as /dashboard; a full URL is not required.",
      "Useful after login, redirects, or clicks that navigate.",
    ],
    "Clear before input": [
      "Yes is best when the field has an old value or browser autofill.",
      "No is best when you want to append to the existing value.",
    ],
    "Typing mode": [
      "Set value is fast and stable for many normal forms.",
      "Type keys behaves more like a user and helps with autocomplete, masks, or key listeners.",
    ],
    "Iframe XPath": [
      "This selects the iframe element on the parent page.",
      "After setting Iframe XPath, the main XPath must be copied from inside that iframe.",
      "Leave this empty when the element is not inside an iframe.",
    ],
    "Delay ms": [
      "Only important when using Type keys.",
      "Increase delay if the site handles each key slowly or has autocomplete.",
    ],
    Method: [
      "Select all behaves like a user and is safe for normal inputs.",
      "Backspace is useful when the website needs key events.",
      "DOM value is fast but may not trigger every framework listener.",
    ],
    "Click count": [
      "Single clicks once and fits most buttons/links.",
      "Double is for UI that requires double-click, such as opening a list item.",
    ],
    Button: [
      "Left is the normal mouse button.",
      "Right opens a context menu if the website supports it.",
      "Middle is rare and mostly for special link/tab behavior.",
    ],
    "Scroll into view": [
      "Yes brings the element into the visible area before clicking.",
      "Try No when the website manages scroll itself or expects a special position.",
    ],
    "Block / Inline": [
      "Block controls vertical alignment: start, center, end, nearest.",
      "Inline controls horizontal alignment: start, center, end, nearest.",
      "Center is easiest to reason about; nearest moves the page less.",
    ],
    Position: [
      "Center clicks the middle of the element and fits most cases.",
      "Corner positions help when a large element has a specific clickable area.",
      "Offset lets you click exact coordinates inside the element.",
    ],
    "Offset X / Offset Y": [
      "Only used when Position is Offset.",
      "X/Y are measured from the element's top-left corner.",
      "Use for canvas, maps, or complex controls that need precise clicks.",
    ],
    "Retry interval ms": [
      "Delay between retries while the element is not ready.",
      "Smaller values react faster; larger values reduce pressure on the page.",
    ],
    "Post-click wait ms": [
      "Extra wait after click before the next step runs.",
      "Useful when click opens a modal, dropdown, animation, or short request.",
    ],
    Mode: [
      "Mode decides how the other fields are interpreted.",
      "When changing Mode, reread XPath guidance because each mode can use XPath differently.",
    ],
    Direction: [
      "Down/Up scroll vertically; Left/Right scroll horizontally.",
      "Direction is used by Page, Container, and Until Visible.",
    ],
    Pixels: [
      "Pixels is the distance per scroll attempt.",
      "250-800 is usually reasonable; too small needs many attempts, too large can jump past content.",
    ],
    "Max attempts": [
      "How many times the app tries to scroll in Until Visible.",
      "Total scroll distance is roughly Pixels multiplied by Max attempts.",
    ],
    "Wait ms": [
      "Delay between scroll attempts so the browser can render new content.",
      "Increase this for lazy-loaded pages or slow animations.",
    ],
    Behavior: [
      "Instant is faster and more predictable for automation.",
      "Smooth looks more natural but can make the step take longer.",
    ],
    "Match by": [
      "Label matches the visible option text.",
      "Value matches the HTML value attribute and is often stable when you know it.",
    ],
    Value: [
      "This must match either Label or Value depending on Match by.",
      "If selection fails, inspect the option to check visible text and actual value.",
    ],
    State: [
      "Checked ensures the checkbox is on.",
      "Unchecked ensures the checkbox is off.",
      "This sets the final state; it is not just a toggle click.",
    ],
    Key: [
      "Use browser key names such as Enter, Escape, Tab, ArrowDown.",
      "Use when the current focus is already on the element that should receive the key.",
    ],
    Keys: [
      "Enter the combination with +, for example Control+S or Meta+K.",
      "Control usually means Ctrl; Meta usually means Command on macOS.",
    ],
  },
};

export const stepHelpContent: Record<ActionType, BilingualStepHelp> =
  addFieldReference(
    addDecisionGuidance(addFieldDetails({ ...baseStepHelpContent, ...phaseOneStepHelpContent })),
  );
