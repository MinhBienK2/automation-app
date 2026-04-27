#![allow(dead_code)]

use std::{path::PathBuf, sync::Arc, time::Duration};

use uuid::Uuid;
use workflow_automation_manager_lib::{
    app_state::AppState,
    commands,
    db::{create_sqlite_pool, run_migrations},
    domain::{ActionConfig, RunStatus},
    repositories::WorkflowRepository,
    runner::{
        FailedStep, ProgressCallback, RunExecution, RunExecutor, RunExecutorFuture,
        RunnerCancellation, RunnerProgress, RunnerStatus,
    },
};

pub async fn test_state() -> (AppState, PathBuf) {
    let db_path = temp_db_path("wam-command-test");
    let state = AppState::initialize(&db_path).await.expect("init state");

    (state, db_path)
}

pub async fn test_state_with_runner(runner: Arc<dyn RunExecutor>) -> (AppState, PathBuf) {
    let db_path = temp_db_path("wam-command-test");
    let state = AppState::initialize_with_runner(&db_path, runner)
        .await
        .expect("init state");

    (state, db_path)
}

pub async fn test_repository() -> (WorkflowRepository, PathBuf) {
    let db_path = temp_db_path("wam-test");
    let pool = create_sqlite_pool(&db_path)
        .await
        .expect("create sqlite pool");
    run_migrations(&pool).await.expect("run migrations");

    (WorkflowRepository::new(pool), db_path)
}

pub async fn poll_status(state: &AppState, expected: RunStatus) {
    for _ in 0..50 {
        let run_state = commands::get_run_state_impl(state).await;
        if run_state.status == expected {
            return;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    panic!("run state did not become {expected:?}");
}

#[derive(Debug)]
pub struct FakeRunExecutor {
    behavior: FakeRunBehavior,
}

#[derive(Debug, Clone)]
enum FakeRunBehavior {
    Complete {
        status: RunnerStatus,
        failed_step: Option<FailedStep>,
    },
    WaitForCancellation,
}

impl FakeRunExecutor {
    pub fn success() -> Arc<Self> {
        Arc::new(Self {
            behavior: FakeRunBehavior::Complete {
                status: RunnerStatus::Success,
                failed_step: None,
            },
        })
    }

    pub fn failed(step_number: usize, reason: &str) -> Arc<Self> {
        Arc::new(Self {
            behavior: FakeRunBehavior::Complete {
                status: RunnerStatus::Failed,
                failed_step: Some(FailedStep {
                    step_number,
                    reason: reason.to_string(),
                }),
            },
        })
    }

    pub fn stopped_on_cancel() -> Arc<Self> {
        Arc::new(Self {
            behavior: FakeRunBehavior::WaitForCancellation,
        })
    }
}

impl RunExecutor for FakeRunExecutor {
    fn run_steps(
        &self,
        steps: Vec<ActionConfig>,
        cancellation: RunnerCancellation,
        mut progress: ProgressCallback,
    ) -> RunExecutorFuture {
        let behavior = self.behavior.clone();

        Box::pin(async move {
            match behavior {
                FakeRunBehavior::Complete {
                    status,
                    failed_step,
                } => {
                    for step_number in 1..=steps.len() {
                        progress(RunnerProgress::StepStarted { step_number });
                        progress(RunnerProgress::StepCompleted { step_number });
                    }

                    Ok(RunExecution {
                        status,
                        failed_step,
                        session: None,
                    })
                }
                FakeRunBehavior::WaitForCancellation => {
                    if !steps.is_empty() {
                        progress(RunnerProgress::StepStarted { step_number: 1 });
                    }
                    cancellation.cancelled().await;

                    Ok(RunExecution {
                        status: RunnerStatus::Stopped,
                        failed_step: None,
                        session: None,
                    })
                }
            }
        })
    }
}

fn temp_db_path(prefix: &str) -> PathBuf {
    std::env::temp_dir().join(format!("{prefix}-{}.sqlite", Uuid::new_v4()))
}
