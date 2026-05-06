use serde_json::Value;

use crate::{app_state::AppState, domain::WorkflowExport, repositories::WorkflowDetail};

use super::{create_workflow_impl, CommandError};

pub async fn export_workflow_impl(
    state: &AppState,
    workflow_id: &str,
) -> Result<WorkflowExport, CommandError> {
    let detail = state
        .repository()
        .get_workflow(workflow_id)
        .await
        .map_err(CommandError::from)?
        .ok_or_else(|| CommandError::message("Workflow not found"))?;

    Ok(WorkflowExport {
        version: 1,
        workflow: detail.workflow,
        steps: detail.steps,
        settings: state
            .repository()
            .get_workflow_settings(workflow_id)
            .await
            .map_err(CommandError::from)?,
    })
}

pub async fn import_workflow_impl(
    state: &AppState,
    exported: WorkflowExport,
) -> Result<WorkflowDetail, CommandError> {
    if exported.version != 1 {
        return Err(CommandError::message("Unsupported workflow export version"));
    }

    let imported_name = format!("{} (imported)", exported.workflow.name.trim());
    let workflow = create_workflow_impl(state, &imported_name).await?;

    for step in exported.steps {
        step.config.validate().map_err(CommandError::validation)?;
        let created = state
            .repository()
            .add_step(&workflow.id, step.config.clone())
            .await
            .map_err(CommandError::from)?;
        state
            .repository()
            .update_step(&created.id, &step.name, step.config)
            .await
            .map_err(CommandError::from)?;
    }

    if let Some(mut settings) = exported.settings {
        settings.workflow_id = workflow.id.clone();
        settings.general.name = imported_name;
        settings.validate().map_err(CommandError::validation)?;
        state
            .repository()
            .save_workflow_settings(settings)
            .await
            .map_err(CommandError::from)?;
    }

    state
        .repository()
        .get_workflow(&workflow.id)
        .await
        .map_err(CommandError::from)?
        .ok_or_else(|| CommandError::message("Workflow not found after import"))
}

pub fn normalize_workflow_export_value(
    mut exported: Value,
) -> Result<WorkflowExport, CommandError> {
    if let Some(steps) = exported.get_mut("steps").and_then(Value::as_array_mut) {
        for step in steps {
            normalize_legacy_export_step(step);
        }
    }

    serde_json::from_value(exported)
        .map_err(|error| CommandError::message(format!("Invalid workflow export: {error}")))
}

fn normalize_legacy_export_step(step: &mut Value) {
    let Some(config) = step.get("config") else {
        return;
    };
    let action_type = config.get("type").and_then(Value::as_str);

    let replacement = match action_type {
        Some("open_url") => Some((
            "navigate",
            serde_json::json!({
                "type": "navigate",
                "config": {
                    "url": config
                        .get("config")
                        .and_then(|config| config.get("url"))
                        .cloned()
                        .unwrap_or_else(|| Value::String(String::new()))
                }
            }),
        )),
        Some("sleep") => {
            let seconds = config
                .get("config")
                .and_then(|config| config.get("seconds"))
                .and_then(Value::as_f64)
                .unwrap_or(0.0);
            let duration_ms = (seconds * 1000.0).round().max(0.0) as u64;
            Some((
                "wait",
                serde_json::json!({
                    "type": "wait",
                    "config": {
                        "condition": "duration",
                        "duration_ms": duration_ms
                    }
                }),
            ))
        }
        Some("type_text") => {
            let old_config = config.get("config").cloned().unwrap_or(Value::Null);
            let xpath = old_config
                .get("xpath")
                .cloned()
                .unwrap_or_else(|| Value::String(String::new()));
            let text = old_config
                .get("text")
                .cloned()
                .unwrap_or_else(|| Value::String(String::new()));
            Some((
                "input_text",
                serde_json::json!({
                    "type": "input_text",
                    "config": {
                        "xpath": xpath,
                        "text": text,
                        "clear_before_input": true,
                        "typing_mode": "set_value"
                    }
                }),
            ))
        }
        _ => None,
    };

    if let Some((action_type, config)) = replacement {
        step["action_type"] = Value::String(action_type.to_string());
        step["config"] = config;
    }
}
