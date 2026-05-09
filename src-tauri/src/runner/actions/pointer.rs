use serde::Deserialize;

use crate::{
    domain::{ClickPosition, ClickWaitUntil, ScrollBlock, ScrollInline},
    runner::RunnerError,
};

use super::{
    actionability::click_wait_until_value,
    js::{json_string, optional_json_string},
    scroll_block_value, scroll_inline_value,
};

pub(super) struct ClickScriptOptions<'a> {
    pub xpath: &'a str,
    pub iframe_xpath: Option<&'a str>,
    pub scroll_into_view: Option<bool>,
    pub block: Option<ScrollBlock>,
    pub inline: Option<ScrollInline>,
    pub position: Option<ClickPosition>,
    pub offset_x: Option<f64>,
    pub offset_y: Option<f64>,
    pub wait_until: Option<ClickWaitUntil>,
    pub timeout_ms: Option<u64>,
    pub retry_interval_ms: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub(super) struct ClickTargetResult {
    pub ok: bool,
    pub reason: String,
    pub x: f64,
    pub y: f64,
}

pub(super) fn force_dom_click_script(
    xpath: &str,
    iframe_xpath: Option<&str>,
) -> Result<String, RunnerError> {
    let xpath = json_string(xpath)?;
    let iframe_xpath = optional_json_string(iframe_xpath)?;

    Ok(format!(
        r#"
        (() => {{
          const xpath = {xpath};
          const iframeXPath = {iframe_xpath};
          const evaluateXPath = (path, rootDocument) => rootDocument.evaluate(path, rootDocument, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
          let rootDocument = document;
          if (iframeXPath) {{
            const iframe = evaluateXPath(iframeXPath, document);
            if (!iframe) return {{ ok: false, reason: "Iframe XPath not found" }};
            if (!iframe.contentDocument) return {{ ok: false, reason: "Iframe document is not accessible" }};
            rootDocument = iframe.contentDocument;
          }}
          const node = evaluateXPath(xpath, rootDocument);
          if (!node) return {{ ok: false, reason: "XPath not found" }};
          node.click();
          return {{ ok: true, reason: "" }};
        }})()
        "#
    ))
}

pub(super) fn click_script(options: ClickScriptOptions<'_>) -> Result<String, RunnerError> {
    let xpath = json_string(options.xpath)?;
    let iframe_xpath = optional_json_string(options.iframe_xpath)?;
    let scroll_into_view = options.scroll_into_view.unwrap_or(true);
    let block = scroll_block_value(options.block);
    let inline = scroll_inline_value(options.inline);
    let position = click_position_value(options.position);
    let offset_x = options.offset_x.unwrap_or(0.0);
    let offset_y = options.offset_y.unwrap_or(0.0);
    let wait_until = click_wait_until_value(options.wait_until);
    let timeout_ms = options.timeout_ms.unwrap_or(5000).max(1);
    let retry_interval_ms = options.retry_interval_ms.unwrap_or(100);

    Ok(format!(
        r#"
        (async () => {{
          const xpath = {xpath};
          const iframeXPath = {iframe_xpath};
          const scrollIntoView = {scroll_into_view};
          const block = "{block}";
          const inline = "{inline}";
          const position = "{position}";
          const offsetX = {offset_x};
          const offsetY = {offset_y};
          const waitUntil = "{wait_until}";
          const deadline = Date.now() + {timeout_ms};
          const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
          const evaluateXPath = (path, rootDocument) => rootDocument.evaluate(path, rootDocument, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
          const resolveDocument = () => {{
            if (!iframeXPath) return {{ ok: true, document: document, iframe: null }};
            const iframe = evaluateXPath(iframeXPath, document);
            if (!iframe) return {{ ok: false, reason: "Iframe XPath not found" }};
            if (!iframe.contentDocument) return {{ ok: false, reason: "Iframe document is not accessible" }};
            return {{ ok: true, document: iframe.contentDocument, iframe }};
          }};
          const isVisible = (node) => {{
            if (!node || !node.getBoundingClientRect) return false;
            const rect = node.getBoundingClientRect();
            const view = node.ownerDocument.defaultView;
            const style = view.getComputedStyle(node);
            return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && rect.bottom > 0 && rect.right > 0 && rect.top < view.innerHeight && rect.left < view.innerWidth;
          }};
          const isEnabled = (node) => !node.disabled && node.getAttribute?.("aria-disabled") !== "true";
          const pointFor = (node, iframe) => {{
            const rect = node.getBoundingClientRect();
            let x = rect.left + rect.width / 2;
            let y = rect.top + rect.height / 2;
            if (position === "top_left") {{ x = rect.left + 1; y = rect.top + 1; }}
            if (position === "top_right") {{ x = rect.right - 1; y = rect.top + 1; }}
            if (position === "bottom_left") {{ x = rect.left + 1; y = rect.bottom - 1; }}
            if (position === "bottom_right") {{ x = rect.right - 1; y = rect.bottom - 1; }}
            if (position === "offset") {{ x = rect.left + offsetX; y = rect.top + offsetY; }}
            if (iframe) {{
              const frameRect = iframe.getBoundingClientRect();
              x += frameRect.left;
              y += frameRect.top;
            }}
            return {{ x, y }};
          }};
          const receivesEvents = (node, point, rootDocument, iframe) => {{
            const localX = iframe ? point.x - iframe.getBoundingClientRect().left : point.x;
            const localY = iframe ? point.y - iframe.getBoundingClientRect().top : point.y;
            const topNode = rootDocument.elementFromPoint(localX, localY);
            return topNode === node || node.contains?.(topNode);
          }};

          let lastReason = "Element did not become clickable before timeout";
          while (Date.now() <= deadline) {{
            const resolved = resolveDocument();
            if (!resolved.ok) return {{ ok: false, reason: resolved.reason, x: 0, y: 0 }};
            const node = evaluateXPath(xpath, resolved.document);
            if (!node) {{
              lastReason = "XPath not found";
            }} else {{
              if (scrollIntoView && node.scrollIntoView) node.scrollIntoView({{ block, inline, behavior: "instant" }});
              await wait(0);
              const visible = isVisible(node);
              const enabled = isEnabled(node);
              const point = pointFor(node, resolved.iframe);
              if (waitUntil === "attached") return {{ ok: true, reason: "", ...point }};
              if (!visible) lastReason = "Element is not visible";
              else if ((waitUntil === "enabled" || waitUntil === "clickable") && !enabled) lastReason = "Element is disabled";
              else if (waitUntil === "clickable" && !receivesEvents(node, point, resolved.document, resolved.iframe)) lastReason = "Element is covered";
              else return {{ ok: true, reason: "", ...point }};
            }}
            await wait({retry_interval_ms});
          }}
          return {{ ok: false, reason: lastReason, x: 0, y: 0 }};
        }})()
        "#
    ))
}

fn click_position_value(position: Option<ClickPosition>) -> &'static str {
    match position.unwrap_or(ClickPosition::Center) {
        ClickPosition::Center => "center",
        ClickPosition::TopLeft => "top_left",
        ClickPosition::TopRight => "top_right",
        ClickPosition::BottomLeft => "bottom_left",
        ClickPosition::BottomRight => "bottom_right",
        ClickPosition::Offset => "offset",
    }
}

#[cfg(test)]
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

#[cfg(test)]
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn click_script_supports_real_user_actionability_checks() {
        let script = click_script(ClickScriptOptions {
            xpath: "//*[@id='submit']",
            iframe_xpath: Some("//*[@id='frame']"),
            scroll_into_view: None,
            block: None,
            inline: None,
            position: None,
            offset_x: None,
            offset_y: None,
            wait_until: None,
            timeout_ms: Some(5000),
            retry_interval_ms: Some(100),
        })
        .unwrap();

        assert!(script.contains("scrollIntoView"));
        assert!(script.contains("elementFromPoint"));
        assert!(script.contains("Element is covered"));
        assert!(script.contains("Iframe XPath not found"));
    }

    #[test]
    fn pointer_scripts_cover_hover_and_drag_actions() {
        let hover = hover_script(
            "//*[@id='menu']",
            None,
            Some(ClickWaitUntil::Visible),
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

        assert!(hover.contains("mouseover"));
        assert!(hover.contains("timeoutMs"));
        assert!(drag.contains("dragstart"));
        assert!(drag.contains("drop"));
    }
}
