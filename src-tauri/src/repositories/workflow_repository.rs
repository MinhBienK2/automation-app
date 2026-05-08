use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::{Error as JsonError, Value};
use sqlx::{Row, SqlitePool};
use thiserror::Error;
use uuid::Uuid;

use crate::domain::{
    ActionConfig, Workflow, WorkflowBrowserChallengePolicy, WorkflowBrowserConfig, WorkflowGraph,
    WorkflowSettings, WorkflowStep,
};

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

        let graph_json = serde_json::to_string(&WorkflowGraph::from_steps(&[]))?;
        sqlx::query(
            r#"
            INSERT INTO workflow_graphs (workflow_id, graph_json, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4)
            "#,
        )
        .bind(&workflow.id)
        .bind(graph_json)
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
            SELECT id, name, workflow_id, order_index, config_json, created_at, updated_at
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
            let config_json = normalize_legacy_action_config_json(&config_json)?;
            let config: ActionConfig = serde_json::from_str(&config_json)?;
            let action_type = config.action_type();

            steps.push(WorkflowStep {
                id: row.get("id"),
                name: step_name(row.get("name"), action_type),
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

    pub async fn get_workflow_graph(
        &self,
        workflow_id: &str,
    ) -> Result<Option<WorkflowGraph>, RepositoryError> {
        let graph_json: Option<String> = sqlx::query_scalar(
            r#"
            SELECT graph_json
            FROM workflow_graphs
            WHERE workflow_id = ?1
            "#,
        )
        .bind(workflow_id)
        .fetch_optional(&self.pool)
        .await?;

        graph_json
            .map(|graph_json| serde_json::from_str(&graph_json).map_err(RepositoryError::from))
            .transpose()
    }

    pub async fn save_workflow_graph(
        &self,
        workflow_id: &str,
        graph: WorkflowGraph,
    ) -> Result<(), RepositoryError> {
        let now = now_timestamp();
        let graph_json = serde_json::to_string(&graph)?;

        sqlx::query(
            r#"
            INSERT INTO workflow_graphs (workflow_id, graph_json, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4)
            ON CONFLICT(workflow_id) DO UPDATE SET
              graph_json = excluded.graph_json,
              updated_at = excluded.updated_at
            "#,
        )
        .bind(workflow_id)
        .bind(graph_json)
        .bind(&now)
        .bind(&now)
        .execute(&self.pool)
        .await?;

        touch_workflow(&self.pool, workflow_id).await?;

        Ok(())
    }

    pub async fn get_workflow_browser_config(
        &self,
        workflow_id: &str,
    ) -> Result<Option<WorkflowBrowserConfig>, RepositoryError> {
        let row = sqlx::query(
            r#"
            SELECT
              workflow_id,
              profile_name,
              proxy_enabled,
              proxy_server,
              proxy_username,
              proxy_password,
              user_agent,
              viewport_width,
              viewport_height,
              mobile,
              touch,
              challenge_policy
            FROM workflow_browser_configs
            WHERE workflow_id = ?1
            "#,
        )
        .bind(workflow_id)
        .fetch_optional(&self.pool)
        .await?;

        row.map(|row| {
            let challenge_policy: String = row.get("challenge_policy");
            let challenge_policy = serde_json::from_value::<WorkflowBrowserChallengePolicy>(
                Value::String(challenge_policy),
            )?;

            Ok(WorkflowBrowserConfig {
                workflow_id: row.get("workflow_id"),
                profile_name: row.get("profile_name"),
                proxy_enabled: row.get::<i64, _>("proxy_enabled") != 0,
                proxy_server: row.get("proxy_server"),
                proxy_username: row.get("proxy_username"),
                proxy_password: row.get("proxy_password"),
                user_agent: row.get("user_agent"),
                viewport_width: optional_u32(row.get("viewport_width")),
                viewport_height: optional_u32(row.get("viewport_height")),
                mobile: row.get::<i64, _>("mobile") != 0,
                touch: row.get::<i64, _>("touch") != 0,
                challenge_policy,
                headless: false,
            })
        })
        .transpose()
    }

    pub async fn save_workflow_browser_config(
        &self,
        config: WorkflowBrowserConfig,
    ) -> Result<(), RepositoryError> {
        let now = now_timestamp();
        let config = config.normalized();
        let challenge_policy = challenge_policy_str(config.challenge_policy);

        sqlx::query(
            r#"
            INSERT INTO workflow_browser_configs (
              workflow_id,
              profile_name,
              proxy_enabled,
              proxy_server,
              proxy_username,
              proxy_password,
              user_agent,
              viewport_width,
              viewport_height,
              mobile,
              touch,
              challenge_policy,
              created_at,
              updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
            ON CONFLICT(workflow_id) DO UPDATE SET
              profile_name = excluded.profile_name,
              proxy_enabled = excluded.proxy_enabled,
              proxy_server = excluded.proxy_server,
              proxy_username = excluded.proxy_username,
              proxy_password = excluded.proxy_password,
              user_agent = excluded.user_agent,
              viewport_width = excluded.viewport_width,
              viewport_height = excluded.viewport_height,
              mobile = excluded.mobile,
              touch = excluded.touch,
              challenge_policy = excluded.challenge_policy,
              updated_at = excluded.updated_at
            "#,
        )
        .bind(&config.workflow_id)
        .bind(&config.profile_name)
        .bind(bool_to_i64(config.proxy_enabled))
        .bind(&config.proxy_server)
        .bind(&config.proxy_username)
        .bind(&config.proxy_password)
        .bind(&config.user_agent)
        .bind(config.viewport_width.map(i64::from))
        .bind(config.viewport_height.map(i64::from))
        .bind(bool_to_i64(config.mobile))
        .bind(bool_to_i64(config.touch))
        .bind(challenge_policy)
        .bind(&now)
        .bind(&now)
        .execute(&self.pool)
        .await?;

        touch_workflow(&self.pool, &config.workflow_id).await?;

        Ok(())
    }

    pub async fn get_workflow_settings(
        &self,
        workflow_id: &str,
    ) -> Result<Option<WorkflowSettings>, RepositoryError> {
        let detail = self.get_workflow(workflow_id).await?;
        let Some(detail) = detail else {
            return Ok(None);
        };

        let row = sqlx::query(
            r#"
            SELECT
              workflow_id,
              version,
              general_json,
              execution_json,
              browser_json,
              behavior_json,
              environment_json,
              inputs_json,
              triggers_json,
              advanced_json,
              created_at,
              updated_at
            FROM workflow_settings
            WHERE workflow_id = ?1
            "#,
        )
        .bind(workflow_id)
        .fetch_optional(&self.pool)
        .await?;

        let Some(row) = row else {
            let mut settings = WorkflowSettings::default_for_workflow(&detail.workflow);
            if let Some(browser_config) = self.get_workflow_browser_config(workflow_id).await? {
                settings.browser =
                    crate::domain::WorkflowSettingsBrowser::from_browser_config(browser_config);
            }
            return Ok(Some(settings));
        };

        Ok(Some(
            WorkflowSettings {
                workflow_id: row.get("workflow_id"),
                version: row.get::<i64, _>("version") as u32,
                general: serde_json::from_str(&row.get::<String, _>("general_json"))?,
                execution: serde_json::from_str(&row.get::<String, _>("execution_json"))?,
                browser: serde_json::from_str(&row.get::<String, _>("browser_json"))?,
                behavior: serde_json::from_str(&row.get::<String, _>("behavior_json"))?,
                environment: serde_json::from_str(&row.get::<String, _>("environment_json"))?,
                inputs: serde_json::from_str(&row.get::<String, _>("inputs_json"))?,
                triggers: serde_json::from_str(&row.get::<String, _>("triggers_json"))?,
                advanced: serde_json::from_str(&row.get::<String, _>("advanced_json"))?,
                created_at: Some(row.get("created_at")),
                updated_at: Some(row.get("updated_at")),
            }
            .normalized(),
        ))
    }

    pub async fn save_workflow_settings(
        &self,
        settings: WorkflowSettings,
    ) -> Result<WorkflowSettings, RepositoryError> {
        let now = now_timestamp();
        let mut settings = settings.normalized();
        settings.version = 1;
        let created_at = settings.created_at.clone().unwrap_or_else(|| now.clone());
        settings.created_at = Some(created_at.clone());
        settings.updated_at = Some(now.clone());
        settings.general.updated_at = Some(now.clone());
        settings.general.created_at = settings
            .general
            .created_at
            .clone()
            .or(Some(created_at.clone()));

        sqlx::query(
            r#"
            INSERT INTO workflow_settings (
              workflow_id,
              version,
              general_json,
              execution_json,
              browser_json,
              behavior_json,
              environment_json,
              inputs_json,
              triggers_json,
              advanced_json,
              created_at,
              updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
            ON CONFLICT(workflow_id) DO UPDATE SET
              version = excluded.version,
              general_json = excluded.general_json,
              execution_json = excluded.execution_json,
              browser_json = excluded.browser_json,
              behavior_json = excluded.behavior_json,
              environment_json = excluded.environment_json,
              inputs_json = excluded.inputs_json,
              triggers_json = excluded.triggers_json,
              advanced_json = excluded.advanced_json,
              updated_at = excluded.updated_at
            "#,
        )
        .bind(&settings.workflow_id)
        .bind(i64::from(settings.version))
        .bind(serde_json::to_string(&settings.general)?)
        .bind(serde_json::to_string(&settings.execution)?)
        .bind(serde_json::to_string(&settings.browser)?)
        .bind(serde_json::to_string(&settings.behavior)?)
        .bind(serde_json::to_string(&settings.environment)?)
        .bind(serde_json::to_string(&settings.inputs)?)
        .bind(serde_json::to_string(&settings.triggers)?)
        .bind(serde_json::to_string(&settings.advanced)?)
        .bind(&created_at)
        .bind(&now)
        .execute(&self.pool)
        .await?;

        sqlx::query(
            r#"
            UPDATE workflows
            SET name = ?1, updated_at = ?2
            WHERE id = ?3
            "#,
        )
        .bind(&settings.general.name)
        .bind(&now)
        .bind(&settings.workflow_id)
        .execute(&self.pool)
        .await?;

        Ok(settings)
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
            name: config.action_type().label().to_string(),
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
        name: &str,
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
            SET name = ?1, type = ?2, config_json = ?3, updated_at = ?4
            WHERE id = ?5
            "#,
        )
        .bind(step_name(name.to_string(), config.action_type()))
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

fn normalize_legacy_action_config_json(config_json: &str) -> Result<String, JsonError> {
    let mut value: Value = serde_json::from_str(config_json)?;
    let action_type = value.get("type").and_then(Value::as_str);
    let Some(action_type) = action_type else {
        return Ok(config_json.to_string());
    };

    match action_type {
        "open_url" => {
            value["type"] = Value::String("navigate".to_string());
        }
        "sleep" => {
            let seconds = value
                .get("config")
                .and_then(|config| config.get("seconds"))
                .and_then(Value::as_f64)
                .unwrap_or(0.0);
            let duration_ms = (seconds * 1000.0).round().max(0.0) as u64;
            value = serde_json::json!({
                "type": "wait",
                "config": {
                    "condition": "duration",
                    "duration_ms": duration_ms
                }
            });
        }
        "type_text" => {
            let config = value.get("config").cloned().unwrap_or(Value::Null);
            let xpath = config
                .get("xpath")
                .cloned()
                .unwrap_or_else(|| Value::String(String::new()));
            let text = config
                .get("text")
                .cloned()
                .unwrap_or_else(|| Value::String(String::new()));
            value = serde_json::json!({
                "type": "input_text",
                "config": {
                    "xpath": xpath,
                    "text": text,
                    "clear_before_input": true,
                    "typing_mode": "set_value"
                }
            });
        }
        _ => return Ok(config_json.to_string()),
    }

    serde_json::to_string(&value)
}

async fn insert_step(pool: &SqlitePool, step: &WorkflowStep) -> Result<(), RepositoryError> {
    sqlx::query(
        r#"
        INSERT INTO workflow_steps
          (id, name, workflow_id, order_index, type, config_json, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        "#,
    )
    .bind(&step.id)
    .bind(&step.name)
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

fn step_name(name: String, action_type: crate::domain::ActionType) -> String {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        action_type.label().to_string()
    } else {
        trimmed.to_string()
    }
}

fn optional_u32(value: Option<i64>) -> Option<u32> {
    value.and_then(|value| u32::try_from(value).ok())
}

fn bool_to_i64(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}

fn challenge_policy_str(policy: WorkflowBrowserChallengePolicy) -> &'static str {
    match policy {
        WorkflowBrowserChallengePolicy::None => "none",
        WorkflowBrowserChallengePolicy::DetectOnly => "detect_only",
        WorkflowBrowserChallengePolicy::PauseForHuman => "pause_for_human",
    }
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
