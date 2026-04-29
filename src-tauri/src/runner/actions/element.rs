use crate::{domain::ClickWaitUntil, runner::RunnerError};

use super::{
    actionability::click_wait_until_value,
    js::{json_string, optional_json_string},
};

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

#[cfg(test)]
mod tests {
    use crate::domain::ClickWaitUntil;

    use super::*;

    #[test]
    fn element_scripts_focus_and_blur_elements() {
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

        assert!(focus.contains(".focus"));
        assert!(blur.contains(".blur"));
    }
}
