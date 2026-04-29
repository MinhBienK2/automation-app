mod click;
mod data_capture;
mod js;
mod scroll;
mod type_text;
mod user_interaction;

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
    ActionConfig, AssertElementState, AssertTextMatchMode, ClickButton, ClickMode, HeaderPair,
    StopWorkflowStatus, WaitCondition, WorkflowCondition,
};

use self::{
    click::{click_script, force_dom_click_script, ClickScriptOptions, ClickTargetResult},
    data_capture::{extract_data_script, store_output_script, ExtractKind},
    js::{ensure_js_action, json_string, optional_json_string},
    scroll::{scroll_script, ScrollScriptOptions},
    type_text::type_text_script,
    user_interaction::{
        blur_element_script, clear_input_script, drag_and_drop_script, focus_element_script,
        hotkey_script, hover_script, input_text_script, paste_clipboard_script, press_key_script,
        select_custom_option_script, select_option_script, select_radio_script,
        set_checkbox_script, set_clipboard_script, set_contenteditable_script, submit_form_script,
        toggle_checkbox_script, type_sequence_script, wait_script, InputTextScriptOptions,
        WaitScriptOptions,
    },
};
use super::{browser::BrowserSession, cancellation::RunnerCancellation, error::RunnerError};

pub(super) enum ActionExecution {
    Complete,
    Stopped,
    StopSuccess,
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
        ActionConfig::OpenUrl { url } => {
            let url = render_template(&page, &url).await?;
            page.goto(url).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::Sleep { seconds } => {
            tokio::select! {
                _ = tokio::time::sleep(Duration::from_secs_f64(seconds)) => Ok(ActionExecution::Complete),
                _ = cancellation.cancelled() => Ok(ActionExecution::Stopped),
            }
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
        ActionConfig::TypeText { xpath, text } => {
            let text = render_template(&page, &text).await?;
            let script = type_text_script(&xpath, &text)?;
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
                    mode,
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
                mode: None,
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
                mode: None,
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
        ActionConfig::SetVariable { name, value } => {
            let value = render_template(&page, &value).await?;
            let script = store_output_script(&name, &value)?;
            ensure_js_action(&page, &script).await?;
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
            items,
            steps,
        } => {
            for item in items {
                let script = store_output_script(&item_name, &item)?;
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
            Err(RunnerError::ActionFailed(
                last_error.unwrap_or_else(|| "Retry block failed".to_string()),
            ))
        }
        ActionConfig::StopWorkflow { status, reason } => match status {
            StopWorkflowStatus::Success => Ok(ActionExecution::StopSuccess),
            StopWorkflowStatus::Failure => Err(RunnerError::ActionFailed(
                reason.unwrap_or_else(|| "Workflow stopped".to_string()),
            )),
        },
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
    use crate::domain::ClickButton;

    use super::mouse_button_for;

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
}
