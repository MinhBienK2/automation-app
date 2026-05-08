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
    Behavior,
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

    fn warning(
        section: WorkflowSettingsSection,
        field: impl Into<String>,
        message: impl Into<String>,
    ) -> Self {
        Self {
            section,
            field: Some(field.into()),
            message: message.into(),
            level: WorkflowSettingsIssueLevel::Warning,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BehaviorPersonaType {
    NewUser,
    ReturningUser,
    PowerUser,
    MobileUser,
    Reader,
    Viewer,
    Buyer,
    OperatorDefined,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BehaviorStrictness {
    ObserveOnly,
    Assistive,
    Realistic,
    StressTest,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BehaviorDistribution {
    Uniform,
    Normal,
    LogNormal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BehaviorPointerPathStyle {
    Direct,
    Curved,
    Hesitant,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BehaviorClickOffsetPolicy {
    CenterBiased,
    AreaWeighted,
    OperatorDefined,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BehaviorMoveSpeedProfile {
    Slow,
    Normal,
    Fast,
    Variable,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BehaviorTypingMode {
    SetValue,
    HumanType,
    Mixed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BehaviorCorrectionPolicy {
    Backspace,
    SelectAllRewrite,
    None,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BehaviorBudgetExceededAction {
    Pause,
    Fail,
    ManualApproval,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BehaviorEvidenceExportFormat {
    Json,
    JsonAndMarkdown,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BehaviorTimedRange {
    pub min: u64,
    pub max: u64,
    pub distribution: BehaviorDistribution,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BehaviorCountRange {
    pub min: u32,
    pub max: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BehaviorProbabilityTimedRange {
    pub min: u64,
    pub max: u64,
    pub probability: f64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BehaviorDwellRange {
    pub min: u64,
    pub max: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BehaviorScrollChunkRange {
    pub min: i64,
    pub max: i64,
    pub distribution: BehaviorDistribution,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BehaviorVideoWatchPolicy {
    pub min_ratio: f64,
    pub max_ratio: f64,
    pub skip_probability: f64,
    pub replay_probability: f64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BehaviorActionRateCap {
    pub action_type: String,
    pub max_per_minute: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BehaviorCooldownWindow {
    pub action_type: String,
    pub min_ms: u64,
    pub max_ms: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BehaviorSessionDuration {
    pub min: u64,
    pub max: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BehaviorTimingPolicy {
    pub reaction_time_ms: BehaviorTimedRange,
    pub between_actions_ms: BehaviorTimedRange,
    pub burst_action_count: BehaviorCountRange,
    pub burst_cooldown_ms: BehaviorProbabilityTimedRange,
    pub long_pause_ms: BehaviorProbabilityTimedRange,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_actions_per_minute: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BehaviorPointerPolicy {
    pub path_style: BehaviorPointerPathStyle,
    pub click_offset_policy: BehaviorClickOffsetPolicy,
    pub hover_before_click_probability: f64,
    pub dwell_before_click_ms: BehaviorDwellRange,
    pub overshoot_probability: f64,
    pub move_speed_profile: BehaviorMoveSpeedProfile,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BehaviorTypingPolicy {
    pub mode: BehaviorTypingMode,
    pub key_delay_ms: BehaviorTimedRange,
    pub word_pause_ms: BehaviorProbabilityTimedRange,
    pub sentence_pause_ms: BehaviorProbabilityTimedRange,
    pub typo_probability: f64,
    pub correction_policy: BehaviorCorrectionPolicy,
    pub paste_probability: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BehaviorScrollPolicy {
    pub scroll_chunk_px: BehaviorScrollChunkRange,
    pub pause_between_scrolls_ms: BehaviorTimedRange,
    pub backtrack_probability: f64,
    pub read_dwell_per_100_words_ms: BehaviorDwellRange,
    pub video_watch_policy: BehaviorVideoWatchPolicy,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BehaviorVelocityBudget {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub per_domain_actions_per_minute: Option<u32>,
    #[serde(default)]
    pub per_action_caps: Vec<BehaviorActionRateCap>,
    #[serde(default)]
    pub cooldown_windows: Vec<BehaviorCooldownWindow>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_duration_ms: Option<BehaviorSessionDuration>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub daily_action_budget: Option<u32>,
    pub on_budget_exceeded: BehaviorBudgetExceededAction,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BehaviorEvidencePolicy {
    pub timeline_enabled: bool,
    pub screenshots_enabled: bool,
    pub histograms_enabled: bool,
    pub redact_sensitive_values: bool,
    pub export_format: BehaviorEvidenceExportFormat,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BehaviorProfile {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_behavior_profile_name")]
    pub profile_name: String,
    #[serde(default = "default_behavior_persona_type")]
    pub persona_type: BehaviorPersonaType,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub seed: Option<String>,
    #[serde(default = "default_behavior_strictness")]
    pub strictness: BehaviorStrictness,
    #[serde(default)]
    pub account_ref: String,
    #[serde(default)]
    pub target_domains: Vec<String>,
    #[serde(default = "default_behavior_timing")]
    pub timing: BehaviorTimingPolicy,
    #[serde(default = "default_behavior_pointer")]
    pub pointer: BehaviorPointerPolicy,
    #[serde(default = "default_behavior_typing")]
    pub typing: BehaviorTypingPolicy,
    #[serde(default = "default_behavior_scroll")]
    pub scroll: BehaviorScrollPolicy,
    #[serde(default = "default_behavior_velocity")]
    pub velocity: BehaviorVelocityBudget,
    #[serde(default = "default_behavior_evidence")]
    pub evidence: BehaviorEvidencePolicy,
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
    #[serde(default = "default_behavior")]
    pub behavior: BehaviorProfile,
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
            behavior: default_behavior(),
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
                ..browser
            },
            behavior: normalized_behavior(&self.behavior),
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

        validate_behavior_profile(&mut issues, &settings);

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

fn validate_behavior_profile(
    issues: &mut Vec<SettingsValidationIssue>,
    settings: &WorkflowSettings,
) {
    let behavior = &settings.behavior;
    if !behavior.enabled {
        return;
    }

    if behavior.profile_name.trim().is_empty() {
        issues.push(SettingsValidationIssue::error(
            WorkflowSettingsSection::Behavior,
            "profile_name",
            "Behavior profile name is required",
        ));
    }
    if behavior
        .seed
        .as_deref()
        .unwrap_or_default()
        .trim()
        .is_empty()
    {
        issues.push(SettingsValidationIssue::error(
            WorkflowSettingsSection::Behavior,
            "seed",
            "Behavior Lab requires an explicit seed",
        ));
    }
    if behavior.target_domains.is_empty() {
        issues.push(SettingsValidationIssue::error(
            WorkflowSettingsSection::Behavior,
            "target_domains",
            "Behavior Lab requires at least one target domain",
        ));
    }
    for domain in &behavior.target_domains {
        let domain = domain.trim();
        if domain.is_empty() || domain.contains("://") || domain.contains('*') {
            issues.push(SettingsValidationIssue::error(
                WorkflowSettingsSection::Behavior,
                "target_domains",
                "Behavior target domains must be explicit hostnames without scheme or wildcard",
            ));
            break;
        }
    }

    if behavior.account_ref.trim().is_empty() {
        let message = "Behavior Lab requires an account label outside observe-only mode";
        if behavior.strictness == BehaviorStrictness::ObserveOnly {
            issues.push(SettingsValidationIssue::warning(
                WorkflowSettingsSection::Behavior,
                "account_ref",
                message,
            ));
        } else {
            issues.push(SettingsValidationIssue::error(
                WorkflowSettingsSection::Behavior,
                "account_ref",
                message,
            ));
        }
    }

    if settings.browser.challenge_policy == WorkflowBrowserChallengePolicy::None {
        issues.push(SettingsValidationIssue::error(
            WorkflowSettingsSection::Browser,
            "challenge_policy",
            "Behavior Lab requires challenge detection or pause-for-human handling",
        ));
    }

    validate_timed_range(
        issues,
        "timing.reaction_time_ms",
        "Behavior reaction time maximum must be greater than or equal to minimum",
        &behavior.timing.reaction_time_ms,
    );
    validate_timed_range(
        issues,
        "timing.between_actions_ms",
        "Behavior between-actions maximum must be greater than or equal to minimum",
        &behavior.timing.between_actions_ms,
    );
    validate_count_range(
        issues,
        "timing.burst_action_count",
        "Behavior burst action maximum must be greater than or equal to minimum",
        behavior.timing.burst_action_count.min,
        behavior.timing.burst_action_count.max,
    );
    validate_probability_timed_range(
        issues,
        "timing.burst_cooldown_ms",
        "Behavior burst cooldown maximum must be greater than or equal to minimum",
        &behavior.timing.burst_cooldown_ms,
    );
    validate_probability_timed_range(
        issues,
        "timing.long_pause_ms",
        "Behavior long pause maximum must be greater than or equal to minimum",
        &behavior.timing.long_pause_ms,
    );
    validate_optional_positive_u32(
        issues,
        "timing.max_actions_per_minute",
        "Behavior max actions per minute must be greater than 0",
        behavior.timing.max_actions_per_minute,
    );

    validate_probability(
        issues,
        "pointer.hover_before_click_probability",
        "Behavior hover probability must be between 0 and 1",
        behavior.pointer.hover_before_click_probability,
    );
    validate_probability(
        issues,
        "pointer.overshoot_probability",
        "Behavior overshoot probability must be between 0 and 1",
        behavior.pointer.overshoot_probability,
    );
    validate_u64_range(
        issues,
        "pointer.dwell_before_click_ms",
        "Behavior click dwell maximum must be greater than or equal to minimum",
        behavior.pointer.dwell_before_click_ms.min,
        behavior.pointer.dwell_before_click_ms.max,
    );

    validate_timed_range(
        issues,
        "typing.key_delay_ms",
        "Behavior key delay maximum must be greater than or equal to minimum",
        &behavior.typing.key_delay_ms,
    );
    validate_probability_timed_range(
        issues,
        "typing.word_pause_ms",
        "Behavior word pause maximum must be greater than or equal to minimum",
        &behavior.typing.word_pause_ms,
    );
    validate_probability_timed_range(
        issues,
        "typing.sentence_pause_ms",
        "Behavior sentence pause maximum must be greater than or equal to minimum",
        &behavior.typing.sentence_pause_ms,
    );
    validate_probability(
        issues,
        "typing.typo_probability",
        "Behavior typo probability must be between 0 and 1",
        behavior.typing.typo_probability,
    );
    validate_probability(
        issues,
        "typing.paste_probability",
        "Behavior paste probability must be between 0 and 1",
        behavior.typing.paste_probability,
    );

    if behavior.scroll.scroll_chunk_px.max < behavior.scroll.scroll_chunk_px.min {
        issues.push(SettingsValidationIssue::error(
            WorkflowSettingsSection::Behavior,
            "scroll.scroll_chunk_px",
            "Behavior scroll chunk maximum must be greater than or equal to minimum",
        ));
    }
    validate_timed_range(
        issues,
        "scroll.pause_between_scrolls_ms",
        "Behavior scroll pause maximum must be greater than or equal to minimum",
        &behavior.scroll.pause_between_scrolls_ms,
    );
    validate_probability(
        issues,
        "scroll.backtrack_probability",
        "Behavior scroll backtrack probability must be between 0 and 1",
        behavior.scroll.backtrack_probability,
    );
    validate_u64_range(
        issues,
        "scroll.read_dwell_per_100_words_ms",
        "Behavior read dwell maximum must be greater than or equal to minimum",
        behavior.scroll.read_dwell_per_100_words_ms.min,
        behavior.scroll.read_dwell_per_100_words_ms.max,
    );
    validate_ratio_range(
        issues,
        "scroll.video_watch_policy",
        "Behavior video watch ratio must be between 0 and 1 with max greater than or equal to min",
        behavior.scroll.video_watch_policy.min_ratio,
        behavior.scroll.video_watch_policy.max_ratio,
    );
    validate_probability(
        issues,
        "scroll.video_watch_policy.skip_probability",
        "Behavior video skip probability must be between 0 and 1",
        behavior.scroll.video_watch_policy.skip_probability,
    );
    validate_probability(
        issues,
        "scroll.video_watch_policy.replay_probability",
        "Behavior video replay probability must be between 0 and 1",
        behavior.scroll.video_watch_policy.replay_probability,
    );

    validate_optional_positive_u32(
        issues,
        "velocity.per_domain_actions_per_minute",
        "Behavior per-domain action budget must be greater than 0",
        behavior.velocity.per_domain_actions_per_minute,
    );
    validate_optional_positive_u32(
        issues,
        "velocity.daily_action_budget",
        "Behavior daily action budget must be greater than 0",
        behavior.velocity.daily_action_budget,
    );
    for cap in &behavior.velocity.per_action_caps {
        if cap.action_type.trim().is_empty() || cap.max_per_minute == 0 {
            issues.push(SettingsValidationIssue::error(
                WorkflowSettingsSection::Behavior,
                "velocity.per_action_caps",
                "Behavior per-action caps require an action type and positive max per minute",
            ));
            break;
        }
    }
    for window in &behavior.velocity.cooldown_windows {
        if window.action_type.trim().is_empty() || window.max_ms < window.min_ms {
            issues.push(SettingsValidationIssue::error(
                WorkflowSettingsSection::Behavior,
                "velocity.cooldown_windows",
                "Behavior cooldown windows require an action type and valid min/max milliseconds",
            ));
            break;
        }
    }
    if let Some(session_duration) = &behavior.velocity.session_duration_ms {
        validate_u64_range(
            issues,
            "velocity.session_duration_ms",
            "Behavior session duration maximum must be greater than or equal to minimum",
            session_duration.min,
            session_duration.max,
        );
    }
}

fn validate_timed_range(
    issues: &mut Vec<SettingsValidationIssue>,
    field: &str,
    message: &str,
    range: &BehaviorTimedRange,
) {
    validate_u64_range(issues, field, message, range.min, range.max);
}

fn validate_probability_timed_range(
    issues: &mut Vec<SettingsValidationIssue>,
    field: &str,
    message: &str,
    range: &BehaviorProbabilityTimedRange,
) {
    validate_u64_range(issues, field, message, range.min, range.max);
    validate_probability(
        issues,
        field,
        "Behavior probability must be between 0 and 1",
        range.probability,
    );
}

fn validate_count_range(
    issues: &mut Vec<SettingsValidationIssue>,
    field: &str,
    message: &str,
    min: u32,
    max: u32,
) {
    if max < min {
        issues.push(SettingsValidationIssue::error(
            WorkflowSettingsSection::Behavior,
            field,
            message,
        ));
    }
}

fn validate_u64_range(
    issues: &mut Vec<SettingsValidationIssue>,
    field: &str,
    message: &str,
    min: u64,
    max: u64,
) {
    if max < min {
        issues.push(SettingsValidationIssue::error(
            WorkflowSettingsSection::Behavior,
            field,
            message,
        ));
    }
}

fn validate_ratio_range(
    issues: &mut Vec<SettingsValidationIssue>,
    field: &str,
    message: &str,
    min: f64,
    max: f64,
) {
    if !(0.0..=1.0).contains(&min) || !(0.0..=1.0).contains(&max) || max < min {
        issues.push(SettingsValidationIssue::error(
            WorkflowSettingsSection::Behavior,
            field,
            message,
        ));
    }
}

fn validate_probability(
    issues: &mut Vec<SettingsValidationIssue>,
    field: &str,
    message: &str,
    probability: f64,
) {
    if !(0.0..=1.0).contains(&probability) {
        issues.push(SettingsValidationIssue::error(
            WorkflowSettingsSection::Behavior,
            field,
            message,
        ));
    }
}

fn validate_optional_positive_u32(
    issues: &mut Vec<SettingsValidationIssue>,
    field: &str,
    message: &str,
    value: Option<u32>,
) {
    if value == Some(0) {
        issues.push(SettingsValidationIssue::error(
            WorkflowSettingsSection::Behavior,
            field,
            message,
        ));
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
        WorkflowSettingsSection::Behavior => "behavior",
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
    }
}

fn default_behavior_profile_name() -> String {
    "Default behavior profile".to_string()
}

fn default_behavior_persona_type() -> BehaviorPersonaType {
    BehaviorPersonaType::ReturningUser
}

fn default_behavior_strictness() -> BehaviorStrictness {
    BehaviorStrictness::ObserveOnly
}

fn default_behavior() -> BehaviorProfile {
    BehaviorProfile {
        enabled: false,
        profile_name: default_behavior_profile_name(),
        persona_type: default_behavior_persona_type(),
        seed: None,
        strictness: default_behavior_strictness(),
        account_ref: String::new(),
        target_domains: Vec::new(),
        timing: default_behavior_timing(),
        pointer: default_behavior_pointer(),
        typing: default_behavior_typing(),
        scroll: default_behavior_scroll(),
        velocity: default_behavior_velocity(),
        evidence: default_behavior_evidence(),
    }
}

fn default_behavior_timing() -> BehaviorTimingPolicy {
    BehaviorTimingPolicy {
        reaction_time_ms: BehaviorTimedRange {
            min: 250,
            max: 900,
            distribution: BehaviorDistribution::LogNormal,
        },
        between_actions_ms: BehaviorTimedRange {
            min: 400,
            max: 1600,
            distribution: BehaviorDistribution::LogNormal,
        },
        burst_action_count: BehaviorCountRange { min: 2, max: 5 },
        burst_cooldown_ms: BehaviorProbabilityTimedRange {
            min: 1500,
            max: 5000,
            probability: 0.2,
        },
        long_pause_ms: BehaviorProbabilityTimedRange {
            min: 8000,
            max: 30000,
            probability: 0.05,
        },
        max_actions_per_minute: Some(30),
    }
}

fn default_behavior_pointer() -> BehaviorPointerPolicy {
    BehaviorPointerPolicy {
        path_style: BehaviorPointerPathStyle::Curved,
        click_offset_policy: BehaviorClickOffsetPolicy::CenterBiased,
        hover_before_click_probability: 0.35,
        dwell_before_click_ms: BehaviorDwellRange { min: 120, max: 700 },
        overshoot_probability: 0.05,
        move_speed_profile: BehaviorMoveSpeedProfile::Variable,
    }
}

fn default_behavior_typing() -> BehaviorTypingPolicy {
    BehaviorTypingPolicy {
        mode: BehaviorTypingMode::Mixed,
        key_delay_ms: BehaviorTimedRange {
            min: 35,
            max: 180,
            distribution: BehaviorDistribution::LogNormal,
        },
        word_pause_ms: BehaviorProbabilityTimedRange {
            min: 180,
            max: 750,
            probability: 0.25,
        },
        sentence_pause_ms: BehaviorProbabilityTimedRange {
            min: 500,
            max: 1600,
            probability: 0.15,
        },
        typo_probability: 0.01,
        correction_policy: BehaviorCorrectionPolicy::Backspace,
        paste_probability: 0.05,
    }
}

fn default_behavior_scroll() -> BehaviorScrollPolicy {
    BehaviorScrollPolicy {
        scroll_chunk_px: BehaviorScrollChunkRange {
            min: 180,
            max: 900,
            distribution: BehaviorDistribution::LogNormal,
        },
        pause_between_scrolls_ms: BehaviorTimedRange {
            min: 250,
            max: 1800,
            distribution: BehaviorDistribution::LogNormal,
        },
        backtrack_probability: 0.08,
        read_dwell_per_100_words_ms: BehaviorDwellRange {
            min: 800,
            max: 4500,
        },
        video_watch_policy: BehaviorVideoWatchPolicy {
            min_ratio: 0.35,
            max_ratio: 0.9,
            skip_probability: 0.15,
            replay_probability: 0.03,
        },
    }
}

fn default_behavior_velocity() -> BehaviorVelocityBudget {
    BehaviorVelocityBudget {
        per_domain_actions_per_minute: Some(30),
        per_action_caps: Vec::new(),
        cooldown_windows: Vec::new(),
        session_duration_ms: None,
        daily_action_budget: None,
        on_budget_exceeded: BehaviorBudgetExceededAction::Fail,
    }
}

fn default_behavior_evidence() -> BehaviorEvidencePolicy {
    BehaviorEvidencePolicy {
        timeline_enabled: true,
        screenshots_enabled: false,
        histograms_enabled: true,
        redact_sensitive_values: true,
        export_format: BehaviorEvidenceExportFormat::Json,
    }
}

fn normalized_behavior(behavior: &BehaviorProfile) -> BehaviorProfile {
    let mut seen_domains = BTreeSet::new();
    BehaviorProfile {
        enabled: behavior.enabled,
        profile_name: behavior.profile_name.trim().to_string(),
        persona_type: behavior.persona_type,
        seed: trimmed_option(&behavior.seed),
        strictness: behavior.strictness,
        account_ref: behavior.account_ref.trim().to_string(),
        target_domains: behavior
            .target_domains
            .iter()
            .map(|domain| domain.trim().to_ascii_lowercase())
            .filter(|domain| !domain.is_empty())
            .filter(|domain| seen_domains.insert(domain.clone()))
            .collect(),
        timing: behavior.timing.clone(),
        pointer: behavior.pointer.clone(),
        typing: behavior.typing.clone(),
        scroll: behavior.scroll.clone(),
        velocity: BehaviorVelocityBudget {
            per_action_caps: behavior
                .velocity
                .per_action_caps
                .iter()
                .map(|cap| BehaviorActionRateCap {
                    action_type: cap.action_type.trim().to_string(),
                    max_per_minute: cap.max_per_minute,
                })
                .collect(),
            cooldown_windows: behavior
                .velocity
                .cooldown_windows
                .iter()
                .map(|window| BehaviorCooldownWindow {
                    action_type: window.action_type.trim().to_string(),
                    min_ms: window.min_ms,
                    max_ms: window.max_ms,
                })
                .collect(),
            ..behavior.velocity.clone()
        },
        evidence: behavior.evidence.clone(),
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
