use workflow_automation_manager_lib::domain::{
    ActionConfig, RunError, RunStatus, ScrollDirection, ValidationError, Workflow, WorkflowStep,
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
        }
        .validate()
        .expect_err("blank XPath should fail"),
        "xpath",
        "XPath is required",
    );

    assert_validation_message(
        ActionConfig::Scroll {
            direction: ScrollDirection::Down,
            pixels: 0,
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
        },
        ActionConfig::Scroll {
            direction: ScrollDirection::Down,
            pixels: 500,
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
        },
        ActionConfig::Scroll {
            direction: ScrollDirection::Up,
            pixels: 300,
        },
    ];

    for config in configs {
        let json = serde_json::to_string(&config).expect("serialize config");
        let decoded: ActionConfig = serde_json::from_str(&json).expect("deserialize config");

        assert_eq!(decoded, config);
    }
}

#[test]
fn workflow_step_uses_action_type_from_config() {
    let step = WorkflowStep::new(
        "workflow-1",
        0,
        ActionConfig::Click {
            xpath: "//*[@id=\"submit\"]".to_string(),
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
