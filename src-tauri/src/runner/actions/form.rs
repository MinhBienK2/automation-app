use crate::{
    domain::{CheckboxState, ClickWaitUntil, SelectOptionMatchBy},
    runner::RunnerError,
};

use super::{
    actionability::click_wait_until_value,
    js::{json_string, optional_json_string},
};

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

pub(super) fn submit_form_script(
    xpath: Option<&str>,
    iframe_xpath: Option<&str>,
    wait_until: Option<ClickWaitUntil>,
    timeout_ms: Option<u64>,
) -> Result<String, RunnerError> {
    let xpath = optional_json_string(xpath)?;
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
            const target = xpath ? doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue : doc.querySelector("form");
            if (!target) {{
              if (Date.now() - startedAt >= timeoutMs) return resolve({{ ok: false, reason: xpath ? "XPath not found" : "Form not found" }});
              return setTimeout(tick, 50);
            }}
            if (!ready(target)) {{
              if (Date.now() - startedAt >= timeoutMs) return resolve({{ ok: false, reason: "Element is not visible" }});
              return setTimeout(tick, 50);
            }}
            const form = target instanceof HTMLFormElement ? target : target.closest?.("form");
            if (!form) return resolve({{ ok: false, reason: "Form not found" }});
            if (form.requestSubmit) form.requestSubmit();
            else form.dispatchEvent(new Event("submit", {{ bubbles: true, cancelable: true }}));
            return resolve({{ ok: true, reason: "" }});
          }};
          tick();
        }}))()
        "#
    ))
}

pub(super) fn select_custom_option_script(
    trigger_xpath: &str,
    option_text: &str,
    iframe_xpath: Option<&str>,
    timeout_ms: Option<u64>,
) -> Result<String, RunnerError> {
    let trigger_xpath = json_string(trigger_xpath)?;
    let option_text = json_string(option_text)?;
    let iframe_xpath = optional_json_string(iframe_xpath)?;
    let timeout_ms = timeout_ms.unwrap_or(5000);
    Ok(format!(
        r#"
        (() => new Promise((resolve) => {{
          const triggerXpath = {trigger_xpath};
          const optionText = {option_text};
          const iframeXpath = {iframe_xpath};
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
          const byText = (doc) => Array.from(doc.querySelectorAll("[role='option'], option, li, button, div, span"))
            .find((node) => visible(node) && (node.textContent || "").trim() === optionText);
          const tickOption = (doc) => {{
            const option = byText(doc);
            if (option) {{
              option.click();
              return resolve({{ ok: true, reason: "" }});
            }}
            if (Date.now() - startedAt >= timeoutMs) return resolve({{ ok: false, reason: "Option not found" }});
            setTimeout(() => tickOption(doc), 50);
          }};
          const doc = resolveDocument();
          if (!doc) return resolve({{ ok: false, reason: "Iframe not found" }});
          const trigger = doc.evaluate(triggerXpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
          if (!trigger) return resolve({{ ok: false, reason: "XPath not found" }});
          trigger.click();
          setTimeout(() => tickOption(doc), 0);
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

fn select_option_match_by_value(match_by: SelectOptionMatchBy) -> &'static str {
    match match_by {
        SelectOptionMatchBy::Label => "label",
        SelectOptionMatchBy::Value => "value",
    }
}

#[cfg(test)]
mod tests {
    use crate::domain::{CheckboxState, ClickWaitUntil, SelectOptionMatchBy};

    use super::*;

    #[test]
    fn form_scripts_express_form_actions() {
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
        let submit = submit_form_script(
            Some("//*[@id='login-form']"),
            None,
            Some(ClickWaitUntil::Visible),
            Some(3000),
        )
        .unwrap();
        let custom =
            select_custom_option_script("//*[@role='combobox']", "Vietnam", None, Some(3000))
                .unwrap();

        assert!(select.contains("selected = true"));
        assert!(select.contains("timeoutMs"));
        assert!(checkbox.contains("desiredChecked"));
        assert!(checkbox.contains("waitUntil"));
        assert!(toggle.contains("node.click"));
        assert!(radio.contains("radio"));
        assert!(submit.contains("requestSubmit"));
        assert!(custom.contains("optionText"));
        assert!(custom.contains("click"));
    }
}
