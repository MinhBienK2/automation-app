use serde_json::Value;

use crate::{
    app_state::AppState,
    domain::{
        Workflow, WorkflowExport, WorkflowGraph, WorkflowPackage, WorkflowPackageExportOptions,
        WorkflowPackageImportOptions, WorkflowPackagePreview, WorkflowPackageSettings,
        WorkflowPackageWorkflow, WorkflowSettings, WorkflowSettingsEnvironment,
        WorkflowSettingsSection,
    },
    repositories::WorkflowDetail,
};

use super::{
    create_workflow_impl, get_workflow_graph_impl, save_workflow_graph_impl,
    save_workflow_settings_impl, CommandError,
};

const WORKFLOW_PACKAGE_KIND: &str = "workflow_package";
const WORKFLOW_PACKAGE_VERSION: u32 = 2;

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

pub async fn export_workflow_package_impl(
    state: &AppState,
    workflow_id: &str,
    options: WorkflowPackageExportOptions,
) -> Result<WorkflowPackage, CommandError> {
    let detail = state
        .repository()
        .get_workflow(workflow_id)
        .await
        .map_err(CommandError::from)?
        .ok_or_else(|| CommandError::message("Workflow not found"))?;
    let settings = state
        .repository()
        .get_workflow_settings(workflow_id)
        .await
        .map_err(CommandError::from)?;

    let mut included_sections = Vec::new();
    let mut omitted_fields = Vec::new();
    let flow = if options.include_flow {
        included_sections.push("flow".to_string());
        Some(get_workflow_graph_impl(state, workflow_id).await?)
    } else {
        None
    };

    let package_settings = settings
        .map(|settings| {
            package_settings_from_workflow_settings(
                settings,
                &options.settings_sections,
                &mut included_sections,
                &mut omitted_fields,
            )
        })
        .filter(|settings| !settings.is_empty());

    Ok(WorkflowPackage {
        kind: WORKFLOW_PACKAGE_KIND.to_string(),
        version: WORKFLOW_PACKAGE_VERSION,
        workflow: WorkflowPackageWorkflow {
            name: detail.workflow.name,
        },
        included_sections,
        omitted_fields,
        flow,
        settings: package_settings,
    })
}

pub fn preview_workflow_package_impl(
    package: WorkflowPackage,
) -> Result<WorkflowPackagePreview, CommandError> {
    validate_workflow_package_header(&package)?;

    Ok(WorkflowPackagePreview {
        workflow_name: package.workflow.name.trim().to_string(),
        includes_flow: package.flow.is_some(),
        settings_sections: available_package_settings_sections(package.settings.as_ref()),
        omitted_fields: package.omitted_fields,
    })
}

pub async fn import_workflow_package_impl(
    state: &AppState,
    package: WorkflowPackage,
    options: WorkflowPackageImportOptions,
) -> Result<WorkflowDetail, CommandError> {
    validate_workflow_package_header(&package)?;
    let import_name = format!("{} (imported)", package.workflow.name.trim());
    let flow = selected_package_flow(&package, options.include_flow)?;
    let settings = selected_package_settings(&package, &import_name, &options.settings_sections)?;

    let workflow = create_workflow_impl(state, &import_name).await?;

    if let Some(graph) = flow {
        save_workflow_graph_impl(state, &workflow.id, graph).await?;
    }

    if let Some(mut settings) = settings {
        settings.workflow_id = workflow.id.clone();
        settings.general.name = import_name;
        save_workflow_settings_impl(state, &workflow.id, settings).await?;
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

fn validate_workflow_package_header(package: &WorkflowPackage) -> Result<(), CommandError> {
    if package.kind != WORKFLOW_PACKAGE_KIND {
        return Err(CommandError::message("Invalid workflow package kind"));
    }

    if package.version != WORKFLOW_PACKAGE_VERSION {
        return Err(CommandError::message(
            "Unsupported workflow package version",
        ));
    }

    let candidate = Workflow::new(package.workflow.name.trim());
    candidate.validate().map_err(CommandError::validation)
}

fn package_settings_from_workflow_settings(
    settings: WorkflowSettings,
    sections: &[WorkflowSettingsSection],
    included_sections: &mut Vec<String>,
    omitted_fields: &mut Vec<String>,
) -> WorkflowPackageSettings {
    let mut package_settings = WorkflowPackageSettings {
        general: None,
        execution: None,
        browser: None,
        environment: None,
        inputs: None,
        triggers: None,
        advanced: None,
    };

    for section in normalized_sections(sections) {
        match section {
            WorkflowSettingsSection::General => {
                included_sections.push("settings.general".to_string());
                package_settings.general = Some(settings.general.clone());
            }
            WorkflowSettingsSection::Execution => {
                included_sections.push("settings.execution".to_string());
                package_settings.execution = Some(settings.execution.clone());
            }
            WorkflowSettingsSection::Browser => {
                included_sections.push("settings.browser".to_string());
                let mut browser = settings.browser.clone();
                if browser.proxy_password.is_some() {
                    browser.proxy_password = None;
                    omitted_fields.push("settings.browser.proxy_password".to_string());
                }
                package_settings.browser = Some(browser);
            }
            WorkflowSettingsSection::Environment => {
                included_sections.push("settings.environment".to_string());
                package_settings.environment = Some(sanitized_environment(
                    settings.environment.clone(),
                    omitted_fields,
                ));
            }
            WorkflowSettingsSection::Inputs => {
                included_sections.push("settings.inputs".to_string());
                package_settings.inputs = Some(settings.inputs.clone());
            }
            WorkflowSettingsSection::Triggers => {
                included_sections.push("settings.triggers".to_string());
                package_settings.triggers = Some(settings.triggers.clone());
            }
            WorkflowSettingsSection::Advanced => {
                included_sections.push("settings.advanced".to_string());
                package_settings.advanced = Some(settings.advanced.clone());
            }
        }
    }

    package_settings
}

fn sanitized_environment(
    mut environment: WorkflowSettingsEnvironment,
    omitted_fields: &mut Vec<String>,
) -> WorkflowSettingsEnvironment {
    if environment.download_directory.is_some() {
        environment.download_directory = None;
        omitted_fields.push("settings.environment.download_directory".to_string());
    }
    if !environment.cookies.is_empty() {
        environment.cookies.clear();
        omitted_fields.push("settings.environment.cookies".to_string());
    }
    if !environment.local_storage.is_empty() {
        environment.local_storage.clear();
        omitted_fields.push("settings.environment.local_storage".to_string());
    }
    if !environment.session_storage.is_empty() {
        environment.session_storage.clear();
        omitted_fields.push("settings.environment.session_storage".to_string());
    }
    if environment.session_restore_ref.is_some() {
        environment.session_restore_ref = None;
        omitted_fields.push("settings.environment.session_restore_ref".to_string());
    }

    environment
}

fn available_package_settings_sections(
    settings: Option<&WorkflowPackageSettings>,
) -> Vec<WorkflowSettingsSection> {
    let Some(settings) = settings else {
        return Vec::new();
    };

    let mut sections = Vec::new();
    if settings.general.is_some() {
        sections.push(WorkflowSettingsSection::General);
    }
    if settings.execution.is_some() {
        sections.push(WorkflowSettingsSection::Execution);
    }
    if settings.browser.is_some() {
        sections.push(WorkflowSettingsSection::Browser);
    }
    if settings.environment.is_some() {
        sections.push(WorkflowSettingsSection::Environment);
    }
    if settings.inputs.is_some() {
        sections.push(WorkflowSettingsSection::Inputs);
    }
    if settings.triggers.is_some() {
        sections.push(WorkflowSettingsSection::Triggers);
    }
    if settings.advanced.is_some() {
        sections.push(WorkflowSettingsSection::Advanced);
    }

    sections
}

fn selected_package_flow(
    package: &WorkflowPackage,
    include_flow: bool,
) -> Result<Option<WorkflowGraph>, CommandError> {
    if !include_flow {
        return Ok(None);
    }

    package
        .flow
        .clone()
        .map(Some)
        .ok_or_else(|| CommandError::message("Workflow package does not include Flow"))
}

fn selected_package_settings(
    package: &WorkflowPackage,
    import_name: &str,
    sections: &[WorkflowSettingsSection],
) -> Result<Option<WorkflowSettings>, CommandError> {
    if sections.is_empty() {
        return Ok(None);
    }

    let package_settings = package
        .settings
        .as_ref()
        .ok_or_else(|| CommandError::message("Workflow package does not include Settings"))?;
    let workflow = Workflow::new(import_name);
    let mut settings = WorkflowSettings::default_for_workflow(&workflow);

    for section in normalized_sections(sections) {
        match section {
            WorkflowSettingsSection::General => {
                settings.general = package_settings
                    .general
                    .clone()
                    .ok_or_else(|| missing_settings_section("General"))?;
            }
            WorkflowSettingsSection::Execution => {
                settings.execution = package_settings
                    .execution
                    .clone()
                    .ok_or_else(|| missing_settings_section("Execution"))?;
            }
            WorkflowSettingsSection::Browser => {
                settings.browser = package_settings
                    .browser
                    .clone()
                    .ok_or_else(|| missing_settings_section("Browser"))?;
            }
            WorkflowSettingsSection::Environment => {
                settings.environment = package_settings
                    .environment
                    .clone()
                    .ok_or_else(|| missing_settings_section("Environment"))?;
            }
            WorkflowSettingsSection::Inputs => {
                settings.inputs = package_settings
                    .inputs
                    .clone()
                    .ok_or_else(|| missing_settings_section("Inputs"))?;
            }
            WorkflowSettingsSection::Triggers => {
                settings.triggers = package_settings
                    .triggers
                    .clone()
                    .ok_or_else(|| missing_settings_section("Triggers"))?;
            }
            WorkflowSettingsSection::Advanced => {
                settings.advanced = package_settings
                    .advanced
                    .clone()
                    .ok_or_else(|| missing_settings_section("Advanced"))?;
            }
        }
    }

    settings.general.name = import_name.to_string();
    settings.validate().map_err(CommandError::validation)?;
    Ok(Some(settings))
}

fn missing_settings_section(section: &str) -> CommandError {
    CommandError::message(format!(
        "Workflow package does not include {section} settings"
    ))
}

fn normalized_sections(sections: &[WorkflowSettingsSection]) -> Vec<WorkflowSettingsSection> {
    let mut normalized = Vec::new();

    for candidate in [
        WorkflowSettingsSection::General,
        WorkflowSettingsSection::Execution,
        WorkflowSettingsSection::Browser,
        WorkflowSettingsSection::Environment,
        WorkflowSettingsSection::Inputs,
        WorkflowSettingsSection::Triggers,
        WorkflowSettingsSection::Advanced,
    ] {
        if sections.contains(&candidate) {
            normalized.push(candidate);
        }
    }

    normalized
}
