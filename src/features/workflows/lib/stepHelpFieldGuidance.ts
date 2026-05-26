import type { ActionType } from "../../../types/workflow";
import { actionLabels } from "../../../lib/workflowUi";
import type {
  ActionFieldOptionReference,
  StepHelpContent,
  StepHelpLanguage,
} from "./stepHelpTypes";

export function fieldOptions(
  actionType: ActionType,
  language: StepHelpLanguage,
  fieldName: string,
) {
  const key = `${actionType}:${fieldName}`;
  if (isLocatorTypeField(fieldName)) return commonFieldOptions[language]["Locator type"];
  if (fieldName.endsWith("visibility")) return commonFieldOptions[language]["Target visibility"];
  if (fieldName.endsWith("enabled")) return commonFieldOptions[language]["Target enabled"];
  return specificFieldOptions[language][key] ?? commonFieldOptions[language][fieldName];
}

export function isLocatorTypeField(fieldName: string) {
  return fieldName.endsWith("locator type");
}

export function isLocatorValueField(fieldName: string) {
  return fieldName.endsWith("locator");
}

export function isLocatorConstraintField(fieldName: string) {
  return (
    fieldName.endsWith("visibility") ||
    fieldName.endsWith("enabled") ||
    fieldName.endsWith("contains text") ||
    fieldName.endsWith("index")
  );
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
    "Locator type": [
      option("Test ID", "Tìm bằng data-testid hoặc test id tương đương.", "Dùng khi app có selector test ổn định.", "Tránh nếu trang không có test id.", undefined, "test_id"),
      option("Role", "Tìm bằng role ARIA và tên accessible.", "Dùng cho button, link, textbox, checkbox có accessibility tốt.", "Tránh nếu role không rõ hoặc tên thay đổi.", undefined, "role"),
      option("Label", "Tìm control qua label hiển thị.", "Dùng cho input form có label ổn định.", "Tránh nếu label đổi theo locale.", undefined, "label"),
      option("Placeholder", "Tìm input qua placeholder.", "Dùng khi field không có label nhưng placeholder ổn định.", "Tránh nếu placeholder chỉ là hint tạm.", undefined, "placeholder"),
      option("Text", "Tìm element theo text hiển thị.", "Dùng cho link, button, hoặc nội dung có chữ ổn định.", "Tránh text động hoặc dịch theo locale.", undefined, "text"),
      option("CSS", "Tìm bằng CSS selector.", "Dùng khi có class/id/attribute ổn định.", "Tránh selector phụ thuộc layout sâu.", undefined, "css"),
      option("XPath", "Tìm bằng XPath tương thích.", "Dùng làm mặc định tương thích hoặc khi selector khác không đủ.", "Tránh XPath tuyệt đối dài khi layout trang thay đổi thường xuyên.", undefined, "xpath"),
      option("Attribute", "Tìm bằng một attribute cụ thể.", "Dùng khi trang có data attribute ổn định.", "Tránh attribute thay đổi theo session.", undefined, "attribute"),
    ],
    "Target visibility": [
      option("Any", "Không lọc visibility.", "Dùng mặc định khi locator đã đủ chính xác.", "Tránh nếu có cả bản hidden và visible.", undefined, "any"),
      option("Visible", "Chỉ khớp element đang hiển thị.", "Dùng trước thao tác người dùng như click hoặc nhập.", "Tránh nếu cần kiểm tra element hidden.", undefined, "true"),
      option("Hidden", "Chỉ khớp element đang ẩn.", "Dùng cho assertion hoặc wait hidden.", "Tránh cho click/input.", undefined, "false"),
    ],
    "Target enabled": [
      option("Any", "Không lọc trạng thái enabled.", "Dùng khi enabled không quan trọng.", "Tránh nếu control có thể disabled.", undefined, "any"),
      option("Enabled", "Chỉ khớp control sẵn sàng thao tác.", "Dùng trước click/input quan trọng.", "Tránh nếu cần xác nhận disabled.", undefined, "true"),
      option("Disabled", "Chỉ khớp control đang bị disabled.", "Dùng cho assertion trạng thái khóa.", "Tránh cho thao tác nhập/click.", undefined, "false"),
    ],
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
    "Locator type": [
      option("Test ID", "Finds by data-testid or an equivalent test id.", "Use when the app exposes stable test selectors.", "Avoid when the page has no test id.", undefined, "test_id"),
      option("Role", "Finds by ARIA role and accessible name.", "Use for accessible buttons, links, textboxes, and checkboxes.", "Avoid when the role or name is unclear.", undefined, "role"),
      option("Label", "Finds a control by its visible label.", "Use for form inputs with stable labels.", "Avoid labels that change by locale.", undefined, "label"),
      option("Placeholder", "Finds an input by placeholder.", "Use when a field has no label but a stable placeholder.", "Avoid placeholders that are only temporary hints.", undefined, "placeholder"),
      option("Text", "Finds an element by visible text.", "Use for links, buttons, or stable content.", "Avoid dynamic or localized text.", undefined, "text"),
      option("CSS", "Finds by CSS selector.", "Use for stable ids, classes, or attributes.", "Avoid selectors tied to deep layout structure.", undefined, "css"),
      option("XPath", "Finds by XPath.", "Use when other selectors are insufficient.", "Avoid long absolute XPath when the page layout changes often.", undefined, "xpath"),
      option("Attribute", "Finds by a specific attribute.", "Use when the page exposes a stable data attribute.", "Avoid attributes that change by session.", undefined, "attribute"),
    ],
    "Target visibility": [
      option("Any", "Does not constrain visibility.", "Use by default when the locator is already precise.", "Avoid when both hidden and visible copies exist.", undefined, "any"),
      option("Visible", "Matches only visible elements.", "Use before user-like actions such as click or input.", "Avoid when checking hidden state.", undefined, "true"),
      option("Hidden", "Matches only hidden elements.", "Use for assertions or hidden waits.", "Avoid for click or input.", undefined, "false"),
    ],
    "Target enabled": [
      option("Any", "Does not constrain enabled state.", "Use when enabled state does not matter.", "Avoid when a control may be disabled.", undefined, "any"),
      option("Enabled", "Matches only controls ready for interaction.", "Use before important click or input work.", "Avoid when verifying disabled state.", undefined, "true"),
      option("Disabled", "Matches only disabled controls.", "Use for locked-state assertions.", "Avoid for typing or clicking.", undefined, "false"),
    ],
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

export function decisionAlternatives(actionType: ActionType, language: StepHelpLanguage) {
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

export function workflowExamples(
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

export function outputGuidance(actionType: ActionType, language: StepHelpLanguage) {
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

export function safetyNotes(actionType: ActionType, language: StepHelpLanguage) {
  const vi = language === "vi";
  const advancedActions = new Set<ActionType>([
    "execute_js",
    "set_extra_headers",
    "wait_for_request",
    "wait_for_response",
    "block_request",
    "mock_response",
  ]);
  const humanActions = new Set<ActionType>();

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

export function fieldDetails(
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
    "wait:Condition": [
      "Duration chờ theo thời gian cố định bằng mili-giây.",
      "Element visible/hidden kiểm tra element có đang nhìn thấy hay không.",
      "Element attached/detached kiểm tra element có tồn tại trong DOM hay không, kể cả chưa visible.",
      "URL contains chờ địa chỉ trình duyệt chứa một đoạn text, hữu ích sau login hoặc chuyển trang.",
    ],
  },
  en: {
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
    Mode: [
      "Mode quyết định ý nghĩa của các field còn lại.",
      "Page Scroll dùng Direction/Pixels; Scroll To Element và Wait Then Scroll To Element dùng Target locator và Timeout.",
    ],
    Direction: [
      "Down/Up cuộn theo chiều dọc; Left/Right cuộn theo chiều ngang.",
      "Direction chỉ dùng trong Page scroll.",
    ],
    Pixels: [
      "Pixels là tổng khoảng cách cho Page Scroll.",
      "250-800 thường hợp lý cho một hành động cuộn trang.",
    ],
    "Max attempts": [
      "Thông số nội bộ của planner scroll, không cần cấu hình trong Scroll UI hiện tại.",
      "Hệ thống tự giới hạn theo Timeout ms và human preset.",
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
    Mode: [
      "Mode decides how the other fields are interpreted.",
      "Page Scroll uses Direction/Pixels; Scroll To Element and Wait Then Scroll To Element use Target locator and Timeout.",
    ],
    Direction: [
      "Down/Up scroll vertically; Left/Right scroll horizontally.",
      "Direction is only used by Page scroll.",
    ],
    Pixels: [
      "Pixels is the total distance for Page Scroll.",
      "250-800 is usually reasonable for one page-scroll action.",
    ],
    "Max attempts": [
      "Internal scroll-planner tuning; the current Scroll UI does not require configuring it.",
      "The system bounds attempts from Timeout ms and the human preset.",
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
