use crate::{domain::ClickWaitUntil, runner::RunnerError};

use super::{
    actionability::click_wait_until_value,
    js::{json_string, optional_json_string},
};

pub(super) fn set_clipboard_script(text: &str) -> Result<String, RunnerError> {
    let text = json_string(text)?;
    Ok(format!(
        r#"
        (() => {{
          window.__wamClipboard = {text};
          return {{ ok: true, reason: "" }};
        }})()
        "#
    ))
}

pub(super) fn paste_clipboard_script(
    xpath: &str,
    iframe_xpath: Option<&str>,
    wait_until: Option<ClickWaitUntil>,
    timeout_ms: Option<u64>,
) -> Result<String, RunnerError> {
    let xpath = json_string(xpath)?;
    let iframe_xpath = optional_json_string(iframe_xpath)?;
    let wait_until = click_wait_until_value(wait_until);
    let timeout_ms = timeout_ms.unwrap_or(5000);
    Ok(format!(
        r#"
        (() => new Promise((resolve) => {{
          const xpath = {xpath};
          const iframeXpath = {iframe_xpath};
          const waitUntil = "{wait_until}";
          const timeoutMs = {timeout_ms};
          const startedAt = Date.now();
          const text = window.__wamClipboard || "";
          const resolveDocument = () => iframeXpath
            ? document.evaluate(iframeXpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue?.contentDocument || null
            : document;
          const visible = (node) => {{
            const rect = node.getBoundingClientRect();
            const style = node.ownerDocument.defaultView.getComputedStyle(node);
            return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
          }};
          const enabled = (node) => !node.disabled && node.getAttribute("aria-disabled") !== "true" && !node.readOnly;
          const ready = (node) => waitUntil === "attached" || (waitUntil === "visible" && visible(node)) || (waitUntil !== "visible" && enabled(node));
          const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
          const textareaSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
          const setValue = (node, value) => {{
            if (node instanceof HTMLTextAreaElement && textareaSetter) textareaSetter.call(node, value);
            else if (node instanceof HTMLInputElement && inputSetter) textareaSetter ? inputSetter.call(node, value) : node.value = value;
            else if ("value" in node) node.value = value;
            else if (node.isContentEditable) node.textContent = value;
            else return false;
            return true;
          }};
          const tick = () => {{
            const doc = resolveDocument();
            if (!doc) return resolve({{ ok: false, reason: "Iframe not found" }});
            const node = doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            if (!node) {{
              if (Date.now() - startedAt >= timeoutMs) return resolve({{ ok: false, reason: "XPath not found" }});
              return setTimeout(tick, 50);
            }}
            if (!ready(node)) {{
              if (Date.now() - startedAt >= timeoutMs) return resolve({{ ok: false, reason: "Element cannot receive text" }});
              return setTimeout(tick, 50);
            }}
            node.focus?.();
            const next = ("value" in node ? node.value : node.textContent || "") + text;
            if (!setValue(node, next)) return resolve({{ ok: false, reason: "Element cannot receive text" }});
            node.dispatchEvent(new ClipboardEvent("paste", {{ bubbles: true, clipboardData: new DataTransfer() }}));
            node.dispatchEvent(new InputEvent("input", {{ bubbles: true, inputType: "insertFromPaste", data: text }}));
            node.dispatchEvent(new Event("change", {{ bubbles: true }}));
            return resolve({{ ok: true, reason: "" }});
          }};
          tick();
        }}))()
        "#
    ))
}

#[cfg(test)]
mod tests {
    use crate::domain::ClickWaitUntil;

    use super::*;

    #[test]
    fn clipboard_scripts_store_and_paste_text() {
        let set = set_clipboard_script("hello").unwrap();
        let paste = paste_clipboard_script(
            "//*[@name='notes']",
            None,
            Some(ClickWaitUntil::Visible),
            Some(3000),
        )
        .unwrap();

        assert!(set.contains("__wamClipboard"));
        assert!(paste.contains("__wamClipboard"));
        assert!(paste.contains("ClipboardEvent"));
    }
}
