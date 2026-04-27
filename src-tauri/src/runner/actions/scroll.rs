use crate::{
    domain::{ScrollBehavior, ScrollBlock, ScrollDirection, ScrollInline, ScrollMode},
    runner::RunnerError,
};

use super::js::optional_json_string;

pub(super) struct ScrollScriptOptions<'a> {
    pub mode: Option<ScrollMode>,
    pub direction: ScrollDirection,
    pub pixels: i64,
    pub xpath: Option<&'a str>,
    pub iframe_xpath: Option<&'a str>,
    pub behavior: Option<ScrollBehavior>,
    pub block: Option<ScrollBlock>,
    pub inline: Option<ScrollInline>,
    pub max_attempts: Option<u32>,
    pub wait_ms: Option<u64>,
}

pub(super) fn scroll_script(options: ScrollScriptOptions<'_>) -> Result<String, RunnerError> {
    let mode = scroll_mode_value(options.mode);
    let direction = scroll_direction_value(options.direction);
    let pixels = options.pixels;
    let xpath = optional_json_string(options.xpath)?;
    let iframe_xpath = optional_json_string(options.iframe_xpath)?;
    let behavior = scroll_behavior_value(options.behavior);
    let block = scroll_block_value(options.block);
    let inline = scroll_inline_value(options.inline);
    let max_attempts = options.max_attempts.unwrap_or(10).max(1);
    let wait_ms = options.wait_ms.unwrap_or(250);

    Ok(format!(
        r#"
        (async () => {{
          const mode = "{mode}";
          const direction = "{direction}";
          const pixels = {pixels};
          const xpath = {xpath};
          const iframeXPath = {iframe_xpath};
          const behavior = "{behavior}";
          const block = "{block}";
          const inline = "{inline}";
          const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
          const axisDelta = () => {{
            if (direction === "left") return {{ left: -pixels, top: 0 }};
            if (direction === "right") return {{ left: pixels, top: 0 }};
            if (direction === "up") return {{ left: 0, top: -pixels }};
            return {{ left: 0, top: pixels }};
          }};
          const evaluateXPath = (path, rootDocument) => {{
            if (!path) return null;
            return rootDocument.evaluate(path, rootDocument, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
          }};
          const isVisible = (node) => {{
            if (!node || !node.getBoundingClientRect) return false;
            const rect = node.getBoundingClientRect();
            const doc = node.ownerDocument;
            const view = doc.defaultView;
            return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < view.innerHeight && rect.left < view.innerWidth;
          }};
          const isScrollable = (node) => {{
            if (!node || node === document || node === window || !node.ownerDocument) return false;
            const style = node.ownerDocument.defaultView.getComputedStyle(node);
            const overflowY = style.overflowY;
            const overflowX = style.overflowX;
            const canScrollY = /(auto|scroll|overlay)/.test(overflowY) && node.scrollHeight > node.clientHeight;
            const canScrollX = /(auto|scroll|overlay)/.test(overflowX) && node.scrollWidth > node.clientWidth;
            return canScrollY || canScrollX;
          }};
          const findScrollableParent = (node) => {{
            let current = node;
            while (current && current.ownerDocument && current !== current.ownerDocument.body) {{
              if (isScrollable(current)) return current;
              current = current.parentElement;
            }}
            return null;
          }};
          const scrollElement = (target) => {{
            const delta = axisDelta();
            if (target) {{
              target.scrollBy({{ ...delta, behavior }});
            }} else {{
              window.scrollBy({{ ...delta, behavior }});
            }}
          }};
          const resolveDocument = () => {{
            if (!iframeXPath) return {{ ok: true, document: document, iframe: null }};
            const iframe = evaluateXPath(iframeXPath, document);
            if (!iframe) return {{ ok: false, reason: "Iframe XPath not found" }};
            if (!iframe.contentDocument) return {{ ok: false, reason: "Iframe document is not accessible" }};
            return {{ ok: true, document: iframe.contentDocument, iframe }};
          }};
          const resolved = resolveDocument();
          if (!resolved.ok) return resolved;
          const rootDocument = resolved.document;
          const rootWindow = rootDocument.defaultView;

          if (mode === "page") {{
            const delta = axisDelta();
            if (rootWindow && rootWindow !== window) {{
              rootWindow.scrollBy({{ ...delta, behavior }});
            }} else {{
              window.scrollBy({{ ...delta, behavior }});
            }}
            return {{ ok: true, reason: "" }};
          }}

          const node = evaluateXPath(xpath, rootDocument);
          if (!node) return {{ ok: false, reason: "XPath not found" }};

          if (mode === "into_view") {{
            node.scrollIntoView({{ behavior, block, inline }});
            return {{ ok: true, reason: "" }};
          }}

          const scrollTarget = isScrollable(node) ? node : findScrollableParent(node);
          if (mode === "container") {{
            scrollElement(scrollTarget);
            return {{ ok: true, reason: "" }};
          }}

          for (let attempt = 0; attempt < {max_attempts}; attempt++) {{
            if (isVisible(node)) return {{ ok: true, reason: "" }};
            scrollElement(scrollTarget);
            await wait({wait_ms});
          }}

          if (isVisible(node)) return {{ ok: true, reason: "" }};
          return {{ ok: false, reason: "Element not visible after scrolling" }};
        }})()
        "#
    ))
}

fn scroll_mode_value(mode: Option<ScrollMode>) -> &'static str {
    match mode.unwrap_or(ScrollMode::Page) {
        ScrollMode::Page => "page",
        ScrollMode::Container => "container",
        ScrollMode::IntoView => "into_view",
        ScrollMode::UntilVisible => "until_visible",
    }
}

fn scroll_direction_value(direction: ScrollDirection) -> &'static str {
    match direction {
        ScrollDirection::Up => "up",
        ScrollDirection::Down => "down",
        ScrollDirection::Left => "left",
        ScrollDirection::Right => "right",
    }
}

fn scroll_behavior_value(behavior: Option<ScrollBehavior>) -> &'static str {
    match behavior.unwrap_or(ScrollBehavior::Instant) {
        ScrollBehavior::Instant => "instant",
        ScrollBehavior::Smooth => "smooth",
    }
}

fn scroll_block_value(block: Option<ScrollBlock>) -> &'static str {
    match block.unwrap_or(ScrollBlock::Center) {
        ScrollBlock::Start => "start",
        ScrollBlock::Center => "center",
        ScrollBlock::End => "end",
        ScrollBlock::Nearest => "nearest",
    }
}

fn scroll_inline_value(inline: Option<ScrollInline>) -> &'static str {
    match inline.unwrap_or(ScrollInline::Nearest) {
        ScrollInline::Start => "start",
        ScrollInline::Center => "center",
        ScrollInline::End => "end",
        ScrollInline::Nearest => "nearest",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scroll_script_supports_page_and_horizontal_scroll() {
        let script = scroll_script(ScrollScriptOptions {
            mode: Some(ScrollMode::Page),
            direction: ScrollDirection::Right,
            pixels: 250,
            xpath: None,
            iframe_xpath: None,
            behavior: None,
            block: None,
            inline: None,
            max_attempts: None,
            wait_ms: None,
        })
        .unwrap();

        assert!(script.contains("window.scrollBy"));
        assert!(script.contains("direction = \"right\""));
        assert!(script.contains("left: pixels"));
    }

    #[test]
    fn scroll_script_supports_container_and_into_view_modes() {
        let container = scroll_script(ScrollScriptOptions {
            mode: Some(ScrollMode::Container),
            direction: ScrollDirection::Down,
            pixels: 300,
            xpath: Some("//*[@id='item']"),
            iframe_xpath: None,
            behavior: None,
            block: None,
            inline: None,
            max_attempts: None,
            wait_ms: None,
        })
        .unwrap();
        let into_view = scroll_script(ScrollScriptOptions {
            mode: Some(ScrollMode::IntoView),
            direction: ScrollDirection::Down,
            pixels: 300,
            xpath: Some("//*[@id='item']"),
            iframe_xpath: Some("//*[@id='frame']"),
            behavior: Some(ScrollBehavior::Instant),
            block: Some(ScrollBlock::Center),
            inline: Some(ScrollInline::Nearest),
            max_attempts: None,
            wait_ms: None,
        })
        .unwrap();

        assert!(container.contains("findScrollableParent"));
        assert!(container.contains("scrollElement"));
        assert!(into_view.contains("scrollIntoView"));
        assert!(into_view.contains("iframe"));
    }

    #[test]
    fn scroll_script_supports_until_visible_loop() {
        let script = scroll_script(ScrollScriptOptions {
            mode: Some(ScrollMode::UntilVisible),
            direction: ScrollDirection::Down,
            pixels: 500,
            xpath: Some("//*[@id='target']"),
            iframe_xpath: None,
            behavior: None,
            block: None,
            inline: None,
            max_attempts: Some(5),
            wait_ms: Some(100),
        })
        .unwrap();

        assert!(script.contains("for (let attempt = 0; attempt < 5; attempt++)"));
        assert!(script.contains("Element not visible after scrolling"));
    }
}
