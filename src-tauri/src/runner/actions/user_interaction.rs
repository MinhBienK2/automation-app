use crate::{
    domain::{
        CheckboxState, ClearInputMethod, ClickWaitUntil, InputTypingMode, SelectOptionMatchBy,
        WaitCondition,
    },
    runner::RunnerError,
};

use super::js::{json_string, optional_json_string};

pub(super) struct WaitScriptOptions<'a> {
    pub condition: WaitCondition,
    pub xpath: Option<&'a str>,
    pub text: Option<&'a str>,
    pub url: Option<&'a str>,
    pub duration_ms: Option<u64>,
    pub timeout_ms: Option<u64>,
}

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

pub(super) fn wait_script(options: WaitScriptOptions<'_>) -> Result<String, RunnerError> {
    let condition = wait_condition_value(options.condition);
    let xpath = optional_json_string(options.xpath)?;
    let text = optional_json_string(options.text)?;
    let url = optional_json_string(options.url)?;
    let duration_ms = options.duration_ms.unwrap_or(1000);
    let timeout_ms = options.timeout_ms.unwrap_or(5000);

    Ok(format!(
        r#"
        (() => new Promise((resolve) => {{
          const condition = "{condition}";
          const xpath = {xpath};
          const text = {text};
          const url = {url};
          const durationMs = {duration_ms};
          const timeoutMs = {timeout_ms};
          const startedAt = Date.now();
          const byXpath = (value) => value ? document.evaluate(value, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue : null;
          const isVisible = (node) => {{
            if (!node) return false;
            const style = window.getComputedStyle(node);
            const rect = node.getBoundingClientRect();
            return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
          }};
          const isEnabled = (node) => !node.disabled && node.getAttribute("aria-disabled") !== "true";
          const pass = () => {{
            if (condition === "duration") return Date.now() - startedAt >= durationMs;
            if (condition === "page_load") return document.readyState === "complete";
            if (condition === "url_contains") return window.location.href.includes(url || "");
            if (condition === "text_visible") return document.body?.innerText.includes(text || "");
            const node = byXpath(xpath);
            if (condition === "element_attached") return !!node;
            if (condition === "element_detached") return !node;
            if (!node) return false;
            if (condition === "element_visible") return isVisible(node);
            if (condition === "element_hidden") return !isVisible(node);
            if (condition === "element_enabled") return isEnabled(node);
            if (condition === "element_disabled") return !isEnabled(node);
            return false;
          }};
          const tick = () => {{
            if (pass()) return resolve({{ ok: true, reason: "" }});
            if (Date.now() - startedAt >= timeoutMs) {{
              const reason = xpath && !byXpath(xpath) ? "XPath not found" : "Wait timed out";
              return resolve({{ ok: false, reason }});
            }}
            setTimeout(tick, 50);
          }};
          tick();
        }}))()
        "#
    ))
}

pub(super) fn input_text_script(
    options: InputTextScriptOptions<'_>,
) -> Result<String, RunnerError> {
    let xpath = json_string(options.xpath)?;
    let iframe_xpath = optional_json_string(options.iframe_xpath)?;
    let text = json_string(options.text)?;
    let clear_before_input = options.clear_before_input;
    let typing_mode = input_typing_mode_value(options.typing_mode);
    let delay_ms = options.delay_ms.unwrap_or(0);
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
              const current = "value" in node ? node.value : node.textContent || "";
              if (setNativeValue(node, current + character)) emit(node, character);
              else if (node.isContentEditable) {{ node.textContent = current + character; emit(node, character); }}
              else return false;
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

pub(super) fn select_option_script(
    xpath: &str,
    iframe_xpath: Option<&str>,
    match_by: SelectOptionMatchBy,
    value: &str,
    wait_until: Option<ClickWaitUntil>,
    timeout_ms: Option<u64>,
) -> Result<String, RunnerError> {
    let xpath = json_string(xpath)?;
    let iframe_xpath = optional_json_string(iframe_xpath)?;
    let value = json_string(value)?;
    let match_by = select_option_match_by_value(match_by);
    let wait_until = click_wait_until_value(wait_until);
    let timeout_ms = timeout_ms.unwrap_or(5000);
    Ok(format!(
        r#"
        (() => new Promise((resolve) => {{
          const xpath = {xpath};
          const iframeXpath = {iframe_xpath};
          const matchBy = "{match_by}";
          const desired = {value};
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
          const enabled = (node) => !node.disabled && node.getAttribute("aria-disabled") !== "true";
          const ready = (node) => waitUntil === "attached" || (waitUntil === "visible" && visible(node)) || (waitUntil !== "visible" && enabled(node));
          const tick = () => {{
            const doc = resolveDocument();
            if (!doc) return resolve({{ ok: false, reason: "Iframe not found" }});
            const node = doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            if (!node) {{
              if (Date.now() - startedAt >= timeoutMs) return resolve({{ ok: false, reason: "XPath not found" }});
              return setTimeout(tick, 50);
            }}
            if (!(node instanceof HTMLSelectElement)) return resolve({{ ok: false, reason: "Element is not a select" }});
            if (!ready(node)) {{
              if (Date.now() - startedAt >= timeoutMs) return resolve({{ ok: false, reason: "Element is disabled" }});
              return setTimeout(tick, 50);
            }}
            const option = Array.from(node.options).find((candidate) => matchBy === "label" ? candidate.label === desired || candidate.text === desired : candidate.value === desired);
            if (!option) return resolve({{ ok: false, reason: "Option not found" }});
            if (option.disabled) return resolve({{ ok: false, reason: "Option is disabled" }});
            option.selected = true;
            node.dispatchEvent(new Event("input", {{ bubbles: true }}));
            node.dispatchEvent(new Event("change", {{ bubbles: true }}));
            return resolve({{ ok: true, reason: "" }});
          }};
          tick();
        }}))()
        "#
    ))
}

pub(super) fn set_checkbox_script(
    xpath: &str,
    iframe_xpath: Option<&str>,
    state: CheckboxState,
    wait_until: Option<ClickWaitUntil>,
    timeout_ms: Option<u64>,
) -> Result<String, RunnerError> {
    let xpath = json_string(xpath)?;
    let iframe_xpath = optional_json_string(iframe_xpath)?;
    let desired_checked = matches!(state, CheckboxState::Checked);
    let wait_until = click_wait_until_value(wait_until);
    let timeout_ms = timeout_ms.unwrap_or(5000);
    Ok(format!(
        r#"
        (() => new Promise((resolve) => {{
          const xpath = {xpath};
          const iframeXpath = {iframe_xpath};
          const desiredChecked = {desired_checked};
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
          const enabled = (node) => !node.disabled && node.getAttribute("aria-disabled") !== "true";
          const ready = (node) => waitUntil === "attached" || (waitUntil === "visible" && visible(node)) || (waitUntil !== "visible" && enabled(node));
          const tick = () => {{
            const doc = resolveDocument();
            if (!doc) return resolve({{ ok: false, reason: "Iframe not found" }});
            const node = doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            if (!node) {{
              if (Date.now() - startedAt >= timeoutMs) return resolve({{ ok: false, reason: "XPath not found" }});
              return setTimeout(tick, 50);
            }}
            if (!(node instanceof HTMLInputElement) || node.type !== "checkbox") return resolve({{ ok: false, reason: "Element is not a checkbox" }});
            if (!ready(node)) {{
              if (Date.now() - startedAt >= timeoutMs) return resolve({{ ok: false, reason: "Element is disabled" }});
              return setTimeout(tick, 50);
            }}
            if (node.checked !== desiredChecked) node.click();
            return resolve({{ ok: true, reason: "" }});
          }};
          tick();
        }}))()
        "#
    ))
}

pub(super) fn press_key_script(key: &str) -> Result<String, RunnerError> {
    let key = json_string(key)?;
    Ok(format!(
        r#"
        (() => {{
          const key = {key};
          const target = document.activeElement || document.body;
          target.dispatchEvent(new KeyboardEvent("keydown", {{ key, bubbles: true }}));
          target.dispatchEvent(new KeyboardEvent("keyup", {{ key, bubbles: true }}));
          return {{ ok: true, reason: "" }};
        }})()
        "#
    ))
}

pub(super) fn hotkey_script(keys: &[String]) -> Result<String, RunnerError> {
    let key = keys.last().map(String::as_str).unwrap_or_default();
    let key = json_string(key)?;
    let ctrl_key = keys
        .iter()
        .any(|key| key.eq_ignore_ascii_case("control") || key.eq_ignore_ascii_case("ctrl"));
    let meta_key = keys.iter().any(|key| {
        key.eq_ignore_ascii_case("meta")
            || key.eq_ignore_ascii_case("cmd")
            || key.eq_ignore_ascii_case("command")
    });
    let alt_key = keys.iter().any(|key| key.eq_ignore_ascii_case("alt"));
    let shift_key = keys.iter().any(|key| key.eq_ignore_ascii_case("shift"));
    Ok(format!(
        r#"
        (() => {{
          const key = {key};
          const eventInit = {{ key, ctrlKey: {ctrl_key}, metaKey: {meta_key}, altKey: {alt_key}, shiftKey: {shift_key}, bubbles: true }};
          const target = document.activeElement || document.body;
          target.dispatchEvent(new KeyboardEvent("keydown", eventInit));
          target.dispatchEvent(new KeyboardEvent("keyup", eventInit));
          return {{ ok: true, reason: "" }};
        }})()
        "#
    ))
}

pub(super) fn hover_script(
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
          const resolveDocument = () => iframeXpath
            ? document.evaluate(iframeXpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue?.contentDocument || null
            : document;
          const visible = (node) => {{
            const rect = node.getBoundingClientRect();
            const style = node.ownerDocument.defaultView.getComputedStyle(node);
            return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
          }};
          const enabled = (node) => !node.disabled && node.getAttribute("aria-disabled") !== "true";
          const ready = (node) => waitUntil === "attached" || (waitUntil === "visible" && visible(node)) || (waitUntil !== "visible" && enabled(node));
          const tick = () => {{
            const doc = resolveDocument();
            if (!doc) return resolve({{ ok: false, reason: "Iframe not found" }});
            const node = doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            if (!node) {{
              if (Date.now() - startedAt >= timeoutMs) return resolve({{ ok: false, reason: "XPath not found" }});
              return setTimeout(tick, 50);
            }}
            if (!ready(node)) {{
              if (Date.now() - startedAt >= timeoutMs) return resolve({{ ok: false, reason: "Element is not visible" }});
              return setTimeout(tick, 50);
            }}
            node.dispatchEvent(new MouseEvent("mouseover", {{ bubbles: true }}));
            node.dispatchEvent(new MouseEvent("mouseenter", {{ bubbles: true }}));
            node.dispatchEvent(new MouseEvent("mousemove", {{ bubbles: true }}));
            return resolve({{ ok: true, reason: "" }});
          }};
          tick();
        }}))()
        "#
    ))
}

pub(super) fn focus_element_script(
    xpath: &str,
    iframe_xpath: Option<&str>,
    wait_until: Option<ClickWaitUntil>,
    timeout_ms: Option<u64>,
) -> Result<String, RunnerError> {
    element_method_script(
        xpath,
        iframe_xpath,
        wait_until,
        timeout_ms,
        "focus",
        "focus",
    )
}

pub(super) fn blur_element_script(
    xpath: &str,
    iframe_xpath: Option<&str>,
    wait_until: Option<ClickWaitUntil>,
    timeout_ms: Option<u64>,
) -> Result<String, RunnerError> {
    element_method_script(xpath, iframe_xpath, wait_until, timeout_ms, "blur", "blur")
}

pub(super) fn type_sequence_script(
    xpath: &str,
    iframe_xpath: Option<&str>,
    text: &str,
    delay_ms: Option<u64>,
    wait_until: Option<ClickWaitUntil>,
    timeout_ms: Option<u64>,
) -> Result<String, RunnerError> {
    let xpath = json_string(xpath)?;
    let iframe_xpath = optional_json_string(iframe_xpath)?;
    let text = json_string(text)?;
    let delay_ms = delay_ms.unwrap_or(0);
    let wait_until = click_wait_until_value(wait_until);
    let timeout_ms = timeout_ms.unwrap_or(5000);
    Ok(format!(
        r#"
        (() => new Promise((resolve) => {{
          const xpath = {xpath};
          const iframeXpath = {iframe_xpath};
          const text = {text};
          const delayMs = {delay_ms};
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
          const enabled = (node) => !node.disabled && node.getAttribute("aria-disabled") !== "true" && !node.readOnly;
          const ready = (node) => waitUntil === "attached" || (waitUntil === "visible" && visible(node)) || (waitUntil !== "visible" && enabled(node));
          const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
          const textareaSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
          const currentValue = (node) => "value" in node ? node.value : node.textContent || "";
          const setValue = (node, value) => {{
            if (node instanceof HTMLTextAreaElement && textareaSetter) textareaSetter.call(node, value);
            else if (node instanceof HTMLInputElement && inputSetter) inputSetter.call(node, value);
            else if ("value" in node) node.value = value;
            else if (node.isContentEditable) node.textContent = value;
            else return false;
            return true;
          }};
          const typeInto = async (node) => {{
            node.focus?.();
            for (const character of text) {{
              node.dispatchEvent(new KeyboardEvent("keydown", {{ key: character, bubbles: true }}));
              const next = currentValue(node) + character;
              if (!setValue(node, next)) return false;
              node.dispatchEvent(new InputEvent("input", {{ bubbles: true, inputType: "insertText", data: character }}));
              node.dispatchEvent(new KeyboardEvent("keyup", {{ key: character, bubbles: true }}));
              if (delayMs > 0) await new Promise((done) => setTimeout(done, delayMs));
            }}
            node.dispatchEvent(new Event("change", {{ bubbles: true }}));
            return true;
          }};
          const tick = async () => {{
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
            const ok = await typeInto(node);
            return resolve(ok ? {{ ok: true, reason: "" }} : {{ ok: false, reason: "Element cannot receive text" }});
          }};
          tick();
        }}))()
        "#
    ))
}

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

pub(super) fn toggle_checkbox_script(
    xpath: &str,
    iframe_xpath: Option<&str>,
    wait_until: Option<ClickWaitUntil>,
    timeout_ms: Option<u64>,
) -> Result<String, RunnerError> {
    checkbox_or_radio_script(
        xpath,
        iframe_xpath,
        wait_until,
        timeout_ms,
        "checkbox",
        None,
    )
}

pub(super) fn select_radio_script(
    xpath: &str,
    iframe_xpath: Option<&str>,
    wait_until: Option<ClickWaitUntil>,
    timeout_ms: Option<u64>,
) -> Result<String, RunnerError> {
    checkbox_or_radio_script(
        xpath,
        iframe_xpath,
        wait_until,
        timeout_ms,
        "radio",
        Some(true),
    )
}

pub(super) fn drag_and_drop_script(
    source_xpath: &str,
    target_xpath: &str,
    iframe_xpath: Option<&str>,
    wait_until: Option<ClickWaitUntil>,
    timeout_ms: Option<u64>,
) -> Result<String, RunnerError> {
    let source_xpath = json_string(source_xpath)?;
    let target_xpath = json_string(target_xpath)?;
    let iframe_xpath = optional_json_string(iframe_xpath)?;
    let wait_until = click_wait_until_value(wait_until);
    let timeout_ms = timeout_ms.unwrap_or(5000);
    Ok(format!(
        r#"
        (() => new Promise((resolve) => {{
          const sourceXpath = {source_xpath};
          const targetXpath = {target_xpath};
          const iframeXpath = {iframe_xpath};
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
          const ready = (node) => waitUntil === "attached" || visible(node);
          const tick = () => {{
            const doc = resolveDocument();
            if (!doc) return resolve({{ ok: false, reason: "Iframe not found" }});
            const source = doc.evaluate(sourceXpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            const target = doc.evaluate(targetXpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            if (!source) {{
              if (Date.now() - startedAt >= timeoutMs) return resolve({{ ok: false, reason: "Source XPath not found" }});
              return setTimeout(tick, 50);
            }}
            if (!target) {{
              if (Date.now() - startedAt >= timeoutMs) return resolve({{ ok: false, reason: "Target XPath not found" }});
              return setTimeout(tick, 50);
            }}
            if (!ready(source) || !ready(target)) {{
              if (Date.now() - startedAt >= timeoutMs) return resolve({{ ok: false, reason: "Element is not visible" }});
              return setTimeout(tick, 50);
            }}
            const dataTransfer = new DataTransfer();
            source.dispatchEvent(new DragEvent("dragstart", {{ bubbles: true, cancelable: true, dataTransfer }}));
            target.dispatchEvent(new DragEvent("dragenter", {{ bubbles: true, cancelable: true, dataTransfer }}));
            target.dispatchEvent(new DragEvent("dragover", {{ bubbles: true, cancelable: true, dataTransfer }}));
            target.dispatchEvent(new DragEvent("drop", {{ bubbles: true, cancelable: true, dataTransfer }}));
            source.dispatchEvent(new DragEvent("dragend", {{ bubbles: true, cancelable: true, dataTransfer }}));
            return resolve({{ ok: true, reason: "" }});
          }};
          tick();
        }}))()
        "#
    ))
}

fn element_method_script(
    xpath: &str,
    iframe_xpath: Option<&str>,
    wait_until: Option<ClickWaitUntil>,
    timeout_ms: Option<u64>,
    method: &str,
    event_name: &str,
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
          const resolveDocument = () => iframeXpath
            ? document.evaluate(iframeXpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue?.contentDocument || null
            : document;
          const visible = (node) => {{
            const rect = node.getBoundingClientRect();
            const style = node.ownerDocument.defaultView.getComputedStyle(node);
            return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
          }};
          const enabled = (node) => !node.disabled && node.getAttribute("aria-disabled") !== "true";
          const ready = (node) => waitUntil === "attached" || (waitUntil === "visible" && visible(node)) || (waitUntil !== "visible" && enabled(node));
          const tick = () => {{
            const doc = resolveDocument();
            if (!doc) return resolve({{ ok: false, reason: "Iframe not found" }});
            const node = doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            if (!node) {{
              if (Date.now() - startedAt >= timeoutMs) return resolve({{ ok: false, reason: "XPath not found" }});
              return setTimeout(tick, 50);
            }}
            if (!ready(node)) {{
              if (Date.now() - startedAt >= timeoutMs) return resolve({{ ok: false, reason: "Element is not visible" }});
              return setTimeout(tick, 50);
            }}
            node.{method}?.();
            node.dispatchEvent(new Event("{event_name}", {{ bubbles: true }}));
            return resolve({{ ok: true, reason: "" }});
          }};
          tick();
        }}))()
        "#
    ))
}

fn checkbox_or_radio_script(
    xpath: &str,
    iframe_xpath: Option<&str>,
    wait_until: Option<ClickWaitUntil>,
    timeout_ms: Option<u64>,
    expected_type: &str,
    desired_checked: Option<bool>,
) -> Result<String, RunnerError> {
    let xpath = json_string(xpath)?;
    let iframe_xpath = optional_json_string(iframe_xpath)?;
    let wait_until = click_wait_until_value(wait_until);
    let timeout_ms = timeout_ms.unwrap_or(5000);
    let desired_checked = desired_checked
        .map(|value| value.to_string())
        .unwrap_or_else(|| "null".to_string());
    Ok(format!(
        r#"
        (() => new Promise((resolve) => {{
          const xpath = {xpath};
          const iframeXpath = {iframe_xpath};
          const expectedType = "{expected_type}";
          const desiredChecked = {desired_checked};
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
          const enabled = (node) => !node.disabled && node.getAttribute("aria-disabled") !== "true";
          const ready = (node) => waitUntil === "attached" || (waitUntil === "visible" && visible(node)) || (waitUntil !== "visible" && enabled(node));
          const tick = () => {{
            const doc = resolveDocument();
            if (!doc) return resolve({{ ok: false, reason: "Iframe not found" }});
            const node = doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            if (!node) {{
              if (Date.now() - startedAt >= timeoutMs) return resolve({{ ok: false, reason: "XPath not found" }});
              return setTimeout(tick, 50);
            }}
            if (!(node instanceof HTMLInputElement) || node.type !== expectedType) return resolve({{ ok: false, reason: `Element is not a ${{expectedType}}` }});
            if (!ready(node)) {{
              if (Date.now() - startedAt >= timeoutMs) return resolve({{ ok: false, reason: "Element is disabled" }});
              return setTimeout(tick, 50);
            }}
            if (desiredChecked === null || node.checked !== desiredChecked) node.click();
            return resolve({{ ok: true, reason: "" }});
          }};
          tick();
        }}))()
        "#
    ))
}

fn wait_condition_value(condition: WaitCondition) -> &'static str {
    match condition {
        WaitCondition::Duration => "duration",
        WaitCondition::ElementVisible => "element_visible",
        WaitCondition::ElementHidden => "element_hidden",
        WaitCondition::ElementAttached => "element_attached",
        WaitCondition::ElementDetached => "element_detached",
        WaitCondition::TextVisible => "text_visible",
        WaitCondition::UrlContains => "url_contains",
        WaitCondition::PageLoad => "page_load",
        WaitCondition::ElementEnabled => "element_enabled",
        WaitCondition::ElementDisabled => "element_disabled",
    }
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

fn select_option_match_by_value(match_by: SelectOptionMatchBy) -> &'static str {
    match match_by {
        SelectOptionMatchBy::Label => "label",
        SelectOptionMatchBy::Value => "value",
    }
}

fn click_wait_until_value(wait_until: Option<ClickWaitUntil>) -> &'static str {
    match wait_until {
        Some(ClickWaitUntil::Attached) => "attached",
        Some(ClickWaitUntil::Visible) => "visible",
        Some(ClickWaitUntil::Enabled) => "enabled",
        Some(ClickWaitUntil::Clickable) | None => "clickable",
    }
}

#[cfg(test)]
mod tests {
    use crate::domain::{
        CheckboxState, ClearInputMethod, ClickWaitUntil, InputTypingMode, SelectOptionMatchBy,
        WaitCondition,
    };

    use super::*;

    #[test]
    fn wait_script_supports_duration_and_element_conditions() {
        let duration = wait_script(WaitScriptOptions {
            condition: WaitCondition::Duration,
            xpath: None,
            text: None,
            url: None,
            duration_ms: Some(250),
            timeout_ms: None,
        })
        .unwrap();
        let element = wait_script(WaitScriptOptions {
            condition: WaitCondition::ElementVisible,
            xpath: Some("//*[@id='ready']"),
            text: None,
            url: None,
            duration_ms: None,
            timeout_ms: Some(3000),
        })
        .unwrap();

        assert!(duration.contains("setTimeout"));
        assert!(element.contains("element_visible"));
        assert!(element.contains("XPath not found"));
    }

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

        assert!(input.contains("clearBeforeInput"));
        assert!(input.contains("typeCharacters"));
        assert!(clear.contains("selectAll"));
        assert!(clear.contains("InputEvent"));
        assert!(clear.contains("timeoutMs"));
        assert!(clear.contains("waitUntil"));
    }

    #[test]
    fn form_and_keyboard_scripts_express_user_actions() {
        let select = select_option_script(
            "//*[@name='country']",
            None,
            SelectOptionMatchBy::Label,
            "Vietnam",
            Some(ClickWaitUntil::Visible),
            Some(3000),
        )
        .unwrap();
        let checkbox = set_checkbox_script(
            "//*[@name='terms']",
            None,
            CheckboxState::Checked,
            Some(ClickWaitUntil::Enabled),
            Some(3000),
        )
        .unwrap();
        let key = press_key_script("Enter").unwrap();
        let hotkey = hotkey_script(&["Control".to_string(), "S".to_string()]).unwrap();
        let hover = hover_script(
            "//*[@id='menu']",
            None,
            Some(ClickWaitUntil::Visible),
            Some(3000),
        )
        .unwrap();

        assert!(select.contains("selected = true"));
        assert!(select.contains("timeoutMs"));
        assert!(checkbox.contains("desiredChecked"));
        assert!(checkbox.contains("waitUntil"));
        assert!(key.contains("KeyboardEvent"));
        assert!(hotkey.contains("ctrlKey"));
        assert!(hover.contains("mouseover"));
        assert!(hover.contains("timeoutMs"));
    }

    #[test]
    fn phase_one_scripts_express_human_interaction_actions() {
        let focus = focus_element_script(
            "//*[@name='email']",
            None,
            Some(ClickWaitUntil::Visible),
            Some(3000),
        )
        .unwrap();
        let blur = blur_element_script(
            "//*[@name='email']",
            None,
            Some(ClickWaitUntil::Visible),
            Some(3000),
        )
        .unwrap();
        let sequence = type_sequence_script(
            "//*[@name='search']",
            None,
            "abc",
            Some(10),
            Some(ClickWaitUntil::Visible),
            Some(3000),
        )
        .unwrap();
        let paste = paste_clipboard_script(
            "//*[@name='notes']",
            None,
            Some(ClickWaitUntil::Visible),
            Some(3000),
        )
        .unwrap();
        let toggle = toggle_checkbox_script(
            "//*[@name='terms']",
            None,
            Some(ClickWaitUntil::Enabled),
            Some(3000),
        )
        .unwrap();
        let radio = select_radio_script(
            "//*[@value='email']",
            None,
            Some(ClickWaitUntil::Enabled),
            Some(3000),
        )
        .unwrap();
        let drag = drag_and_drop_script(
            "//*[@id='source']",
            "//*[@id='target']",
            None,
            Some(ClickWaitUntil::Visible),
            Some(3000),
        )
        .unwrap();

        assert!(focus.contains(".focus"));
        assert!(blur.contains(".blur"));
        assert!(sequence.contains("KeyboardEvent"));
        assert!(sequence.contains("inputType: \"insertText\""));
        assert!(paste.contains("__wamClipboard"));
        assert!(toggle.contains("node.click"));
        assert!(radio.contains("radio"));
        assert!(drag.contains("dragstart"));
        assert!(drag.contains("drop"));
    }
}
