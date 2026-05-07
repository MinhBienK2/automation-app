use crate::{
    app_state::{AppState, RunStateDto},
    commands::CommandError,
    domain::{
        ActionConfig, ActionType, CheckboxState, ClearInputMethod, HeaderPair, InputTypingMode,
        RunError, RunMode, RunStatus, ScrollDirection, SelectOptionMatchBy, VariableAssignment,
        VariableValueType, WaitCondition, WorkflowBrowserConfig, WorkflowStep,
    },
    runner::{RunExecution, RunnerError, RunnerProgress, RunnerStatus},
};
use std::time::Duration;

pub fn default_config(action_type: ActionType) -> ActionConfig {
    match action_type {
        ActionType::Navigate => ActionConfig::Navigate {
            url: String::new(),
            wait_until: None,
            timeout_ms: None,
        },
        ActionType::Wait => ActionConfig::Wait {
            condition: WaitCondition::Duration,
            xpath: None,
            text: None,
            url: None,
            duration_ms: Some(1000),
            timeout_ms: None,
        },
        ActionType::RandomWait => ActionConfig::RandomWait {
            min_ms: 500,
            max_ms: 1500,
        },
        ActionType::InputText => ActionConfig::InputText {
            xpath: String::new(),
            iframe_xpath: None,
            text: String::new(),
            clear_before_input: true,
            typing_mode: Some(InputTypingMode::SetValue),
            delay_ms: None,
            wait_until: None,
            timeout_ms: None,
        },
        ActionType::ClearInput => ActionConfig::ClearInput {
            xpath: String::new(),
            iframe_xpath: None,
            method: Some(ClearInputMethod::SelectAll),
            wait_until: None,
            timeout_ms: None,
        },
        ActionType::Click => ActionConfig::Click {
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
        },
        ActionType::Scroll => ActionConfig::Scroll {
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
        ActionType::SelectOption => ActionConfig::SelectOption {
            xpath: String::new(),
            iframe_xpath: None,
            match_by: SelectOptionMatchBy::Label,
            value: String::new(),
            wait_until: None,
            timeout_ms: None,
        },
        ActionType::SetCheckbox => ActionConfig::SetCheckbox {
            xpath: String::new(),
            iframe_xpath: None,
            state: CheckboxState::Checked,
            wait_until: None,
            timeout_ms: None,
        },
        ActionType::PressKey => ActionConfig::PressKey {
            key: "Enter".to_string(),
        },
        ActionType::Hotkey => ActionConfig::Hotkey {
            keys: vec!["Control".to_string(), "S".to_string()],
        },
        ActionType::Hover => ActionConfig::Hover {
            xpath: String::new(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: None,
        },
        ActionType::DoubleClick => ActionConfig::DoubleClick {
            xpath: String::new(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: None,
        },
        ActionType::RightClick => ActionConfig::RightClick {
            xpath: String::new(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: None,
        },
        ActionType::DragAndDrop => ActionConfig::DragAndDrop {
            source_xpath: String::new(),
            target_xpath: String::new(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: None,
        },
        ActionType::FocusElement => ActionConfig::FocusElement {
            xpath: String::new(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: None,
        },
        ActionType::BlurElement => ActionConfig::BlurElement {
            xpath: String::new(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: None,
        },
        ActionType::TypeSequence => ActionConfig::TypeSequence {
            xpath: String::new(),
            iframe_xpath: None,
            text: String::new(),
            delay_ms: None,
            wait_until: None,
            timeout_ms: None,
        },
        ActionType::SetClipboard => ActionConfig::SetClipboard {
            text: String::new(),
        },
        ActionType::PasteClipboard => ActionConfig::PasteClipboard {
            xpath: String::new(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: None,
        },
        ActionType::Check => ActionConfig::Check {
            xpath: String::new(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: None,
        },
        ActionType::Uncheck => ActionConfig::Uncheck {
            xpath: String::new(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: None,
        },
        ActionType::ToggleCheckbox => ActionConfig::ToggleCheckbox {
            xpath: String::new(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: None,
        },
        ActionType::SelectRadio => ActionConfig::SelectRadio {
            xpath: String::new(),
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: None,
        },
        ActionType::UploadFile => ActionConfig::UploadFile {
            xpath: String::new(),
            iframe_xpath: None,
            files: Vec::new(),
            wait_until: None,
            timeout_ms: None,
        },
        ActionType::SubmitForm => ActionConfig::SubmitForm {
            xpath: None,
            iframe_xpath: None,
            wait_until: None,
            timeout_ms: None,
        },
        ActionType::SelectCustomOption => ActionConfig::SelectCustomOption {
            trigger_xpath: String::new(),
            option_text: String::new(),
            iframe_xpath: None,
            timeout_ms: None,
        },
        ActionType::SetContenteditable => ActionConfig::SetContenteditable {
            xpath: String::new(),
            iframe_xpath: None,
            text: String::new(),
            clear_before_input: true,
            wait_until: None,
            timeout_ms: None,
        },
        ActionType::ExtractText => ActionConfig::ExtractText {
            xpath: String::new(),
            iframe_xpath: None,
            output_name: "text".to_string(),
            timeout_ms: None,
        },
        ActionType::ExtractAttribute => ActionConfig::ExtractAttribute {
            xpath: String::new(),
            iframe_xpath: None,
            attribute: String::new(),
            output_name: "attribute".to_string(),
            timeout_ms: None,
        },
        ActionType::ExtractInputValue => ActionConfig::ExtractInputValue {
            xpath: String::new(),
            iframe_xpath: None,
            output_name: "input_value".to_string(),
            timeout_ms: None,
        },
        ActionType::ExtractTable => ActionConfig::ExtractTable {
            xpath: String::new(),
            iframe_xpath: None,
            output_name: "table".to_string(),
            timeout_ms: None,
        },
        ActionType::ExtractList => ActionConfig::ExtractList {
            xpath: String::new(),
            iframe_xpath: None,
            output_name: "list".to_string(),
            timeout_ms: None,
        },
        ActionType::TakeScreenshot => ActionConfig::TakeScreenshot {
            path: String::new(),
            output_name: Some("screenshot_path".to_string()),
            full_page: false,
        },
        ActionType::GoBack => ActionConfig::GoBack {},
        ActionType::GoForward => ActionConfig::GoForward {},
        ActionType::Reload => ActionConfig::Reload {},
        ActionType::OpenNewTab => ActionConfig::OpenNewTab { url: None },
        ActionType::SwitchTab => ActionConfig::SwitchTab { index: 0 },
        ActionType::CloseTab => ActionConfig::CloseTab { index: None },
        ActionType::SwitchFrame => ActionConfig::SwitchFrame { xpath: None },
        ActionType::AcceptDialog => ActionConfig::AcceptDialog { prompt_text: None },
        ActionType::DismissDialog => ActionConfig::DismissDialog {},
        ActionType::SetDownloadDirectory => ActionConfig::SetDownloadDirectory {
            path: String::new(),
        },
        ActionType::WaitForDownload => ActionConfig::WaitForDownload {
            output_name: "download_path".to_string(),
            timeout_ms: None,
        },
        ActionType::SetVariable => ActionConfig::SetVariable {
            name: None,
            value: None,
            value_type: None,
            variables: vec![VariableAssignment {
                name: "name".to_string(),
                value: String::new(),
                value_type: VariableValueType::Text,
            }],
        },
        ActionType::SetJsonVariables => ActionConfig::SetJsonVariables {
            json: "{\n  \"name\": \"value\"\n}".to_string(),
        },
        ActionType::AssertElement => ActionConfig::AssertElement {
            xpath: String::new(),
            iframe_xpath: None,
            state: crate::domain::AssertElementState::Visible,
            timeout_ms: None,
        },
        ActionType::AssertText => ActionConfig::AssertText {
            xpath: None,
            iframe_xpath: None,
            text: String::new(),
            match_mode: crate::domain::AssertTextMatchMode::Contains,
            timeout_ms: None,
        },
        ActionType::IfCondition => ActionConfig::IfCondition {
            condition: crate::domain::WorkflowCondition::OutputEquals {
                name: "name".to_string(),
                value: String::new(),
            },
            then_steps: Vec::new(),
            else_steps: Vec::new(),
        },
        ActionType::RepeatTimes => ActionConfig::RepeatTimes {
            times: 1,
            steps: Vec::new(),
        },
        ActionType::RepeatForEach => ActionConfig::RepeatForEach {
            item_name: "item".to_string(),
            array_variable: None,
            items: vec!["item".to_string()],
            steps: Vec::new(),
        },
        ActionType::RetryBlock => ActionConfig::RetryBlock {
            max_attempts: 3,
            delay_ms: None,
            steps: Vec::new(),
            failed_steps: Vec::new(),
        },
        ActionType::SwitchCondition => ActionConfig::SwitchCondition {
            expression: "name".to_string(),
            cases: Vec::new(),
            default_steps: Vec::new(),
        },
        ActionType::WhileLoop => ActionConfig::WhileLoop {
            condition: crate::domain::WorkflowCondition::OutputEquals {
                name: "name".to_string(),
                value: "true".to_string(),
            },
            max_attempts: Some(1),
            timeout_ms: None,
            steps: Vec::new(),
        },
        ActionType::RepeatUntil => ActionConfig::RepeatUntil {
            condition: crate::domain::WorkflowCondition::OutputEquals {
                name: "name".to_string(),
                value: "true".to_string(),
            },
            max_attempts: Some(1),
            timeout_ms: None,
            steps: Vec::new(),
            timeout_steps: Vec::new(),
        },
        ActionType::TryCatch => ActionConfig::TryCatch {
            try_steps: Vec::new(),
            success_steps: Vec::new(),
            error_steps: Vec::new(),
            finally_steps: Vec::new(),
        },
        ActionType::FallbackBlock => ActionConfig::FallbackBlock {
            primary_steps: Vec::new(),
            fallback_steps: Vec::new(),
        },
        ActionType::BreakLoop => ActionConfig::BreakLoop {},
        ActionType::ContinueLoop => ActionConfig::ContinueLoop {},
        ActionType::TransformVariable => ActionConfig::TransformVariable {
            source_name: "input".to_string(),
            target_name: "output".to_string(),
            expression: String::new(),
        },
        ActionType::AssertOutput => ActionConfig::AssertOutput {
            name: "output".to_string(),
            match_mode: crate::domain::AssertOutputMatchMode::Equals,
            value: String::new(),
        },
        ActionType::RunSubworkflow => ActionConfig::RunSubworkflow {
            workflow_id: String::new(),
            input_mapping: Vec::new(),
            output_mapping: Vec::new(),
        },
        ActionType::DomainAllowlist => ActionConfig::DomainAllowlist {
            domains: Vec::new(),
        },
        ActionType::StopWorkflow => ActionConfig::StopWorkflow {
            status: crate::domain::StopWorkflowStatus::Success,
            reason: None,
            close_browser: false,
        },
        ActionType::UseProfile => ActionConfig::UseProfile {
            name: "default".to_string(),
        },
        ActionType::SaveSession => ActionConfig::SaveSession {
            path: String::new(),
        },
        ActionType::LoadSession => ActionConfig::LoadSession {
            path: String::new(),
        },
        ActionType::SetCookie => ActionConfig::SetCookie {
            name: String::new(),
            value: String::new(),
            domain: None,
            path: Some("/".to_string()),
        },
        ActionType::ClearCookies => ActionConfig::ClearCookies { domain: None },
        ActionType::SetSecret => ActionConfig::SetSecret {
            name: "secret".to_string(),
            value: String::new(),
        },
        ActionType::UseProxy => ActionConfig::UseProxy {
            server: String::new(),
            username: None,
            password: None,
        },
        ActionType::SetUserAgent => ActionConfig::SetUserAgent {
            user_agent: String::new(),
        },
        ActionType::SetViewport => ActionConfig::SetViewport {
            width: 1280,
            height: 720,
            device_scale_factor: Some(1.0),
            mobile: false,
            touch: false,
        },
        ActionType::SetGeolocation => ActionConfig::SetGeolocation {
            latitude: 0.0,
            longitude: 0.0,
            accuracy: Some(100.0),
        },
        ActionType::SetExtraHeaders => ActionConfig::SetExtraHeaders {
            headers: vec![HeaderPair {
                name: "X-WAM-Header".to_string(),
                value: "value".to_string(),
            }],
        },
        ActionType::GrantPermission => ActionConfig::GrantPermission {
            origin: None,
            permissions: vec!["geolocation".to_string()],
        },
        ActionType::DetectChallenge => ActionConfig::DetectChallenge {
            output_name: "challenge_found".to_string(),
            patterns: vec![
                "captcha".to_string(),
                "verify you are human".to_string(),
                "challenge".to_string(),
            ],
            timeout_ms: Some(1000),
        },
        ActionType::PauseForHuman => ActionConfig::PauseForHuman {
            reason: "Human verification required".to_string(),
            timeout_ms: None,
        },
        ActionType::ResumeWhenCondition => ActionConfig::ResumeWhenCondition {
            condition: crate::domain::WorkflowCondition::TextVisible {
                text: "Welcome".to_string(),
            },
            timeout_ms: Some(60_000),
        },
        ActionType::FallbackSelector => ActionConfig::FallbackSelector {
            output_name: "target_xpath".to_string(),
            xpaths: vec!["//*[@id='target']".to_string()],
            timeout_ms: Some(1000),
        },
        ActionType::RetryStep => ActionConfig::RetryStep {
            max_attempts: 3,
            delay_ms: Some(100),
            step: Box::new(ActionConfig::Wait {
                condition: WaitCondition::Duration,
                xpath: None,
                text: None,
                url: None,
                duration_ms: Some(100),
                timeout_ms: None,
            }),
        },
        ActionType::Checkpoint => ActionConfig::Checkpoint {
            name: "checkpoint".to_string(),
            screenshot_path: None,
        },
        ActionType::ExecuteJs => ActionConfig::ExecuteJs {
            script: "return document.title;".to_string(),
            output_name: Some("js_result".to_string()),
            timeout_ms: Some(1000),
        },
        ActionType::WaitForRequest => ActionConfig::WaitForRequest {
            url_contains: "/api/".to_string(),
            timeout_ms: Some(5000),
        },
        ActionType::WaitForResponse => ActionConfig::WaitForResponse {
            url_contains: "/api/".to_string(),
            status: Some(200),
            timeout_ms: Some(5000),
        },
        ActionType::BlockRequest => ActionConfig::BlockRequest {
            url_patterns: vec!["analytics".to_string()],
        },
        ActionType::MockResponse => ActionConfig::MockResponse {
            url_contains: "/api/mock".to_string(),
            status: 200,
            body: "{}".to_string(),
            content_type: Some("application/json".to_string()),
        },
        ActionType::SetLocalStorage => ActionConfig::SetLocalStorage {
            key: "key".to_string(),
            value: "value".to_string(),
        },
        ActionType::SetSessionStorage => ActionConfig::SetSessionStorage {
            key: "key".to_string(),
            value: "value".to_string(),
        },
    }
}

pub async fn start_background_run(
    state: &AppState,
    steps: Vec<WorkflowStep>,
    mode: RunMode,
    target_step_id: Option<String>,
    options: BackgroundRunOptions,
) -> Result<RunStateDto, CommandError> {
    let cancellation = state
        .begin_run(mode, target_step_id)
        .await
        .ok_or_else(|| CommandError::message("A workflow is already running"))?;
    let run_state = state.run_state().await;
    let task_state = state.clone();
    let run_executor = state.run_executor();
    let browser_config = options.browser_config;
    let default_close_browser = options.default_close_browser;
    let max_workflow_duration_ms = options.max_workflow_duration_ms;
    let action_configs = steps
        .iter()
        .map(|step| step.config.clone())
        .collect::<Vec<_>>();

    tokio::spawn(async move {
        let (progress_tx, mut progress_rx) =
            tokio::sync::mpsc::unbounded_channel::<RunnerProgress>();
        let progress_state = task_state.clone();
        let progress_steps = steps.clone();
        let progress_task = tokio::spawn(async move {
            while let Some(progress) = progress_rx.recv().await {
                match progress {
                    RunnerProgress::StepStarted { step_number } => {
                        if let Some(step) = progress_steps.get(step_number.saturating_sub(1)) {
                            progress_state
                                .mark_step_running(step.id.clone(), step_number)
                                .await;
                        }
                    }
                    RunnerProgress::StepCompleted { step_number } => {
                        if let Some(step) = progress_steps.get(step_number.saturating_sub(1)) {
                            progress_state.mark_step_completed(step.id.clone()).await;
                        }
                    }
                }
            }
        });
        let cancellation_for_timeout = cancellation.clone();
        let run_future = run_executor.run_steps(
            action_configs,
            browser_config,
            cancellation,
            Box::new(move |progress| {
                let _ = progress_tx.send(progress);
            }),
        );
        let completion = if let Some(max_duration_ms) = max_workflow_duration_ms {
            tokio::pin!(run_future);
            tokio::select! {
                result = &mut run_future => RunCompletion::Finished(result),
                _ = tokio::time::sleep(Duration::from_millis(max_duration_ms)) => {
                    cancellation_for_timeout.cancel();
                    match tokio::time::timeout(Duration::from_secs(5), &mut run_future).await {
                        Ok(result) => RunCompletion::TimedOut {
                            max_duration_ms,
                            result: Some(result),
                        },
                        Err(_) => RunCompletion::TimedOut {
                            max_duration_ms,
                            result: None,
                        },
                    }
                }
            }
        } else {
            RunCompletion::Finished(run_future.await)
        };
        let _ = progress_task.await;
        complete_background_run(task_state, steps, completion, default_close_browser).await;
    });

    Ok(run_state)
}

#[derive(Debug, Clone, Default)]
pub struct BackgroundRunOptions {
    pub browser_config: Option<WorkflowBrowserConfig>,
    pub default_close_browser: bool,
    pub max_workflow_duration_ms: Option<u64>,
}

enum RunCompletion {
    Finished(Result<RunExecution, RunnerError>),
    TimedOut {
        max_duration_ms: u64,
        result: Option<Result<RunExecution, RunnerError>>,
    },
}

async fn complete_background_run(
    state: AppState,
    steps: Vec<WorkflowStep>,
    completion: RunCompletion,
    default_close_browser: bool,
) {
    match completion {
        RunCompletion::TimedOut {
            max_duration_ms,
            result,
        } => {
            let error = RunError::new(
                0,
                "workflow",
                format!("Workflow exceeded maximum duration of {max_duration_ms} ms"),
            );
            if let Some(Ok(outcome)) = result {
                state
                    .finish_run(
                        RunStatus::Failed,
                        Some(error),
                        outcome.session,
                        outcome.close_browser || default_close_browser,
                    )
                    .await;
            } else {
                state.fail_run_without_session(error).await;
            }
        }
        RunCompletion::Finished(result) => match result {
            Ok(outcome) => {
                let (status, error) = match outcome.status {
                    RunnerStatus::Success => (RunStatus::Success, None),
                    RunnerStatus::Stopped => (RunStatus::Stopped, None),
                    RunnerStatus::Failed => {
                        let error = outcome.failed_step.as_ref().map(|failed_step| {
                            if let Some(step) = steps.get(failed_step.step_number.saturating_sub(1))
                            {
                                RunError::for_step(
                                    step.id.clone(),
                                    failed_step.step_number,
                                    step.name.clone(),
                                    step.action_type.as_str(),
                                    failed_step.reason.clone(),
                                )
                            } else {
                                RunError::new(
                                    failed_step.step_number,
                                    "unknown",
                                    failed_step.reason.clone(),
                                )
                            }
                        });
                        (RunStatus::Failed, error)
                    }
                };

                state
                    .finish_run(
                        status,
                        error,
                        outcome.session,
                        outcome.close_browser || default_close_browser,
                    )
                    .await;
            }
            Err(error) => {
                state
                    .fail_run_without_session(RunError::new(0, "runner", error.to_string()))
                    .await;
            }
        },
    }
}
