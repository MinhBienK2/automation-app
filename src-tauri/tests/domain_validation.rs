use workflow_automation_manager_lib::domain::{
    ActionConfig, ActionType, CheckboxState, ClearInputMethod, ClickButton, ClickMode,
    ClickPosition, ClickWaitUntil, HeaderPair, InputTypingMode, RunError, RunStatus,
    ScrollBehavior, ScrollBlock, ScrollDirection, ScrollInline, ScrollMode, SelectOptionMatchBy,
    ValidationError, WaitCondition, Workflow, WorkflowStep,
};
use workflow_automation_manager_lib::services::run_service::default_config;

fn assert_validation_message(error: ValidationError, field: &str, message: &str) {
    assert_eq!(error.field, field);
    assert_eq!(error.message, message);
}

#[test]
fn workflow_name_is_required() {
    let workflow = Workflow::new("  ");

    let error = workflow.validate().expect_err("blank name should fail");

    assert_validation_message(error, "name", "Workflow name is required");
}

#[test]
fn valid_workflow_name_passes() {
    let workflow = Workflow::new("Login flow");

    workflow.validate().expect("name should be valid");
}

#[test]
fn action_config_validation_covers_required_fields() {
    assert_validation_message(
        ActionConfig::OpenUrl {
            url: " ".to_string(),
        }
        .validate()
        .expect_err("blank URL should fail"),
        "url",
        "URL is required",
    );

    assert_validation_message(
        ActionConfig::Sleep { seconds: 0.0 }
            .validate()
            .expect_err("zero seconds should fail"),
        "seconds",
        "Seconds must be greater than 0",
    );

    assert_validation_message(
        ActionConfig::TypeText {
            xpath: String::new(),
            text: "abc".to_string(),
        }
        .validate()
        .expect_err("blank XPath should fail"),
        "xpath",
        "XPath is required",
    );

    assert_validation_message(
        ActionConfig::TypeText {
            xpath: "//*[@name=\"email\"]".to_string(),
            text: String::new(),
        }
        .validate()
        .expect_err("blank text should fail"),
        "text",
        "Text is required",
    );

    assert_validation_message(
        ActionConfig::Click {
            xpath: String::new(),
            iframe_xpath: None,
            mode: None,
            button: None,
            click_count: None,
            scroll_into_view: None,
            block: None,
            inline: None,
            position: None,
            offset_x: None,
            offset_y: None,
            wait_until: None,
            timeout_ms: None,
            retry_interval_ms: None,
            post_click_wait_ms: None,
        }
        .validate()
        .expect_err("blank XPath should fail"),
        "xpath",
        "XPath is required",
    );

    assert_validation_message(
        ActionConfig::Scroll {
            mode: None,
            direction: ScrollDirection::Down,
            pixels: 0,
            xpath: None,
            iframe_xpath: None,
            behavior: None,
            block: None,
            inline: None,
            max_attempts: None,
            wait_ms: None,
        }
        .validate()
        .expect_err("zero pixels should fail"),
        "pixels",
        "Pixels must be greater than 0",
    );
}

#[test]
fn valid_action_configs_pass_validation() {
    let configs = [
        ActionConfig::OpenUrl {
            url: "https://example.com".to_string(),
        },
        ActionConfig::Sleep { seconds: 1.5 },
        ActionConfig::TypeText {
            xpath: "//*[@name=\"email\"]".to_string(),
            text: "user@example.com".to_string(),
        },
        ActionConfig::Click {
            xpath: "//*[@type=\"submit\"]".to_string(),
            iframe_xpath: None,
            mode: None,
            button: None,
            click_count: None,
            scroll_into_view: None,
            block: None,
            inline: None,
            position: None,
            offset_x: None,
            offset_y: None,
            wait_until: None,
            timeout_ms: None,
            retry_interval_ms: None,
            post_click_wait_ms: None,
        },
        ActionConfig::Scroll {
            mode: None,
            direction: ScrollDirection::Down,
            pixels: 500,
            xpath: None,
            iframe_xpath: None,
            behavior: None,
            block: None,
            inline: None,
            max_attempts: None,
            wait_ms: None,
        },
    ];

    for config in configs {
        config.validate().expect("config should be valid");
    }
}

#[test]
fn every_action_config_round_trips_through_json() {
    let configs = [
        ActionConfig::OpenUrl {
            url: "https://example.com".to_string(),
        },
        ActionConfig::Sleep { seconds: 2.0 },
        ActionConfig::TypeText {
            xpath: "//*[@name=\"email\"]".to_string(),
            text: "user@example.com".to_string(),
        },
        ActionConfig::Click {
            xpath: "//*[@type=\"submit\"]".to_string(),
            iframe_xpath: None,
            mode: None,
            button: None,
            click_count: None,
            scroll_into_view: None,
            block: None,
            inline: None,
            position: None,
            offset_x: None,
            offset_y: None,
            wait_until: None,
            timeout_ms: None,
            retry_interval_ms: None,
            post_click_wait_ms: None,
        },
        ActionConfig::Scroll {
            mode: None,
            direction: ScrollDirection::Up,
            pixels: 300,
            xpath: None,
            iframe_xpath: None,
            behavior: None,
            block: None,
            inline: None,
            max_attempts: None,
            wait_ms: None,
        },
    ];

    for config in configs {
        let json = serde_json::to_string(&config).expect("serialize config");
        let decoded: ActionConfig = serde_json::from_str(&json).expect("deserialize config");

        assert_eq!(decoded, config);
    }
}

#[test]
fn user_action_taxonomy_configs_validate_and_round_trip() {
    let configs = [
        ActionConfig::Navigate {
            url: "https://example.com".to_string(),
            wait_until: None,
            timeout_ms: Some(5000),
        },
        ActionConfig::InputText {
            xpath: "//*[@name=\"email\"]".to_string(),
            iframe_xpath: None,
            text: "user@example.com".to_string(),
            clear_before_input: true,
            typing_mode: Some(InputTypingMode::SetValue),
            delay_ms: None,
            wait_until: None,
            timeout_ms: None,
        },
        ActionConfig::ClearInput {
            xpath: "//*[@name=\"email\"]".to_string(),
            iframe_xpath: None,
            method: Some(ClearInputMethod::SelectAll),
            wait_until: None,
            timeout_ms: None,
        },
        ActionConfig::Wait {
            condition: WaitCondition::ElementVisible,
            xpath: Some("//*[@id=\"ready\"]".to_string()),
            text: None,
            url: None,
            duration_ms: None,
            timeout_ms: Some(3000),
        },
        ActionConfig::SelectOption {
            xpath: "//*[@name=\"country\"]".to_string(),
            iframe_xpath: None,
            match_by: SelectOptionMatchBy::Label,
            value: "Vietnam".to_string(),
            wait_until: None,
            timeout_ms: None,
        },
        ActionConfig::SetCheckbox {
            xpath: "//*[@name=\"terms\"]".to_string(),
            iframe_xpath: None,
            state: CheckboxState::Checked,
            wait_until: None,
            timeout_ms: None,
        },
        ActionConfig::PressKey {
            key: "Enter".to_string(),
        },
        ActionConfig::Hotkey {
            keys: vec!["Control".to_string(), "S".to_string()],
        },
        ActionConfig::Hover {
            xpath: "//*[@id=\"menu\"]".to_string(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: None,
        },
    ];

    for config in configs {
        config
            .validate()
            .expect("new taxonomy config should be valid");
        let json = serde_json::to_string(&config).expect("serialize config");
        let decoded: ActionConfig = serde_json::from_str(&json).expect("deserialize config");

        assert_eq!(decoded, config);
    }
}

#[test]
fn phase_four_data_capture_configs_validate_and_round_trip() {
    let configs = [
        ActionConfig::ExtractText {
            xpath: "//*[@id=\"title\"]".to_string(),
            iframe_xpath: None,
            output_name: "title".to_string(),
            timeout_ms: Some(3000),
        },
        ActionConfig::ExtractAttribute {
            xpath: "//*[@id=\"link\"]".to_string(),
            iframe_xpath: None,
            attribute: "href".to_string(),
            output_name: "link_href".to_string(),
            timeout_ms: Some(3000),
        },
        ActionConfig::ExtractInputValue {
            xpath: "//*[@id=\"email\"]".to_string(),
            iframe_xpath: None,
            output_name: "email".to_string(),
            timeout_ms: Some(3000),
        },
        ActionConfig::ExtractTable {
            xpath: "//*[@id=\"orders\"]".to_string(),
            iframe_xpath: None,
            output_name: "orders".to_string(),
            timeout_ms: Some(3000),
        },
        ActionConfig::ExtractList {
            xpath: "//*[@id=\"items\"]".to_string(),
            iframe_xpath: None,
            output_name: "items".to_string(),
            timeout_ms: Some(3000),
        },
        ActionConfig::TakeScreenshot {
            path: "/tmp/wam-phase-four.png".to_string(),
            output_name: Some("screenshot_path".to_string()),
            full_page: true,
        },
    ];

    for config in configs {
        config.validate().expect("config should be valid");
        let json = serde_json::to_string(&config).expect("serialize config");
        let decoded: ActionConfig = serde_json::from_str(&json).expect("deserialize config");

        assert_eq!(decoded, config);
    }
}

#[test]
fn phase_four_data_capture_configs_validate_required_fields() {
    assert_validation_message(
        ActionConfig::ExtractText {
            xpath: String::new(),
            iframe_xpath: None,
            output_name: "title".to_string(),
            timeout_ms: None,
        }
        .validate()
        .expect_err("blank XPath should fail"),
        "xpath",
        "XPath is required",
    );

    assert_validation_message(
        ActionConfig::ExtractAttribute {
            xpath: "//*[@id=\"link\"]".to_string(),
            iframe_xpath: None,
            attribute: String::new(),
            output_name: "link_href".to_string(),
            timeout_ms: None,
        }
        .validate()
        .expect_err("blank attribute should fail"),
        "attribute",
        "Attribute is required",
    );

    assert_validation_message(
        ActionConfig::ExtractList {
            xpath: "//*[@id=\"items\"]".to_string(),
            iframe_xpath: None,
            output_name: String::new(),
            timeout_ms: None,
        }
        .validate()
        .expect_err("blank output name should fail"),
        "output_name",
        "Output name is required",
    );

    assert_validation_message(
        ActionConfig::TakeScreenshot {
            path: String::new(),
            output_name: Some("screenshot_path".to_string()),
            full_page: false,
        }
        .validate()
        .expect_err("blank screenshot path should fail"),
        "path",
        "Screenshot path is required",
    );
}

#[test]
fn phase_three_browser_context_configs_validate_and_round_trip() {
    let configs = [
        ActionConfig::GoBack {},
        ActionConfig::GoForward {},
        ActionConfig::Reload {},
        ActionConfig::OpenNewTab {
            url: Some("https://example.com".to_string()),
        },
        ActionConfig::SwitchTab { index: 1 },
        ActionConfig::CloseTab { index: Some(1) },
    ];

    for config in configs {
        config.validate().expect("config should be valid");
        let json = serde_json::to_string(&config).expect("serialize config");
        let decoded: ActionConfig = serde_json::from_str(&json).expect("deserialize config");

        assert_eq!(decoded, config);
    }
}

#[test]
fn phase_three_browser_context_configs_validate_required_fields() {
    assert_validation_message(
        ActionConfig::OpenNewTab {
            url: Some(" ".to_string()),
        }
        .validate()
        .expect_err("blank tab URL should fail"),
        "url",
        "URL is required",
    );
}

#[test]
fn phase_three_frame_dialog_download_configs_validate_and_round_trip() {
    let configs = [
        ActionConfig::SwitchFrame {
            xpath: Some("//*[@id=\"checkout-frame\"]".to_string()),
        },
        ActionConfig::SwitchFrame { xpath: None },
        ActionConfig::AcceptDialog {
            prompt_text: Some("approved".to_string()),
        },
        ActionConfig::DismissDialog {},
        ActionConfig::SetDownloadDirectory {
            path: "/tmp/wam-downloads".to_string(),
        },
        ActionConfig::WaitForDownload {
            output_name: "download_path".to_string(),
            timeout_ms: Some(3000),
        },
    ];

    for config in configs {
        config.validate().expect("config should be valid");
        let json = serde_json::to_string(&config).expect("serialize config");
        let decoded: ActionConfig = serde_json::from_str(&json).expect("deserialize config");

        assert_eq!(decoded, config);
    }
}

#[test]
fn phase_three_frame_dialog_download_configs_validate_required_fields() {
    assert_validation_message(
        ActionConfig::SwitchFrame {
            xpath: Some(" ".to_string()),
        }
        .validate()
        .expect_err("blank frame XPath should fail"),
        "xpath",
        "XPath is required",
    );

    assert_validation_message(
        ActionConfig::SetDownloadDirectory {
            path: String::new(),
        }
        .validate()
        .expect_err("blank download directory should fail"),
        "path",
        "Download directory is required",
    );

    assert_validation_message(
        ActionConfig::WaitForDownload {
            output_name: String::new(),
            timeout_ms: Some(3000),
        }
        .validate()
        .expect_err("blank output name should fail"),
        "output_name",
        "Output name is required",
    );
}

#[test]
fn phase_five_logic_configs_validate_and_round_trip() {
    let nested_step = ActionConfig::SetVariable {
        name: "status".to_string(),
        value: "ready".to_string(),
    };
    let configs = [
        ActionConfig::SetVariable {
            name: "customer".to_string(),
            value: "Ada".to_string(),
        },
        ActionConfig::AssertElement {
            xpath: "//*[@id=\"submit\"]".to_string(),
            iframe_xpath: None,
            state: workflow_automation_manager_lib::domain::AssertElementState::Visible,
            timeout_ms: Some(3000),
        },
        ActionConfig::AssertText {
            xpath: Some("//*[@id=\"message\"]".to_string()),
            iframe_xpath: None,
            text: "Saved".to_string(),
            match_mode: workflow_automation_manager_lib::domain::AssertTextMatchMode::Contains,
            timeout_ms: Some(3000),
        },
        ActionConfig::IfCondition {
            condition: workflow_automation_manager_lib::domain::WorkflowCondition::OutputEquals {
                name: "status".to_string(),
                value: "ready".to_string(),
            },
            then_steps: vec![nested_step.clone()],
            else_steps: vec![],
        },
        ActionConfig::RepeatTimes {
            times: 2,
            steps: vec![nested_step.clone()],
        },
        ActionConfig::RepeatForEach {
            item_name: "item".to_string(),
            items: vec!["one".to_string(), "two".to_string()],
            steps: vec![nested_step.clone()],
        },
        ActionConfig::RetryBlock {
            max_attempts: 3,
            delay_ms: Some(100),
            steps: vec![nested_step.clone()],
        },
        ActionConfig::StopWorkflow {
            status: workflow_automation_manager_lib::domain::StopWorkflowStatus::Success,
            reason: Some("done".to_string()),
        },
    ];

    for config in configs {
        config.validate().expect("config should be valid");
        let json = serde_json::to_string(&config).expect("serialize config");
        let decoded: ActionConfig = serde_json::from_str(&json).expect("deserialize config");

        assert_eq!(decoded, config);
    }
}

#[test]
fn phase_five_logic_configs_validate_required_fields() {
    assert_validation_message(
        ActionConfig::SetVariable {
            name: String::new(),
            value: "Ada".to_string(),
        }
        .validate()
        .expect_err("blank variable name should fail"),
        "name",
        "Variable name is required",
    );

    assert_validation_message(
        ActionConfig::AssertText {
            xpath: None,
            iframe_xpath: None,
            text: String::new(),
            match_mode: workflow_automation_manager_lib::domain::AssertTextMatchMode::Contains,
            timeout_ms: Some(3000),
        }
        .validate()
        .expect_err("blank assert text should fail"),
        "text",
        "Expected text is required",
    );

    assert_validation_message(
        ActionConfig::AssertElement {
            xpath: String::new(),
            iframe_xpath: None,
            state: workflow_automation_manager_lib::domain::AssertElementState::Visible,
            timeout_ms: Some(3000),
        }
        .validate()
        .expect_err("blank assert element xpath should fail"),
        "xpath",
        "XPath is required",
    );

    assert_validation_message(
        ActionConfig::RepeatTimes {
            times: 0,
            steps: vec![],
        }
        .validate()
        .expect_err("zero repeat count should fail"),
        "times",
        "Repeat count must be greater than 0",
    );

    assert_validation_message(
        ActionConfig::RetryBlock {
            max_attempts: 0,
            delay_ms: Some(100),
            steps: vec![],
        }
        .validate()
        .expect_err("zero retry attempts should fail"),
        "max_attempts",
        "Max attempts must be greater than 0",
    );
}

#[test]
fn phase_six_session_profile_secret_configs_validate_and_round_trip() {
    let configs = [
        ActionConfig::UseProfile {
            name: "account-a".to_string(),
        },
        ActionConfig::SaveSession {
            path: "/tmp/session.json".to_string(),
        },
        ActionConfig::LoadSession {
            path: "/tmp/session.json".to_string(),
        },
        ActionConfig::SetCookie {
            name: "token".to_string(),
            value: "abc".to_string(),
            domain: None,
            path: Some("/".to_string()),
        },
        ActionConfig::ClearCookies { domain: None },
        ActionConfig::SetSecret {
            name: "password".to_string(),
            value: "secret".to_string(),
        },
    ];

    for config in configs {
        config.validate().expect("config should be valid");
        let json = serde_json::to_string(&config).expect("serialize config");
        let decoded: ActionConfig = serde_json::from_str(&json).expect("deserialize config");

        assert_eq!(decoded, config);
    }
}

#[test]
fn phase_six_session_profile_secret_configs_validate_required_fields() {
    assert_validation_message(
        ActionConfig::UseProfile {
            name: String::new(),
        }
        .validate()
        .expect_err("blank profile should fail"),
        "name",
        "Profile name is required",
    );

    assert_validation_message(
        ActionConfig::SaveSession {
            path: String::new(),
        }
        .validate()
        .expect_err("blank save session path should fail"),
        "path",
        "Session path is required",
    );

    assert_validation_message(
        ActionConfig::SetCookie {
            name: String::new(),
            value: "abc".to_string(),
            domain: None,
            path: None,
        }
        .validate()
        .expect_err("blank cookie name should fail"),
        "name",
        "Cookie name is required",
    );

    assert_validation_message(
        ActionConfig::SetSecret {
            name: "password".to_string(),
            value: String::new(),
        }
        .validate()
        .expect_err("blank secret value should fail"),
        "value",
        "Secret value is required",
    );
}

#[test]
fn phase_seven_network_device_configs_validate_and_round_trip() {
    let configs = [
        ActionConfig::UseProxy {
            server: "http://127.0.0.1:8080".to_string(),
            username: Some("agent".to_string()),
            password: Some("secret".to_string()),
        },
        ActionConfig::SetUserAgent {
            user_agent: "WAMPhaseSeven/1.0".to_string(),
        },
        ActionConfig::SetViewport {
            width: 390,
            height: 844,
            device_scale_factor: Some(2.0),
            mobile: true,
            touch: true,
        },
        ActionConfig::SetGeolocation {
            latitude: 10.77,
            longitude: 106.70,
            accuracy: Some(15.0),
        },
        ActionConfig::SetExtraHeaders {
            headers: vec![HeaderPair {
                name: "X-WAM-Phase".to_string(),
                value: "seven".to_string(),
            }],
        },
        ActionConfig::GrantPermission {
            origin: Some("http://127.0.0.1:3000".to_string()),
            permissions: vec!["geolocation".to_string()],
        },
    ];

    for config in configs {
        config.validate().expect("config should be valid");
        let json = serde_json::to_string(&config).expect("serialize config");
        let decoded: ActionConfig = serde_json::from_str(&json).expect("deserialize config");

        assert_eq!(decoded, config);
    }
}

#[test]
fn phase_seven_network_device_configs_validate_required_fields() {
    assert_validation_message(
        ActionConfig::UseProxy {
            server: String::new(),
            username: None,
            password: None,
        }
        .validate()
        .expect_err("blank proxy server should fail"),
        "server",
        "Proxy server is required",
    );

    assert_validation_message(
        ActionConfig::SetUserAgent {
            user_agent: String::new(),
        }
        .validate()
        .expect_err("blank user agent should fail"),
        "user_agent",
        "User agent is required",
    );

    assert_validation_message(
        ActionConfig::SetViewport {
            width: 0,
            height: 844,
            device_scale_factor: Some(1.0),
            mobile: false,
            touch: false,
        }
        .validate()
        .expect_err("zero viewport width should fail"),
        "width",
        "Viewport width must be greater than 0",
    );

    assert_validation_message(
        ActionConfig::SetGeolocation {
            latitude: 91.0,
            longitude: 106.70,
            accuracy: Some(15.0),
        }
        .validate()
        .expect_err("invalid latitude should fail"),
        "latitude",
        "Latitude must be between -90 and 90",
    );

    assert_validation_message(
        ActionConfig::SetExtraHeaders { headers: vec![] }
            .validate()
            .expect_err("empty headers should fail"),
        "headers",
        "At least one header is required",
    );

    assert_validation_message(
        ActionConfig::GrantPermission {
            origin: None,
            permissions: vec![],
        }
        .validate()
        .expect_err("empty permissions should fail"),
        "permissions",
        "At least one permission is required",
    );
}

#[test]
fn user_action_taxonomy_configs_validate_required_fields() {
    assert_validation_message(
        ActionConfig::Navigate {
            url: " ".to_string(),
            wait_until: None,
            timeout_ms: None,
        }
        .validate()
        .expect_err("blank URL should fail"),
        "url",
        "URL is required",
    );

    assert_validation_message(
        ActionConfig::Wait {
            condition: WaitCondition::Duration,
            xpath: None,
            text: None,
            url: None,
            duration_ms: Some(0),
            timeout_ms: None,
        }
        .validate()
        .expect_err("zero duration should fail"),
        "duration_ms",
        "Duration must be greater than 0",
    );

    assert_validation_message(
        ActionConfig::Wait {
            condition: WaitCondition::ElementVisible,
            xpath: None,
            text: None,
            url: None,
            duration_ms: None,
            timeout_ms: None,
        }
        .validate()
        .expect_err("element wait without XPath should fail"),
        "xpath",
        "XPath is required",
    );

    assert_validation_message(
        ActionConfig::SelectOption {
            xpath: "//*[@name=\"country\"]".to_string(),
            iframe_xpath: None,
            match_by: SelectOptionMatchBy::Label,
            value: " ".to_string(),
            wait_until: None,
            timeout_ms: None,
        }
        .validate()
        .expect_err("blank select option value should fail"),
        "value",
        "Option value is required",
    );

    assert_validation_message(
        ActionConfig::Hotkey { keys: vec![] }
            .validate()
            .expect_err("empty hotkey should fail"),
        "keys",
        "At least one key is required",
    );
}

#[test]
fn new_action_types_have_default_configs() {
    assert_eq!(
        default_config(ActionType::Navigate),
        ActionConfig::Navigate {
            url: String::new(),
            wait_until: None,
            timeout_ms: None,
        }
    );
    assert_eq!(
        default_config(ActionType::Wait),
        ActionConfig::Wait {
            condition: WaitCondition::Duration,
            xpath: None,
            text: None,
            url: None,
            duration_ms: Some(1000),
            timeout_ms: None,
        }
    );
    assert_eq!(
        default_config(ActionType::SetCheckbox).action_type(),
        ActionType::SetCheckbox
    );
    assert_eq!(
        default_config(ActionType::Hotkey).action_type(),
        ActionType::Hotkey
    );
}

#[test]
fn phase_one_human_interaction_configs_validate_and_round_trip() {
    let configs = [
        ActionConfig::DoubleClick {
            xpath: "//*[@id=\"item\"]".to_string(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: Some(3000),
        },
        ActionConfig::RightClick {
            xpath: "//*[@id=\"menu-target\"]".to_string(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: Some(3000),
        },
        ActionConfig::DragAndDrop {
            source_xpath: "//*[@id=\"source\"]".to_string(),
            target_xpath: "//*[@id=\"target\"]".to_string(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: Some(3000),
        },
        ActionConfig::FocusElement {
            xpath: "//*[@name=\"email\"]".to_string(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: Some(3000),
        },
        ActionConfig::BlurElement {
            xpath: "//*[@name=\"email\"]".to_string(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: Some(3000),
        },
        ActionConfig::TypeSequence {
            xpath: "//*[@name=\"search\"]".to_string(),
            iframe_xpath: None,
            text: "abc".to_string(),
            delay_ms: Some(5),
            wait_until: None,
            timeout_ms: Some(3000),
        },
        ActionConfig::SetClipboard {
            text: "paste me".to_string(),
        },
        ActionConfig::PasteClipboard {
            xpath: "//*[@name=\"notes\"]".to_string(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: Some(3000),
        },
        ActionConfig::Check {
            xpath: "//*[@name=\"terms\"]".to_string(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: Some(3000),
        },
        ActionConfig::Uncheck {
            xpath: "//*[@name=\"terms\"]".to_string(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: Some(3000),
        },
        ActionConfig::ToggleCheckbox {
            xpath: "//*[@name=\"terms\"]".to_string(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: Some(3000),
        },
        ActionConfig::SelectRadio {
            xpath: "//*[@value=\"email\"]".to_string(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: Some(3000),
        },
    ];

    for config in configs {
        config.validate().expect("phase one config should be valid");
        let json = serde_json::to_string(&config).expect("serialize config");
        let decoded: ActionConfig = serde_json::from_str(&json).expect("deserialize config");

        assert_eq!(decoded, config);
    }
}

#[test]
fn phase_one_human_interaction_configs_validate_required_fields() {
    assert_validation_message(
        ActionConfig::DoubleClick {
            xpath: String::new(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: None,
        }
        .validate()
        .expect_err("double click requires xpath"),
        "xpath",
        "XPath is required",
    );

    assert_validation_message(
        ActionConfig::DragAndDrop {
            source_xpath: String::new(),
            target_xpath: "//*[@id=\"target\"]".to_string(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: None,
        }
        .validate()
        .expect_err("drag and drop requires source xpath"),
        "source_xpath",
        "Source XPath is required",
    );

    assert_validation_message(
        ActionConfig::DragAndDrop {
            source_xpath: "//*[@id=\"source\"]".to_string(),
            target_xpath: String::new(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: None,
        }
        .validate()
        .expect_err("drag and drop requires target xpath"),
        "target_xpath",
        "Target XPath is required",
    );

    assert_validation_message(
        ActionConfig::TypeSequence {
            xpath: "//*[@name=\"search\"]".to_string(),
            iframe_xpath: None,
            text: String::new(),
            delay_ms: None,
            wait_until: None,
            timeout_ms: None,
        }
        .validate()
        .expect_err("type sequence requires text"),
        "text",
        "Text is required",
    );

    assert_validation_message(
        ActionConfig::SetClipboard {
            text: String::new(),
        }
        .validate()
        .expect_err("set clipboard requires text"),
        "text",
        "Text is required",
    );
}

#[test]
fn phase_one_action_types_have_default_configs() {
    assert_eq!(
        default_config(ActionType::DoubleClick).action_type(),
        ActionType::DoubleClick
    );
    assert_eq!(
        default_config(ActionType::RightClick).action_type(),
        ActionType::RightClick
    );
    assert_eq!(
        default_config(ActionType::DragAndDrop).action_type(),
        ActionType::DragAndDrop
    );
    assert_eq!(
        default_config(ActionType::FocusElement).action_type(),
        ActionType::FocusElement
    );
    assert_eq!(
        default_config(ActionType::BlurElement).action_type(),
        ActionType::BlurElement
    );
    assert_eq!(
        default_config(ActionType::TypeSequence).action_type(),
        ActionType::TypeSequence
    );
    assert_eq!(
        default_config(ActionType::SetClipboard).action_type(),
        ActionType::SetClipboard
    );
    assert_eq!(
        default_config(ActionType::PasteClipboard).action_type(),
        ActionType::PasteClipboard
    );
    assert_eq!(
        default_config(ActionType::Check).action_type(),
        ActionType::Check
    );
    assert_eq!(
        default_config(ActionType::Uncheck).action_type(),
        ActionType::Uncheck
    );
    assert_eq!(
        default_config(ActionType::ToggleCheckbox).action_type(),
        ActionType::ToggleCheckbox
    );
    assert_eq!(
        default_config(ActionType::SelectRadio).action_type(),
        ActionType::SelectRadio
    );
}

#[test]
fn phase_two_form_and_file_configs_validate_and_round_trip() {
    let configs = [
        ActionConfig::UploadFile {
            xpath: "//*[@id=\"file\"]".to_string(),
            iframe_xpath: None,
            files: vec!["/tmp/example.txt".to_string()],
            wait_until: None,
            timeout_ms: Some(3000),
        },
        ActionConfig::SubmitForm {
            xpath: Some("//*[@id=\"login-form\"]".to_string()),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: Some(3000),
        },
        ActionConfig::SelectCustomOption {
            trigger_xpath: "//*[@role=\"combobox\"]".to_string(),
            option_text: "Vietnam".to_string(),
            iframe_xpath: None,
            timeout_ms: Some(3000),
        },
        ActionConfig::SetContenteditable {
            xpath: "//*[@contenteditable=\"true\"]".to_string(),
            iframe_xpath: None,
            text: "Hello editor".to_string(),
            clear_before_input: true,
            wait_until: None,
            timeout_ms: Some(3000),
        },
    ];

    for config in configs {
        config.validate().expect("phase two config should be valid");
        let json = serde_json::to_string(&config).expect("serialize config");
        let decoded: ActionConfig = serde_json::from_str(&json).expect("deserialize config");

        assert_eq!(decoded, config);
    }
}

#[test]
fn phase_two_form_and_file_configs_validate_required_fields() {
    assert_validation_message(
        ActionConfig::UploadFile {
            xpath: String::new(),
            iframe_xpath: None,
            files: vec!["/tmp/example.txt".to_string()],
            wait_until: None,
            timeout_ms: None,
        }
        .validate()
        .expect_err("upload requires xpath"),
        "xpath",
        "XPath is required",
    );

    assert_validation_message(
        ActionConfig::UploadFile {
            xpath: "//*[@id=\"file\"]".to_string(),
            iframe_xpath: None,
            files: vec![],
            wait_until: None,
            timeout_ms: None,
        }
        .validate()
        .expect_err("upload requires files"),
        "files",
        "At least one file is required",
    );

    assert_validation_message(
        ActionConfig::SelectCustomOption {
            trigger_xpath: String::new(),
            option_text: "Vietnam".to_string(),
            iframe_xpath: None,
            timeout_ms: None,
        }
        .validate()
        .expect_err("custom select requires trigger xpath"),
        "trigger_xpath",
        "Trigger XPath is required",
    );

    assert_validation_message(
        ActionConfig::SetContenteditable {
            xpath: "//*[@contenteditable=\"true\"]".to_string(),
            iframe_xpath: None,
            text: String::new(),
            clear_before_input: true,
            wait_until: None,
            timeout_ms: None,
        }
        .validate()
        .expect_err("contenteditable requires text"),
        "text",
        "Text is required",
    );
}

#[test]
fn phase_two_action_types_have_default_configs() {
    assert_eq!(
        default_config(ActionType::UploadFile).action_type(),
        ActionType::UploadFile
    );
    assert_eq!(
        default_config(ActionType::SubmitForm).action_type(),
        ActionType::SubmitForm
    );
    assert_eq!(
        default_config(ActionType::SelectCustomOption).action_type(),
        ActionType::SelectCustomOption
    );
    assert_eq!(
        default_config(ActionType::SetContenteditable).action_type(),
        ActionType::SetContenteditable
    );
}

#[test]
fn scroll_config_supports_advanced_modes_and_backwards_compatibility() {
    let legacy_json = r#"{"type":"scroll","config":{"direction":"down","pixels":300}}"#;
    let legacy: ActionConfig = serde_json::from_str(legacy_json).expect("legacy scroll");

    assert_eq!(
        legacy,
        ActionConfig::Scroll {
            mode: None,
            direction: ScrollDirection::Down,
            pixels: 300,
            xpath: None,
            iframe_xpath: None,
            behavior: None,
            block: None,
            inline: None,
            max_attempts: None,
            wait_ms: None,
        }
    );

    let advanced = ActionConfig::Scroll {
        mode: Some(ScrollMode::UntilVisible),
        direction: ScrollDirection::Right,
        pixels: 250,
        xpath: Some("//*[@id=\"target\"]".to_string()),
        iframe_xpath: Some("//*[@id=\"frame\"]".to_string()),
        behavior: Some(ScrollBehavior::Instant),
        block: Some(ScrollBlock::Center),
        inline: Some(ScrollInline::Nearest),
        max_attempts: Some(8),
        wait_ms: Some(150),
    };

    advanced.validate().expect("advanced scroll is valid");
    let json = serde_json::to_string(&advanced).expect("serialize advanced scroll");
    assert!(json.contains("\"mode\":\"until_visible\""));
    assert!(json.contains("\"direction\":\"right\""));
    assert!(json.contains("\"iframe_xpath\""));
}

#[test]
fn click_config_supports_real_user_options_and_backwards_compatibility() {
    let legacy_json = r#"{"type":"click","config":{"xpath":"//*[@id=\"submit\"]"}}"#;
    let legacy: ActionConfig = serde_json::from_str(legacy_json).expect("legacy click");

    assert_eq!(
        legacy,
        ActionConfig::Click {
            xpath: "//*[@id=\"submit\"]".to_string(),
            iframe_xpath: None,
            mode: None,
            button: None,
            click_count: None,
            scroll_into_view: None,
            block: None,
            inline: None,
            position: None,
            offset_x: None,
            offset_y: None,
            wait_until: None,
            timeout_ms: None,
            retry_interval_ms: None,
            post_click_wait_ms: None,
        }
    );

    let advanced = ActionConfig::Click {
        xpath: "//*[@id=\"submit\"]".to_string(),
        iframe_xpath: Some("//*[@id=\"frame\"]".to_string()),
        mode: Some(ClickMode::Real),
        button: Some(ClickButton::Left),
        click_count: Some(2),
        scroll_into_view: Some(true),
        block: Some(ScrollBlock::Center),
        inline: Some(ScrollInline::Nearest),
        position: Some(ClickPosition::Offset),
        offset_x: Some(12.0),
        offset_y: Some(8.0),
        wait_until: Some(ClickWaitUntil::Clickable),
        timeout_ms: Some(5000),
        retry_interval_ms: Some(100),
        post_click_wait_ms: Some(50),
    };

    advanced.validate().expect("advanced click is valid");
    let json = serde_json::to_string(&advanced).expect("serialize advanced click");
    assert!(json.contains("\"mode\":\"real\""));
    assert!(json.contains("\"click_count\":2"));
    assert!(json.contains("\"iframe_xpath\""));
}

#[test]
fn click_config_validates_real_user_options() {
    assert_validation_message(
        ActionConfig::Click {
            xpath: "//*[@id=\"submit\"]".to_string(),
            iframe_xpath: None,
            mode: None,
            button: None,
            click_count: Some(0),
            scroll_into_view: None,
            block: None,
            inline: None,
            position: None,
            offset_x: None,
            offset_y: None,
            wait_until: None,
            timeout_ms: None,
            retry_interval_ms: None,
            post_click_wait_ms: None,
        }
        .validate()
        .expect_err("zero click count should fail"),
        "click_count",
        "Click count must be greater than 0",
    );

    assert_validation_message(
        ActionConfig::Click {
            xpath: "//*[@id=\"submit\"]".to_string(),
            iframe_xpath: None,
            mode: Some(ClickMode::ForceDom),
            button: Some(ClickButton::Right),
            click_count: None,
            scroll_into_view: None,
            block: None,
            inline: None,
            position: None,
            offset_x: None,
            offset_y: None,
            wait_until: None,
            timeout_ms: None,
            retry_interval_ms: None,
            post_click_wait_ms: None,
        }
        .validate()
        .expect_err("force DOM cannot right click"),
        "button",
        "Force DOM click only supports the left button",
    );
}

#[test]
fn scroll_modes_validate_required_xpath_and_attempts() {
    assert_validation_message(
        ActionConfig::Scroll {
            mode: Some(ScrollMode::IntoView),
            direction: ScrollDirection::Down,
            pixels: 300,
            xpath: None,
            iframe_xpath: None,
            behavior: None,
            block: None,
            inline: None,
            max_attempts: None,
            wait_ms: None,
        }
        .validate()
        .expect_err("into view requires xpath"),
        "xpath",
        "XPath is required",
    );

    assert_validation_message(
        ActionConfig::Scroll {
            mode: Some(ScrollMode::UntilVisible),
            direction: ScrollDirection::Down,
            pixels: 300,
            xpath: Some("//*[@id=\"target\"]".to_string()),
            iframe_xpath: None,
            behavior: None,
            block: None,
            inline: None,
            max_attempts: Some(0),
            wait_ms: None,
        }
        .validate()
        .expect_err("until visible requires attempts"),
        "max_attempts",
        "Max attempts must be greater than 0",
    );
}

#[test]
fn workflow_step_uses_action_type_from_config() {
    let step = WorkflowStep::new(
        "workflow-1",
        0,
        ActionConfig::Click {
            xpath: "//*[@id=\"submit\"]".to_string(),
            iframe_xpath: None,
            mode: None,
            button: None,
            click_count: None,
            scroll_into_view: None,
            block: None,
            inline: None,
            position: None,
            offset_x: None,
            offset_y: None,
            wait_until: None,
            timeout_ms: None,
            retry_interval_ms: None,
            post_click_wait_ms: None,
        },
    );

    assert_eq!(step.action_type().as_str(), "click");
    step.validate().expect("step should be valid");
}

#[test]
fn run_status_and_error_are_frontend_safe() {
    let status_json = serde_json::to_string(&RunStatus::Failed).expect("serialize status");
    assert_eq!(status_json, "\"failed\"");

    let error = RunError::new(4, "click", "XPath not found");
    let error_json = serde_json::to_string(&error).expect("serialize run error");

    assert!(error_json.contains("\"step_number\":4"));
    assert!(error_json.contains("\"action_type\":\"click\""));
    assert!(error_json.contains("\"reason\":\"XPath not found\""));
}
