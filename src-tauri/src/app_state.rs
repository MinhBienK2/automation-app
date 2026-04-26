use std::{path::Path, sync::Arc};

use tokio::sync::Mutex;

use crate::{
    db::{create_sqlite_pool, run_migrations},
    domain::{RunError, RunStatus},
    repositories::WorkflowRepository,
    runner::{BrowserSession, RunnerCancellation},
};

#[derive(Debug, Clone)]
pub struct AppState {
    inner: Arc<AppStateInner>,
}

#[derive(Debug)]
struct AppStateInner {
    repository: WorkflowRepository,
    run_state: Mutex<RunStateDto>,
    active_run: Mutex<Option<ActiveRun>>,
    retained_sessions: Mutex<Vec<BrowserSession>>,
}

#[derive(Debug, Clone)]
pub struct ActiveRun {
    cancellation: RunnerCancellation,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct RunStateDto {
    pub status: RunStatus,
    pub error: Option<crate::domain::RunError>,
}

impl AppState {
    pub async fn initialize(db_path: &Path) -> Result<Self, AppStateError> {
        let pool = create_sqlite_pool(db_path).await?;
        run_migrations(&pool).await?;

        Ok(Self {
            inner: Arc::new(AppStateInner {
                repository: WorkflowRepository::new(pool),
                run_state: Mutex::new(RunStateDto {
                    status: RunStatus::Idle,
                    error: None,
                }),
                active_run: Mutex::new(None),
                retained_sessions: Mutex::new(Vec::new()),
            }),
        })
    }

    pub fn repository(&self) -> &WorkflowRepository {
        &self.inner.repository
    }

    pub async fn run_state(&self) -> RunStateDto {
        self.inner.run_state.lock().await.clone()
    }

    pub async fn begin_run(&self) -> Option<RunnerCancellation> {
        let mut active_run = self.inner.active_run.lock().await;
        if active_run.is_some() {
            return None;
        }

        let cancellation = RunnerCancellation::new();
        *active_run = Some(ActiveRun {
            cancellation: cancellation.clone(),
        });
        *self.inner.run_state.lock().await = RunStateDto {
            status: RunStatus::Running,
            error: None,
        };

        Some(cancellation)
    }

    pub async fn stop_active_run(&self) -> Option<RunStateDto> {
        let active_run = self.inner.active_run.lock().await;
        let active_run = active_run.as_ref()?;
        active_run.cancellation.cancel();

        let stopped = RunStateDto {
            status: RunStatus::Stopped,
            error: None,
        };
        *self.inner.run_state.lock().await = stopped.clone();

        Some(stopped)
    }

    pub async fn finish_run(
        &self,
        status: RunStatus,
        error: Option<RunError>,
        session: BrowserSession,
    ) {
        self.inner.retained_sessions.lock().await.push(session);
        *self.inner.active_run.lock().await = None;
        *self.inner.run_state.lock().await = RunStateDto { status, error };
    }

    pub async fn fail_run_without_session(&self, error: RunError) {
        *self.inner.active_run.lock().await = None;
        *self.inner.run_state.lock().await = RunStateDto {
            status: RunStatus::Failed,
            error: Some(error),
        };
    }
}

#[derive(Debug, thiserror::Error)]
pub enum AppStateError {
    #[error("database error: {0}")]
    Sqlx(#[from] sqlx::Error),
    #[error("migration error: {0}")]
    Migration(#[from] sqlx::migrate::MigrateError),
}
