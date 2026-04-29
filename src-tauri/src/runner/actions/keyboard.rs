use crate::runner::RunnerError;

use super::actionability::click_wait_until_value;
use super::js::{json_string, optional_json_string};
use crate::domain::ClickWaitUntil;

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

#[cfg(test)]
mod tests {
    use crate::domain::ClickWaitUntil;

    use super::*;

    #[test]
    fn keyboard_scripts_express_key_actions() {
        let key = press_key_script("Enter").unwrap();
        let hotkey = hotkey_script(&["Control".to_string(), "S".to_string()]).unwrap();
        let sequence = type_sequence_script(
            "//*[@name='search']",
            None,
            "abc",
            Some(10),
            Some(ClickWaitUntil::Visible),
            Some(3000),
        )
        .unwrap();

        assert!(key.contains("KeyboardEvent"));
        assert!(hotkey.contains("ctrlKey"));
        assert!(sequence.contains("KeyboardEvent"));
        assert!(sequence.contains("inputType: \"insertText\""));
    }
}
