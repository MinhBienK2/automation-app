use std::{path::Path, sync::Arc};

use tokio::sync::Mutex;

use crate::{
    db::{create_sqlite_pool, run_migrations},
    domain::{RunError, RunMode, RunStatus},
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
    pub mode: RunMode,
    pub target_step_id: Option<String>,
    pub current_step_id: Option<String>,
    pub current_step_number: Option<usize>,
    pub completed_step_ids: Vec<String>,
    pub error: Option<crate::domain::RunError>,
}

impl RunStateDto {
    fn idle() -> Self {
        Self {
            status: RunStatus::Idle,
            mode: RunMode::None,
            target_step_id: None,
            current_step_id: None,
            current_step_number: None,
            completed_step_ids: Vec::new(),
            error: None,
        }
    }
}

impl AppState {
    pub async fn initialize(db_path: &Path) -> Result<Self, AppStateError> {
        let pool = create_sqlite_pool(db_path).await?;
        run_migrations(&pool).await?;

        Ok(Self {
            inner: Arc::new(AppStateInner {
                repository: WorkflowRepository::new(pool),
                run_state: Mutex::new(RunStateDto::idle()),
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

    pub async fn begin_run(
        &self,
        mode: RunMode,
        target_step_id: Option<String>,
    ) -> Option<RunnerCancellation> {
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
            mode,
            target_step_id,
            current_step_id: None,
            current_step_number: None,
            completed_step_ids: Vec::new(),
            error: None,
        };

        Some(cancellation)
    }

    pub async fn stop_active_run(&self) -> Option<RunStateDto> {
        let active_run = self.inner.active_run.lock().await;
        let active_run = active_run.as_ref()?;
        active_run.cancellation.cancel();

        let current = self.inner.run_state.lock().await.clone();
        let stopped = RunStateDto {
            status: RunStatus::Stopped,
            mode: current.mode,
            target_step_id: current.target_step_id,
            current_step_id: current.current_step_id,
            current_step_number: current.current_step_number,
            completed_step_ids: current.completed_step_ids,
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
        let mut run_state = self.inner.run_state.lock().await;
        run_state.status = status;
        run_state.current_step_id = None;
        run_state.current_step_number = None;
        run_state.error = error;
    }

    pub async fn fail_run_without_session(&self, error: RunError) {
        *self.inner.active_run.lock().await = None;
        let mut run_state = self.inner.run_state.lock().await;
        run_state.status = RunStatus::Failed;
        run_state.current_step_id = None;
        run_state.current_step_number = None;
        run_state.error = Some(error);
    }

    pub async fn mark_step_running(&self, step_id: String, step_number: usize) {
        let mut run_state = self.inner.run_state.lock().await;
        run_state.current_step_id = Some(step_id);
        run_state.current_step_number = Some(step_number);
    }

    pub async fn mark_step_completed(&self, step_id: String) {
        let mut run_state = self.inner.run_state.lock().await;
        if !run_state.completed_step_ids.contains(&step_id) {
            run_state.completed_step_ids.push(step_id);
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum AppStateError {
    #[error("database error: {0}")]
    Sqlx(#[from] sqlx::Error),
    #[error("migration error: {0}")]
    Migration(#[from] sqlx::migrate::MigrateError),
}
