import type { ActionType } from "../../../types/workflow";

export type StepHelpLanguage = "vi" | "en";

export type StepHelpContent = {
  title: string;
  summary: string;
  useWhen: string[];
  fields: Array<{
    name: string;
    description: string;
    details?: string[];
  }>;
  examples: string[];
  commonMistakes: string[];
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
  | "resume_when_condition";

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
  open_url: {
    vi: {
      title: "Trợ giúp Open URL",
      summary: "Mở một URL. Đây là step legacy đơn giản hơn Navigate.",
      useWhen: ["Dùng cho workflow cũ hoặc khi chỉ cần mở trang mà không cấu hình wait nâng cao."],
      fields: [{ name: "URL", description: "Địa chỉ trang web đầy đủ, ví dụ https://example.com." }],
      examples: ["URL: https://w3schools.com/html/html_iframe.asp"],
      commonMistakes: ["Dùng URL thiếu giao thức như example.com thay vì https://example.com."],
    },
    en: {
      title: "Open URL Help",
      summary: "Open a URL. This is the simpler legacy version of Navigate.",
      useWhen: ["Use for older workflows or when you only need to open a page without advanced waiting."],
      fields: [{ name: "URL", description: "The full website address, for example https://example.com." }],
      examples: ["URL: https://w3schools.com/html/html_iframe.asp"],
      commonMistakes: ["Using a URL without a protocol, such as example.com instead of https://example.com."],
    },
  },
  sleep: {
    vi: {
      title: "Trợ giúp Sleep",
      summary: "Tạm dừng workflow trong một khoảng thời gian cố định.",
      useWhen: ["Dùng khi trang cần thêm thời gian để animation, popup, hoặc dữ liệu xuất hiện.", "Dùng tạm thời khi chưa có điều kiện Wait phù hợp."],
      fields: [{ name: "Seconds", description: "Số giây cần chờ. Có thể dùng số thập phân như 0.5." }],
      examples: ["Seconds: 1", "Seconds: 0.5"],
      commonMistakes: ["Lạm dụng Sleep quá dài làm workflow chạy chậm.", "Dùng 0 giây sẽ bị validation chặn."],
    },
    en: {
      title: "Sleep Help",
      summary: "Pause the workflow for a fixed amount of time.",
      useWhen: ["Use when a page needs extra time for animation, popups, or data.", "Use as a temporary fallback when no Wait condition fits yet."],
      fields: [{ name: "Seconds", description: "How many seconds to wait. Decimal values like 0.5 are allowed." }],
      examples: ["Seconds: 1", "Seconds: 0.5"],
      commonMistakes: ["Long sleeps make workflows slow.", "0 seconds is rejected by validation."],
    },
  },
  wait: {
    vi: {
      title: "Trợ giúp Wait",
      summary: "Chờ một điều kiện xảy ra trước khi chạy step tiếp theo.",
      useWhen: ["Dùng thay Sleep khi bạn biết chính xác cần chờ gì.", "Dùng để chờ element hiện, biến mất, URL đổi, text xuất hiện, hoặc trang tải."],
      fields: [
        { name: "Condition", description: "Điều kiện cần chờ: thời gian, element, text, URL, hoặc page load." },
        { name: "Duration ms", description: "Số mili-giây cần chờ khi Condition là Duration." },
        { name: "XPath", description: "XPath của element cần kiểm tra khi Condition là element_*." },
        { name: "Text", description: "Đoạn chữ cần thấy trên trang khi Condition là Text visible." },
        { name: "URL contains", description: "Đoạn URL cần xuất hiện khi Condition là URL contains." },
        { name: "Timeout ms", description: timeoutField.vi },
      ],
      examples: ["Condition: Element visible, XPath: //*[@id='result']", "Condition: URL contains, URL contains: /dashboard"],
      commonMistakes: ["Dùng Sleep cố định trong khi Wait element visible sẽ ổn định hơn.", "XPath phải trỏ đúng element cần kiểm tra."],
    },
    en: {
      title: "Wait Help",
      summary: "Wait for a condition before running the next step.",
      useWhen: ["Use instead of Sleep when you know what must happen.", "Use to wait for elements, text, URL changes, or page load."],
      fields: [
        { name: "Condition", description: "The condition to wait for: time, element state, text, URL, or page load." },
        { name: "Duration ms", description: "Milliseconds to wait when Condition is Duration." },
        { name: "XPath", description: "XPath of the element to check when Condition is element_*." },
        { name: "Text", description: "Text that must appear when Condition is Text visible." },
        { name: "URL contains", description: "URL fragment that must appear when Condition is URL contains." },
        { name: "Timeout ms", description: timeoutField.en },
      ],
      examples: ["Condition: Element visible, XPath: //*[@id='result']", "Condition: URL contains, URL contains: /dashboard"],
      commonMistakes: ["Using fixed Sleep when Wait element visible would be more stable.", "XPath must point to the element being checked."],
    },
  },
  input_text: {
    vi: {
      title: "Trợ giúp Input Text",
      summary: "Nhập text vào input, textarea, hoặc element có thể nhập liệu.",
      useWhen: ["Dùng cho form đăng nhập, search box, textarea, hoặc field cần nhập dữ liệu.", "Nên dùng thay Type Text khi cần hỗ trợ iframe và wait nâng cao."],
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
      title: "Input Text Help",
      summary: "Enter text into an input, textarea, or editable element.",
      useWhen: ["Use for login forms, search boxes, textareas, or fields that need text.", "Prefer this over Type Text when you need iframe or wait support."],
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
  type_text: {
    vi: {
      title: "Trợ giúp Type Text",
      summary: "Nhập text vào element theo XPath. Đây là step legacy đơn giản.",
      useWhen: ["Dùng cho workflow cũ.", "Dùng khi chỉ cần nhập nhanh vào field trên trang chính."],
      fields: [
        { name: "XPath", description: "XPath của input, textarea, hoặc contenteditable trên trang chính." },
        { name: "Text", description: "Nội dung cần nhập." },
      ],
      examples: ["XPath: //*[@name='q'], Text: automation"],
      commonMistakes: ["Step này không có Iframe XPath; nếu cần iframe hãy dùng Input Text."],
    },
    en: {
      title: "Type Text Help",
      summary: "Enter text into an element by XPath. This is a simple legacy step.",
      useWhen: ["Use for older workflows.", "Use when you only need simple typing on the main page."],
      fields: [
        { name: "XPath", description: "XPath of an input, textarea, or contenteditable element on the main page." },
        { name: "Text", description: "The text to enter." },
      ],
      examples: ["XPath: //*[@name='q'], Text: automation"],
      commonMistakes: ["This step has no Iframe XPath; use Input Text for iframe fields."],
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
  paste_clipboard: elementHelp("Paste Clipboard", "paste clipboard text", "dán clipboard", "paste"),
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
  set_variable: elementHelp("Set Variable", "save a reusable value", "lưu biến", "variable"),
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
      commonMistakes: ["Dùng Input Text cho field thường sẽ nhanh và ổn định hơn.", "Delay 0 không hợp lệ; bỏ trống nếu không cần delay."],
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
      commonMistakes: ["Input Text is faster and more stable for normal fields.", "Delay 0 is invalid; leave it blank when no delay is needed."],
    },
  },
  set_clipboard: {
    vi: {
      title: "Trợ giúp Set Clipboard",
      summary: "Đặt nội dung clipboard nội bộ của workflow để dùng ở step Paste Clipboard.",
      useWhen: ["Dùng khi website xử lý paste tốt hơn nhập từng ký tự.", "Dùng trước Paste Clipboard."],
      fields: [{ name: "Text", description: "Nội dung cần đưa vào clipboard workflow." }],
      examples: ["Text: Nội dung cần dán"],
      commonMistakes: ["Step này chỉ chuẩn bị nội dung; dùng Paste Clipboard để dán vào field."],
    },
    en: {
      title: "Set Clipboard Help",
      summary: "Set the workflow clipboard text for a later Paste Clipboard step.",
      useWhen: ["Use when the site handles paste better than typing.", "Use before Paste Clipboard."],
      fields: [{ name: "Text", description: "The text to place into the workflow clipboard." }],
      examples: ["Text: Text to paste"],
      commonMistakes: ["This only prepares the text; use Paste Clipboard to put it into a field."],
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
      "Duration chỉ chờ theo thời gian cố định, giống Sleep nhưng dùng mili-giây.",
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
      "Duration waits for fixed time, like Sleep, but in milliseconds.",
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
    Seconds: [
      "Dùng số nhỏ trước, ví dụ 0.5 hoặc 1, rồi tăng nếu trang tải chậm.",
      "Sleep không kiểm tra điều kiện thật; nếu có thể, Wait thường ổn định hơn.",
    ],
    Condition: [
      "Chọn điều kiện đúng giúp workflow ổn định hơn Sleep cố định.",
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
    Seconds: [
      "Start small, such as 0.5 or 1, then increase if the page is slow.",
      "Sleep does not check a real condition; Wait is usually more stable when possible.",
    ],
    Condition: [
      "Choosing the right condition makes workflows more stable than fixed Sleep.",
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
  addFieldDetails({ ...baseStepHelpContent, ...phaseOneStepHelpContent });
