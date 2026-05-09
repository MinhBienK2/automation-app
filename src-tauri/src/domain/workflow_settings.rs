use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};

use super::{
    HeaderPair, ValidationError, VariableAssignment, Workflow, WorkflowBrowserChallengePolicy,
    WorkflowBrowserConfig,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowSettingsSection {
    General,
    Execution,
    Browser,
    Environment,
    Inputs,
    Triggers,
    Advanced,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowSettingsIssueLevel {
    Error,
    Warning,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SettingsValidationIssue {
    pub section: WorkflowSettingsSection,
    pub field: Option<String>,
    pub message: String,
    pub level: WorkflowSettingsIssueLevel,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RunValidationIssueSource {
    Graph,
    Settings,
}

impl RunValidationIssueSource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Graph => "graph",
            Self::Settings => "settings",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RunValidationIssue {
    pub source: RunValidationIssueSource,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub node_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub edge_id: Option<String>,
    pub message: String,
    pub level: WorkflowSettingsIssueLevel,
}

impl SettingsValidationIssue {
    fn error(
        section: WorkflowSettingsSection,
        field: impl Into<String>,
        message: impl Into<String>,
    ) -> Self {
        Self {
            section,
            field: Some(field.into()),
            message: message.into(),
            level: WorkflowSettingsIssueLevel::Error,
        }
    }

    fn validation_error(&self) -> ValidationError {
        let field = self
            .field
            .as_deref()
            .map(|field| format!("{}.{}", section_field_prefix(self.section), field))
            .unwrap_or_else(|| "settings".to_string());
        ValidationError::new(field, self.message.clone())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowBrowserRetention {
    Retain,
    Close,
}

impl WorkflowBrowserRetention {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Retain => "retain",
            Self::Close => "close",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowFailurePolicy {
    StopOnFirstFailure,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowInteractionFidelity {
    Standard,
    High,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowDirectDomFallback {
    Disabled,
    Explicit,
    AllowedWithTrace,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowTimingProfile {
    Balanced,
    SlowRealistic,
    Custom,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowInputValueType {
    Text,
    Json,
    Number,
    Boolean,
    Array,
    Object,
    SecretRef,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowTriggerMode {
    Manual,
    Once,
    Interval,
    Cron,
    Event,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowMissedRunPolicy {
    Skip,
    RunNextEligible,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowTriggerConcurrencyPolicy {
    SkipIfRunning,
    QueueOne,
    Reject,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowDebugLoggingLevel {
    Off,
    Error,
    Info,
    Debug,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkflowSettingsGeneral {
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub notes: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkflowSettingsExecution {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_action_timeout_ms: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_retry_attempts: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_retry_interval_ms: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_workflow_duration_ms: Option<u64>,
    #[serde(default = "default_browser_retention")]
    pub browser_retention: WorkflowBrowserRetention,
    #[serde(default = "default_failure_policy")]
    pub failure_policy: WorkflowFailurePolicy,
    #[serde(default = "default_interaction_fidelity")]
    pub interaction_fidelity: WorkflowInteractionFidelity,
    #[serde(default = "default_direct_dom_fallback")]
    pub direct_dom_fallback: WorkflowDirectDomFallback,
    #[serde(default = "default_timing_profile")]
    pub timing_profile: WorkflowTimingProfile,
    #[serde(default)]
    pub wait_between_nodes_enabled: bool,
    #[serde(default)]
    pub wait_between_nodes_random: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wait_between_nodes_ms: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wait_between_nodes_min_ms: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wait_between_nodes_max_ms: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub batch_concurrency_limit: Option<usize>,
    #[serde(default)]
    pub batch_headless: bool,
    #[serde(default)]
    pub batch_stop_on_first_failed_row: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output_retention_days: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkflowSettingsBrowser {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub profile_name: Option<String>,
    #[serde(default)]
    pub proxy_enabled: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub proxy_server: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub proxy_username: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub proxy_password: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_agent: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub viewport_width: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub viewport_height: Option<u32>,
    #[serde(default)]
    pub mobile: bool,
    #[serde(default)]
    pub touch: bool,
    #[serde(default)]
    pub challenge_policy: WorkflowBrowserChallengePolicy,
    #[serde(default)]
    pub headless: bool,
    #[serde(default)]
    pub fingerprint_preflight_enabled: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fingerprint_probe_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fingerprint_profile_id: Option<String>,
    #[serde(default)]
    pub fingerprint_allowed_origins: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fingerprint_proxy_label: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fingerprint_proxy_region: Option<String>,
}

impl WorkflowSettingsBrowser {
    pub fn from_browser_config(config: WorkflowBrowserConfig) -> Self {
        let config = config.normalized();
        Self {
            profile_name: config.profile_name,
            proxy_enabled: config.proxy_enabled,
            proxy_server: config.proxy_server,
            proxy_username: config.proxy_username,
            proxy_password: config.proxy_password,
            user_agent: config.user_agent,
            viewport_width: config.viewport_width,
            viewport_height: config.viewport_height,
            mobile: config.mobile,
            touch: config.touch,
            challenge_policy: config.challenge_policy,
            headless: config.headless,
            fingerprint_preflight_enabled: false,
            fingerprint_probe_url: None,
            fingerprint_profile_id: None,
            fingerprint_allowed_origins: Vec::new(),
            fingerprint_proxy_label: None,
            fingerprint_proxy_region: None,
        }
    }

    pub fn to_browser_config(&self, workflow_id: impl Into<String>) -> WorkflowBrowserConfig {
        WorkflowBrowserConfig {
            workflow_id: workflow_id.into(),
            profile_name: self.profile_name.clone(),
            proxy_enabled: self.proxy_enabled,
            proxy_server: self.proxy_server.clone(),
            proxy_username: self.proxy_username.clone(),
            proxy_password: self.proxy_password.clone(),
            user_agent: self.user_agent.clone(),
            viewport_width: self.viewport_width,
            viewport_height: self.viewport_height,
            mobile: self.mobile,
            touch: self.touch,
            challenge_policy: self.challenge_policy,
            headless: self.headless,
        }
        .normalized()
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WorkflowSettingsGeolocation {
    pub latitude: f64,
    pub longitude: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub accuracy: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkflowSettingsCookie {
    pub name: String,
    pub value: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub domain: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkflowSettingsStorageEntry {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WorkflowSettingsEnvironment {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub geolocation: Option<WorkflowSettingsGeolocation>,
    #[serde(default)]
    pub permissions: Vec<String>,
    #[serde(default)]
    pub extra_http_headers: Vec<HeaderPair>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub locale: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timezone: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub download_directory: Option<String>,
    #[serde(default)]
    pub cookies: Vec<WorkflowSettingsCookie>,
    #[serde(default)]
    pub local_storage: Vec<WorkflowSettingsStorageEntry>,
    #[serde(default)]
    pub session_storage: Vec<WorkflowSettingsStorageEntry>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_restore_ref: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkflowSettingsInputRow {
    pub name: String,
    pub value_type: WorkflowInputValueType,
    #[serde(default)]
    pub required: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_value: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkflowSettingsBatchMapping {
    pub column: String,
    pub input: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkflowSettingsInputs {
    #[serde(default)]
    pub input_schema: Vec<WorkflowSettingsInputRow>,
    #[serde(default)]
    pub initial_variables: Vec<VariableAssignment>,
    #[serde(default)]
    pub batch_mapping: Vec<WorkflowSettingsBatchMapping>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkflowSettingsTriggers {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_trigger_mode")]
    pub mode: WorkflowTriggerMode,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub interval_seconds: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub once_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub input_source: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub batch_source_ref: Option<String>,
    #[serde(default = "default_missed_run_policy")]
    pub missed_run_policy: WorkflowMissedRunPolicy,
    #[serde(default = "default_concurrency_policy")]
    pub concurrency_policy: WorkflowTriggerConcurrencyPolicy,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_run_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub next_run_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkflowSettingsAdvanced {
    #[serde(default)]
    pub compatibility_warnings: Vec<String>,
    #[serde(default = "default_debug_logging_level")]
    pub debug_logging_level: WorkflowDebugLoggingLevel,
    #[serde(default)]
    pub experimental_flags: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WorkflowSettings {
    pub workflow_id: String,
    #[serde(default = "default_settings_version")]
    pub version: u32,
    pub general: WorkflowSettingsGeneral,
    #[serde(default = "default_execution")]
    pub execution: WorkflowSettingsExecution,
    #[serde(default = "default_browser")]
    pub browser: WorkflowSettingsBrowser,
    #[serde(default = "default_environment")]
    pub environment: WorkflowSettingsEnvironment,
    #[serde(default = "default_inputs")]
    pub inputs: WorkflowSettingsInputs,
    #[serde(default = "default_triggers")]
    pub triggers: WorkflowSettingsTriggers,
    #[serde(default = "default_advanced")]
    pub advanced: WorkflowSettingsAdvanced,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

impl WorkflowSettings {
    pub fn default_for_workflow(workflow: &Workflow) -> Self {
        Self {
            workflow_id: workflow.id.clone(),
            version: 1,
            general: WorkflowSettingsGeneral {
                name: workflow.name.clone(),
                description: String::new(),
                tags: Vec::new(),
                notes: String::new(),
                created_at: Some(workflow.created_at.clone()),
                updated_at: Some(workflow.updated_at.clone()),
            },
            execution: default_execution(),
            browser: default_browser(),
            environment: default_environment(),
            inputs: default_inputs(),
            triggers: default_triggers(),
            advanced: default_advanced(),
            created_at: Some(workflow.created_at.clone()),
            updated_at: Some(workflow.updated_at.clone()),
        }
    }

    pub fn normalized(&self) -> Self {
        let mut seen_tags = BTreeSet::new();
        let tags = self
            .general
            .tags
            .iter()
            .map(|tag| tag.trim().to_ascii_lowercase())
            .filter(|tag| !tag.is_empty())
            .filter(|tag| seen_tags.insert(tag.clone()))
            .collect::<Vec<_>>();

        let browser = WorkflowSettingsBrowser::from_browser_config(
            self.browser.to_browser_config(&self.workflow_id),
        );

        Self {
            workflow_id: self.workflow_id.clone(),
            version: self.version,
            general: WorkflowSettingsGeneral {
                name: self.general.name.trim().to_string(),
                description: self.general.description.trim().to_string(),
                tags,
                notes: self.general.notes.clone(),
                created_at: self.general.created_at.clone(),
                updated_at: self.general.updated_at.clone(),
            },
            execution: self.execution.clone(),
            browser: WorkflowSettingsBrowser {
                headless: self.browser.headless,
                fingerprint_preflight_enabled: self.browser.fingerprint_preflight_enabled,
                fingerprint_probe_url: trimmed_option(&self.browser.fingerprint_probe_url),
                fingerprint_profile_id: trimmed_option(&self.browser.fingerprint_profile_id),
                fingerprint_allowed_origins: self
                    .browser
                    .fingerprint_allowed_origins
                    .iter()
                    .map(|origin| origin.trim().to_string())
                    .filter(|origin| !origin.is_empty())
                    .collect(),
                fingerprint_proxy_label: trimmed_option(&self.browser.fingerprint_proxy_label),
                fingerprint_proxy_region: trimmed_option(&self.browser.fingerprint_proxy_region),
                ..browser
            },
            environment: WorkflowSettingsEnvironment {
                geolocation: self.environment.geolocation.clone(),
                permissions: self
                    .environment
                    .permissions
                    .iter()
                    .map(|permission| permission.trim().to_string())
                    .filter(|permission| !permission.is_empty())
                    .collect(),
                extra_http_headers: self.environment.extra_http_headers.clone(),
                locale: trimmed_option(&self.environment.locale),
                timezone: trimmed_option(&self.environment.timezone),
                download_directory: trimmed_option(&self.environment.download_directory),
                cookies: self.environment.cookies.clone(),
                local_storage: self.environment.local_storage.clone(),
                session_storage: self.environment.session_storage.clone(),
                session_restore_ref: trimmed_option(&self.environment.session_restore_ref),
            },
            inputs: self.inputs.clone(),
            triggers: WorkflowSettingsTriggers {
                once_at: trimmed_option(&self.triggers.once_at),
                input_source: trimmed_option(&self.triggers.input_source),
                batch_source_ref: trimmed_option(&self.triggers.batch_source_ref),
                ..self.triggers.clone()
            },
            advanced: WorkflowSettingsAdvanced {
                compatibility_warnings: self.advanced.compatibility_warnings.clone(),
                debug_logging_level: self.advanced.debug_logging_level,
                experimental_flags: self
                    .advanced
                    .experimental_flags
                    .iter()
                    .map(|flag| flag.trim().to_string())
                    .filter(|flag| !flag.is_empty())
                    .collect(),
            },
            created_at: self.created_at.clone(),
            updated_at: self.updated_at.clone(),
        }
    }

    pub fn validate(&self) -> Result<(), ValidationError> {
        self.validation_issues()
            .into_iter()
            .find(|issue| issue.level == WorkflowSettingsIssueLevel::Error)
            .map(|issue| Err(issue.validation_error()))
            .unwrap_or(Ok(()))
    }

    pub fn validation_issues(&self) -> Vec<SettingsValidationIssue> {
        let settings = self.normalized();
        let mut issues = Vec::new();

        if settings.general.name.is_empty() {
            issues.push(SettingsValidationIssue::error(
                WorkflowSettingsSection::General,
                "name",
                "Workflow name is required",
            ));
        }

        validate_positive_u64(
            &mut issues,
            WorkflowSettingsSection::Execution,
            "default_action_timeout_ms",
            "Default action timeout must be greater than 0",
            settings.execution.default_action_timeout_ms,
        );
        validate_positive_u32(
            &mut issues,
            WorkflowSettingsSection::Execution,
            "default_retry_attempts",
            "Default retry attempts must be greater than 0",
            settings.execution.default_retry_attempts,
        );
        validate_positive_u64(
            &mut issues,
            WorkflowSettingsSection::Execution,
            "default_retry_interval_ms",
            "Default retry interval must be greater than 0",
            settings.execution.default_retry_interval_ms,
        );
        validate_positive_u64(
            &mut issues,
            WorkflowSettingsSection::Execution,
            "max_workflow_duration_ms",
            "Workflow max duration must be greater than 0",
            settings.execution.max_workflow_duration_ms,
        );
        if matches!(settings.execution.batch_concurrency_limit, Some(0)) {
            issues.push(SettingsValidationIssue::error(
                WorkflowSettingsSection::Execution,
                "batch_concurrency_limit",
                "Batch concurrency must be greater than 0",
            ));
        }
        if let (Some(max_duration), Some(action_timeout)) = (
            settings.execution.max_workflow_duration_ms,
            settings.execution.default_action_timeout_ms,
        ) {
            if max_duration < action_timeout {
                issues.push(SettingsValidationIssue::error(
                    WorkflowSettingsSection::Execution,
                    "max_workflow_duration_ms",
                    "Workflow max duration must be greater than or equal to default action timeout",
                ));
            }
        }
        if settings.execution.wait_between_nodes_enabled {
            if settings.execution.wait_between_nodes_random {
                validate_required_positive_u64(
                    &mut issues,
                    "wait_between_nodes_min_ms",
                    "Random wait minimum must be greater than 0",
                    settings.execution.wait_between_nodes_min_ms,
                );
                validate_required_positive_u64(
                    &mut issues,
                    "wait_between_nodes_max_ms",
                    "Random wait maximum must be greater than 0",
                    settings.execution.wait_between_nodes_max_ms,
                );
                if let (Some(min_ms), Some(max_ms)) = (
                    settings.execution.wait_between_nodes_min_ms,
                    settings.execution.wait_between_nodes_max_ms,
                ) {
                    if max_ms < min_ms {
                        issues.push(SettingsValidationIssue::error(
                            WorkflowSettingsSection::Execution,
                            "wait_between_nodes_max_ms",
                            "Random wait maximum must be greater than or equal to minimum",
                        ));
                    }
                }
            } else {
                validate_required_positive_u64(
                    &mut issues,
                    "wait_between_nodes_ms",
                    "Wait between nodes must be greater than 0",
                    settings.execution.wait_between_nodes_ms,
                );
            }
        }

        if let Err(error) = settings
            .browser
            .to_browser_config(&settings.workflow_id)
            .validate()
        {
            issues.push(SettingsValidationIssue::error(
                WorkflowSettingsSection::Browser,
                error.field,
                error.message,
            ));
        }
        if settings.browser.fingerprint_preflight_enabled {
            let probe_url = settings
                .browser
                .fingerprint_probe_url
                .as_deref()
                .unwrap_or_default()
                .trim();
            if probe_url.is_empty() {
                issues.push(SettingsValidationIssue::error(
                    WorkflowSettingsSection::Browser,
                    "fingerprint_probe_url",
                    "Fingerprint probe URL is required when preflight is enabled",
                ));
            } else if !is_http_url(probe_url) {
                issues.push(SettingsValidationIssue::error(
                    WorkflowSettingsSection::Browser,
                    "fingerprint_probe_url",
                    "Fingerprint probe URL must use http or https",
                ));
            } else if !settings.browser.fingerprint_allowed_origins.is_empty() {
                let probe_origin = origin_from_http_url(probe_url);
                let allowed = settings
                    .browser
                    .fingerprint_allowed_origins
                    .iter()
                    .any(|origin| origin.trim() == probe_origin);
                if !allowed {
                    issues.push(SettingsValidationIssue::error(
                        WorkflowSettingsSection::Browser,
                        "fingerprint_probe_url",
                        "Fingerprint probe origin must be in the workflow allowlist",
                    ));
                }
            }
            if settings
                .browser
                .fingerprint_profile_id
                .as_deref()
                .is_none_or(|value| value.trim().is_empty())
            {
                issues.push(SettingsValidationIssue::error(
                    WorkflowSettingsSection::Browser,
                    "fingerprint_profile_id",
                    "Fingerprint identity profile is required when preflight is enabled",
                ));
            }
            if settings.browser.headless {
                issues.push(SettingsValidationIssue::error(
                    WorkflowSettingsSection::Browser,
                    "headless",
                    "Fingerprint preflight requires headed browser mode",
                ));
            }
        }

        if let Some(geolocation) = &settings.environment.geolocation {
            if !(-90.0..=90.0).contains(&geolocation.latitude) {
                issues.push(SettingsValidationIssue::error(
                    WorkflowSettingsSection::Environment,
                    "geolocation.latitude",
                    "Geolocation latitude must be between -90 and 90",
                ));
            }
            if !(-180.0..=180.0).contains(&geolocation.longitude) {
                issues.push(SettingsValidationIssue::error(
                    WorkflowSettingsSection::Environment,
                    "geolocation.longitude",
                    "Geolocation longitude must be between -180 and 180",
                ));
            }
        }
        for header in &settings.environment.extra_http_headers {
            if header.name.trim().is_empty() || header.value.trim().is_empty() {
                issues.push(SettingsValidationIssue::error(
                    WorkflowSettingsSection::Environment,
                    "extra_http_headers",
                    "Header names and values must be non-empty",
                ));
                break;
            }
        }
        for entry in settings
            .environment
            .local_storage
            .iter()
            .chain(settings.environment.session_storage.iter())
        {
            if entry.key.trim().is_empty() {
                issues.push(SettingsValidationIssue::error(
                    WorkflowSettingsSection::Environment,
                    "storage",
                    "Storage keys must be non-empty",
                ));
                break;
            }
        }

        let mut input_names = BTreeSet::new();
        for input in &settings.inputs.input_schema {
            let name = input.name.trim();
            if name.is_empty() {
                issues.push(SettingsValidationIssue::error(
                    WorkflowSettingsSection::Inputs,
                    "input_schema",
                    "Input name is required",
                ));
                continue;
            }
            if !input_names.insert(name.to_string()) {
                issues.push(SettingsValidationIssue::error(
                    WorkflowSettingsSection::Inputs,
                    "input_schema",
                    format!("Duplicate input name {name}"),
                ));
            }
            if let Some(default_value) = &input.default_value {
                validate_input_default(&mut issues, input.value_type, name, default_value);
            }
        }

        if settings.triggers.enabled {
            match settings.triggers.mode {
                WorkflowTriggerMode::Interval => {
                    if settings.triggers.interval_seconds.unwrap_or(0) == 0 {
                        issues.push(SettingsValidationIssue::error(
                            WorkflowSettingsSection::Triggers,
                            "interval_seconds",
                            "Trigger interval must be greater than 0",
                        ));
                    }
                }
                WorkflowTriggerMode::Once => {
                    if settings
                        .triggers
                        .once_at
                        .as_deref()
                        .unwrap_or_default()
                        .trim()
                        .is_empty()
                    {
                        issues.push(SettingsValidationIssue::error(
                            WorkflowSettingsSection::Triggers,
                            "once_at",
                            "Trigger timestamp is required",
                        ));
                    }
                }
                WorkflowTriggerMode::Manual
                | WorkflowTriggerMode::Cron
                | WorkflowTriggerMode::Event => {}
            }
        }

        issues
    }
}

fn validate_input_default(
    issues: &mut Vec<SettingsValidationIssue>,
    value_type: WorkflowInputValueType,
    name: &str,
    value: &str,
) {
    match value_type {
        WorkflowInputValueType::Json
        | WorkflowInputValueType::Array
        | WorkflowInputValueType::Object => {
            if serde_json::from_str::<serde_json::Value>(value).is_err() {
                issues.push(SettingsValidationIssue::error(
                    WorkflowSettingsSection::Inputs,
                    "input_schema",
                    format!("Input {name} default must contain valid JSON"),
                ));
            }
        }
        WorkflowInputValueType::Number => {
            if !value.parse::<f64>().is_ok_and(f64::is_finite) {
                issues.push(SettingsValidationIssue::error(
                    WorkflowSettingsSection::Inputs,
                    "input_schema",
                    format!("Input {name} default must contain a finite number"),
                ));
            }
        }
        WorkflowInputValueType::Boolean => {
            if !matches!(value, "true" | "false") {
                issues.push(SettingsValidationIssue::error(
                    WorkflowSettingsSection::Inputs,
                    "input_schema",
                    format!("Input {name} default must be true or false"),
                ));
            }
        }
        WorkflowInputValueType::Text | WorkflowInputValueType::SecretRef => {}
    }
}

fn validate_required_positive_u64(
    issues: &mut Vec<SettingsValidationIssue>,
    field: &str,
    message: &str,
    value: Option<u64>,
) {
    if value.unwrap_or_default() == 0 {
        issues.push(SettingsValidationIssue::error(
            WorkflowSettingsSection::Execution,
            field,
            message,
        ));
    }
}

fn validate_positive_u64(
    issues: &mut Vec<SettingsValidationIssue>,
    section: WorkflowSettingsSection,
    field: &str,
    message: &str,
    value: Option<u64>,
) {
    if value == Some(0) {
        issues.push(SettingsValidationIssue::error(section, field, message));
    }
}

fn validate_positive_u32(
    issues: &mut Vec<SettingsValidationIssue>,
    section: WorkflowSettingsSection,
    field: &str,
    message: &str,
    value: Option<u32>,
) {
    if value == Some(0) {
        issues.push(SettingsValidationIssue::error(section, field, message));
    }
}

fn section_field_prefix(section: WorkflowSettingsSection) -> &'static str {
    match section {
        WorkflowSettingsSection::General => "general",
        WorkflowSettingsSection::Execution => "execution",
        WorkflowSettingsSection::Browser => "browser",
        WorkflowSettingsSection::Environment => "environment",
        WorkflowSettingsSection::Inputs => "inputs",
        WorkflowSettingsSection::Triggers => "triggers",
        WorkflowSettingsSection::Advanced => "advanced",
    }
}

fn default_settings_version() -> u32 {
    1
}

fn default_browser_retention() -> WorkflowBrowserRetention {
    WorkflowBrowserRetention::Retain
}

fn default_failure_policy() -> WorkflowFailurePolicy {
    WorkflowFailurePolicy::StopOnFirstFailure
}

fn default_interaction_fidelity() -> WorkflowInteractionFidelity {
    WorkflowInteractionFidelity::Standard
}

fn default_direct_dom_fallback() -> WorkflowDirectDomFallback {
    WorkflowDirectDomFallback::AllowedWithTrace
}

fn default_timing_profile() -> WorkflowTimingProfile {
    WorkflowTimingProfile::Balanced
}

fn default_trigger_mode() -> WorkflowTriggerMode {
    WorkflowTriggerMode::Manual
}

fn default_missed_run_policy() -> WorkflowMissedRunPolicy {
    WorkflowMissedRunPolicy::Skip
}

fn default_concurrency_policy() -> WorkflowTriggerConcurrencyPolicy {
    WorkflowTriggerConcurrencyPolicy::SkipIfRunning
}

fn default_debug_logging_level() -> WorkflowDebugLoggingLevel {
    WorkflowDebugLoggingLevel::Off
}

fn default_execution() -> WorkflowSettingsExecution {
    WorkflowSettingsExecution {
        default_action_timeout_ms: None,
        default_retry_attempts: None,
        default_retry_interval_ms: None,
        max_workflow_duration_ms: None,
        browser_retention: WorkflowBrowserRetention::Retain,
        failure_policy: WorkflowFailurePolicy::StopOnFirstFailure,
        interaction_fidelity: WorkflowInteractionFidelity::Standard,
        direct_dom_fallback: WorkflowDirectDomFallback::AllowedWithTrace,
        timing_profile: WorkflowTimingProfile::Balanced,
        wait_between_nodes_enabled: false,
        wait_between_nodes_random: false,
        wait_between_nodes_ms: None,
        wait_between_nodes_min_ms: None,
        wait_between_nodes_max_ms: None,
        batch_concurrency_limit: None,
        batch_headless: false,
        batch_stop_on_first_failed_row: false,
        output_retention_days: None,
    }
}

fn default_browser() -> WorkflowSettingsBrowser {
    WorkflowSettingsBrowser {
        profile_name: None,
        proxy_enabled: false,
        proxy_server: None,
        proxy_username: None,
        proxy_password: None,
        user_agent: None,
        viewport_width: None,
        viewport_height: None,
        mobile: false,
        touch: false,
        challenge_policy: WorkflowBrowserChallengePolicy::None,
        headless: false,
        fingerprint_preflight_enabled: false,
        fingerprint_probe_url: None,
        fingerprint_profile_id: None,
        fingerprint_allowed_origins: Vec::new(),
        fingerprint_proxy_label: None,
        fingerprint_proxy_region: None,
    }
}

fn default_environment() -> WorkflowSettingsEnvironment {
    WorkflowSettingsEnvironment {
        geolocation: None,
        permissions: Vec::new(),
        extra_http_headers: Vec::new(),
        locale: None,
        timezone: None,
        download_directory: None,
        cookies: Vec::new(),
        local_storage: Vec::new(),
        session_storage: Vec::new(),
        session_restore_ref: None,
    }
}

fn default_inputs() -> WorkflowSettingsInputs {
    WorkflowSettingsInputs {
        input_schema: Vec::new(),
        initial_variables: Vec::new(),
        batch_mapping: Vec::new(),
    }
}

fn default_triggers() -> WorkflowSettingsTriggers {
    WorkflowSettingsTriggers {
        enabled: false,
        mode: WorkflowTriggerMode::Manual,
        interval_seconds: None,
        once_at: None,
        input_source: None,
        batch_source_ref: None,
        missed_run_policy: WorkflowMissedRunPolicy::Skip,
        concurrency_policy: WorkflowTriggerConcurrencyPolicy::SkipIfRunning,
        last_run_at: None,
        next_run_at: None,
    }
}

fn default_advanced() -> WorkflowSettingsAdvanced {
    WorkflowSettingsAdvanced {
        compatibility_warnings: Vec::new(),
        debug_logging_level: WorkflowDebugLoggingLevel::Off,
        experimental_flags: Vec::new(),
    }
}

fn trimmed_option(value: &Option<String>) -> Option<String> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn is_http_url(value: &str) -> bool {
    value.starts_with("https://") || value.starts_with("http://")
}

fn origin_from_http_url(value: &str) -> String {
    let Some((scheme, rest)) = value.split_once("://") else {
        return value.to_string();
    };
    let host = rest.split('/').next().unwrap_or_default();
    format!("{scheme}://{host}")
}
