use std::{
    path::PathBuf,
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

use crate::domain::{ActionConfig, ScrollDirection};

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

    fn is_cancelled(&self) -> bool {
        self.inner.cancelled.load(Ordering::SeqCst)
    }

    async fn cancelled(&self) {
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
            let xpath = json_string(&xpath)?;
            let text = json_string(&text)?;
            let script = format!(
                r#"
                (() => {{
                  const node = document.evaluate({xpath}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                  if (!node) return {{ ok: false, reason: "XPath not found" }};
                  if (!("value" in node)) return {{ ok: false, reason: "Element cannot receive text" }};
                  node.focus();
                  node.value = "";
                  node.value = {text};
                  node.dispatchEvent(new Event("input", {{ bubbles: true }}));
                  node.dispatchEvent(new Event("change", {{ bubbles: true }}));
                  return {{ ok: true, reason: "" }};
                }})()
                "#
            );
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
        ActionConfig::Scroll { direction, pixels } => {
            let signed_pixels = match direction {
                ScrollDirection::Down => pixels,
                ScrollDirection::Up => -pixels,
            };
            page.evaluate(format!("window.scrollBy(0, {signed_pixels}); true"))
                .await?;
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
