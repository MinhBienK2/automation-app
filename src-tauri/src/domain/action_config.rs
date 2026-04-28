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
    StopWorkflow,
    UseProfile,
    SaveSession,
    LoadSession,
    SetCookie,
    ClearCookies,
    SetSecret,
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
            Self::StopWorkflow => "stop_workflow",
            Self::UseProfile => "use_profile",
            Self::SaveSession => "save_session",
            Self::LoadSession => "load_session",
            Self::SetCookie => "set_cookie",
            Self::ClearCookies => "clear_cookies",
            Self::SetSecret => "set_secret",
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
            Self::StopWorkflow => "Stop Workflow",
            Self::UseProfile => "Use Profile",
            Self::SaveSession => "Save Session",
            Self::LoadSession => "Load Session",
            Self::SetCookie => "Set Cookie",
            Self::ClearCookies => "Clear Cookies",
            Self::SetSecret => "Set Secret",
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
    },
    StopWorkflow {
        status: StopWorkflowStatus,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        reason: Option<String>,
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
            Self::StopWorkflow { .. } => ActionType::StopWorkflow,
            Self::UseProfile { .. } => ActionType::UseProfile,
            Self::SaveSession { .. } => ActionType::SaveSession,
            Self::LoadSession { .. } => ActionType::LoadSession,
            Self::SetCookie { .. } => ActionType::SetCookie,
            Self::ClearCookies { .. } => ActionType::ClearCookies,
            Self::SetSecret { .. } => ActionType::SetSecret,
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
            Self::IfCondition { condition, .. } => validate_condition(condition),
            Self::RepeatTimes { times: 0, .. } => Err(ValidationError::new(
                "times",
                "Repeat count must be greater than 0",
            )),
            Self::RepeatForEach { item_name, .. } if item_name.trim().is_empty() => {
                Err(ValidationError::new("item_name", "Item name is required"))
            }
            Self::RepeatForEach { items, .. } if items.is_empty() => Err(ValidationError::new(
                "items",
                "At least one item is required",
            )),
            Self::RetryBlock {
                max_attempts: 0, ..
            } => Err(ValidationError::new(
                "max_attempts",
                "Max attempts must be greater than 0",
            )),
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
