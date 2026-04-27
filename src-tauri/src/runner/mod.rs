use std::{
    future::Future,
    path::PathBuf,
    pin::Pin,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Duration,
};

use chromiumoxide::{
    browser::{Browser, BrowserConfig},
    Page,
};
use futures::StreamExt;
use serde::Deserialize;
use tokio::{sync::Notify, task::JoinHandle};
use uuid::Uuid;

use crate::domain::{
    ActionConfig, ScrollBehavior, ScrollBlock, ScrollDirection, ScrollInline, ScrollMode,
};

#[derive(Debug, Clone)]
pub struct RunnerOptions {
    pub headed: bool,
    pub chrome_executable: Option<PathBuf>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RunnerStatus {
    Success,
    Failed,
    Stopped,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FailedStep {
    pub step_number: usize,
    pub reason: String,
}

#[derive(Debug)]
pub struct RunnerOutcome {
    pub status: RunnerStatus,
    pub failed_step: Option<FailedStep>,
    pub session: BrowserSession,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RunnerProgress {
    StepStarted { step_number: usize },
    StepCompleted { step_number: usize },
}

pub type ProgressCallback = Box<dyn FnMut(RunnerProgress) + Send + 'static>;
pub type RunExecutorFuture =
    Pin<Box<dyn Future<Output = Result<RunExecution, RunnerError>> + Send + 'static>>;

#[derive(Debug)]
pub struct RunExecution {
    pub status: RunnerStatus,
    pub failed_step: Option<FailedStep>,
    pub session: Option<BrowserSession>,
}

pub trait RunExecutor: std::fmt::Debug + Send + Sync {
    fn run_steps(
        &self,
        steps: Vec<ActionConfig>,
        cancellation: RunnerCancellation,
        progress: ProgressCallback,
    ) -> RunExecutorFuture;
}

#[derive(Debug, Clone)]
pub struct BrowserRunExecutor {
    options: RunnerOptions,
}

impl BrowserRunExecutor {
    pub fn new(options: RunnerOptions) -> Self {
        Self { options }
    }
}

impl Default for BrowserRunExecutor {
    fn default() -> Self {
        Self {
            options: RunnerOptions {
                headed: true,
                chrome_executable: None,
            },
        }
    }
}

impl RunExecutor for BrowserRunExecutor {
    fn run_steps(
        &self,
        steps: Vec<ActionConfig>,
        cancellation: RunnerCancellation,
        mut progress: ProgressCallback,
    ) -> RunExecutorFuture {
        let runner = BrowserRunner::new(self.options.clone());

        Box::pin(async move {
            let outcome = runner
                .run_steps_with_progress(steps, cancellation, &mut progress)
                .await?;

            Ok(RunExecution {
                status: outcome.status,
                failed_step: outcome.failed_step,
                session: Some(outcome.session),
            })
        })
    }
}

#[derive(Debug, Clone)]
pub struct RunnerCancellation {
    inner: Arc<CancellationInner>,
}

#[derive(Debug)]
struct CancellationInner {
    cancelled: AtomicBool,
    notify: Notify,
}

impl RunnerCancellation {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(CancellationInner {
                cancelled: AtomicBool::new(false),
                notify: Notify::new(),
            }),
        }
    }

    pub fn cancel(&self) {
        self.inner.cancelled.store(true, Ordering::SeqCst);
        self.inner.notify.notify_waiters();
    }

    pub fn is_cancelled(&self) -> bool {
        self.inner.cancelled.load(Ordering::SeqCst)
    }

    pub async fn cancelled(&self) {
        if self.is_cancelled() {
            return;
        }
        self.inner.notify.notified().await;
    }
}

impl Default for RunnerCancellation {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug)]
pub struct BrowserRunner {
    options: RunnerOptions,
}

impl BrowserRunner {
    pub fn new(options: RunnerOptions) -> Self {
        Self { options }
    }

    pub async fn run_steps(
        &self,
        steps: Vec<ActionConfig>,
        cancellation: RunnerCancellation,
    ) -> Result<RunnerOutcome, RunnerError> {
        self.run_steps_with_progress(steps, cancellation, |_| {})
            .await
    }

    pub async fn run_steps_with_progress(
        &self,
        steps: Vec<ActionConfig>,
        cancellation: RunnerCancellation,
        mut progress: impl FnMut(RunnerProgress) + Send,
    ) -> Result<RunnerOutcome, RunnerError> {
        let session = BrowserSession::launch(&self.options).await?;

        for (index, step) in steps.into_iter().enumerate() {
            if cancellation.is_cancelled() {
                return Ok(RunnerOutcome {
                    status: RunnerStatus::Stopped,
                    failed_step: None,
                    session,
                });
            }

            let step_number = index + 1;
            progress(RunnerProgress::StepStarted { step_number });
            let result = execute_action(&session.page, step, &cancellation).await;

            match result {
                Ok(ActionExecution::Complete) => {
                    progress(RunnerProgress::StepCompleted { step_number });
                }
                Ok(ActionExecution::Stopped) => {
                    return Ok(RunnerOutcome {
                        status: RunnerStatus::Stopped,
                        failed_step: None,
                        session,
                    });
                }
                Err(RunnerError::ActionFailed(reason)) => {
                    return Ok(RunnerOutcome {
                        status: RunnerStatus::Failed,
                        failed_step: Some(FailedStep {
                            step_number,
                            reason,
                        }),
                        session,
                    });
                }
                Err(error) => return Err(error),
            }
        }

        Ok(RunnerOutcome {
            status: RunnerStatus::Success,
            failed_step: None,
            session,
        })
    }
}

#[derive(Debug)]
pub struct BrowserSession {
    browser: Option<Browser>,
    page: Page,
    handler: JoinHandle<()>,
    user_data_dir: Option<PathBuf>,
    open: bool,
}

impl BrowserSession {
    async fn launch(options: &RunnerOptions) -> Result<Self, RunnerError> {
        let user_data_dir = std::env::temp_dir().join(format!("wam-chrome-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&user_data_dir)?;

        let mut builder = BrowserConfig::builder()
            .request_timeout(Duration::from_secs(10))
            .launch_timeout(Duration::from_secs(20))
            .window_size(1100, 800)
            .user_data_dir(&user_data_dir)
            .no_sandbox();

        if options.headed {
            builder = builder.with_head();
        }

        let chrome_executable = options
            .chrome_executable
            .clone()
            .or_else(default_chrome_executable);
        if let Some(executable) = &chrome_executable {
            builder = builder.chrome_executable(executable);
        }

        let config = builder.build().map_err(RunnerError::Config)?;
        let (browser, mut handler) = Browser::launch(config).await?;
        let handler_task = tokio::spawn(async move {
            while let Some(message) = handler.next().await {
                if message.is_err() {
                    break;
                }
            }
        });

        let page = browser.new_page("about:blank").await?;

        Ok(Self {
            browser: Some(browser),
            page,
            handler: handler_task,
            user_data_dir: Some(user_data_dir),
            open: true,
        })
    }

    pub fn is_open(&self) -> bool {
        self.open
    }

    pub async fn evaluate_string(&self, expression: &str) -> Result<String, RunnerError> {
        Ok(self.page.evaluate(expression).await?.into_value()?)
    }

    pub async fn evaluate_i64(&self, expression: &str) -> Result<i64, RunnerError> {
        Ok(self.page.evaluate(expression).await?.into_value()?)
    }

    pub async fn close(&mut self) -> Result<(), RunnerError> {
        if let Some(browser) = &mut self.browser {
            browser.close().await?;
            let _ = browser.wait().await;
        }

        self.browser = None;
        self.open = false;
        self.handler.abort();

        if let Some(path) = self.user_data_dir.take() {
            let _ = std::fs::remove_dir_all(path);
        }

        Ok(())
    }
}

enum ActionExecution {
    Complete,
    Stopped,
}

async fn execute_action(
    page: &Page,
    config: ActionConfig,
    cancellation: &RunnerCancellation,
) -> Result<ActionExecution, RunnerError> {
    match config {
        ActionConfig::OpenUrl { url } => {
            page.goto(url).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::Sleep { seconds } => {
            tokio::select! {
                _ = tokio::time::sleep(Duration::from_secs_f64(seconds)) => Ok(ActionExecution::Complete),
                _ = cancellation.cancelled() => Ok(ActionExecution::Stopped),
            }
        }
        ActionConfig::TypeText { xpath, text } => {
            let script = type_text_script(&xpath, &text)?;
            ensure_js_action(page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::Click { xpath } => {
            let xpath = json_string(&xpath)?;
            let script = format!(
                r#"
                (() => {{
                  const node = document.evaluate({xpath}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                  if (!node) return {{ ok: false, reason: "XPath not found" }};
                  node.click();
                  return {{ ok: true, reason: "" }};
                }})()
                "#
            );
            ensure_js_action(page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::Scroll {
            mode,
            direction,
            pixels,
            xpath,
            iframe_xpath,
            behavior,
            block,
            inline,
            max_attempts,
            wait_ms,
        } => {
            let script = scroll_script(ScrollScriptOptions {
                mode,
                direction,
                pixels,
                xpath: xpath.as_deref(),
                iframe_xpath: iframe_xpath.as_deref(),
                behavior,
                block,
                inline,
                max_attempts,
                wait_ms,
            })?;
            ensure_js_action(page, &script).await?;
            Ok(ActionExecution::Complete)
        }
    }
}

async fn ensure_js_action(page: &Page, script: &str) -> Result<(), RunnerError> {
    let result: JsActionResult = page.evaluate(script).await?.into_value()?;
    if result.ok {
        Ok(())
    } else {
        Err(RunnerError::ActionFailed(result.reason))
    }
}

fn json_string(value: &str) -> Result<String, RunnerError> {
    Ok(serde_json::to_string(value)?)
}

fn type_text_script(xpath: &str, text: &str) -> Result<String, RunnerError> {
    let xpath = json_string(xpath)?;
    let text = json_string(text)?;

    Ok(format!(
        r#"
        (() => {{
          const node = document.evaluate({xpath}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
          if (!node) return {{ ok: false, reason: "XPath not found" }};

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

          node.focus?.();
          if (setNativeValue(node, {text})) {{
            node.dispatchEvent(new InputEvent("input", {{ bubbles: true, inputType: "insertText", data: {text} }}));
            node.dispatchEvent(new Event("change", {{ bubbles: true }}));
            return {{ ok: true, reason: "" }};
          }}

          if (node.isContentEditable) {{
            node.textContent = {text};
            node.dispatchEvent(new InputEvent("input", {{ bubbles: true, inputType: "insertText", data: {text} }}));
            node.dispatchEvent(new Event("change", {{ bubbles: true }}));
            return {{ ok: true, reason: "" }};
          }}

          return {{ ok: false, reason: "Element cannot receive text" }};
        }})()
        "#
    ))
}

struct ScrollScriptOptions<'a> {
    mode: Option<ScrollMode>,
    direction: ScrollDirection,
    pixels: i64,
    xpath: Option<&'a str>,
    iframe_xpath: Option<&'a str>,
    behavior: Option<ScrollBehavior>,
    block: Option<ScrollBlock>,
    inline: Option<ScrollInline>,
    max_attempts: Option<u32>,
    wait_ms: Option<u64>,
}

fn scroll_script(options: ScrollScriptOptions<'_>) -> Result<String, RunnerError> {
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

fn optional_json_string(value: Option<&str>) -> Result<String, RunnerError> {
    value
        .map(json_string)
        .transpose()
        .map(|value| value.unwrap_or_else(|| "null".to_string()))
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

fn default_chrome_executable() -> Option<PathBuf> {
    [
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
    ]
    .iter()
    .map(PathBuf::from)
    .find(|path| path.exists())
}

#[derive(Debug, Deserialize)]
struct JsActionResult {
    ok: bool,
    reason: String,
}

#[derive(Debug, thiserror::Error)]
pub enum RunnerError {
    #[error("browser config error: {0}")]
    Config(String),
    #[error("browser error: {0}")]
    Browser(#[from] chromiumoxide::error::CdpError),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("{0}")]
    ActionFailed(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn type_text_script_uses_native_value_setter_for_controlled_inputs() {
        let script = type_text_script("//input[@id='email']", "user@example.com").unwrap();

        assert!(script.contains("HTMLInputElement.prototype"));
        assert!(script.contains("HTMLTextAreaElement.prototype"));
        assert!(script.contains("setNativeValue(node"));
        assert!(script.contains("new InputEvent(\"input\""));
    }

    #[test]
    fn type_text_script_supports_contenteditable_elements() {
        let script = type_text_script("//*[@contenteditable='true']", "hello").unwrap();

        assert!(script.contains("node.isContentEditable"));
        assert!(script.contains("node.textContent"));
    }

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
