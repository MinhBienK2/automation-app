mod actionability;
mod clipboard;
mod data_capture;
mod element;
mod form;
mod input;
mod js;
mod keyboard;
mod pointer;
mod scroll;
mod wait;

use std::{future::Future, path::Path, pin::Pin, time::Duration};

use chromiumoxide::{
    cdp::browser_protocol::{
        browser::{PermissionSetting, SetPermissionParams},
        dom::SetFileInputFilesParams,
        emulation::{
            SetDeviceMetricsOverrideParams, SetGeolocationOverrideParams,
            SetTouchEmulationEnabledParams,
        },
        input::{DispatchMouseEventParams, DispatchMouseEventType, MouseButton},
        network::{EnableParams as NetworkEnableParams, Headers, SetExtraHttpHeadersParams},
        page::{
            CaptureScreenshotFormat, GetNavigationHistoryParams, HandleJavaScriptDialogParams,
            NavigateToHistoryEntryParams,
        },
    },
    layout::Point,
    page::ScreenshotParams,
    Page,
};

use crate::domain::{
    ActionConfig, AssertElementState, AssertOutputMatchMode, AssertTextMatchMode, ClickButton,
    ClickMode, HeaderPair, ScrollBlock, ScrollInline, StopWorkflowStatus, VariableAssignment,
    VariableValueType, WaitCondition, WorkflowCondition,
};

use self::{
    clipboard::{paste_clipboard_script, set_clipboard_script},
    data_capture::{extract_data_script, store_output_script, ExtractKind},
    element::{blur_element_script, focus_element_script},
    form::{
        select_custom_option_script, select_option_script, select_radio_script,
        set_checkbox_script, submit_form_script, toggle_checkbox_script,
    },
    input::{
        clear_input_script, input_text_script, set_contenteditable_script, InputTextScriptOptions,
    },
    js::{ensure_js_action, json_string, optional_json_string},
    keyboard::{hotkey_script, press_key_script, type_sequence_script},
    pointer::{
        click_script, drag_and_drop_script, force_dom_click_script, hover_script,
        ClickScriptOptions, ClickTargetResult,
    },
    scroll::{scroll_script, ScrollScriptOptions},
    wait::{wait_script, WaitScriptOptions},
};
use super::{browser::BrowserSession, cancellation::RunnerCancellation, error::RunnerError};

pub(super) enum ActionExecution {
    Complete,
    Stopped,
    StopSuccess { close_browser: bool },
    StopFailure { reason: String, close_browser: bool },
    BreakLoop,
    ContinueLoop,
}

pub(super) async fn execute_action(
    session: &mut BrowserSession,
    config: ActionConfig,
    cancellation: &RunnerCancellation,
) -> Result<ActionExecution, RunnerError> {
    let page = session.current_page()?;
    match config {
        ActionConfig::Navigate { url, .. } => {
            let url = render_template(&page, &url).await?;
            page.goto(url).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::Wait {
            condition: WaitCondition::Duration,
            duration_ms,
            ..
        } => {
            let wait_ms = duration_ms.unwrap_or(1000);
            tokio::select! {
                _ = tokio::time::sleep(Duration::from_millis(wait_ms)) => Ok(ActionExecution::Complete),
                _ = cancellation.cancelled() => Ok(ActionExecution::Stopped),
            }
        }
        ActionConfig::Wait {
            condition,
            xpath,
            text,
            url,
            duration_ms,
            timeout_ms,
        } => {
            let script = wait_script(WaitScriptOptions {
                condition,
                xpath: xpath.as_deref(),
                text: text.as_deref(),
                url: url.as_deref(),
                duration_ms,
                timeout_ms,
            })?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::InputText {
            xpath,
            iframe_xpath,
            text,
            clear_before_input,
            typing_mode,
            delay_ms,
            wait_until,
            timeout_ms,
        } => {
            let text = render_template(&page, &text).await?;
            let script = input_text_script(InputTextScriptOptions {
                xpath: &xpath,
                iframe_xpath: effective_frame(iframe_xpath.as_deref(), session),
                text: &text,
                clear_before_input,
                typing_mode,
                delay_ms,
                wait_until,
                timeout_ms,
            })?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::ClearInput {
            xpath,
            iframe_xpath,
            method,
            wait_until,
            timeout_ms,
        } => {
            let script = clear_input_script(
                &xpath,
                effective_frame(iframe_xpath.as_deref(), session),
                method,
                wait_until,
                timeout_ms,
            )?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::Click {
            xpath,
            iframe_xpath,
            mode,
            button,
            click_count,
            scroll_into_view,
            block,
            inline,
            position,
            offset_x,
            offset_y,
            wait_until,
            timeout_ms,
            retry_interval_ms,
            post_click_wait_ms,
        } => {
            if matches!(mode, Some(ClickMode::ForceDom)) {
                let script = force_dom_click_script(
                    &xpath,
                    effective_frame(iframe_xpath.as_deref(), session),
                )?;
                ensure_js_action(&page, &script).await?;
            } else {
                let script = click_script(ClickScriptOptions {
                    xpath: &xpath,
                    iframe_xpath: effective_frame(iframe_xpath.as_deref(), session),
                    scroll_into_view,
                    block,
                    inline,
                    position,
                    offset_x,
                    offset_y,
                    wait_until,
                    timeout_ms,
                    retry_interval_ms,
                })?;
                let target: ClickTargetResult = page.evaluate(script).await?.into_value()?;
                if !target.ok {
                    return Err(RunnerError::ActionFailed(target.reason));
                }
                dispatch_mouse_click(
                    &page,
                    Point::new(target.x, target.y),
                    button,
                    click_count.unwrap_or(1).max(1),
                )
                .await?;
            }
            if let Some(wait_ms) = post_click_wait_ms {
                tokio::select! {
                    _ = tokio::time::sleep(Duration::from_millis(wait_ms)) => {},
                    _ = cancellation.cancelled() => return Ok(ActionExecution::Stopped),
                }
            }
            Ok(ActionExecution::Complete)
        }
        ActionConfig::Scroll {
            mode,
            direction,
            pixels,
            xpath,
            iframe_xpath,
            behavior,
            block,
            inline,
            max_attempts,
            wait_ms,
        } => {
            let script = scroll_script(ScrollScriptOptions {
                mode,
                direction,
                pixels,
                xpath: xpath.as_deref(),
                iframe_xpath: effective_frame(iframe_xpath.as_deref(), session),
                behavior,
                block,
                inline,
                max_attempts,
                wait_ms,
            })?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::SelectOption {
            xpath,
            iframe_xpath,
            match_by,
            value,
            wait_until,
            timeout_ms,
        } => {
            let script = select_option_script(
                &xpath,
                effective_frame(iframe_xpath.as_deref(), session),
                match_by,
                &value,
                wait_until,
                timeout_ms,
            )?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::SetCheckbox {
            xpath,
            iframe_xpath,
            state,
            wait_until,
            timeout_ms,
        } => {
            let script = set_checkbox_script(
                &xpath,
                effective_frame(iframe_xpath.as_deref(), session),
                state,
                wait_until,
                timeout_ms,
            )?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::PressKey { key } => {
            let script = press_key_script(&key)?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::Hotkey { keys } => {
            let script = hotkey_script(&keys)?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::Hover {
            xpath,
            iframe_xpath,
            wait_until,
            timeout_ms,
        } => {
            let script = hover_script(
                &xpath,
                effective_frame(iframe_xpath.as_deref(), session),
                wait_until,
                timeout_ms,
            )?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::DoubleClick {
            xpath,
            iframe_xpath,
            wait_until,
            timeout_ms,
        } => {
            let script = click_script(ClickScriptOptions {
                xpath: &xpath,
                iframe_xpath: effective_frame(iframe_xpath.as_deref(), session),
                scroll_into_view: Some(true),
                block: None,
                inline: None,
                position: None,
                offset_x: None,
                offset_y: None,
                wait_until,
                timeout_ms,
                retry_interval_ms: None,
            })?;
            let target: ClickTargetResult = page.evaluate(script).await?.into_value()?;
            if !target.ok {
                return Err(RunnerError::ActionFailed(target.reason));
            }
            dispatch_mouse_click(&page, Point::new(target.x, target.y), None, 2).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::RightClick {
            xpath,
            iframe_xpath,
            wait_until,
            timeout_ms,
        } => {
            let script = click_script(ClickScriptOptions {
                xpath: &xpath,
                iframe_xpath: effective_frame(iframe_xpath.as_deref(), session),
                scroll_into_view: Some(true),
                block: None,
                inline: None,
                position: None,
                offset_x: None,
                offset_y: None,
                wait_until,
                timeout_ms,
                retry_interval_ms: None,
            })?;
            let target: ClickTargetResult = page.evaluate(script).await?.into_value()?;
            if !target.ok {
                return Err(RunnerError::ActionFailed(target.reason));
            }
            dispatch_mouse_click(
                &page,
                Point::new(target.x, target.y),
                Some(ClickButton::Right),
                1,
            )
            .await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::DragAndDrop {
            source_xpath,
            target_xpath,
            iframe_xpath,
            wait_until,
            timeout_ms,
        } => {
            let script = drag_and_drop_script(
                &source_xpath,
                &target_xpath,
                effective_frame(iframe_xpath.as_deref(), session),
                wait_until,
                timeout_ms,
            )?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::FocusElement {
            xpath,
            iframe_xpath,
            wait_until,
            timeout_ms,
        } => {
            let script = focus_element_script(
                &xpath,
                effective_frame(iframe_xpath.as_deref(), session),
                wait_until,
                timeout_ms,
            )?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::BlurElement {
            xpath,
            iframe_xpath,
            wait_until,
            timeout_ms,
        } => {
            let script = blur_element_script(
                &xpath,
                effective_frame(iframe_xpath.as_deref(), session),
                wait_until,
                timeout_ms,
            )?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::TypeSequence {
            xpath,
            iframe_xpath,
            text,
            delay_ms,
            wait_until,
            timeout_ms,
        } => {
            let text = render_template(&page, &text).await?;
            let script = type_sequence_script(
                &xpath,
                effective_frame(iframe_xpath.as_deref(), session),
                &text,
                delay_ms,
                wait_until,
                timeout_ms,
            )?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::SetClipboard { text } => {
            let text = render_template(&page, &text).await?;
            let script = set_clipboard_script(&text)?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::PasteClipboard {
            xpath,
            iframe_xpath,
            wait_until,
            timeout_ms,
        } => {
            let script = paste_clipboard_script(
                &xpath,
                effective_frame(iframe_xpath.as_deref(), session),
                wait_until,
                timeout_ms,
            )?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::Check {
            xpath,
            iframe_xpath,
            wait_until,
            timeout_ms,
        } => {
            let script = set_checkbox_script(
                &xpath,
                effective_frame(iframe_xpath.as_deref(), session),
                crate::domain::CheckboxState::Checked,
                wait_until,
                timeout_ms,
            )?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::Uncheck {
            xpath,
            iframe_xpath,
            wait_until,
            timeout_ms,
        } => {
            let script = set_checkbox_script(
                &xpath,
                effective_frame(iframe_xpath.as_deref(), session),
                crate::domain::CheckboxState::Unchecked,
                wait_until,
                timeout_ms,
            )?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::ToggleCheckbox {
            xpath,
            iframe_xpath,
            wait_until,
            timeout_ms,
        } => {
            let script = toggle_checkbox_script(
                &xpath,
                effective_frame(iframe_xpath.as_deref(), session),
                wait_until,
                timeout_ms,
            )?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::SelectRadio {
            xpath,
            iframe_xpath,
            wait_until,
            timeout_ms,
        } => {
            let script = select_radio_script(
                &xpath,
                effective_frame(iframe_xpath.as_deref(), session),
                wait_until,
                timeout_ms,
            )?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::UploadFile {
            xpath,
            iframe_xpath,
            files,
            wait_until: _,
            timeout_ms: _,
        } => {
            upload_file(
                &page,
                &xpath,
                effective_frame(iframe_xpath.as_deref(), session),
                &files,
            )
            .await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::SubmitForm {
            xpath,
            iframe_xpath,
            wait_until,
            timeout_ms,
        } => {
            let script = submit_form_script(
                xpath.as_deref(),
                effective_frame(iframe_xpath.as_deref(), session),
                wait_until,
                timeout_ms,
            )?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::SelectCustomOption {
            trigger_xpath,
            option_text,
            iframe_xpath,
            timeout_ms,
        } => {
            let script = select_custom_option_script(
                &trigger_xpath,
                &option_text,
                effective_frame(iframe_xpath.as_deref(), session),
                timeout_ms,
            )?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::SetContenteditable {
            xpath,
            iframe_xpath,
            text,
            clear_before_input,
            wait_until,
            timeout_ms,
        } => {
            let text = render_template(&page, &text).await?;
            let script = set_contenteditable_script(
                &xpath,
                effective_frame(iframe_xpath.as_deref(), session),
                &text,
                clear_before_input,
                wait_until,
                timeout_ms,
            )?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::ExtractText {
            xpath,
            iframe_xpath,
            output_name,
            timeout_ms,
        } => {
            let script = extract_data_script(
                &xpath,
                effective_frame(iframe_xpath.as_deref(), session),
                &output_name,
                timeout_ms,
                ExtractKind::Text,
            )?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::ExtractAttribute {
            xpath,
            iframe_xpath,
            attribute,
            output_name,
            timeout_ms,
        } => {
            let script = extract_data_script(
                &xpath,
                effective_frame(iframe_xpath.as_deref(), session),
                &output_name,
                timeout_ms,
                ExtractKind::Attribute(&attribute),
            )?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::ExtractInputValue {
            xpath,
            iframe_xpath,
            output_name,
            timeout_ms,
        } => {
            let script = extract_data_script(
                &xpath,
                effective_frame(iframe_xpath.as_deref(), session),
                &output_name,
                timeout_ms,
                ExtractKind::InputValue,
            )?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::ExtractTable {
            xpath,
            iframe_xpath,
            output_name,
            timeout_ms,
        } => {
            let script = extract_data_script(
                &xpath,
                effective_frame(iframe_xpath.as_deref(), session),
                &output_name,
                timeout_ms,
                ExtractKind::Table,
            )?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::ExtractList {
            xpath,
            iframe_xpath,
            output_name,
            timeout_ms,
        } => {
            let script = extract_data_script(
                &xpath,
                effective_frame(iframe_xpath.as_deref(), session),
                &output_name,
                timeout_ms,
                ExtractKind::List,
            )?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::TakeScreenshot {
            path,
            output_name,
            full_page,
        } => {
            take_screenshot(&page, &path, full_page).await?;
            if let Some(output_name) = output_name {
                let script = store_output_script(&output_name, &path)?;
                ensure_js_action(&page, &script).await?;
            }
            Ok(ActionExecution::Complete)
        }
        ActionConfig::GoBack {} => {
            navigate_history(&page, -1).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::GoForward {} => {
            navigate_history(&page, 1).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::Reload {} => {
            page.reload().await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::OpenNewTab { url } => {
            session.open_new_tab(url.as_deref()).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::SwitchTab { index } => {
            session.switch_tab(index).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::CloseTab { index } => {
            session.close_tab(index).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::SwitchFrame { xpath } => {
            session.switch_frame(xpath);
            Ok(ActionExecution::Complete)
        }
        ActionConfig::AcceptDialog { prompt_text } => {
            let mut builder = HandleJavaScriptDialogParams::builder().accept(true);
            if let Some(prompt_text) = prompt_text {
                builder = builder.prompt_text(prompt_text);
            }
            page.execute(builder.build().map_err(RunnerError::ActionFailed)?)
                .await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::DismissDialog {} => {
            page.execute(HandleJavaScriptDialogParams::new(false))
                .await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::SetDownloadDirectory { path } => {
            session.set_download_directory(&path).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::WaitForDownload {
            output_name,
            timeout_ms,
        } => {
            let path = session.wait_for_download(timeout_ms).await?;
            let path = path.to_string_lossy();
            let script = store_output_script(&output_name, &path)?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::SetVariable {
            name,
            value,
            value_type,
            variables,
        } => {
            let variables = if variables.is_empty() {
                vec![VariableAssignment {
                    name: name.unwrap_or_default(),
                    value: value.unwrap_or_default(),
                    value_type: value_type.unwrap_or_default(),
                }]
            } else {
                variables
            };
            let mut assignments = Vec::new();
            for variable in variables {
                let value = render_template(&page, &variable.value).await?;
                let value = parse_variable_value(&value, variable.value_type)?;
                flatten_variable_value(&variable.name, &value, &mut assignments);
            }
            let script = store_variable_assignments_script(&assignments)?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::SetJsonVariables { json } => {
            let json = render_template(&page, &json).await?;
            let parsed: serde_json::Value = serde_json::from_str(&json).map_err(|_| {
                RunnerError::ActionFailed("JSON variables must contain valid JSON".to_string())
            })?;
            let object = parsed.as_object().ok_or_else(|| {
                RunnerError::ActionFailed("JSON variables root must be an object".to_string())
            })?;
            for (name, value) in object {
                let mut assignments = Vec::new();
                flatten_variable_value(name, value, &mut assignments);
                let script = store_variable_assignments_script(&assignments)?;
                ensure_js_action(&page, &script).await?;
            }
            Ok(ActionExecution::Complete)
        }
        ActionConfig::AssertElement {
            xpath,
            iframe_xpath,
            state,
            timeout_ms,
        } => {
            let condition = match state {
                AssertElementState::Attached => WaitCondition::ElementAttached,
                AssertElementState::Visible => WaitCondition::ElementVisible,
                AssertElementState::Hidden => WaitCondition::ElementHidden,
                AssertElementState::Enabled => WaitCondition::ElementEnabled,
                AssertElementState::Disabled => WaitCondition::ElementDisabled,
            };
            let script = assert_element_script(
                &xpath,
                effective_frame(iframe_xpath.as_deref(), session),
                condition,
                timeout_ms,
            )?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::AssertText {
            xpath,
            iframe_xpath,
            text,
            match_mode,
            timeout_ms,
        } => {
            let text = render_template(&page, &text).await?;
            let script = assert_text_script(
                xpath.as_deref(),
                effective_frame(iframe_xpath.as_deref(), session),
                &text,
                match_mode,
                timeout_ms,
            )?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::IfCondition {
            condition,
            then_steps,
            else_steps,
        } => {
            let matches = evaluate_condition(&page, &condition).await?;
            let steps = if matches { then_steps } else { else_steps };
            execute_inline_steps(session, steps, cancellation).await
        }
        ActionConfig::RepeatTimes { times, steps } => {
            for _ in 0..times {
                match execute_inline_steps(session, steps.clone(), cancellation).await? {
                    ActionExecution::Complete => {}
                    execution => return Ok(execution),
                }
            }
            Ok(ActionExecution::Complete)
        }
        ActionConfig::RepeatForEach {
            item_name,
            array_variable,
            items,
            steps,
        } => {
            let loop_values = if let Some(array_variable) = array_variable {
                let value = read_output_json(&page, &array_variable).await?;
                value.as_array().cloned().ok_or_else(|| {
                    RunnerError::ActionFailed(format!(
                        "Variable {array_variable} is missing or is not an array"
                    ))
                })?
            } else {
                items.into_iter().map(serde_json::Value::String).collect()
            };
            let total = u32::try_from(loop_values.len()).unwrap_or(u32::MAX);
            for (index, item) in loop_values.into_iter().enumerate() {
                store_loop_outputs(&page, index as u32, Some(total)).await?;
                let mut assignments = Vec::new();
                flatten_variable_value(&item_name, &item, &mut assignments);
                let script = store_variable_assignments_script(&assignments)?;
                ensure_js_action(&page, &script).await?;
                match execute_inline_steps(session, steps.clone(), cancellation).await? {
                    ActionExecution::Complete => {}
                    execution => return Ok(execution),
                }
            }
            Ok(ActionExecution::Complete)
        }
        ActionConfig::RetryBlock {
            max_attempts,
            delay_ms,
            steps,
            failed_steps,
        } => {
            let mut last_error = None;
            for attempt in 1..=max_attempts {
                match execute_inline_steps(session, steps.clone(), cancellation).await {
                    Ok(ActionExecution::Complete) => return Ok(ActionExecution::Complete),
                    Ok(execution) => return Ok(execution),
                    Err(RunnerError::ActionFailed(reason)) => {
                        last_error = Some(reason);
                        if attempt < max_attempts {
                            tokio::select! {
                                _ = tokio::time::sleep(Duration::from_millis(delay_ms.unwrap_or(0))) => {},
                                _ = cancellation.cancelled() => return Ok(ActionExecution::Stopped),
                            }
                        }
                    }
                    Err(error) => return Err(error),
                }
            }
            if !failed_steps.is_empty() {
                return execute_inline_steps(session, failed_steps, cancellation).await;
            }
            Err(RunnerError::ActionFailed(
                last_error.unwrap_or_else(|| "Retry block failed".to_string()),
            ))
        }
        ActionConfig::SwitchCondition {
            expression,
            cases,
            default_steps,
        } => {
            let value = read_output_value(&page, &expression).await?;
            let steps = cases
                .into_iter()
                .find(|case| case.value == value)
                .map(|case| case.steps)
                .unwrap_or(default_steps);
            execute_inline_steps(session, steps, cancellation).await
        }
        ActionConfig::WhileLoop {
            condition,
            max_attempts,
            timeout_ms,
            steps,
        } => {
            let started_at = tokio::time::Instant::now();
            let deadline = timeout_ms.map(|timeout| started_at + Duration::from_millis(timeout));
            let mut iteration = 0_u32;
            loop {
                if cancellation.is_cancelled() {
                    return Ok(ActionExecution::Stopped);
                }
                if let Some(limit) = max_attempts {
                    if iteration >= limit {
                        return Ok(ActionExecution::Complete);
                    }
                }
                if deadline.is_some_and(|deadline| tokio::time::Instant::now() >= deadline) {
                    return Ok(ActionExecution::Complete);
                }
                if !evaluate_condition(&page, &condition).await? {
                    return Ok(ActionExecution::Complete);
                }
                store_loop_outputs(&page, iteration, max_attempts).await?;
                match execute_inline_steps(session, steps.clone(), cancellation).await? {
                    ActionExecution::Complete | ActionExecution::ContinueLoop => {}
                    ActionExecution::BreakLoop => return Ok(ActionExecution::Complete),
                    execution => return Ok(execution),
                }
                iteration += 1;
            }
        }
        ActionConfig::RepeatUntil {
            condition,
            max_attempts,
            timeout_ms,
            steps,
            timeout_steps,
        } => {
            let started_at = tokio::time::Instant::now();
            let deadline = timeout_ms.map(|timeout| started_at + Duration::from_millis(timeout));
            let mut iteration = 0_u32;
            loop {
                if cancellation.is_cancelled() {
                    return Ok(ActionExecution::Stopped);
                }
                if evaluate_condition(&page, &condition).await? {
                    return Ok(ActionExecution::Complete);
                }
                if let Some(limit) = max_attempts {
                    if iteration >= limit {
                        return execute_inline_steps(session, timeout_steps, cancellation).await;
                    }
                }
                if deadline.is_some_and(|deadline| tokio::time::Instant::now() >= deadline) {
                    return execute_inline_steps(session, timeout_steps, cancellation).await;
                }
                store_loop_outputs(&page, iteration, max_attempts).await?;
                match execute_inline_steps(session, steps.clone(), cancellation).await? {
                    ActionExecution::Complete | ActionExecution::ContinueLoop => {}
                    ActionExecution::BreakLoop => return Ok(ActionExecution::Complete),
                    execution => return Ok(execution),
                }
                iteration += 1;
            }
        }
        ActionConfig::TryCatch {
            try_steps,
            success_steps,
            error_steps,
            finally_steps,
        } => {
            let try_result = execute_inline_steps(session, try_steps, cancellation).await;
            let branch_result = match try_result {
                Ok(ActionExecution::Complete) => {
                    execute_inline_steps(session, success_steps, cancellation).await
                }
                Err(RunnerError::ActionFailed(reason)) => {
                    let script = store_output_script("last_error", &reason)?;
                    ensure_js_action(&page, &script).await?;
                    if error_steps.is_empty() {
                        let finally_execution = if finally_steps.is_empty() {
                            ActionExecution::Complete
                        } else {
                            execute_inline_steps(session, finally_steps, cancellation).await?
                        };
                        return match finally_execution {
                            ActionExecution::Complete => Err(RunnerError::ActionFailed(reason)),
                            execution => Ok(execution),
                        };
                    }
                    execute_inline_steps(session, error_steps, cancellation).await
                }
                other => other,
            };

            let branch_execution = branch_result?;
            let finally_execution = if finally_steps.is_empty() {
                ActionExecution::Complete
            } else {
                execute_inline_steps(session, finally_steps, cancellation).await?
            };
            match finally_execution {
                ActionExecution::Complete => Ok(branch_execution),
                execution => Ok(execution),
            }
        }
        ActionConfig::FallbackBlock {
            primary_steps,
            fallback_steps,
        } => match execute_inline_steps(session, primary_steps, cancellation).await {
            Ok(ActionExecution::Complete) => Ok(ActionExecution::Complete),
            Ok(execution) => Ok(execution),
            Err(RunnerError::ActionFailed(reason)) => {
                let script = store_output_script("last_error", &reason)?;
                ensure_js_action(&page, &script).await?;
                if fallback_steps.is_empty() {
                    return Err(RunnerError::ActionFailed(reason));
                }
                execute_inline_steps(session, fallback_steps, cancellation).await
            }
            Err(error) => Err(error),
        },
        ActionConfig::BreakLoop {} => Ok(ActionExecution::BreakLoop),
        ActionConfig::ContinueLoop {} => Ok(ActionExecution::ContinueLoop),
        ActionConfig::StopWorkflow {
            status,
            reason,
            close_browser,
        } => match status {
            StopWorkflowStatus::Success => Ok(ActionExecution::StopSuccess { close_browser }),
            StopWorkflowStatus::Failure => Ok(ActionExecution::StopFailure {
                reason: reason.unwrap_or_else(|| "Workflow stopped".to_string()),
                close_browser,
            }),
        },
        ActionConfig::TransformVariable {
            source_name,
            target_name,
            expression,
        } => {
            let script = transform_variable_script(&source_name, &target_name, &expression)?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::AssertOutput {
            name,
            match_mode,
            value,
        } => {
            let script = assert_output_script(&name, match_mode, &value)?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::RunSubworkflow { workflow_id, .. } => Err(RunnerError::ActionFailed(
            format!("Subworkflow {workflow_id} was not expanded before execution"),
        )),
        ActionConfig::DomainAllowlist { domains } => {
            let script = domain_allowlist_script(&domains)?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::UseProfile { .. } => Ok(ActionExecution::Complete),
        ActionConfig::SaveSession { path } => {
            save_session(&page, &path).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::LoadSession { path } => {
            load_session(&page, &path).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::SetCookie {
            name,
            value,
            domain,
            path,
        } => {
            let value = render_template(&page, &value).await?;
            let script = set_cookie_script(&name, &value, domain.as_deref(), path.as_deref())?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::ClearCookies { domain } => {
            let script = clear_cookies_script(domain.as_deref())?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::SetSecret { name, value } => {
            let value = render_template(&page, &value).await?;
            let secret_name = format!("secret:{name}");
            let script = store_output_script(&secret_name, &value)?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::UseProxy { .. } => Ok(ActionExecution::Complete),
        ActionConfig::SetUserAgent { user_agent } => {
            page.set_user_agent(user_agent.as_str()).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::SetViewport {
            width,
            height,
            device_scale_factor,
            mobile,
            touch,
        } => {
            let metrics = SetDeviceMetricsOverrideParams::new(
                i64::from(width),
                i64::from(height),
                device_scale_factor.unwrap_or(1.0),
                mobile,
            );
            page.execute(metrics).await?;
            let touch = SetTouchEmulationEnabledParams::builder()
                .enabled(touch)
                .max_touch_points(if touch { 1 } else { 0 })
                .build()
                .map_err(RunnerError::ActionFailed)?;
            page.execute(touch).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::SetGeolocation {
            latitude,
            longitude,
            accuracy,
        } => {
            let geolocation = SetGeolocationOverrideParams::builder()
                .latitude(latitude)
                .longitude(longitude)
                .accuracy(accuracy.unwrap_or(100.0))
                .build();
            page.execute(geolocation).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::SetExtraHeaders { headers } => {
            page.execute(NetworkEnableParams::default()).await?;
            let headers = SetExtraHttpHeadersParams::new(headers_value(&headers));
            page.execute(headers).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::GrantPermission {
            origin,
            permissions,
        } => {
            for permission in permissions {
                let mut params = SetPermissionParams::new(permission, PermissionSetting::Granted);
                params.origin = origin.clone();
                page.execute(params).await?;
            }
            Ok(ActionExecution::Complete)
        }
        ActionConfig::DetectChallenge {
            output_name,
            patterns,
            timeout_ms,
        } => {
            let script = detect_challenge_script(&output_name, &patterns, timeout_ms)?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::PauseForHuman { reason, timeout_ms } => {
            let script = store_output_script("human_verification_pause", &reason)?;
            ensure_js_action(&page, &script).await?;
            if let Some(timeout_ms) = timeout_ms {
                tokio::select! {
                    () = cancellation.cancelled() => Ok(ActionExecution::Stopped),
                    () = tokio::time::sleep(Duration::from_millis(timeout_ms)) => Ok(ActionExecution::Complete),
                }
            } else {
                Ok(ActionExecution::Complete)
            }
        }
        ActionConfig::ResumeWhenCondition {
            condition,
            timeout_ms,
        } => {
            wait_for_workflow_condition(&page, &condition, timeout_ms, cancellation).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::FallbackSelector {
            output_name,
            xpaths,
            timeout_ms,
        } => {
            let script = fallback_selector_script(&output_name, &xpaths, timeout_ms)?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::RetryStep {
            max_attempts,
            delay_ms,
            step,
        } => retry_single_step(session, max_attempts, delay_ms, *step, cancellation).await,
        ActionConfig::Checkpoint {
            name,
            screenshot_path,
        } => {
            if let Some(path) = screenshot_path.as_deref() {
                take_screenshot(&page, path, true).await?;
                let output_name = format!("checkpoint:{name}");
                let script = store_output_script(&output_name, path)?;
                ensure_js_action(&page, &script).await?;
            } else {
                let script = store_output_script(&format!("checkpoint:{name}"), "reached")?;
                ensure_js_action(&page, &script).await?;
            }
            Ok(ActionExecution::Complete)
        }
        ActionConfig::ExecuteJs {
            script,
            output_name,
            timeout_ms,
        } => {
            let script = execute_js_script(&script, output_name.as_deref(), timeout_ms)?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::WaitForRequest {
            url_contains,
            timeout_ms,
        } => {
            let script = wait_for_network_script(&url_contains, None, timeout_ms, false)?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::WaitForResponse {
            url_contains,
            status,
            timeout_ms,
        } => {
            let script = wait_for_network_script(&url_contains, status, timeout_ms, true)?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::BlockRequest { url_patterns } => {
            let script = block_request_script(&url_patterns)?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::MockResponse {
            url_contains,
            status,
            body,
            content_type,
        } => {
            let script =
                mock_response_script(&url_contains, status, &body, content_type.as_deref())?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::SetLocalStorage { key, value } => {
            let script = storage_script("localStorage", &key, &value)?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::SetSessionStorage { key, value } => {
            let script = storage_script("sessionStorage", &key, &value)?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
    }
}

fn headers_value(headers: &[HeaderPair]) -> Headers {
    let mut value = serde_json::Map::new();
    for header in headers {
        value.insert(
            header.name.trim().to_string(),
            serde_json::Value::String(header.value.trim().to_string()),
        );
    }
    Headers::new(serde_json::Value::Object(value))
}

fn fallback_selector_script(
    output_name: &str,
    xpaths: &[String],
    timeout_ms: Option<u64>,
) -> Result<String, RunnerError> {
    let output_name = json_string(output_name)?;
    let xpaths = serde_json::to_string(xpaths)?;
    let timeout_ms = timeout_ms.unwrap_or(1000);
    Ok(format!(
        r#"
        (async () => {{
          const outputName = {output_name};
          const xpaths = {xpaths};
          const deadline = Date.now() + {timeout_ms};
          const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
          const find = () => {{
            for (const xpath of xpaths) {{
              const node = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
              if (node) return xpath;
            }}
            return "";
          }};
          let found = find();
          while (!found && Date.now() <= deadline) {{
            await delay(100);
            found = find();
          }}
          if (!found) return {{ ok: false, reason: "No fallback XPath matched" }};
          window.__wamOutputs = window.__wamOutputs || {{}};
          window.__wamOutputs[outputName] = found;
          return {{ ok: true, reason: "" }};
        }})()
        "#
    ))
}

fn retry_single_step<'a>(
    session: &'a mut BrowserSession,
    max_attempts: u32,
    delay_ms: Option<u64>,
    step: ActionConfig,
    cancellation: &'a RunnerCancellation,
) -> Pin<Box<dyn Future<Output = Result<ActionExecution, RunnerError>> + Send + 'a>> {
    Box::pin(async move {
        let mut last_error = None;
        for attempt in 1..=max_attempts {
            match execute_action(session, step.clone(), cancellation).await {
                Ok(execution) => return Ok(execution),
                Err(RunnerError::ActionFailed(error)) => {
                    last_error = Some(error);
                    if attempt < max_attempts {
                        tokio::time::sleep(Duration::from_millis(delay_ms.unwrap_or(100))).await;
                    }
                }
                Err(error) => return Err(error),
            }
        }

        Err(RunnerError::ActionFailed(
            last_error.unwrap_or_else(|| "Retry step failed".to_string()),
        ))
    })
}

fn detect_challenge_script(
    output_name: &str,
    patterns: &[String],
    timeout_ms: Option<u64>,
) -> Result<String, RunnerError> {
    let output_name = json_string(output_name)?;
    let patterns = serde_json::to_string(patterns)?;
    let timeout_ms = timeout_ms.unwrap_or(1000);
    Ok(format!(
        r#"
        (async () => {{
          const outputName = {output_name};
          const patterns = {patterns}.map((pattern) => String(pattern).toLowerCase());
          const deadline = Date.now() + {timeout_ms};
          const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
          const detect = () => {{
            const text = (document.body ? document.body.innerText : document.documentElement.innerText || "").toLowerCase();
            const marker = document.querySelector('[class*="captcha" i], [id*="captcha" i], iframe[src*="captcha" i], iframe[title*="challenge" i]');
            return Boolean(marker) || patterns.some((pattern) => pattern && text.includes(pattern));
          }};
          let found = detect();
          while (!found && Date.now() <= deadline) {{
            await delay(100);
            found = detect();
          }}
          window.__wamOutputs = window.__wamOutputs || {{}};
          window.__wamOutputs[outputName] = found ? "true" : "false";
          return {{ ok: true, reason: "" }};
        }})()
        "#
    ))
}

fn execute_js_script(
    user_script: &str,
    output_name: Option<&str>,
    timeout_ms: Option<u64>,
) -> Result<String, RunnerError> {
    let user_script = json_string(user_script)?;
    let output_name = optional_json_string(output_name)?;
    let timeout_ms = timeout_ms.unwrap_or(5000);
    Ok(format!(
        r#"
        (async () => {{
          const source = {user_script};
          const outputName = {output_name};
          const run = Function('"use strict"; return (async () => {{ ' + source + '\n }})();');
          try {{
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('JavaScript timed out')), {timeout_ms}));
            const value = await Promise.race([run(), timeout]);
            if (outputName) {{
              window.__wamOutputs = window.__wamOutputs || {{}};
              window.__wamOutputs[outputName] = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
            }}
            return {{ ok: true, reason: "" }};
          }} catch (error) {{
            return {{ ok: false, reason: 'JavaScript error: ' + (error && error.message ? error.message : String(error)) }};
          }}
        }})()
        "#
    ))
}

fn storage_script(storage_name: &str, key: &str, value: &str) -> Result<String, RunnerError> {
    let key = json_string(key)?;
    let value = json_string(value)?;
    Ok(format!(
        r#"
        (() => {{
          try {{
            window.{storage_name}.setItem({key}, {value});
            return {{ ok: true, reason: "" }};
          }} catch (error) {{
            return {{ ok: false, reason: 'Storage error: ' + (error && error.message ? error.message : String(error)) }};
          }}
        }})()
        "#
    ))
}

fn network_patch_script() -> &'static str {
    r#"
      window.__wamNetworkEvents = window.__wamNetworkEvents || [];
      window.__wamRequestBlocks = window.__wamRequestBlocks || [];
      window.__wamResponseMocks = window.__wamResponseMocks || [];
      if (!window.__wamFetchPatched) {
        const originalFetch = window.fetch.bind(window);
        window.fetch = async (input, init = {}) => {
          const url = String(typeof input === 'string' ? input : input.url);
          const method = String(init.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase();
          window.__wamNetworkEvents.push({ type: 'request', url, method, at: Date.now() });
          const blocked = window.__wamRequestBlocks.some((pattern) => url.includes(pattern));
          if (blocked) {
            window.__wamNetworkEvents.push({ type: 'response', url, method, status: 0, blocked: true, at: Date.now() });
            throw new Error('Blocked by workflow');
          }
          const mock = window.__wamResponseMocks.find((candidate) => url.includes(candidate.urlContains));
          if (mock) {
            window.__wamNetworkEvents.push({ type: 'response', url, method, status: mock.status, mocked: true, at: Date.now() });
            return new Response(mock.body, { status: mock.status, headers: { 'Content-Type': mock.contentType || 'text/plain' } });
          }
          const response = await originalFetch(input, init);
          window.__wamNetworkEvents.push({ type: 'response', url: response.url || url, method, status: response.status, at: Date.now() });
          return response;
        };
        window.__wamFetchPatched = true;
      }
    "#
}

fn block_request_script(url_patterns: &[String]) -> Result<String, RunnerError> {
    let patterns = serde_json::to_string(url_patterns)?;
    Ok(format!(
        r#"
        (() => {{
          {patch}
          window.__wamRequestBlocks.push(...{patterns});
          return {{ ok: true, reason: "" }};
        }})()
        "#,
        patch = network_patch_script()
    ))
}

fn mock_response_script(
    url_contains: &str,
    status: u16,
    body: &str,
    content_type: Option<&str>,
) -> Result<String, RunnerError> {
    let url_contains = json_string(url_contains)?;
    let body = json_string(body)?;
    let content_type = optional_json_string(content_type)?;
    Ok(format!(
        r#"
        (() => {{
          {patch}
          window.__wamResponseMocks.push({{ urlContains: {url_contains}, status: {status}, body: {body}, contentType: {content_type} }});
          return {{ ok: true, reason: "" }};
        }})()
        "#,
        patch = network_patch_script()
    ))
}

fn wait_for_network_script(
    url_contains: &str,
    status: Option<u16>,
    timeout_ms: Option<u64>,
    response: bool,
) -> Result<String, RunnerError> {
    let url_contains = json_string(url_contains)?;
    let status = status
        .map(|status| status.to_string())
        .unwrap_or_else(|| "null".to_string());
    let event_type = if response { "response" } else { "request" };
    let timeout_ms = timeout_ms.unwrap_or(5000);
    Ok(format!(
        r#"
        (async () => {{
          {patch}
          const urlContains = {url_contains};
          const expectedStatus = {status};
          const eventType = {event_type:?};
          const deadline = Date.now() + {timeout_ms};
          const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
          const matches = () => (window.__wamNetworkEvents || []).some((event) => {{
            if (event.type !== eventType) return false;
            if (!String(event.url || '').includes(urlContains)) return false;
            return expectedStatus === null || Number(event.status) === Number(expectedStatus);
          }});
          while (Date.now() <= deadline) {{
            if (matches()) return {{ ok: true, reason: "" }};
            await delay(100);
          }}
          return {{ ok: false, reason: 'Network ' + eventType + ' was not observed before timeout' }};
        }})()
        "#,
        patch = network_patch_script()
    ))
}

async fn wait_for_workflow_condition(
    page: &Page,
    condition: &WorkflowCondition,
    timeout_ms: Option<u64>,
    cancellation: &RunnerCancellation,
) -> Result<(), RunnerError> {
    let deadline =
        tokio::time::Instant::now() + Duration::from_millis(timeout_ms.unwrap_or(60_000));
    loop {
        if evaluate_condition(page, condition).await? {
            return Ok(());
        }
        if tokio::time::Instant::now() >= deadline {
            return Err(RunnerError::ActionFailed(
                "Resume condition was not met before timeout".to_string(),
            ));
        }
        tokio::select! {
            () = cancellation.cancelled() => {
                return Err(RunnerError::ActionFailed("Workflow stopped".to_string()));
            }
            () = tokio::time::sleep(Duration::from_millis(100)) => {}
        }
    }
}

fn execute_inline_steps<'a>(
    session: &'a mut BrowserSession,
    steps: Vec<ActionConfig>,
    cancellation: &'a RunnerCancellation,
) -> Pin<Box<dyn Future<Output = Result<ActionExecution, RunnerError>> + Send + 'a>> {
    Box::pin(async move {
        for step in steps {
            match execute_action(session, step, cancellation).await? {
                ActionExecution::Complete => {}
                execution => return Ok(execution),
            }
        }
        Ok(ActionExecution::Complete)
    })
}

fn effective_frame<'a>(
    explicit_iframe_xpath: Option<&'a str>,
    session: &'a BrowserSession,
) -> Option<&'a str> {
    explicit_iframe_xpath.or_else(|| session.frame_xpath())
}

fn scroll_block_value(block: Option<ScrollBlock>) -> &'static str {
    match block.unwrap_or(ScrollBlock::Center) {
        ScrollBlock::Start => "start",
        ScrollBlock::Center => "center",
        ScrollBlock::End => "end",
        ScrollBlock::Nearest => "nearest",
    }
}

fn scroll_inline_value(inline: Option<ScrollInline>) -> &'static str {
    match inline.unwrap_or(ScrollInline::Nearest) {
        ScrollInline::Start => "start",
        ScrollInline::Center => "center",
        ScrollInline::End => "end",
        ScrollInline::Nearest => "nearest",
    }
}

async fn render_template(page: &Page, template: &str) -> Result<String, RunnerError> {
    let template = json_string(template)?;
    let script = format!(
        r#"
        (() => {{
          const template = {template};
          const outputs = window.__wamOutputs || {{}};
          return template.replace(/\{{\{{\s*([a-zA-Z0-9_.:-]+)\s*\}}\}}/g, (_, name) => {{
            const value = outputs[name];
            if (value === undefined || value === null) return "";
            if (typeof value === "object") return JSON.stringify(value);
            return String(value);
          }});
        }})()
        "#
    );
    Ok(page.evaluate(script).await?.into_value()?)
}

fn parse_variable_value(
    value: &str,
    value_type: VariableValueType,
) -> Result<serde_json::Value, RunnerError> {
    match value_type {
        VariableValueType::Text => Ok(serde_json::Value::String(value.to_string())),
        VariableValueType::Json => serde_json::from_str(value).map_err(|_| {
            RunnerError::ActionFailed("Variable value must contain valid JSON".to_string())
        }),
        VariableValueType::Number => {
            let parsed = value.trim().parse::<f64>().map_err(|_| {
                RunnerError::ActionFailed("Variable value must contain a finite number".to_string())
            })?;
            let number = serde_json::Number::from_f64(parsed).ok_or_else(|| {
                RunnerError::ActionFailed("Variable value must contain a finite number".to_string())
            })?;
            Ok(serde_json::Value::Number(number))
        }
        VariableValueType::Boolean => match value.trim() {
            "true" => Ok(serde_json::Value::Bool(true)),
            "false" => Ok(serde_json::Value::Bool(false)),
            _ => Err(RunnerError::ActionFailed(
                "Variable value must be true or false".to_string(),
            )),
        },
    }
}

fn flatten_variable_value(
    name: &str,
    value: &serde_json::Value,
    assignments: &mut Vec<(String, serde_json::Value)>,
) {
    assignments.push((name.to_string(), value.clone()));
    if let serde_json::Value::Object(object) = value {
        for (key, nested_value) in object {
            flatten_variable_value(&format!("{name}.{key}"), nested_value, assignments);
        }
    }
}

fn store_variable_assignments_script(
    assignments: &[(String, serde_json::Value)],
) -> Result<String, RunnerError> {
    let assignments = serde_json::to_string(assignments)?;
    Ok(format!(
        r#"
        (() => {{
          window.__wamOutputs = window.__wamOutputs || {{}};
          const assignments = {assignments};
          for (const [name, value] of assignments) {{
            window.__wamOutputs[name] = value;
          }}
          return {{ ok: true, reason: "" }};
        }})()
        "#
    ))
}

async fn evaluate_condition(
    page: &Page,
    condition: &WorkflowCondition,
) -> Result<bool, RunnerError> {
    let script = match condition {
        WorkflowCondition::OutputEquals { name, value } => {
            let name = json_string(name)?;
            let value = json_string(value)?;
            format!(r#"(() => String((window.__wamOutputs || {{}})[{name}] ?? "") === {value})()"#)
        }
        WorkflowCondition::OutputContains { name, value } => {
            let name = json_string(name)?;
            let value = json_string(value)?;
            format!(
                r#"(() => String((window.__wamOutputs || {{}})[{name}] ?? "").includes({value}))()"#
            )
        }
        WorkflowCondition::TextVisible { text } => {
            let text = json_string(text)?;
            format!(r#"(() => document.body.innerText.includes({text}))()"#)
        }
        WorkflowCondition::UrlContains { value } => {
            let value = json_string(value)?;
            format!(r#"(() => window.location.href.includes({value}))()"#)
        }
        WorkflowCondition::ElementVisible { xpath } => {
            let xpath = json_string(xpath)?;
            format!(
                r#"(() => {{
                  const node = document.evaluate({xpath}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                  if (!node || !(node instanceof Element)) return false;
                  const style = window.getComputedStyle(node);
                  const rect = node.getBoundingClientRect();
                  return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
                }})()"#
            )
        }
    };
    Ok(page.evaluate(script).await?.into_value()?)
}

async fn read_output_value(page: &Page, name: &str) -> Result<String, RunnerError> {
    let name = json_string(name)?;
    let script = format!(
        r#"
        (() => {{
          const value = (window.__wamOutputs || {{}})[{name}];
          if (value === undefined || value === null) return "";
          if (typeof value === "object") return JSON.stringify(value);
          return String(value);
        }})()
        "#
    );
    Ok(page.evaluate(script).await?.into_value()?)
}

async fn read_output_json(page: &Page, name: &str) -> Result<serde_json::Value, RunnerError> {
    let name = json_string(name)?;
    let script = format!(
        r#"
        (() => {{
          const outputs = window.__wamOutputs || {{}};
          return Object.prototype.hasOwnProperty.call(outputs, {name}) ? outputs[{name}] : null;
        }})()
        "#
    );
    Ok(page.evaluate(script).await?.into_value()?)
}

async fn store_loop_outputs(
    page: &Page,
    iteration: u32,
    total: Option<u32>,
) -> Result<(), RunnerError> {
    let total = total
        .map(|value| value.to_string())
        .unwrap_or_else(|| "null".to_string());
    let script = format!(
        r#"
        (() => {{
          window.__wamOutputs = window.__wamOutputs || {{}};
          window.__wamOutputs["loop.index"] = "{index}";
          window.__wamOutputs["loop.number"] = "{number}";
          if ({total} === null) {{
            delete window.__wamOutputs["loop.total"];
          }} else {{
            window.__wamOutputs["loop.total"] = String({total});
          }}
          return {{ ok: true, reason: "" }};
        }})()
        "#,
        index = iteration,
        number = iteration + 1,
        total = total,
    );
    ensure_js_action(page, &script).await
}

fn transform_variable_script(
    source_name: &str,
    target_name: &str,
    expression: &str,
) -> Result<String, RunnerError> {
    let source_name = json_string(source_name)?;
    let target_name = json_string(target_name)?;
    let expression = json_string(expression)?;
    Ok(format!(
        r#"
        (() => {{
          window.__wamOutputs = window.__wamOutputs || {{}};
          const sourceName = {source_name};
          const targetName = {target_name};
          const expression = {expression};
          const outputs = window.__wamOutputs;
          const value = outputs[sourceName] ?? "";
          let nextValue = value;
          if (String(expression).trim()) {{
            try {{
              nextValue = Function("value", "outputs", "return (" + expression + ");")(value, outputs);
            }} catch (error) {{
              return {{ ok: false, reason: "Variable transform failed: " + (error && error.message ? error.message : String(error)) }};
            }}
          }}
          outputs[targetName] = nextValue;
          return {{ ok: true, reason: "" }};
        }})()
        "#
    ))
}

fn assert_output_script(
    name: &str,
    match_mode: AssertOutputMatchMode,
    expected: &str,
) -> Result<String, RunnerError> {
    let name = json_string(name)?;
    let expected = json_string(expected)?;
    let mode = match match_mode {
        AssertOutputMatchMode::Contains => "contains",
        AssertOutputMatchMode::Equals => "equals",
    };
    Ok(format!(
        r#"
        (() => {{
          const outputs = window.__wamOutputs || {{}};
          const name = {name};
          const expected = {expected};
          const actualValue = outputs[name];
          const actual = actualValue === undefined || actualValue === null
            ? ""
            : (typeof actualValue === "object" ? JSON.stringify(actualValue) : String(actualValue));
          const ok = {mode:?} === "contains" ? actual.includes(expected) : actual === expected;
          return ok
            ? {{ ok: true, reason: "" }}
            : {{ ok: false, reason: "Output " + name + " expected " + expected + " but was " + actual }};
        }})()
        "#
    ))
}

fn domain_allowlist_script(domains: &[String]) -> Result<String, RunnerError> {
    let domains = serde_json::to_string(domains)?;
    Ok(format!(
        r#"
        (() => {{
          const host = window.location.hostname;
          const domains = {domains};
          const matches = domains.some((domain) => {{
            if (domain.startsWith("*.")) {{
              const suffix = domain.slice(1);
              return host.endsWith(suffix);
            }}
            return host === domain || host.endsWith("." + domain);
          }});
          return matches
            ? {{ ok: true, reason: "" }}
            : {{ ok: false, reason: "Current domain " + host + " is not in the workflow allowlist" }};
        }})()
        "#
    ))
}

fn assert_element_script(
    xpath: &str,
    iframe_xpath: Option<&str>,
    condition: WaitCondition,
    timeout_ms: Option<u64>,
) -> Result<String, RunnerError> {
    let xpath = json_string(xpath)?;
    let iframe_xpath = optional_json_string(iframe_xpath)?;
    let condition = json_string(condition_name(condition))?;
    let timeout_ms = timeout_ms.unwrap_or(5_000);
    Ok(format!(
        r#"
        (async () => {{
          const xpath = {xpath};
          const iframeXPath = {iframe_xpath};
          const condition = {condition};
          const timeoutMs = {timeout_ms};
          const deadline = Date.now() + timeoutMs;
          const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
          const docFor = () => {{
            if (!iframeXPath) return document;
            const frame = document.evaluate(iframeXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            return frame && frame.contentDocument ? frame.contentDocument : null;
          }};
          const find = (doc) => doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
          const visible = (node) => {{
            if (!node || !(node instanceof Element)) return false;
            const style = node.ownerDocument.defaultView.getComputedStyle(node);
            const rect = node.getBoundingClientRect();
            return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
          }};
          const enabled = (node) => !node.disabled && node.getAttribute("aria-disabled") !== "true";
          while (Date.now() <= deadline) {{
            const doc = docFor();
            const node = doc ? find(doc) : null;
            const ok =
              condition === "element_attached" ? !!node :
              condition === "element_visible" ? visible(node) :
              condition === "element_hidden" ? !node || !visible(node) :
              condition === "element_enabled" ? !!node && enabled(node) :
              condition === "element_disabled" ? !!node && !enabled(node) :
              false;
            if (ok) return {{ ok: true, reason: "" }};
            await delay(100);
          }}
          return {{ ok: false, reason: "Assertion failed" }};
        }})()
        "#
    ))
}

fn assert_text_script(
    xpath: Option<&str>,
    iframe_xpath: Option<&str>,
    text: &str,
    match_mode: AssertTextMatchMode,
    timeout_ms: Option<u64>,
) -> Result<String, RunnerError> {
    let xpath = optional_json_string(xpath)?;
    let iframe_xpath = optional_json_string(iframe_xpath)?;
    let text = json_string(text)?;
    let mode = json_string(match match_mode {
        AssertTextMatchMode::Contains => "contains",
        AssertTextMatchMode::Equals => "equals",
    })?;
    let timeout_ms = timeout_ms.unwrap_or(5_000);
    Ok(format!(
        r#"
        (async () => {{
          const xpath = {xpath};
          const iframeXPath = {iframe_xpath};
          const expected = {text};
          const mode = {mode};
          const timeoutMs = {timeout_ms};
          const deadline = Date.now() + timeoutMs;
          const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
          const docFor = () => {{
            if (!iframeXPath) return document;
            const frame = document.evaluate(iframeXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            return frame && frame.contentDocument ? frame.contentDocument : null;
          }};
          const actualText = (doc) => {{
            if (!xpath) return doc.body ? doc.body.innerText : "";
            const node = doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            return node ? node.textContent || "" : "";
          }};
          while (Date.now() <= deadline) {{
            const doc = docFor();
            const actual = doc ? actualText(doc) : "";
            const ok = mode === "equals" ? actual.trim() === expected : actual.includes(expected);
            if (ok) return {{ ok: true, reason: "" }};
            await delay(100);
          }}
          return {{ ok: false, reason: "Text assertion failed" }};
        }})()
        "#
    ))
}

fn condition_name(condition: WaitCondition) -> &'static str {
    match condition {
        WaitCondition::ElementAttached => "element_attached",
        WaitCondition::ElementVisible => "element_visible",
        WaitCondition::ElementHidden => "element_hidden",
        WaitCondition::ElementEnabled => "element_enabled",
        WaitCondition::ElementDisabled => "element_disabled",
        _ => "element_visible",
    }
}

async fn save_session(page: &Page, path: &str) -> Result<(), RunnerError> {
    if let Some(parent) = Path::new(path).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)?;
        }
    }
    let script = r#"
        (() => JSON.stringify({
          localStorage: Object.fromEntries(Object.entries(localStorage)),
          sessionStorage: Object.fromEntries(Object.entries(sessionStorage)),
          cookies: document.cookie
        }))()
    "#;
    let state: String = page.evaluate(script).await?.into_value()?;
    std::fs::write(path, state)?;
    Ok(())
}

async fn load_session(page: &Page, path: &str) -> Result<(), RunnerError> {
    let state = std::fs::read_to_string(path)?;
    let state = json_string(&state)?;
    let script = format!(
        r#"
        (() => {{
          const state = JSON.parse({state});
          for (const [key, value] of Object.entries(state.localStorage || {{}})) {{
            localStorage.setItem(key, value);
          }}
          for (const [key, value] of Object.entries(state.sessionStorage || {{}})) {{
            sessionStorage.setItem(key, value);
          }}
          for (const cookie of String(state.cookies || "").split(";")) {{
            const trimmed = cookie.trim();
            if (trimmed) document.cookie = `${{trimmed}}; path=/`;
          }}
          return {{ ok: true, reason: "" }};
        }})()
        "#
    );
    ensure_js_action(page, &script).await
}

fn set_cookie_script(
    name: &str,
    value: &str,
    domain: Option<&str>,
    path: Option<&str>,
) -> Result<String, RunnerError> {
    let name = json_string(name)?;
    let value = json_string(value)?;
    let domain = optional_json_string(domain)?;
    let path = json_string(path.unwrap_or("/"))?;
    Ok(format!(
        r#"
        (() => {{
          const parts = [`${{{name}}}=${{encodeURIComponent({value})}}`, `path=${{{path}}}`];
          if ({domain}) parts.push(`domain=${{{domain}}}`);
          document.cookie = parts.join("; ");
          return {{ ok: true, reason: "" }};
        }})()
        "#
    ))
}

fn clear_cookies_script(domain: Option<&str>) -> Result<String, RunnerError> {
    let domain = optional_json_string(domain)?;
    Ok(format!(
        r#"
        (() => {{
          const cookies = document.cookie ? document.cookie.split(";") : [];
          for (const cookie of cookies) {{
            const name = cookie.split("=")[0].trim();
            document.cookie = `${{name}}=; Max-Age=0; path=/`;
            if ({domain}) document.cookie = `${{name}}=; Max-Age=0; path=/; domain=${{{domain}}}`;
          }}
          return {{ ok: true, reason: "" }};
        }})()
        "#
    ))
}

async fn navigate_history(page: &Page, offset: i64) -> Result<(), RunnerError> {
    let history = page.execute(GetNavigationHistoryParams {}).await?;
    let target_index = history.current_index + offset;
    let entry = history
        .entries
        .get(usize::try_from(target_index).unwrap_or(usize::MAX))
        .ok_or_else(|| RunnerError::ActionFailed("History entry not found".to_string()))?;
    page.execute(NavigateToHistoryEntryParams::new(entry.id))
        .await?;
    let _ = page.wait_for_navigation().await;
    Ok(())
}

async fn take_screenshot(page: &Page, path: &str, full_page: bool) -> Result<(), RunnerError> {
    if let Some(parent) = Path::new(path).parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            return Err(RunnerError::ActionFailed(
                "Screenshot directory not found".to_string(),
            ));
        }
    }

    let image = page
        .screenshot(
            ScreenshotParams::builder()
                .format(CaptureScreenshotFormat::Png)
                .full_page(full_page)
                .build(),
        )
        .await?;
    std::fs::write(path, image)?;
    Ok(())
}

async fn upload_file(
    page: &Page,
    xpath: &str,
    iframe_xpath: Option<&str>,
    files: &[String],
) -> Result<(), RunnerError> {
    if iframe_xpath.is_some() {
        return Err(RunnerError::ActionFailed(
            "File upload inside iframe is not supported yet".to_string(),
        ));
    }

    for file in files {
        if !Path::new(file).is_file() {
            return Err(RunnerError::ActionFailed("File not found".to_string()));
        }
    }

    let mut matches = page
        .find_xpaths(xpath)
        .await
        .map_err(|_| RunnerError::ActionFailed("XPath not found".to_string()))?;
    let element = matches
        .pop()
        .ok_or_else(|| RunnerError::ActionFailed("XPath not found".to_string()))?;

    page.execute(
        SetFileInputFilesParams::builder()
            .files(files.iter().cloned())
            .object_id(element.remote_object_id)
            .build()
            .map_err(RunnerError::ActionFailed)?,
    )
    .await?;

    Ok(())
}

async fn dispatch_mouse_click(
    page: &Page,
    point: Point,
    button: Option<ClickButton>,
    click_count: u32,
) -> Result<(), RunnerError> {
    let mouse_button = mouse_button_for(button);
    let click_count = i64::from(click_count);
    let event = DispatchMouseEventParams::builder()
        .x(point.x)
        .y(point.y)
        .button(mouse_button)
        .click_count(click_count);

    page.move_mouse(point).await?;
    page.execute(
        event
            .clone()
            .r#type(DispatchMouseEventType::MousePressed)
            .build()
            .expect("mouse pressed event should be valid"),
    )
    .await?;
    page.execute(
        event
            .r#type(DispatchMouseEventType::MouseReleased)
            .build()
            .expect("mouse released event should be valid"),
    )
    .await?;

    Ok(())
}

fn mouse_button_for(button: Option<ClickButton>) -> MouseButton {
    match button.unwrap_or(ClickButton::Left) {
        ClickButton::Left => MouseButton::Left,
        ClickButton::Right => MouseButton::Right,
        ClickButton::Middle => MouseButton::Middle,
    }
}

#[cfg(test)]
mod tests {
    use crate::domain::{ClickButton, VariableValueType};
    use serde_json::json;

    use super::{flatten_variable_value, mouse_button_for, parse_variable_value};

    #[test]
    fn click_buttons_map_to_cdp_mouse_buttons() {
        assert_eq!(mouse_button_for(None).as_ref(), "left");
        assert_eq!(mouse_button_for(Some(ClickButton::Left)).as_ref(), "left");
        assert_eq!(mouse_button_for(Some(ClickButton::Right)).as_ref(), "right");
        assert_eq!(
            mouse_button_for(Some(ClickButton::Middle)).as_ref(),
            "middle"
        );
    }

    #[test]
    fn variable_value_parser_preserves_text_and_parses_typed_values() {
        assert_eq!(
            parse_variable_value("[\"admin\"]", VariableValueType::Text).expect("text parses"),
            json!("[\"admin\"]"),
        );
        assert_eq!(
            parse_variable_value("[\"admin\"]", VariableValueType::Json).expect("JSON parses"),
            json!(["admin"]),
        );
        assert_eq!(
            parse_variable_value("20", VariableValueType::Number).expect("number parses"),
            json!(20.0),
        );
        assert_eq!(
            parse_variable_value("true", VariableValueType::Boolean).expect("boolean parses"),
            json!(true),
        );
    }

    #[test]
    fn variable_values_flatten_objects_but_keep_arrays_whole() {
        let mut assignments = Vec::new();

        flatten_variable_value(
            "user",
            &json!({ "name": "Ada", "profile": { "email": "a@b.com" } }),
            &mut assignments,
        );
        flatten_variable_value("roles", &json!(["admin", "editor"]), &mut assignments);

        assert_eq!(
            assignments,
            vec![
                (
                    "user".to_string(),
                    json!({ "name": "Ada", "profile": { "email": "a@b.com" } })
                ),
                ("user.name".to_string(), json!("Ada")),
                ("user.profile".to_string(), json!({ "email": "a@b.com" })),
                ("user.profile.email".to_string(), json!("a@b.com")),
                ("roles".to_string(), json!(["admin", "editor"])),
            ],
        );
    }
}
