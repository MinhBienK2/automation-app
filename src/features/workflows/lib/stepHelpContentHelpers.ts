import type { StepHelpContent } from "./stepHelpTypes";

export const xpathField = {
  vi: "XPath chọn element cần thao tác. Nếu element nằm trong iframe, XPath này là XPath bên trong iframe.",
  en: "XPath selects the element to act on. If the element is inside an iframe, this XPath is evaluated inside that iframe.",
};

export const iframeField = {
  vi: "Iframe XPath là XPath của thẻ iframe trên trang cha. Chỉ nhập khi element nằm bên trong iframe.",
  en: "Iframe XPath selects the iframe element on the parent page. Only use it when the target element is inside an iframe.",
};

export const waitUntilField = {
  vi: "Wait until quyết định app đợi element đạt trạng thái nào trước khi thao tác: attached, visible, enabled, hoặc clickable.",
  en: "Wait until controls which element state the app waits for before acting: attached, visible, enabled, or clickable.",
};

export const timeoutField = {
  vi: "Timeout ms là thời gian tối đa app chờ trước khi báo lỗi. 5000 nghĩa là 5 giây.",
  en: "Timeout ms is the maximum time to wait before failing. 5000 means 5 seconds.",
};

export const scrollTimeoutField = {
  vi: "Timeout ms là thời gian tối đa để chờ/scroll tới target. Các mode target scroll mặc định 60000 ms, tức 1 phút.",
  en: "Timeout ms is the maximum time to wait/scroll to the target. Target scroll modes default to 60000 ms, or 1 minute.",
};

export function elementHelpVi(
  title: string,
  viSummary: string,
  example: string,
): StepHelpContent {
  return {
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
  };
}

export function elementHelpEn(
  title: string,
  enSummary: string,
  example: string,
): StepHelpContent {
  return {
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
  };
}

export function variableHelpVi(
  title: string,
  viSummary: string,
): StepHelpContent {
  return {
    title: `Trợ giúp ${title}`,
    summary: viSummary,
    useWhen: ["Dùng để quản lý trạng thái và dữ liệu trong quá trình chạy."],
    fields: [],
    examples: [],
    commonMistakes: [],
  };
}

export function variableHelpEn(
  title: string,
  enSummary: string,
): StepHelpContent {
  return {
    title: `${title} Help`,
    summary: enSummary,
    useWhen: ["Use to manage state and data during execution."],
    fields: [],
    examples: [],
    commonMistakes: [],
  };
}
