use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::Error as JsonError;
use sqlx::{Row, SqlitePool};
use thiserror::Error;
use uuid::Uuid;

use crate::domain::{ActionConfig, Workflow, WorkflowStep};

#[derive(Debug, Error)]
pub enum RepositoryError {
    #[error("database error: {0}")]
    Sqlx(#[from] sqlx::Error),
    #[error("invalid step config JSON: {0}")]
    Json(#[from] JsonError),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkflowSummary {
    pub id: String,
    pub name: String,
    pub step_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WorkflowDetail {
    pub workflow: Workflow,
    pub steps: Vec<WorkflowStep>,
}

#[derive(Debug, Clone)]
pub struct WorkflowRepository {
    pool: SqlitePool,
}

impl WorkflowRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn list_workflows(&self) -> Result<Vec<WorkflowSummary>, RepositoryError> {
        let rows = sqlx::query(
            r#"
            SELECT
              workflows.id,
              workflows.name,
              workflows.created_at,
              workflows.updated_at,
              COUNT(workflow_steps.id) AS step_count
            FROM workflows
            LEFT JOIN workflow_steps ON workflow_steps.workflow_id = workflows.id
            GROUP BY workflows.id
            ORDER BY workflows.updated_at DESC, workflows.name ASC
            "#,
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|row| WorkflowSummary {
                id: row.get("id"),
                name: row.get("name"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
                step_count: row.get("step_count"),
            })
            .collect())
    }

    pub async fn create_workflow(&self, name: &str) -> Result<Workflow, RepositoryError> {
        let now = now_timestamp();
        let workflow = Workflow {
            id: Uuid::new_v4().to_string(),
            name: name.to_string(),
            created_at: now.clone(),
            updated_at: now,
        };

        sqlx::query(
            r#"
            INSERT INTO workflows (id, name, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4)
            "#,
        )
        .bind(&workflow.id)
        .bind(&workflow.name)
        .bind(&workflow.created_at)
        .bind(&workflow.updated_at)
        .execute(&self.pool)
        .await?;

        Ok(workflow)
    }

    pub async fn get_workflow(
        &self,
        workflow_id: &str,
    ) -> Result<Option<WorkflowDetail>, RepositoryError> {
        let workflow_row = sqlx::query(
            r#"
            SELECT id, name, created_at, updated_at
            FROM workflows
            WHERE id = ?1
            "#,
        )
        .bind(workflow_id)
        .fetch_optional(&self.pool)
        .await?;

        let Some(row) = workflow_row else {
            return Ok(None);
        };

        let workflow = Workflow {
            id: row.get("id"),
            name: row.get("name"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        };

        let step_rows = sqlx::query(
            r#"
            SELECT id, workflow_id, order_index, config_json, created_at, updated_at
            FROM workflow_steps
            WHERE workflow_id = ?1
            ORDER BY order_index ASC
            "#,
        )
        .bind(workflow_id)
        .fetch_all(&self.pool)
        .await?;

        let mut steps = Vec::with_capacity(step_rows.len());
        for row in step_rows {
            let config_json: String = row.get("config_json");
            let config: ActionConfig = serde_json::from_str(&config_json)?;
            let action_type = config.action_type();

            steps.push(WorkflowStep {
                id: row.get("id"),
                workflow_id: row.get("workflow_id"),
                order_index: row.get("order_index"),
                action_type,
                config,
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            });
        }

        Ok(Some(WorkflowDetail { workflow, steps }))
    }

    pub async fn rename_workflow(
        &self,
        workflow_id: &str,
        name: &str,
    ) -> Result<(), RepositoryError> {
        sqlx::query(
            r#"
            UPDATE workflows
            SET name = ?1, updated_at = ?2
            WHERE id = ?3
            "#,
        )
        .bind(name)
        .bind(now_timestamp())
        .bind(workflow_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn delete_workflow(&self, workflow_id: &str) -> Result<(), RepositoryError> {
        sqlx::query("DELETE FROM workflows WHERE id = ?1")
            .bind(workflow_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn add_step(
        &self,
        workflow_id: &str,
        config: ActionConfig,
    ) -> Result<WorkflowStep, RepositoryError> {
        let order_index: i64 = sqlx::query_scalar(
            r#"
            SELECT COALESCE(MAX(order_index) + 1, 0)
            FROM workflow_steps
            WHERE workflow_id = ?1
            "#,
        )
        .bind(workflow_id)
        .fetch_one(&self.pool)
        .await?;

        let now = now_timestamp();
        let step = WorkflowStep {
            id: Uuid::new_v4().to_string(),
            workflow_id: workflow_id.to_string(),
            order_index,
            action_type: config.action_type(),
            config,
            created_at: now.clone(),
            updated_at: now,
        };

        insert_step(&self.pool, &step).await?;
        touch_workflow(&self.pool, workflow_id).await?;

        Ok(step)
    }

    pub async fn update_step(
        &self,
        step_id: &str,
        config: ActionConfig,
    ) -> Result<(), RepositoryError> {
        let workflow_id: String =
            sqlx::query_scalar("SELECT workflow_id FROM workflow_steps WHERE id = ?1")
                .bind(step_id)
                .fetch_one(&self.pool)
                .await?;

        sqlx::query(
            r#"
            UPDATE workflow_steps
            SET type = ?1, config_json = ?2, updated_at = ?3
            WHERE id = ?4
            "#,
        )
        .bind(config.action_type().as_str())
        .bind(serde_json::to_string(&config)?)
        .bind(now_timestamp())
        .bind(step_id)
        .execute(&self.pool)
        .await?;

        touch_workflow(&self.pool, &workflow_id).await?;

        Ok(())
    }

    pub async fn delete_step(&self, step_id: &str) -> Result<(), RepositoryError> {
        let mut tx = self.pool.begin().await?;
        let workflow_id: String =
            sqlx::query_scalar("SELECT workflow_id FROM workflow_steps WHERE id = ?1")
                .bind(step_id)
                .fetch_one(&mut *tx)
                .await?;

        sqlx::query("DELETE FROM workflow_steps WHERE id = ?1")
            .bind(step_id)
            .execute(&mut *tx)
            .await?;

        compact_order_indexes(&mut tx, &workflow_id).await?;
        touch_workflow_tx(&mut tx, &workflow_id).await?;
        tx.commit().await?;

        Ok(())
    }

    pub async fn reorder_steps(
        &self,
        workflow_id: &str,
        ordered_step_ids: &[String],
    ) -> Result<(), RepositoryError> {
        let mut tx = self.pool.begin().await?;

        for (index, step_id) in ordered_step_ids.iter().enumerate() {
            sqlx::query(
                r#"
                UPDATE workflow_steps
                SET order_index = ?1
                WHERE workflow_id = ?2 AND id = ?3
                "#,
            )
            .bind(-((index as i64) + 1))
            .bind(workflow_id)
            .bind(step_id)
            .execute(&mut *tx)
            .await?;
        }

        for (index, step_id) in ordered_step_ids.iter().enumerate() {
            sqlx::query(
                r#"
                UPDATE workflow_steps
                SET order_index = ?1, updated_at = ?2
                WHERE workflow_id = ?3 AND id = ?4
                "#,
            )
            .bind(index as i64)
            .bind(now_timestamp())
            .bind(workflow_id)
            .bind(step_id)
            .execute(&mut *tx)
            .await?;
        }

        touch_workflow_tx(&mut tx, workflow_id).await?;
        tx.commit().await?;

        Ok(())
    }
}

async fn insert_step(pool: &SqlitePool, step: &WorkflowStep) -> Result<(), RepositoryError> {
    sqlx::query(
        r#"
        INSERT INTO workflow_steps
          (id, workflow_id, order_index, type, config_json, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        "#,
    )
    .bind(&step.id)
    .bind(&step.workflow_id)
    .bind(step.order_index)
    .bind(step.action_type.as_str())
    .bind(serde_json::to_string(&step.config)?)
    .bind(&step.created_at)
    .bind(&step.updated_at)
    .execute(pool)
    .await?;

    Ok(())
}

async fn compact_order_indexes(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    workflow_id: &str,
) -> Result<(), RepositoryError> {
    let step_ids: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT id
        FROM workflow_steps
        WHERE workflow_id = ?1
        ORDER BY order_index ASC
        "#,
    )
    .bind(workflow_id)
    .fetch_all(&mut **tx)
    .await?;

    for (index, step_id) in step_ids.iter().enumerate() {
        sqlx::query(
            r#"
            UPDATE workflow_steps
            SET order_index = ?1
            WHERE id = ?2
            "#,
        )
        .bind(index as i64)
        .bind(step_id)
        .execute(&mut **tx)
        .await?;
    }

    Ok(())
}

async fn touch_workflow(pool: &SqlitePool, workflow_id: &str) -> Result<(), RepositoryError> {
    sqlx::query("UPDATE workflows SET updated_at = ?1 WHERE id = ?2")
        .bind(now_timestamp())
        .bind(workflow_id)
        .execute(pool)
        .await?;

    Ok(())
}

async fn touch_workflow_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    workflow_id: &str,
) -> Result<(), RepositoryError> {
    sqlx::query("UPDATE workflows SET updated_at = ?1 WHERE id = ?2")
        .bind(now_timestamp())
        .bind(workflow_id)
        .execute(&mut **tx)
        .await?;

    Ok(())
}

fn now_timestamp() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();

    millis.to_string()
}
