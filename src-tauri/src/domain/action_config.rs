use serde::{Deserialize, Serialize};

use super::ValidationError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ActionType {
    Navigate,
    Wait,
    InputText,
    ClearInput,
    Click,
    Scroll,
    SelectOption,
    SetCheckbox,
    PressKey,
    Hotkey,
    Hover,
    DoubleClick,
    RightClick,
    DragAndDrop,
    FocusElement,
    BlurElement,
    TypeSequence,
    SetClipboard,
    PasteClipboard,
    Check,
    Uncheck,
    ToggleCheckbox,
    SelectRadio,
    UploadFile,
    SubmitForm,
    SelectCustomOption,
    SetContenteditable,
    ExtractText,
    ExtractAttribute,
    ExtractInputValue,
    ExtractTable,
    ExtractList,
    TakeScreenshot,
    GoBack,
    GoForward,
    Reload,
    OpenNewTab,
    SwitchTab,
    CloseTab,
    SwitchFrame,
    AcceptDialog,
    DismissDialog,
    SetDownloadDirectory,
    WaitForDownload,
    SetVariable,
    AssertElement,
    AssertText,
    IfCondition,
    RepeatTimes,
    RepeatForEach,
    RetryBlock,
    SwitchCondition,
    WhileLoop,
    RepeatUntil,
    TryCatch,
    FallbackBlock,
    BreakLoop,
    ContinueLoop,
    StopWorkflow,
    TransformVariable,
    AssertOutput,
    RunSubworkflow,
    DomainAllowlist,
    UseProfile,
    SaveSession,
    LoadSession,
    SetCookie,
    ClearCookies,
    SetSecret,
    UseProxy,
    SetUserAgent,
    SetViewport,
    SetGeolocation,
    SetExtraHeaders,
    GrantPermission,
    DetectChallenge,
    PauseForHuman,
    ResumeWhenCondition,
    FallbackSelector,
    RetryStep,
    Checkpoint,
    ExecuteJs,
    WaitForRequest,
    WaitForResponse,
    BlockRequest,
    MockResponse,
    SetLocalStorage,
    SetSessionStorage,
}

impl ActionType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Navigate => "navigate",
            Self::Wait => "wait",
            Self::InputText => "input_text",
            Self::ClearInput => "clear_input",
            Self::Click => "click",
            Self::Scroll => "scroll",
            Self::SelectOption => "select_option",
            Self::SetCheckbox => "set_checkbox",
            Self::PressKey => "press_key",
            Self::Hotkey => "hotkey",
            Self::Hover => "hover",
            Self::DoubleClick => "double_click",
            Self::RightClick => "right_click",
            Self::DragAndDrop => "drag_and_drop",
            Self::FocusElement => "focus_element",
            Self::BlurElement => "blur_element",
            Self::TypeSequence => "type_sequence",
            Self::SetClipboard => "set_clipboard",
            Self::PasteClipboard => "paste_clipboard",
            Self::Check => "check",
            Self::Uncheck => "uncheck",
            Self::ToggleCheckbox => "toggle_checkbox",
            Self::SelectRadio => "select_radio",
            Self::UploadFile => "upload_file",
            Self::SubmitForm => "submit_form",
            Self::SelectCustomOption => "select_custom_option",
            Self::SetContenteditable => "set_contenteditable",
            Self::ExtractText => "extract_text",
            Self::ExtractAttribute => "extract_attribute",
            Self::ExtractInputValue => "extract_input_value",
            Self::ExtractTable => "extract_table",
            Self::ExtractList => "extract_list",
            Self::TakeScreenshot => "take_screenshot",
            Self::GoBack => "go_back",
            Self::GoForward => "go_forward",
            Self::Reload => "reload",
            Self::OpenNewTab => "open_new_tab",
            Self::SwitchTab => "switch_tab",
            Self::CloseTab => "close_tab",
            Self::SwitchFrame => "switch_frame",
            Self::AcceptDialog => "accept_dialog",
            Self::DismissDialog => "dismiss_dialog",
            Self::SetDownloadDirectory => "set_download_directory",
            Self::WaitForDownload => "wait_for_download",
            Self::SetVariable => "set_variable",
            Self::AssertElement => "assert_element",
            Self::AssertText => "assert_text",
            Self::IfCondition => "if_condition",
            Self::RepeatTimes => "repeat_times",
            Self::RepeatForEach => "repeat_for_each",
            Self::RetryBlock => "retry_block",
            Self::SwitchCondition => "switch_condition",
            Self::WhileLoop => "while_loop",
            Self::RepeatUntil => "repeat_until",
            Self::TryCatch => "try_catch",
            Self::FallbackBlock => "fallback_block",
            Self::BreakLoop => "break_loop",
            Self::ContinueLoop => "continue_loop",
            Self::StopWorkflow => "stop_workflow",
            Self::TransformVariable => "transform_variable",
            Self::AssertOutput => "assert_output",
            Self::RunSubworkflow => "run_subworkflow",
            Self::DomainAllowlist => "domain_allowlist",
            Self::UseProfile => "use_profile",
            Self::SaveSession => "save_session",
            Self::LoadSession => "load_session",
            Self::SetCookie => "set_cookie",
            Self::ClearCookies => "clear_cookies",
            Self::SetSecret => "set_secret",
            Self::UseProxy => "use_proxy",
            Self::SetUserAgent => "set_user_agent",
            Self::SetViewport => "set_viewport",
            Self::SetGeolocation => "set_geolocation",
            Self::SetExtraHeaders => "set_extra_headers",
            Self::GrantPermission => "grant_permission",
            Self::DetectChallenge => "detect_challenge",
            Self::PauseForHuman => "pause_for_human",
            Self::ResumeWhenCondition => "resume_when_condition",
            Self::FallbackSelector => "fallback_selector",
            Self::RetryStep => "retry_step",
            Self::Checkpoint => "checkpoint",
            Self::ExecuteJs => "execute_js",
            Self::WaitForRequest => "wait_for_request",
            Self::WaitForResponse => "wait_for_response",
            Self::BlockRequest => "block_request",
            Self::MockResponse => "mock_response",
            Self::SetLocalStorage => "set_local_storage",
            Self::SetSessionStorage => "set_session_storage",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::Navigate => "Navigate",
            Self::Wait => "Wait",
            Self::InputText => "Input Text",
            Self::ClearInput => "Clear Input",
            Self::Click => "Click",
            Self::Scroll => "Scroll",
            Self::SelectOption => "Select Option",
            Self::SetCheckbox => "Set Checkbox",
            Self::PressKey => "Press Key",
            Self::Hotkey => "Hotkey",
            Self::Hover => "Hover",
            Self::DoubleClick => "Double Click",
            Self::RightClick => "Right Click",
            Self::DragAndDrop => "Drag and Drop",
            Self::FocusElement => "Focus Element",
            Self::BlurElement => "Blur Element",
            Self::TypeSequence => "Type Sequence",
            Self::SetClipboard => "Set Clipboard",
            Self::PasteClipboard => "Paste Clipboard",
            Self::Check => "Check",
            Self::Uncheck => "Uncheck",
            Self::ToggleCheckbox => "Toggle Checkbox",
            Self::SelectRadio => "Select Radio",
            Self::UploadFile => "Upload File",
            Self::SubmitForm => "Submit Form",
            Self::SelectCustomOption => "Select Custom Option",
            Self::SetContenteditable => "Set Contenteditable",
            Self::ExtractText => "Extract Text",
            Self::ExtractAttribute => "Extract Attribute",
            Self::ExtractInputValue => "Extract Input Value",
            Self::ExtractTable => "Extract Table",
            Self::ExtractList => "Extract List",
            Self::TakeScreenshot => "Take Screenshot",
            Self::GoBack => "Go Back",
            Self::GoForward => "Go Forward",
            Self::Reload => "Reload",
            Self::OpenNewTab => "Open New Tab",
            Self::SwitchTab => "Switch Tab",
            Self::CloseTab => "Close Tab",
            Self::SwitchFrame => "Switch Frame",
            Self::AcceptDialog => "Accept Dialog",
            Self::DismissDialog => "Dismiss Dialog",
            Self::SetDownloadDirectory => "Set Download Directory",
            Self::WaitForDownload => "Wait For Download",
            Self::SetVariable => "Set Variable",
            Self::AssertElement => "Assert Element",
            Self::AssertText => "Assert Text",
            Self::IfCondition => "If Condition",
            Self::RepeatTimes => "Repeat Times",
            Self::RepeatForEach => "Repeat For Each",
            Self::RetryBlock => "Retry Block",
            Self::SwitchCondition => "Switch Condition",
            Self::WhileLoop => "While Loop",
            Self::RepeatUntil => "Repeat Until",
            Self::TryCatch => "Try Catch",
            Self::FallbackBlock => "Fallback Block",
            Self::BreakLoop => "Break Loop",
            Self::ContinueLoop => "Continue Loop",
            Self::StopWorkflow => "Stop Workflow",
            Self::TransformVariable => "Transform Variable",
            Self::AssertOutput => "Assert Output",
            Self::RunSubworkflow => "Run Subworkflow",
            Self::DomainAllowlist => "Domain Allowlist",
            Self::UseProfile => "Use Profile",
            Self::SaveSession => "Save Session",
            Self::LoadSession => "Load Session",
            Self::SetCookie => "Set Cookie",
            Self::ClearCookies => "Clear Cookies",
            Self::SetSecret => "Set Secret",
            Self::UseProxy => "Use Proxy",
            Self::SetUserAgent => "Set User Agent",
            Self::SetViewport => "Set Viewport",
            Self::SetGeolocation => "Set Geolocation",
            Self::SetExtraHeaders => "Set Extra Headers",
            Self::GrantPermission => "Grant Permission",
            Self::DetectChallenge => "Detect Challenge",
            Self::PauseForHuman => "Pause For Human",
            Self::ResumeWhenCondition => "Resume When Condition",
            Self::FallbackSelector => "Fallback Selector",
            Self::RetryStep => "Retry Step",
            Self::Checkpoint => "Checkpoint",
            Self::ExecuteJs => "Execute JS",
            Self::WaitForRequest => "Wait For Request",
            Self::WaitForResponse => "Wait For Response",
            Self::BlockRequest => "Block Request",
            Self::MockResponse => "Mock Response",
            Self::SetLocalStorage => "Set Local Storage",
            Self::SetSessionStorage => "Set Session Storage",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AssertElementState {
    Attached,
    Visible,
    Hidden,
    Enabled,
    Disabled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AssertTextMatchMode {
    Contains,
    Equals,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AssertOutputMatchMode {
    Contains,
    Equals,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StopWorkflowStatus {
    Success,
    Failure,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum WorkflowCondition {
    OutputEquals { name: String, value: String },
    OutputContains { name: String, value: String },
    TextVisible { text: String },
    UrlContains { value: String },
    ElementVisible { xpath: String },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SwitchCase {
    pub value: String,
    #[serde(default)]
    pub steps: Vec<ActionConfig>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct VariableMapping {
    pub source: String,
    pub target: String,
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
pub struct HeaderPair {
    pub name: String,
    pub value: String,
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
    DoubleClick {
        xpath: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        iframe_xpath: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        wait_until: Option<ClickWaitUntil>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    RightClick {
        xpath: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        iframe_xpath: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        wait_until: Option<ClickWaitUntil>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    DragAndDrop {
        source_xpath: String,
        target_xpath: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        iframe_xpath: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        wait_until: Option<ClickWaitUntil>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    FocusElement {
        xpath: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        iframe_xpath: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        wait_until: Option<ClickWaitUntil>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    BlurElement {
        xpath: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        iframe_xpath: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        wait_until: Option<ClickWaitUntil>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    TypeSequence {
        xpath: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        iframe_xpath: Option<String>,
        text: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        delay_ms: Option<u64>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        wait_until: Option<ClickWaitUntil>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    SetClipboard {
        text: String,
    },
    PasteClipboard {
        xpath: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        iframe_xpath: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        wait_until: Option<ClickWaitUntil>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    Check {
        xpath: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        iframe_xpath: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        wait_until: Option<ClickWaitUntil>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    Uncheck {
        xpath: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        iframe_xpath: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        wait_until: Option<ClickWaitUntil>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    ToggleCheckbox {
        xpath: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        iframe_xpath: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        wait_until: Option<ClickWaitUntil>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    SelectRadio {
        xpath: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        iframe_xpath: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        wait_until: Option<ClickWaitUntil>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    UploadFile {
        xpath: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        iframe_xpath: Option<String>,
        files: Vec<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        wait_until: Option<ClickWaitUntil>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    SubmitForm {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        xpath: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        iframe_xpath: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        wait_until: Option<ClickWaitUntil>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    SelectCustomOption {
        trigger_xpath: String,
        option_text: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        iframe_xpath: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    SetContenteditable {
        xpath: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        iframe_xpath: Option<String>,
        text: String,
        #[serde(default)]
        clear_before_input: bool,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        wait_until: Option<ClickWaitUntil>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    ExtractText {
        xpath: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        iframe_xpath: Option<String>,
        output_name: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    ExtractAttribute {
        xpath: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        iframe_xpath: Option<String>,
        attribute: String,
        output_name: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    ExtractInputValue {
        xpath: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        iframe_xpath: Option<String>,
        output_name: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    ExtractTable {
        xpath: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        iframe_xpath: Option<String>,
        output_name: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    ExtractList {
        xpath: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        iframe_xpath: Option<String>,
        output_name: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    TakeScreenshot {
        path: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        output_name: Option<String>,
        #[serde(default)]
        full_page: bool,
    },
    GoBack {},
    GoForward {},
    Reload {},
    OpenNewTab {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        url: Option<String>,
    },
    SwitchTab {
        index: usize,
    },
    CloseTab {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        index: Option<usize>,
    },
    SwitchFrame {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        xpath: Option<String>,
    },
    AcceptDialog {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        prompt_text: Option<String>,
    },
    DismissDialog {},
    SetDownloadDirectory {
        path: String,
    },
    WaitForDownload {
        output_name: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    SetVariable {
        name: String,
        value: String,
    },
    AssertElement {
        xpath: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        iframe_xpath: Option<String>,
        state: AssertElementState,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    AssertText {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        xpath: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        iframe_xpath: Option<String>,
        text: String,
        match_mode: AssertTextMatchMode,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    IfCondition {
        condition: WorkflowCondition,
        #[serde(default)]
        then_steps: Vec<ActionConfig>,
        #[serde(default)]
        else_steps: Vec<ActionConfig>,
    },
    RepeatTimes {
        times: u32,
        #[serde(default)]
        steps: Vec<ActionConfig>,
    },
    RepeatForEach {
        item_name: String,
        items: Vec<String>,
        #[serde(default)]
        steps: Vec<ActionConfig>,
    },
    RetryBlock {
        max_attempts: u32,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        delay_ms: Option<u64>,
        #[serde(default)]
        steps: Vec<ActionConfig>,
        #[serde(default)]
        failed_steps: Vec<ActionConfig>,
    },
    SwitchCondition {
        expression: String,
        cases: Vec<SwitchCase>,
        #[serde(default)]
        default_steps: Vec<ActionConfig>,
    },
    WhileLoop {
        condition: WorkflowCondition,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        max_attempts: Option<u32>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
        #[serde(default)]
        steps: Vec<ActionConfig>,
    },
    RepeatUntil {
        condition: WorkflowCondition,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        max_attempts: Option<u32>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
        #[serde(default)]
        steps: Vec<ActionConfig>,
        #[serde(default)]
        timeout_steps: Vec<ActionConfig>,
    },
    TryCatch {
        #[serde(default)]
        try_steps: Vec<ActionConfig>,
        #[serde(default)]
        success_steps: Vec<ActionConfig>,
        #[serde(default)]
        error_steps: Vec<ActionConfig>,
        #[serde(default)]
        finally_steps: Vec<ActionConfig>,
    },
    FallbackBlock {
        #[serde(default)]
        primary_steps: Vec<ActionConfig>,
        #[serde(default)]
        fallback_steps: Vec<ActionConfig>,
    },
    BreakLoop {},
    ContinueLoop {},
    StopWorkflow {
        status: StopWorkflowStatus,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        reason: Option<String>,
    },
    TransformVariable {
        source_name: String,
        target_name: String,
        expression: String,
    },
    AssertOutput {
        name: String,
        match_mode: AssertOutputMatchMode,
        value: String,
    },
    RunSubworkflow {
        workflow_id: String,
        #[serde(default)]
        input_mapping: Vec<VariableMapping>,
        #[serde(default)]
        output_mapping: Vec<VariableMapping>,
    },
    DomainAllowlist {
        domains: Vec<String>,
    },
    UseProfile {
        name: String,
    },
    SaveSession {
        path: String,
    },
    LoadSession {
        path: String,
    },
    SetCookie {
        name: String,
        value: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        domain: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        path: Option<String>,
    },
    ClearCookies {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        domain: Option<String>,
    },
    SetSecret {
        name: String,
        value: String,
    },
    UseProxy {
        server: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        username: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        password: Option<String>,
    },
    SetUserAgent {
        user_agent: String,
    },
    SetViewport {
        width: u32,
        height: u32,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        device_scale_factor: Option<f64>,
        mobile: bool,
        touch: bool,
    },
    SetGeolocation {
        latitude: f64,
        longitude: f64,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        accuracy: Option<f64>,
    },
    SetExtraHeaders {
        headers: Vec<HeaderPair>,
    },
    GrantPermission {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        origin: Option<String>,
        permissions: Vec<String>,
    },
    DetectChallenge {
        output_name: String,
        patterns: Vec<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    PauseForHuman {
        reason: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    ResumeWhenCondition {
        condition: WorkflowCondition,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    FallbackSelector {
        output_name: String,
        xpaths: Vec<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    RetryStep {
        max_attempts: u32,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        delay_ms: Option<u64>,
        step: Box<ActionConfig>,
    },
    Checkpoint {
        name: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        screenshot_path: Option<String>,
    },
    ExecuteJs {
        script: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        output_name: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    WaitForRequest {
        url_contains: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    WaitForResponse {
        url_contains: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        status: Option<u16>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timeout_ms: Option<u64>,
    },
    BlockRequest {
        url_patterns: Vec<String>,
    },
    MockResponse {
        url_contains: String,
        status: u16,
        body: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        content_type: Option<String>,
    },
    SetLocalStorage {
        key: String,
        value: String,
    },
    SetSessionStorage {
        key: String,
        value: String,
    },
}

impl ActionConfig {
    pub fn action_type(&self) -> ActionType {
        match self {
            Self::Navigate { .. } => ActionType::Navigate,
            Self::Wait { .. } => ActionType::Wait,
            Self::InputText { .. } => ActionType::InputText,
            Self::ClearInput { .. } => ActionType::ClearInput,
            Self::Click { .. } => ActionType::Click,
            Self::Scroll { .. } => ActionType::Scroll,
            Self::SelectOption { .. } => ActionType::SelectOption,
            Self::SetCheckbox { .. } => ActionType::SetCheckbox,
            Self::PressKey { .. } => ActionType::PressKey,
            Self::Hotkey { .. } => ActionType::Hotkey,
            Self::Hover { .. } => ActionType::Hover,
            Self::DoubleClick { .. } => ActionType::DoubleClick,
            Self::RightClick { .. } => ActionType::RightClick,
            Self::DragAndDrop { .. } => ActionType::DragAndDrop,
            Self::FocusElement { .. } => ActionType::FocusElement,
            Self::BlurElement { .. } => ActionType::BlurElement,
            Self::TypeSequence { .. } => ActionType::TypeSequence,
            Self::SetClipboard { .. } => ActionType::SetClipboard,
            Self::PasteClipboard { .. } => ActionType::PasteClipboard,
            Self::Check { .. } => ActionType::Check,
            Self::Uncheck { .. } => ActionType::Uncheck,
            Self::ToggleCheckbox { .. } => ActionType::ToggleCheckbox,
            Self::SelectRadio { .. } => ActionType::SelectRadio,
            Self::UploadFile { .. } => ActionType::UploadFile,
            Self::SubmitForm { .. } => ActionType::SubmitForm,
            Self::SelectCustomOption { .. } => ActionType::SelectCustomOption,
            Self::SetContenteditable { .. } => ActionType::SetContenteditable,
            Self::ExtractText { .. } => ActionType::ExtractText,
            Self::ExtractAttribute { .. } => ActionType::ExtractAttribute,
            Self::ExtractInputValue { .. } => ActionType::ExtractInputValue,
            Self::ExtractTable { .. } => ActionType::ExtractTable,
            Self::ExtractList { .. } => ActionType::ExtractList,
            Self::TakeScreenshot { .. } => ActionType::TakeScreenshot,
            Self::GoBack { .. } => ActionType::GoBack,
            Self::GoForward { .. } => ActionType::GoForward,
            Self::Reload { .. } => ActionType::Reload,
            Self::OpenNewTab { .. } => ActionType::OpenNewTab,
            Self::SwitchTab { .. } => ActionType::SwitchTab,
            Self::CloseTab { .. } => ActionType::CloseTab,
            Self::SwitchFrame { .. } => ActionType::SwitchFrame,
            Self::AcceptDialog { .. } => ActionType::AcceptDialog,
            Self::DismissDialog { .. } => ActionType::DismissDialog,
            Self::SetDownloadDirectory { .. } => ActionType::SetDownloadDirectory,
            Self::WaitForDownload { .. } => ActionType::WaitForDownload,
            Self::SetVariable { .. } => ActionType::SetVariable,
            Self::AssertElement { .. } => ActionType::AssertElement,
            Self::AssertText { .. } => ActionType::AssertText,
            Self::IfCondition { .. } => ActionType::IfCondition,
            Self::RepeatTimes { .. } => ActionType::RepeatTimes,
            Self::RepeatForEach { .. } => ActionType::RepeatForEach,
            Self::RetryBlock { .. } => ActionType::RetryBlock,
            Self::SwitchCondition { .. } => ActionType::SwitchCondition,
            Self::WhileLoop { .. } => ActionType::WhileLoop,
            Self::RepeatUntil { .. } => ActionType::RepeatUntil,
            Self::TryCatch { .. } => ActionType::TryCatch,
            Self::FallbackBlock { .. } => ActionType::FallbackBlock,
            Self::BreakLoop { .. } => ActionType::BreakLoop,
            Self::ContinueLoop { .. } => ActionType::ContinueLoop,
            Self::StopWorkflow { .. } => ActionType::StopWorkflow,
            Self::TransformVariable { .. } => ActionType::TransformVariable,
            Self::AssertOutput { .. } => ActionType::AssertOutput,
            Self::RunSubworkflow { .. } => ActionType::RunSubworkflow,
            Self::DomainAllowlist { .. } => ActionType::DomainAllowlist,
            Self::UseProfile { .. } => ActionType::UseProfile,
            Self::SaveSession { .. } => ActionType::SaveSession,
            Self::LoadSession { .. } => ActionType::LoadSession,
            Self::SetCookie { .. } => ActionType::SetCookie,
            Self::ClearCookies { .. } => ActionType::ClearCookies,
            Self::SetSecret { .. } => ActionType::SetSecret,
            Self::UseProxy { .. } => ActionType::UseProxy,
            Self::SetUserAgent { .. } => ActionType::SetUserAgent,
            Self::SetViewport { .. } => ActionType::SetViewport,
            Self::SetGeolocation { .. } => ActionType::SetGeolocation,
            Self::SetExtraHeaders { .. } => ActionType::SetExtraHeaders,
            Self::GrantPermission { .. } => ActionType::GrantPermission,
            Self::DetectChallenge { .. } => ActionType::DetectChallenge,
            Self::PauseForHuman { .. } => ActionType::PauseForHuman,
            Self::ResumeWhenCondition { .. } => ActionType::ResumeWhenCondition,
            Self::FallbackSelector { .. } => ActionType::FallbackSelector,
            Self::RetryStep { .. } => ActionType::RetryStep,
            Self::Checkpoint { .. } => ActionType::Checkpoint,
            Self::ExecuteJs { .. } => ActionType::ExecuteJs,
            Self::WaitForRequest { .. } => ActionType::WaitForRequest,
            Self::WaitForResponse { .. } => ActionType::WaitForResponse,
            Self::BlockRequest { .. } => ActionType::BlockRequest,
            Self::MockResponse { .. } => ActionType::MockResponse,
            Self::SetLocalStorage { .. } => ActionType::SetLocalStorage,
            Self::SetSessionStorage { .. } => ActionType::SetSessionStorage,
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
                mode: Some(ClickMode::ForceDom),
                button: Some(ClickButton::Right | ClickButton::Middle),
                ..
            } => Err(ValidationError::new(
                "button",
                "Force DOM click only supports the left button",
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
            Self::DoubleClick { xpath, .. } if xpath.trim().is_empty() => {
                Err(ValidationError::new("xpath", "XPath is required"))
            }
            Self::RightClick { xpath, .. } if xpath.trim().is_empty() => {
                Err(ValidationError::new("xpath", "XPath is required"))
            }
            Self::FocusElement { xpath, .. } if xpath.trim().is_empty() => {
                Err(ValidationError::new("xpath", "XPath is required"))
            }
            Self::BlurElement { xpath, .. } if xpath.trim().is_empty() => {
                Err(ValidationError::new("xpath", "XPath is required"))
            }
            Self::PasteClipboard { xpath, .. } if xpath.trim().is_empty() => {
                Err(ValidationError::new("xpath", "XPath is required"))
            }
            Self::Check { xpath, .. } if xpath.trim().is_empty() => {
                Err(ValidationError::new("xpath", "XPath is required"))
            }
            Self::Uncheck { xpath, .. } if xpath.trim().is_empty() => {
                Err(ValidationError::new("xpath", "XPath is required"))
            }
            Self::ToggleCheckbox { xpath, .. } if xpath.trim().is_empty() => {
                Err(ValidationError::new("xpath", "XPath is required"))
            }
            Self::SelectRadio { xpath, .. } if xpath.trim().is_empty() => {
                Err(ValidationError::new("xpath", "XPath is required"))
            }
            Self::DragAndDrop { source_xpath, .. } if source_xpath.trim().is_empty() => Err(
                ValidationError::new("source_xpath", "Source XPath is required"),
            ),
            Self::DragAndDrop { target_xpath, .. } if target_xpath.trim().is_empty() => Err(
                ValidationError::new("target_xpath", "Target XPath is required"),
            ),
            Self::TypeSequence { xpath, .. } if xpath.trim().is_empty() => {
                Err(ValidationError::new("xpath", "XPath is required"))
            }
            Self::TypeSequence { text, .. } if text.is_empty() => {
                Err(ValidationError::new("text", "Text is required"))
            }
            Self::TypeSequence {
                delay_ms: Some(0), ..
            } => Err(ValidationError::new(
                "delay_ms",
                "Delay must be greater than 0",
            )),
            Self::SetClipboard { text } if text.is_empty() => {
                Err(ValidationError::new("text", "Text is required"))
            }
            Self::UploadFile { xpath, .. } if xpath.trim().is_empty() => {
                Err(ValidationError::new("xpath", "XPath is required"))
            }
            Self::UploadFile { files, .. } if files.is_empty() => Err(ValidationError::new(
                "files",
                "At least one file is required",
            )),
            Self::UploadFile { files, .. } if files.iter().any(|file| file.trim().is_empty()) => {
                Err(ValidationError::new("files", "File path is required"))
            }
            Self::SubmitForm {
                xpath: Some(xpath), ..
            } if xpath.trim().is_empty() => Err(ValidationError::new("xpath", "XPath is required")),
            Self::SelectCustomOption { trigger_xpath, .. } if trigger_xpath.trim().is_empty() => {
                Err(ValidationError::new(
                    "trigger_xpath",
                    "Trigger XPath is required",
                ))
            }
            Self::SelectCustomOption { option_text, .. } if option_text.trim().is_empty() => Err(
                ValidationError::new("option_text", "Option text is required"),
            ),
            Self::SetContenteditable { xpath, .. } if xpath.trim().is_empty() => {
                Err(ValidationError::new("xpath", "XPath is required"))
            }
            Self::SetContenteditable { text, .. } if text.is_empty() => {
                Err(ValidationError::new("text", "Text is required"))
            }
            Self::ExtractText { xpath, .. }
            | Self::ExtractAttribute { xpath, .. }
            | Self::ExtractInputValue { xpath, .. }
            | Self::ExtractTable { xpath, .. }
            | Self::ExtractList { xpath, .. }
                if xpath.trim().is_empty() =>
            {
                Err(ValidationError::new("xpath", "XPath is required"))
            }
            Self::ExtractAttribute { attribute, .. } if attribute.trim().is_empty() => {
                Err(ValidationError::new("attribute", "Attribute is required"))
            }
            Self::ExtractText { output_name, .. }
            | Self::ExtractAttribute { output_name, .. }
            | Self::ExtractInputValue { output_name, .. }
            | Self::ExtractTable { output_name, .. }
            | Self::ExtractList { output_name, .. }
                if output_name.trim().is_empty() =>
            {
                Err(ValidationError::new(
                    "output_name",
                    "Output name is required",
                ))
            }
            Self::TakeScreenshot { path, .. } if path.trim().is_empty() => {
                Err(ValidationError::new("path", "Screenshot path is required"))
            }
            Self::TakeScreenshot {
                output_name: Some(output_name),
                ..
            } if output_name.trim().is_empty() => Err(ValidationError::new(
                "output_name",
                "Output name is required",
            )),
            Self::OpenNewTab { url: Some(url) } if url.trim().is_empty() => {
                Err(ValidationError::new("url", "URL is required"))
            }
            Self::SwitchFrame { xpath: Some(xpath) } if xpath.trim().is_empty() => {
                Err(ValidationError::new("xpath", "XPath is required"))
            }
            Self::SetDownloadDirectory { path } if path.trim().is_empty() => Err(
                ValidationError::new("path", "Download directory is required"),
            ),
            Self::WaitForDownload { output_name, .. } if output_name.trim().is_empty() => Err(
                ValidationError::new("output_name", "Output name is required"),
            ),
            Self::WaitForDownload {
                timeout_ms: Some(0),
                ..
            } => Err(ValidationError::new(
                "timeout_ms",
                "Timeout must be greater than 0",
            )),
            Self::SetVariable { name, .. } if name.trim().is_empty() => {
                Err(ValidationError::new("name", "Variable name is required"))
            }
            Self::AssertElement { xpath, .. } if xpath.trim().is_empty() => {
                Err(ValidationError::new("xpath", "XPath is required"))
            }
            Self::AssertText { text, .. } if text.trim().is_empty() => {
                Err(ValidationError::new("text", "Expected text is required"))
            }
            Self::IfCondition {
                condition,
                then_steps,
                else_steps,
            } => {
                validate_condition(condition)?;
                validate_nested_steps(then_steps)?;
                validate_nested_steps(else_steps)
            }
            Self::RepeatTimes { times: 0, .. } => Err(ValidationError::new(
                "times",
                "Repeat count must be greater than 0",
            )),
            Self::RepeatTimes { steps, .. } => validate_nested_steps(steps),
            Self::RepeatForEach { item_name, .. } if item_name.trim().is_empty() => {
                Err(ValidationError::new("item_name", "Item name is required"))
            }
            Self::RepeatForEach { items, .. } if items.is_empty() => Err(ValidationError::new(
                "items",
                "At least one item is required",
            )),
            Self::RepeatForEach { steps, .. } => validate_nested_steps(steps),
            Self::RetryBlock {
                max_attempts: 0, ..
            } => Err(ValidationError::new(
                "max_attempts",
                "Max attempts must be greater than 0",
            )),
            Self::RetryBlock {
                steps,
                failed_steps,
                ..
            } => {
                validate_nested_steps(steps)?;
                validate_nested_steps(failed_steps)
            }
            Self::SwitchCondition { expression, .. } if expression.trim().is_empty() => Err(
                ValidationError::new("expression", "Switch expression is required"),
            ),
            Self::SwitchCondition { cases, .. } if cases.is_empty() => Err(ValidationError::new(
                "cases",
                "At least one switch case is required",
            )),
            Self::SwitchCondition {
                cases,
                default_steps,
                ..
            } => {
                for case in cases {
                    if case.value.trim().is_empty() {
                        return Err(ValidationError::new("cases", "Switch case is required"));
                    }
                    validate_nested_steps(&case.steps)?;
                }
                validate_nested_steps(default_steps)
            }
            Self::WhileLoop {
                condition,
                max_attempts,
                timeout_ms,
                steps,
            }
            | Self::RepeatUntil {
                condition,
                max_attempts,
                timeout_ms,
                steps,
                ..
            } => {
                validate_condition(condition)?;
                validate_loop_guard(*max_attempts, *timeout_ms)?;
                validate_nested_steps(steps)
            }
            Self::TryCatch {
                try_steps,
                success_steps,
                error_steps,
                finally_steps,
            } => {
                validate_nested_steps(try_steps)?;
                validate_nested_steps(success_steps)?;
                validate_nested_steps(error_steps)?;
                validate_nested_steps(finally_steps)
            }
            Self::FallbackBlock {
                primary_steps,
                fallback_steps,
            } => {
                validate_nested_steps(primary_steps)?;
                validate_nested_steps(fallback_steps)
            }
            Self::TransformVariable {
                source_name,
                target_name,
                ..
            } if source_name.trim().is_empty() || target_name.trim().is_empty() => Err(
                ValidationError::new("name", "Source and target output names are required"),
            ),
            Self::AssertOutput { name, .. } if name.trim().is_empty() => {
                Err(ValidationError::new("name", "Output name is required"))
            }
            Self::AssertOutput { value, .. } if value.trim().is_empty() => Err(
                ValidationError::new("value", "Expected output value is required"),
            ),
            Self::RunSubworkflow { workflow_id, .. } if workflow_id.trim().is_empty() => Err(
                ValidationError::new("workflow_id", "Workflow id is required"),
            ),
            Self::RunSubworkflow {
                input_mapping,
                output_mapping,
                ..
            } => {
                validate_variable_mappings(input_mapping)?;
                validate_variable_mappings(output_mapping)
            }
            Self::DomainAllowlist { domains } if domains.is_empty() => Err(ValidationError::new(
                "domains",
                "At least one allowed domain is required",
            )),
            Self::DomainAllowlist { domains }
                if domains.iter().any(|domain| domain.trim().is_empty()) =>
            {
                Err(ValidationError::new(
                    "domains",
                    "Allowed domains are required",
                ))
            }
            Self::UseProfile { name } if name.trim().is_empty() => {
                Err(ValidationError::new("name", "Profile name is required"))
            }
            Self::SaveSession { path } | Self::LoadSession { path } if path.trim().is_empty() => {
                Err(ValidationError::new("path", "Session path is required"))
            }
            Self::SetCookie { name, .. } if name.trim().is_empty() => {
                Err(ValidationError::new("name", "Cookie name is required"))
            }
            Self::SetCookie { value, .. } if value.is_empty() => {
                Err(ValidationError::new("value", "Cookie value is required"))
            }
            Self::SetSecret { name, .. } if name.trim().is_empty() => {
                Err(ValidationError::new("name", "Secret name is required"))
            }
            Self::SetSecret { value, .. } if value.is_empty() => {
                Err(ValidationError::new("value", "Secret value is required"))
            }
            Self::UseProxy { server, .. } if server.trim().is_empty() => {
                Err(ValidationError::new("server", "Proxy server is required"))
            }
            Self::UseProxy {
                username: Some(username),
                ..
            } if username.trim().is_empty() => Err(ValidationError::new(
                "username",
                "Proxy username cannot be blank",
            )),
            Self::UseProxy {
                password: Some(password),
                ..
            } if password.is_empty() => Err(ValidationError::new(
                "password",
                "Proxy password cannot be empty",
            )),
            Self::SetUserAgent { user_agent } if user_agent.trim().is_empty() => {
                Err(ValidationError::new("user_agent", "User agent is required"))
            }
            Self::SetViewport { width: 0, .. } => Err(ValidationError::new(
                "width",
                "Viewport width must be greater than 0",
            )),
            Self::SetViewport { height: 0, .. } => Err(ValidationError::new(
                "height",
                "Viewport height must be greater than 0",
            )),
            Self::SetViewport {
                device_scale_factor: Some(device_scale_factor),
                ..
            } if *device_scale_factor <= 0.0 => Err(ValidationError::new(
                "device_scale_factor",
                "Device scale factor must be greater than 0",
            )),
            Self::SetGeolocation { latitude, .. } if !(-90.0..=90.0).contains(latitude) => Err(
                ValidationError::new("latitude", "Latitude must be between -90 and 90"),
            ),
            Self::SetGeolocation { longitude, .. } if !(-180.0..=180.0).contains(longitude) => Err(
                ValidationError::new("longitude", "Longitude must be between -180 and 180"),
            ),
            Self::SetGeolocation {
                accuracy: Some(accuracy),
                ..
            } if *accuracy < 0.0 => Err(ValidationError::new(
                "accuracy",
                "Accuracy must be greater than or equal to 0",
            )),
            Self::SetExtraHeaders { headers } if headers.is_empty() => Err(ValidationError::new(
                "headers",
                "At least one header is required",
            )),
            Self::SetExtraHeaders { headers }
                if headers.iter().any(|header| {
                    header.name.trim().is_empty() || header.value.trim().is_empty()
                }) =>
            {
                Err(ValidationError::new(
                    "headers",
                    "Header names and values are required",
                ))
            }
            Self::GrantPermission { permissions, .. } if permissions.is_empty() => Err(
                ValidationError::new("permissions", "At least one permission is required"),
            ),
            Self::GrantPermission { permissions, .. }
                if permissions
                    .iter()
                    .any(|permission| permission.trim().is_empty()) =>
            {
                Err(ValidationError::new(
                    "permissions",
                    "Permission names are required",
                ))
            }
            Self::DetectChallenge { output_name, .. } if output_name.trim().is_empty() => Err(
                ValidationError::new("output_name", "Output name is required"),
            ),
            Self::DetectChallenge { patterns, .. } if patterns.is_empty() => Err(
                ValidationError::new("patterns", "At least one challenge pattern is required"),
            ),
            Self::DetectChallenge { patterns, .. }
                if patterns.iter().any(|pattern| pattern.trim().is_empty()) =>
            {
                Err(ValidationError::new(
                    "patterns",
                    "Challenge patterns are required",
                ))
            }
            Self::DetectChallenge {
                timeout_ms: Some(0),
                ..
            } => Err(ValidationError::new(
                "timeout_ms",
                "Timeout must be greater than 0",
            )),
            Self::PauseForHuman { reason, .. } if reason.trim().is_empty() => {
                Err(ValidationError::new("reason", "Pause reason is required"))
            }
            Self::PauseForHuman {
                timeout_ms: Some(0),
                ..
            }
            | Self::ResumeWhenCondition {
                timeout_ms: Some(0),
                ..
            } => Err(ValidationError::new(
                "timeout_ms",
                "Timeout must be greater than 0",
            )),
            Self::ResumeWhenCondition { condition, .. } => validate_condition(condition),
            Self::FallbackSelector { output_name, .. } if output_name.trim().is_empty() => Err(
                ValidationError::new("output_name", "Output name is required"),
            ),
            Self::FallbackSelector { xpaths, .. } if xpaths.is_empty() => Err(
                ValidationError::new("xpaths", "At least one fallback XPath is required"),
            ),
            Self::FallbackSelector { xpaths, .. }
                if xpaths.iter().any(|xpath| xpath.trim().is_empty()) =>
            {
                Err(ValidationError::new("xpaths", "Fallback XPath is required"))
            }
            Self::FallbackSelector {
                timeout_ms: Some(0),
                ..
            } => Err(ValidationError::new(
                "timeout_ms",
                "Timeout must be greater than 0",
            )),
            Self::RetryStep {
                max_attempts: 0, ..
            } => Err(ValidationError::new(
                "max_attempts",
                "Max attempts must be greater than 0",
            )),
            Self::RetryStep {
                delay_ms: Some(0), ..
            } => Err(ValidationError::new(
                "delay_ms",
                "Delay must be greater than 0",
            )),
            Self::RetryStep { step, .. } => step.validate(),
            Self::Checkpoint { name, .. } if name.trim().is_empty() => {
                Err(ValidationError::new("name", "Checkpoint name is required"))
            }
            Self::Checkpoint {
                screenshot_path: Some(path),
                ..
            } if path.trim().is_empty() => Err(ValidationError::new(
                "screenshot_path",
                "Screenshot path is required",
            )),
            Self::ExecuteJs { script, .. } if script.trim().is_empty() => {
                Err(ValidationError::new("script", "JavaScript is required"))
            }
            Self::ExecuteJs {
                output_name: Some(output_name),
                ..
            } if output_name.trim().is_empty() => Err(ValidationError::new(
                "output_name",
                "Output name is required",
            )),
            Self::ExecuteJs {
                timeout_ms: Some(0),
                ..
            }
            | Self::WaitForRequest {
                timeout_ms: Some(0),
                ..
            }
            | Self::WaitForResponse {
                timeout_ms: Some(0),
                ..
            } => Err(ValidationError::new(
                "timeout_ms",
                "Timeout must be greater than 0",
            )),
            Self::WaitForRequest { url_contains, .. }
            | Self::WaitForResponse { url_contains, .. }
            | Self::MockResponse { url_contains, .. }
                if url_contains.trim().is_empty() =>
            {
                Err(ValidationError::new(
                    "url_contains",
                    "URL matcher is required",
                ))
            }
            Self::BlockRequest { url_patterns } if url_patterns.is_empty() => Err(
                ValidationError::new("url_patterns", "At least one URL pattern is required"),
            ),
            Self::BlockRequest { url_patterns }
                if url_patterns.iter().any(|pattern| pattern.trim().is_empty()) =>
            {
                Err(ValidationError::new(
                    "url_patterns",
                    "URL pattern is required",
                ))
            }
            Self::MockResponse { status, .. } if !(100..=599).contains(status) => Err(
                ValidationError::new("status", "Status must be between 100 and 599"),
            ),
            Self::SetLocalStorage { key, .. } | Self::SetSessionStorage { key, .. }
                if key.trim().is_empty() =>
            {
                Err(ValidationError::new("key", "Storage key is required"))
            }
            Self::DoubleClick {
                timeout_ms: Some(0),
                ..
            }
            | Self::RightClick {
                timeout_ms: Some(0),
                ..
            }
            | Self::DragAndDrop {
                timeout_ms: Some(0),
                ..
            }
            | Self::FocusElement {
                timeout_ms: Some(0),
                ..
            }
            | Self::BlurElement {
                timeout_ms: Some(0),
                ..
            }
            | Self::TypeSequence {
                timeout_ms: Some(0),
                ..
            }
            | Self::PasteClipboard {
                timeout_ms: Some(0),
                ..
            }
            | Self::Check {
                timeout_ms: Some(0),
                ..
            }
            | Self::Uncheck {
                timeout_ms: Some(0),
                ..
            }
            | Self::ToggleCheckbox {
                timeout_ms: Some(0),
                ..
            }
            | Self::SelectRadio {
                timeout_ms: Some(0),
                ..
            }
            | Self::UploadFile {
                timeout_ms: Some(0),
                ..
            }
            | Self::SubmitForm {
                timeout_ms: Some(0),
                ..
            }
            | Self::SelectCustomOption {
                timeout_ms: Some(0),
                ..
            }
            | Self::SetContenteditable {
                timeout_ms: Some(0),
                ..
            }
            | Self::ExtractText {
                timeout_ms: Some(0),
                ..
            }
            | Self::ExtractAttribute {
                timeout_ms: Some(0),
                ..
            }
            | Self::ExtractInputValue {
                timeout_ms: Some(0),
                ..
            }
            | Self::ExtractTable {
                timeout_ms: Some(0),
                ..
            }
            | Self::ExtractList {
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

fn validate_condition(condition: &WorkflowCondition) -> Result<(), ValidationError> {
    match condition {
        WorkflowCondition::OutputEquals { name, .. }
        | WorkflowCondition::OutputContains { name, .. }
            if name.trim().is_empty() =>
        {
            Err(ValidationError::new("name", "Output name is required"))
        }
        WorkflowCondition::OutputEquals { value, .. }
        | WorkflowCondition::OutputContains { value, .. }
            if value.trim().is_empty() =>
        {
            Err(ValidationError::new("value", "Condition value is required"))
        }
        WorkflowCondition::TextVisible { text } if text.trim().is_empty() => {
            Err(ValidationError::new("text", "Condition text is required"))
        }
        WorkflowCondition::UrlContains { value } if value.trim().is_empty() => {
            Err(ValidationError::new("value", "URL condition is required"))
        }
        WorkflowCondition::ElementVisible { xpath } if xpath.trim().is_empty() => {
            Err(ValidationError::new("xpath", "XPath is required"))
        }
        _ => Ok(()),
    }
}

fn validate_nested_steps(steps: &[ActionConfig]) -> Result<(), ValidationError> {
    for step in steps {
        step.validate()?;
    }
    Ok(())
}

fn validate_loop_guard(
    max_attempts: Option<u32>,
    timeout_ms: Option<u64>,
) -> Result<(), ValidationError> {
    match (max_attempts, timeout_ms) {
        (Some(0), _) => Err(ValidationError::new(
            "max_attempts",
            "Max attempts must be greater than 0",
        )),
        (_, Some(0)) => Err(ValidationError::new(
            "timeout_ms",
            "Timeout must be greater than 0",
        )),
        (None, None) => Err(ValidationError::new(
            "loop_guard",
            "Loop nodes require max attempts or timeout",
        )),
        _ => Ok(()),
    }
}

fn validate_variable_mappings(mappings: &[VariableMapping]) -> Result<(), ValidationError> {
    if mappings
        .iter()
        .any(|mapping| mapping.source.trim().is_empty() || mapping.target.trim().is_empty())
    {
        return Err(ValidationError::new(
            "mapping",
            "Variable mapping source and target are required",
        ));
    }
    Ok(())
}
