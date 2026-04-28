import type { ActionType } from "../../../types/workflow";

export type StepHelpLanguage = "vi" | "en";

export type StepHelpContent = {
  title: string;
  summary: string;
  useWhen: string[];
  fields: Array<{
    name: string;
    description: string;
  }>;
  examples: string[];
  commonMistakes: string[];
};

type BilingualStepHelp = Record<StepHelpLanguage, StepHelpContent>;

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

export const stepHelpContent: Record<ActionType, BilingualStepHelp> = {
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
