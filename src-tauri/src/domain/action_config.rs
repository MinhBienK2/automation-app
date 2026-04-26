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
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScrollDirection {
    Up,
    Down,
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
    },
    Scroll {
        direction: ScrollDirection,
        pixels: i64,
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
            Self::Click { xpath } if xpath.trim().is_empty() => {
                Err(ValidationError::new("xpath", "XPath is required"))
            }
            Self::Scroll { pixels, .. } if *pixels <= 0 => Err(ValidationError::new(
                "pixels",
                "Pixels must be greater than 0",
            )),
            _ => Ok(()),
        }
    }
}
