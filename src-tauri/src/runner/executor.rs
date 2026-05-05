use std::{future::Future, path::PathBuf, pin::Pin};

use crate::domain::{ActionConfig, WorkflowBrowserConfig};

use super::{
    browser::{BrowserRunner, FailedStep, RunnerStatus},
    cancellation::RunnerCancellation,
    error::RunnerError,
    BrowserSession, RunnerOptions, RunnerProgress,
};

pub type ProgressCallback = Box<dyn FnMut(RunnerProgress) + Send + 'static>;
pub type RunExecutorFuture =
    Pin<Box<dyn Future<Output = Result<RunExecution, RunnerError>> + Send + 'static>>;

#[derive(Debug)]
pub struct RunExecution {
    pub status: RunnerStatus,
    pub failed_step: Option<FailedStep>,
    pub session: Option<BrowserSession>,
    pub close_browser: bool,
}

pub trait RunExecutor: std::fmt::Debug + Send + Sync {
    fn run_steps(
        &self,
        steps: Vec<ActionConfig>,
        browser_config: Option<WorkflowBrowserConfig>,
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
                chrome_executable: None::<PathBuf>,
            },
        }
    }
}

impl RunExecutor for BrowserRunExecutor {
    fn run_steps(
        &self,
        steps: Vec<ActionConfig>,
        browser_config: Option<WorkflowBrowserConfig>,
        cancellation: RunnerCancellation,
        mut progress: ProgressCallback,
    ) -> RunExecutorFuture {
        let runner = BrowserRunner::new(self.options.clone());

        Box::pin(async move {
            let outcome = runner
                .run_steps_with_browser_config_and_progress(
                    steps,
                    browser_config,
                    cancellation,
                    &mut progress,
                )
                .await?;

            Ok(RunExecution {
                status: outcome.status,
                failed_step: outcome.failed_step,
                session: Some(outcome.session),
                close_browser: outcome.close_browser,
            })
        })
    }
}
