use crate::{
    domain::{ClearInputMethod, ClickWaitUntil, InputTypingMode},
    runner::RunnerError,
};

use super::{
    actionability::click_wait_until_value,
    js::{json_string, optional_json_string},
};

pub(super) struct InputTextScriptOptions<'a> {
    pub xpath: &'a str,
    pub iframe_xpath: Option<&'a str>,
    pub text: &'a str,
    pub clear_before_input: bool,
    pub typing_mode: Option<InputTypingMode>,
    pub delay_ms: Option<u64>,
    pub wait_until: Option<ClickWaitUntil>,
    pub timeout_ms: Option<u64>,
}

pub(super) fn input_text_script(
    options: InputTextScriptOptions<'_>,
) -> Result<String, RunnerError> {
    let xpath = json_string(options.xpath)?;
    let iframe_xpath = optional_json_string(options.iframe_xpath)?;
    let text = json_string(options.text)?;
    let clear_before_input = options.clear_before_input;
    let typing_mode = input_typing_mode_value(options.typing_mode);
    let delay_ms = match options.typing_mode {
        Some(InputTypingMode::Type) => options.delay_ms.unwrap_or(80),
        Some(InputTypingMode::SetValue) | None => options.delay_ms.unwrap_or(0),
    };
    let wait_until = click_wait_until_value(options.wait_until);
    let timeout_ms = options.timeout_ms.unwrap_or(5000);

    Ok(format!(
        r#"
        (() => new Promise((resolve) => {{
          const xpath = {xpath};
          const iframeXpath = {iframe_xpath};
          const text = {text};
          const clearBeforeInput = {clear_before_input};
          const typingMode = "{typing_mode}";
          const delayMs = {delay_ms};
          const waitUntil = "{wait_until}";
          const timeoutMs = {timeout_ms};
          const startedAt = Date.now();
          const resolveDocument = () => {{
            if (!iframeXpath) return document;
            const iframe = document.evaluate(iframeXpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            return iframe?.contentDocument || null;
          }};
          const findNode = () => {{
            const doc = resolveDocument();
            if (!doc) return null;
            return doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
          }};
          const visible = (node) => {{
            const rect = node.getBoundingClientRect();
            const style = window.getComputedStyle(node);
            return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
          }};
          const enabled = (node) => !node.disabled && node.getAttribute("aria-disabled") !== "true";
          const ready = (node) => waitUntil === "attached" || (waitUntil === "visible" && visible(node)) || (waitUntil !== "visible" && enabled(node));
          const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
          const textareaSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
          const setNativeValue = (element, value) => {{
            if (element instanceof HTMLTextAreaElement && textareaSetter) {{
              textareaSetter.call(element, value);
              return true;
            }}
            if (element instanceof HTMLInputElement && inputSetter) {{
              inputSetter.call(element, value);
              return true;
            }}
            if ("value" in element) {{
              element.value = value;
              return true;
            }}
            return false;
          }};
          const emit = (node, value) => {{
            node.dispatchEvent(new InputEvent("input", {{ bubbles: true, inputType: "insertText", data: value }}));
            node.dispatchEvent(new Event("change", {{ bubbles: true }}));
          }};
          const typeCharacters = async (node) => {{
            if (clearBeforeInput && setNativeValue(node, "")) emit(node, "");
            for (const character of text) {{
              node.dispatchEvent(new KeyboardEvent("keydown", {{ key: character, bubbles: true }}));
              const current = "value" in node ? node.value : node.textContent || "";
              if (setNativeValue(node, current + character)) emit(node, character);
              else if (node.isContentEditable) {{ node.textContent = current + character; emit(node, character); }}
              else return false;
              node.dispatchEvent(new KeyboardEvent("keyup", {{ key: character, bubbles: true }}));
              if (delayMs > 0) await new Promise((done) => setTimeout(done, delayMs));
            }}
            return true;
          }};
          const tick = async () => {{
            const node = findNode();
            if (!node) {{
              if (Date.now() - startedAt >= timeoutMs) return resolve({{ ok: false, reason: "XPath not found" }});
              return setTimeout(tick, 50);
            }}
            if (!ready(node)) {{
              if (Date.now() - startedAt >= timeoutMs) return resolve({{ ok: false, reason: "Element cannot receive text" }});
              return setTimeout(tick, 50);
            }}
            node.focus?.();
            if (typingMode === "type") {{
              const ok = await typeCharacters(node);
              return resolve(ok ? {{ ok: true, reason: "" }} : {{ ok: false, reason: "Element cannot receive text" }});
            }}
            if (setNativeValue(node, text)) {{
              emit(node, text);
              return resolve({{ ok: true, reason: "" }});
            }}
            if (node.isContentEditable) {{
              node.textContent = text;
              emit(node, text);
              return resolve({{ ok: true, reason: "" }});
            }}
            return resolve({{ ok: false, reason: "Element cannot receive text" }});
          }};
          tick();
        }}))()
        "#
    ))
}

pub(super) fn clear_input_script(
    xpath: &str,
    iframe_xpath: Option<&str>,
    method: Option<ClearInputMethod>,
    wait_until: Option<ClickWaitUntil>,
    timeout_ms: Option<u64>,
) -> Result<String, RunnerError> {
    let xpath = json_string(xpath)?;
    let iframe_xpath = optional_json_string(iframe_xpath)?;
    let method = clear_input_method_value(method);
    let wait_until = click_wait_until_value(wait_until);
    let timeout_ms = timeout_ms.unwrap_or(5000);
    Ok(format!(
        r#"
        (() => new Promise((resolve) => {{
          const xpath = {xpath};
          const iframeXpath = {iframe_xpath};
          const method = "{method}";
          const waitUntil = "{wait_until}";
          const timeoutMs = {timeout_ms};
          const startedAt = Date.now();
          const resolveDocument = () => iframeXpath
            ? document.evaluate(iframeXpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue?.contentDocument || null
            : document;
          const findNode = () => {{
            const doc = resolveDocument();
            if (!doc) return {{ ok: false, reason: "Iframe not found", node: null }};
            return {{ ok: true, reason: "", node: doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue }};
          }};
          const visible = (node) => {{
            const rect = node.getBoundingClientRect();
            const style = node.ownerDocument.defaultView.getComputedStyle(node);
            return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
          }};
          const enabled = (node) => !node.disabled && node.getAttribute("aria-disabled") !== "true" && !node.readOnly;
          const ready = (node) => waitUntil === "attached" || (waitUntil === "visible" && visible(node)) || (waitUntil !== "visible" && enabled(node));
          const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
          const textareaSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
          const selectAll = (node) => node.select?.();
          const setValue = (node) => {{
            if (node instanceof HTMLTextAreaElement && textareaSetter) textareaSetter.call(node, "");
            else if (node instanceof HTMLInputElement && inputSetter) inputSetter.call(node, "");
            else if ("value" in node) node.value = "";
            else if (node.isContentEditable) node.textContent = "";
            else return false;
            return true;
          }};
          const tick = () => {{
            const found = findNode();
            if (!found.ok) return resolve({{ ok: false, reason: found.reason }});
            const node = found.node;
            if (!node) {{
              if (Date.now() - startedAt >= timeoutMs) return resolve({{ ok: false, reason: "XPath not found" }});
              return setTimeout(tick, 50);
            }}
            if (!ready(node)) {{
              if (Date.now() - startedAt >= timeoutMs) return resolve({{ ok: false, reason: "Element cannot receive text" }});
              return setTimeout(tick, 50);
            }}
            node.focus?.();
            if (method === "select_all" || method === "backspace") selectAll(node);
            if (!setValue(node)) return resolve({{ ok: false, reason: "Element cannot receive text" }});
            node.dispatchEvent(new InputEvent("input", {{ bubbles: true, inputType: "deleteContentBackward" }}));
            node.dispatchEvent(new Event("change", {{ bubbles: true }}));
            return resolve({{ ok: true, reason: "" }});
          }};
          tick();
        }}))()
        "#
    ))
}

pub(super) fn set_contenteditable_script(
    xpath: &str,
    iframe_xpath: Option<&str>,
    text: &str,
    clear_before_input: bool,
    wait_until: Option<ClickWaitUntil>,
    timeout_ms: Option<u64>,
) -> Result<String, RunnerError> {
    let xpath = json_string(xpath)?;
    let iframe_xpath = optional_json_string(iframe_xpath)?;
    let text = json_string(text)?;
    let wait_until = click_wait_until_value(wait_until);
    let timeout_ms = timeout_ms.unwrap_or(5000);
    Ok(format!(
        r#"
        (() => new Promise((resolve) => {{
          const xpath = {xpath};
          const iframeXpath = {iframe_xpath};
          const text = {text};
          const clearBeforeInput = {clear_before_input};
          const waitUntil = "{wait_until}";
          const timeoutMs = {timeout_ms};
          const startedAt = Date.now();
          const resolveDocument = () => iframeXpath
            ? document.evaluate(iframeXpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue?.contentDocument || null
            : document;
          const visible = (node) => {{
            const rect = node.getBoundingClientRect();
            const style = node.ownerDocument.defaultView.getComputedStyle(node);
            return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
          }};
          const enabled = (node) => node.getAttribute("aria-disabled") !== "true";
          const ready = (node) => waitUntil === "attached" || (waitUntil === "visible" && visible(node)) || (waitUntil !== "visible" && enabled(node));
          const tick = () => {{
            const doc = resolveDocument();
            if (!doc) return resolve({{ ok: false, reason: "Iframe not found" }});
            const node = doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            if (!node) {{
              if (Date.now() - startedAt >= timeoutMs) return resolve({{ ok: false, reason: "XPath not found" }});
              return setTimeout(tick, 50);
            }}
            if (!node.isContentEditable && node.getAttribute("contenteditable") !== "true") return resolve({{ ok: false, reason: "Element is not contenteditable" }});
            if (!ready(node)) {{
              if (Date.now() - startedAt >= timeoutMs) return resolve({{ ok: false, reason: "Element is not visible" }});
              return setTimeout(tick, 50);
            }}
            node.focus?.();
            node.textContent = clearBeforeInput ? text : `${{node.textContent || ""}}${{text}}`;
            node.dispatchEvent(new InputEvent("input", {{ bubbles: true, inputType: "insertText", data: text }}));
            node.dispatchEvent(new Event("change", {{ bubbles: true }}));
            return resolve({{ ok: true, reason: "" }});
          }};
          tick();
        }}))()
        "#
    ))
}

fn input_typing_mode_value(mode: Option<InputTypingMode>) -> &'static str {
    match mode {
        Some(InputTypingMode::Type) => "type",
        Some(InputTypingMode::SetValue) | None => "set_value",
    }
}

fn clear_input_method_value(method: Option<ClearInputMethod>) -> &'static str {
    match method {
        Some(ClearInputMethod::Backspace) => "backspace",
        Some(ClearInputMethod::Dom) => "dom",
        Some(ClearInputMethod::SelectAll) | None => "select_all",
    }
}

#[cfg(test)]
mod tests {
    use crate::domain::{ClearInputMethod, ClickWaitUntil, InputTypingMode};

    use super::*;

    #[test]
    fn input_and_clear_scripts_support_real_field_variants() {
        let input = input_text_script(InputTextScriptOptions {
            xpath: "//*[@name='email']",
            iframe_xpath: None,
            text: "user@example.com",
            clear_before_input: true,
            typing_mode: Some(InputTypingMode::Type),
            delay_ms: Some(10),
            wait_until: Some(ClickWaitUntil::Visible),
            timeout_ms: Some(3000),
        })
        .unwrap();
        let clear = clear_input_script(
            "//*[@name='email']",
            None,
            Some(ClearInputMethod::SelectAll),
            Some(ClickWaitUntil::Visible),
            Some(3000),
        )
        .unwrap();
        let editable = set_contenteditable_script(
            "//*[@contenteditable='true']",
            None,
            "Hello",
            true,
            Some(ClickWaitUntil::Visible),
            Some(3000),
        )
        .unwrap();

        assert!(input.contains("clearBeforeInput"));
        assert!(input.contains("typeCharacters"));
        assert!(clear.contains("selectAll"));
        assert!(clear.contains("InputEvent"));
        assert!(clear.contains("timeoutMs"));
        assert!(clear.contains("waitUntil"));
        assert!(editable.contains("contenteditable"));
        assert!(editable.contains("InputEvent"));
    }

    #[test]
    fn input_type_mode_defaults_to_visible_key_sequence() {
        let input = input_text_script(InputTextScriptOptions {
            xpath: "//*[@name='email']",
            iframe_xpath: None,
            text: "abc",
            clear_before_input: true,
            typing_mode: Some(InputTypingMode::Type),
            delay_ms: None,
            wait_until: Some(ClickWaitUntil::Visible),
            timeout_ms: Some(3000),
        })
        .unwrap();

        assert!(input.contains("const delayMs = 80"));
        assert!(input.contains("KeyboardEvent(\"keydown\""));
        assert!(input.contains("KeyboardEvent(\"keyup\""));
    }
}
