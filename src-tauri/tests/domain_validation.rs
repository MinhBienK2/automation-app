use workflow_automation_manager_lib::domain::{
    ActionConfig, ClickButton, ClickMode, ClickPosition, ClickWaitUntil, RunError, RunStatus,
    ScrollBehavior, ScrollBlock, ScrollDirection, ScrollInline, ScrollMode, ValidationError,
    Workflow, WorkflowStep,
};

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
