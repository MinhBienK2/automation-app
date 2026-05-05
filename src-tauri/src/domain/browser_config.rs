use serde::{Deserialize, Serialize};

use super::ValidationError;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowBrowserChallengePolicy {
    #[default]
    None,
    DetectOnly,
    PauseForHuman,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkflowBrowserConfig {
    pub workflow_id: String,
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
}

impl WorkflowBrowserConfig {
    pub fn default_for_workflow(workflow_id: impl Into<String>) -> Self {
        Self {
            workflow_id: workflow_id.into(),
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
        }
    }

    pub fn normalized(&self) -> Self {
        Self {
            workflow_id: self.workflow_id.clone(),
            profile_name: trimmed_option(&self.profile_name),
            proxy_enabled: self.proxy_enabled,
            proxy_server: trimmed_option(&self.proxy_server),
            proxy_username: trimmed_option(&self.proxy_username),
            proxy_password: self.proxy_password.clone(),
            user_agent: trimmed_option(&self.user_agent),
            viewport_width: self.viewport_width,
            viewport_height: self.viewport_height,
            mobile: self.mobile,
            touch: self.touch,
            challenge_policy: self.challenge_policy,
        }
    }

    pub fn validate(&self) -> Result<(), ValidationError> {
        let config = self.normalized();

        if config.proxy_enabled && config.proxy_server.is_none() {
            return Err(ValidationError::new(
                "proxy_server",
                "Proxy server is required",
            ));
        }

        if self
            .proxy_username
            .as_deref()
            .is_some_and(|username| username.trim().is_empty())
        {
            return Err(ValidationError::new(
                "proxy_username",
                "Proxy username cannot be blank",
            ));
        }

        if self
            .proxy_password
            .as_deref()
            .is_some_and(|password| password.is_empty())
        {
            return Err(ValidationError::new(
                "proxy_password",
                "Proxy password cannot be empty",
            ));
        }

        if self.viewport_width == Some(0) {
            return Err(ValidationError::new(
                "viewport_width",
                "Viewport width must be greater than 0",
            ));
        }

        if self.viewport_height == Some(0) {
            return Err(ValidationError::new(
                "viewport_height",
                "Viewport height must be greater than 0",
            ));
        }

        Ok(())
    }
}

fn trimmed_option(value: &Option<String>) -> Option<String> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}
