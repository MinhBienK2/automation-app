use serde::{Deserialize, Serialize};

use super::ValidationError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ActionType {
    Navigate,
    OpenUrl,
    Sleep,
    Wait,
    InputText,
    TypeText,
    ClearInput,
    Click,
    Scroll,
    SelectOption,
    SetCheckbox,
    PressKey,
    Hotkey,
    Hover,
}

impl ActionType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Navigate => "navigate",
            Self::OpenUrl => "open_url",
            Self::Sleep => "sleep",
            Self::Wait => "wait",
            Self::InputText => "input_text",
            Self::TypeText => "type_text",
            Self::ClearInput => "clear_input",
            Self::Click => "click",
            Self::Scroll => "scroll",
            Self::SelectOption => "select_option",
            Self::SetCheckbox => "set_checkbox",
            Self::PressKey => "press_key",
            Self::Hotkey => "hotkey",
            Self::Hover => "hover",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::Navigate => "Navigate",
            Self::OpenUrl => "Open URL",
            Self::Sleep => "Sleep",
            Self::Wait => "Wait",
            Self::InputText => "Input Text",
            Self::TypeText => "Type Text",
            Self::ClearInput => "Clear Input",
            Self::Click => "Click",
            Self::Scroll => "Scroll",
            Self::SelectOption => "Select Option",
            Self::SetCheckbox => "Set Checkbox",
            Self::PressKey => "Press Key",
            Self::Hotkey => "Hotkey",
            Self::Hover => "Hover",
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NavigateWaitUntil {
    Load,
    DomContentLoaded,
    NetworkIdle,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InputTypingMode {
    SetValue,
    Type,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ClearInputMethod {
    SelectAll,
    Backspace,
    Dom,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WaitCondition {
    Duration,
    ElementVisible,
    ElementHidden,
    ElementAttached,
    ElementDetached,
    TextVisible,
    UrlContains,
    PageLoad,
    ElementEnabled,
    ElementDisabled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SelectOptionMatchBy {
    Label,
    Value,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CheckboxState {
    Checked,
    Unchecked,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", content = "config", rename_all = "snake_case")]
pub enum ActionConfig {
    Navigate {
        url: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        wait_until: Option<NavigateWaitUntil>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    OpenUrl {
        url: String,
    },
    Sleep {
        seconds: f64,
    },
    Wait {
        condition: WaitCondition,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        xpath: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        text: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        url: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        duration_ms: Option<u64>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    InputText {
        xpath: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        iframe_xpath: Option<String>,
        text: String,
        #[serde(default)]
        clear_before_input: bool,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        typing_mode: Option<InputTypingMode>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        delay_ms: Option<u64>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        wait_until: Option<ClickWaitUntil>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    TypeText {
        xpath: String,
        text: String,
    },
    ClearInput {
        xpath: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        iframe_xpath: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        method: Option<ClearInputMethod>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        wait_until: Option<ClickWaitUntil>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
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
    SelectOption {
        xpath: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        iframe_xpath: Option<String>,
        match_by: SelectOptionMatchBy,
        value: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        wait_until: Option<ClickWaitUntil>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    SetCheckbox {
        xpath: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        iframe_xpath: Option<String>,
        state: CheckboxState,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        wait_until: Option<ClickWaitUntil>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    PressKey {
        key: String,
    },
    Hotkey {
        keys: Vec<String>,
    },
    Hover {
        xpath: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        iframe_xpath: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        wait_until: Option<ClickWaitUntil>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
}

impl ActionConfig {
    pub fn action_type(&self) -> ActionType {
        match self {
            Self::Navigate { .. } => ActionType::Navigate,
            Self::OpenUrl { .. } => ActionType::OpenUrl,
            Self::Sleep { .. } => ActionType::Sleep,
            Self::Wait { .. } => ActionType::Wait,
            Self::InputText { .. } => ActionType::InputText,
            Self::TypeText { .. } => ActionType::TypeText,
            Self::ClearInput { .. } => ActionType::ClearInput,
            Self::Click { .. } => ActionType::Click,
            Self::Scroll { .. } => ActionType::Scroll,
            Self::SelectOption { .. } => ActionType::SelectOption,
            Self::SetCheckbox { .. } => ActionType::SetCheckbox,
            Self::PressKey { .. } => ActionType::PressKey,
            Self::Hotkey { .. } => ActionType::Hotkey,
            Self::Hover { .. } => ActionType::Hover,
        }
    }

    pub fn validate(&self) -> Result<(), ValidationError> {
        match self {
            Self::Navigate { url, .. } if url.trim().is_empty() => {
                Err(ValidationError::new("url", "URL is required"))
            }
            Self::Navigate {
                timeout_ms: Some(0),
                ..
            } => Err(ValidationError::new(
                "timeout_ms",
                "Timeout must be greater than 0",
            )),
            Self::OpenUrl { url } if url.trim().is_empty() => {
                Err(ValidationError::new("url", "URL is required"))
            }
            Self::Sleep { seconds } if *seconds <= 0.0 => Err(ValidationError::new(
                "seconds",
                "Seconds must be greater than 0",
            )),
            Self::Wait {
                condition: WaitCondition::Duration,
                duration_ms,
                ..
            } if duration_ms.unwrap_or_default() == 0 => Err(ValidationError::new(
                "duration_ms",
                "Duration must be greater than 0",
            )),
            Self::Wait {
                condition:
                    WaitCondition::ElementVisible
                    | WaitCondition::ElementHidden
                    | WaitCondition::ElementAttached
                    | WaitCondition::ElementDetached
                    | WaitCondition::ElementEnabled
                    | WaitCondition::ElementDisabled,
                xpath,
                ..
            } if xpath.as_deref().unwrap_or_default().trim().is_empty() => {
                Err(ValidationError::new("xpath", "XPath is required"))
            }
            Self::Wait {
                condition: WaitCondition::TextVisible,
                text,
                ..
            } if text.as_deref().unwrap_or_default().trim().is_empty() => {
                Err(ValidationError::new("text", "Text is required"))
            }
            Self::Wait {
                condition: WaitCondition::UrlContains,
                url,
                ..
            } if url.as_deref().unwrap_or_default().trim().is_empty() => {
                Err(ValidationError::new("url", "URL is required"))
            }
            Self::Wait {
                timeout_ms: Some(0),
                ..
            } => Err(ValidationError::new(
                "timeout_ms",
                "Timeout must be greater than 0",
            )),
            Self::InputText { xpath, .. } if xpath.trim().is_empty() => {
                Err(ValidationError::new("xpath", "XPath is required"))
            }
            Self::InputText { text, .. } if text.is_empty() => {
                Err(ValidationError::new("text", "Text is required"))
            }
            Self::InputText {
                delay_ms: Some(0), ..
            } => Err(ValidationError::new(
                "delay_ms",
                "Delay must be greater than 0",
            )),
            Self::TypeText { xpath, .. } if xpath.trim().is_empty() => {
                Err(ValidationError::new("xpath", "XPath is required"))
            }
            Self::TypeText { text, .. } if text.is_empty() => {
                Err(ValidationError::new("text", "Text is required"))
            }
            Self::ClearInput { xpath, .. } if xpath.trim().is_empty() => {
                Err(ValidationError::new("xpath", "XPath is required"))
            }
            Self::ClearInput {
                timeout_ms: Some(0),
                ..
            } => Err(ValidationError::new(
                "timeout_ms",
                "Timeout must be greater than 0",
            )),
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
            Self::SelectOption { xpath, .. } if xpath.trim().is_empty() => {
                Err(ValidationError::new("xpath", "XPath is required"))
            }
            Self::SelectOption { value, .. } if value.trim().is_empty() => {
                Err(ValidationError::new("value", "Option value is required"))
            }
            Self::SelectOption {
                timeout_ms: Some(0),
                ..
            } => Err(ValidationError::new(
                "timeout_ms",
                "Timeout must be greater than 0",
            )),
            Self::SetCheckbox { xpath, .. } if xpath.trim().is_empty() => {
                Err(ValidationError::new("xpath", "XPath is required"))
            }
            Self::SetCheckbox {
                timeout_ms: Some(0),
                ..
            } => Err(ValidationError::new(
                "timeout_ms",
                "Timeout must be greater than 0",
            )),
            Self::PressKey { key } if key.trim().is_empty() => {
                Err(ValidationError::new("key", "Key is required"))
            }
            Self::Hotkey { keys }
                if keys.is_empty() || keys.iter().any(|key| key.trim().is_empty()) =>
            {
                Err(ValidationError::new("keys", "At least one key is required"))
            }
            Self::Hover { xpath, .. } if xpath.trim().is_empty() => {
                Err(ValidationError::new("xpath", "XPath is required"))
            }
            Self::Hover {
                timeout_ms: Some(0),
                ..
            } => Err(ValidationError::new(
                "timeout_ms",
                "Timeout must be greater than 0",
            )),
            _ => Ok(()),
        }
    }
}
