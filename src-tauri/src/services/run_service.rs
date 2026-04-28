use crate::{
    app_state::{AppState, RunStateDto},
    commands::CommandError,
    domain::{
        ActionConfig, ActionType, CheckboxState, ClearInputMethod, InputTypingMode, RunError,
        RunMode, RunStatus, ScrollDirection, SelectOptionMatchBy, WaitCondition, WorkflowStep,
    },
    runner::{RunExecution, RunnerError, RunnerProgress, RunnerStatus},
};

pub fn default_config(action_type: ActionType) -> ActionConfig {
    match action_type {
        ActionType::Navigate => ActionConfig::Navigate {
            url: String::new(),
            wait_until: None,
            timeout_ms: None,
        },
        ActionType::OpenUrl => ActionConfig::OpenUrl { url: String::new() },
        ActionType::Sleep => ActionConfig::Sleep { seconds: 1.0 },
        ActionType::Wait => ActionConfig::Wait {
            condition: WaitCondition::Duration,
            xpath: None,
            text: None,
            url: None,
            duration_ms: Some(1000),
            timeout_ms: None,
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
        ActionType::TypeText => ActionConfig::TypeText {
            xpath: String::new(),
            text: String::new(),
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
    }
}

pub async fn start_background_run(
    state: &AppState,
    steps: Vec<WorkflowStep>,
    mode: RunMode,
    target_step_id: Option<String>,
) -> Result<RunStateDto, CommandError> {
    let cancellation = state
        .begin_run(mode, target_step_id)
        .await
        .ok_or_else(|| CommandError::message("A workflow is already running"))?;
    let run_state = state.run_state().await;
    let task_state = state.clone();
    let run_executor = state.run_executor();
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
        let result = run_executor
            .run_steps(
                action_configs,
                cancellation,
                Box::new(move |progress| {
                    let _ = progress_tx.send(progress);
                }),
            )
            .await;
        let _ = progress_task.await;
        complete_background_run(task_state, steps, result).await;
    });

    Ok(run_state)
}

async fn complete_background_run(
    state: AppState,
    steps: Vec<WorkflowStep>,
    result: Result<RunExecution, RunnerError>,
) {
    match result {
        Ok(outcome) => {
            let (status, error) = match outcome.status {
                RunnerStatus::Success => (RunStatus::Success, None),
                RunnerStatus::Stopped => (RunStatus::Stopped, None),
                RunnerStatus::Failed => {
                    let error = outcome.failed_step.as_ref().map(|failed_step| {
                        if let Some(step) = steps.get(failed_step.step_number.saturating_sub(1)) {
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

            state.finish_run(status, error, outcome.session).await;
        }
        Err(error) => {
            state
                .fail_run_without_session(RunError::new(0, "runner", error.to_string()))
                .await;
        }
    }
}
