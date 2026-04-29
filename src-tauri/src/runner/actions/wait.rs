use crate::{domain::WaitCondition, runner::RunnerError};

use super::js::optional_json_string;

pub(super) struct WaitScriptOptions<'a> {
    pub condition: WaitCondition,
    pub xpath: Option<&'a str>,
    pub text: Option<&'a str>,
    pub url: Option<&'a str>,
    pub duration_ms: Option<u64>,
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

#[cfg(test)]
mod tests {
    use crate::domain::WaitCondition;

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
}
