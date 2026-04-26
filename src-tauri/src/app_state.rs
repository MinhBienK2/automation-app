use std::path::Path;

use tokio::sync::Mutex;

use crate::{
    db::{create_sqlite_pool, run_migrations},
    domain::RunStatus,
    repositories::WorkflowRepository,
};

#[derive(Debug)]
pub struct AppState {
    repository: WorkflowRepository,
    run_state: Mutex<RunStateDto>,
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
            repository: WorkflowRepository::new(pool),
            run_state: Mutex::new(RunStateDto {
                status: RunStatus::Idle,
                error: None,
            }),
        })
    }

    pub fn repository(&self) -> &WorkflowRepository {
        &self.repository
    }

    pub async fn run_state(&self) -> RunStateDto {
        self.run_state.lock().await.clone()
    }
}

#[derive(Debug, thiserror::Error)]
pub enum AppStateError {
    #[error("database error: {0}")]
    Sqlx(#[from] sqlx::Error),
    #[error("migration error: {0}")]
    Migration(#[from] sqlx::migrate::MigrateError),
}
