use serde::{Deserialize, Serialize};

use super::ValidationError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ActionType {
    OpenUrl,
    Sleep,
    TypeText,
    Click,
    Scroll,
}

impl ActionType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::OpenUrl => "open_url",
            Self::Sleep => "sleep",
            Self::TypeText => "type_text",
            Self::Click => "click",
            Self::Scroll => "scroll",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::OpenUrl => "Open URL",
            Self::Sleep => "Sleep",
            Self::TypeText => "Type Text",
            Self::Click => "Click",
            Self::Scroll => "Scroll",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScrollDirection {
    Up,
    Down,
    Left,
    Right,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScrollMode {
    Page,
    Container,
    IntoView,
    UntilVisible,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScrollBehavior {
    Instant,
    Smooth,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScrollBlock {
    Start,
    Center,
    End,
    Nearest,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScrollInline {
    Start,
    Center,
    End,
    Nearest,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ClickMode {
    Real,
    ForceDom,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ClickButton {
    Left,
    Right,
    Middle,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ClickPosition {
    Center,
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
    Offset,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ClickWaitUntil {
    Attached,
    Visible,
    Enabled,
    Clickable,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", content = "config", rename_all = "snake_case")]
pub enum ActionConfig {
    OpenUrl {
        url: String,
    },
    Sleep {
        seconds: f64,
    },
    TypeText {
        xpath: String,
        text: String,
    },
    Click {
        xpath: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        iframe_xpath: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        mode: Option<ClickMode>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        button: Option<ClickButton>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        click_count: Option<u32>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        scroll_into_view: Option<bool>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        block: Option<ScrollBlock>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        inline: Option<ScrollInline>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        position: Option<ClickPosition>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        offset_x: Option<f64>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        offset_y: Option<f64>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        wait_until: Option<ClickWaitUntil>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        retry_interval_ms: Option<u64>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        post_click_wait_ms: Option<u64>,
    },
    Scroll {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        mode: Option<ScrollMode>,
        direction: ScrollDirection,
        pixels: i64,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        xpath: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        iframe_xpath: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        behavior: Option<ScrollBehavior>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        block: Option<ScrollBlock>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        inline: Option<ScrollInline>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        max_attempts: Option<u32>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        wait_ms: Option<u64>,
    },
}

impl ActionConfig {
    pub fn action_type(&self) -> ActionType {
        match self {
            Self::OpenUrl { .. } => ActionType::OpenUrl,
            Self::Sleep { .. } => ActionType::Sleep,
            Self::TypeText { .. } => ActionType::TypeText,
            Self::Click { .. } => ActionType::Click,
            Self::Scroll { .. } => ActionType::Scroll,
        }
    }

    pub fn validate(&self) -> Result<(), ValidationError> {
        match self {
            Self::OpenUrl { url } if url.trim().is_empty() => {
                Err(ValidationError::new("url", "URL is required"))
            }
            Self::Sleep { seconds } if *seconds <= 0.0 => Err(ValidationError::new(
                "seconds",
                "Seconds must be greater than 0",
            )),
            Self::TypeText { xpath, .. } if xpath.trim().is_empty() => {
                Err(ValidationError::new("xpath", "XPath is required"))
            }
            Self::TypeText { text, .. } if text.is_empty() => {
                Err(ValidationError::new("text", "Text is required"))
            }
            Self::Click { xpath, .. } if xpath.trim().is_empty() => {
                Err(ValidationError::new("xpath", "XPath is required"))
            }
            Self::Click {
                click_count: Some(0),
                ..
            } => Err(ValidationError::new(
                "click_count",
                "Click count must be greater than 0",
            )),
            Self::Click {
                position: Some(ClickPosition::Offset),
                offset_x,
                offset_y,
                ..
            } if offset_x.is_none() || offset_y.is_none() => Err(ValidationError::new(
                "offset",
                "Offset X and Y are required",
            )),
            Self::Click {
                timeout_ms: Some(0),
                ..
            } => Err(ValidationError::new(
                "timeout_ms",
                "Timeout must be greater than 0",
            )),
            Self::Scroll { pixels, .. } if *pixels <= 0 => Err(ValidationError::new(
                "pixels",
                "Pixels must be greater than 0",
            )),
            Self::Scroll {
                mode: Some(ScrollMode::IntoView),
                xpath,
                ..
            }
            | Self::Scroll {
                mode: Some(ScrollMode::UntilVisible),
                xpath,
                ..
            } if xpath.as_deref().unwrap_or_default().trim().is_empty() => {
                Err(ValidationError::new("xpath", "XPath is required"))
            }
            Self::Scroll {
                mode: Some(ScrollMode::UntilVisible),
                max_attempts: Some(0),
                ..
            } => Err(ValidationError::new(
                "max_attempts",
                "Max attempts must be greater than 0",
            )),
            _ => Ok(()),
        }
    }
}
