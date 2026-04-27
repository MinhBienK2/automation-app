use std::{path::PathBuf, time::Duration};

use chromiumoxide::{
    browser::{Browser, BrowserConfig},
    Page,
};
use futures::StreamExt;
use tokio::task::JoinHandle;
use uuid::Uuid;

use crate::domain::ActionConfig;

use super::{
    actions::{execute_action, ActionExecution},
    cancellation::RunnerCancellation,
    error::RunnerError,
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
