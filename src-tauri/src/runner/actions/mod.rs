mod click;
mod data_capture;
mod js;
mod scroll;
mod type_text;
mod user_interaction;

use std::{path::Path, time::Duration};

use chromiumoxide::{
    cdp::browser_protocol::{
        dom::SetFileInputFilesParams,
        input::{DispatchMouseEventParams, DispatchMouseEventType, MouseButton},
        page::{CaptureScreenshotFormat, GetNavigationHistoryParams, NavigateToHistoryEntryParams},
    },
    layout::Point,
    page::ScreenshotParams,
    Page,
};

use crate::domain::{ActionConfig, ClickButton, ClickMode, WaitCondition};

use self::{
    click::{click_script, force_dom_click_script, ClickScriptOptions, ClickTargetResult},
    data_capture::{extract_data_script, store_output_script, ExtractKind},
    js::ensure_js_action,
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
}

pub(super) async fn execute_action(
    session: &mut BrowserSession,
    config: ActionConfig,
    cancellation: &RunnerCancellation,
) -> Result<ActionExecution, RunnerError> {
    let page = session.current_page()?;
    match config {
        ActionConfig::Navigate { url, .. } => {
            page.goto(url).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::OpenUrl { url } => {
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
            let script = input_text_script(InputTextScriptOptions {
                xpath: &xpath,
                iframe_xpath: iframe_xpath.as_deref(),
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
                iframe_xpath.as_deref(),
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
                let script = force_dom_click_script(&xpath, iframe_xpath.as_deref())?;
                ensure_js_action(&page, &script).await?;
            } else {
                let script = click_script(ClickScriptOptions {
                    xpath: &xpath,
                    iframe_xpath: iframe_xpath.as_deref(),
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
                iframe_xpath: iframe_xpath.as_deref(),
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
                iframe_xpath.as_deref(),
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
                iframe_xpath.as_deref(),
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
            let script = hover_script(&xpath, iframe_xpath.as_deref(), wait_until, timeout_ms)?;
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
                iframe_xpath: iframe_xpath.as_deref(),
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
                iframe_xpath: iframe_xpath.as_deref(),
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
                iframe_xpath.as_deref(),
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
            let script =
                focus_element_script(&xpath, iframe_xpath.as_deref(), wait_until, timeout_ms)?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::BlurElement {
            xpath,
            iframe_xpath,
            wait_until,
            timeout_ms,
        } => {
            let script =
                blur_element_script(&xpath, iframe_xpath.as_deref(), wait_until, timeout_ms)?;
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
            let script = type_sequence_script(
                &xpath,
                iframe_xpath.as_deref(),
                &text,
                delay_ms,
                wait_until,
                timeout_ms,
            )?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::SetClipboard { text } => {
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
            let script =
                paste_clipboard_script(&xpath, iframe_xpath.as_deref(), wait_until, timeout_ms)?;
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
                iframe_xpath.as_deref(),
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
                iframe_xpath.as_deref(),
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
            let script =
                toggle_checkbox_script(&xpath, iframe_xpath.as_deref(), wait_until, timeout_ms)?;
            ensure_js_action(&page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::SelectRadio {
            xpath,
            iframe_xpath,
            wait_until,
            timeout_ms,
        } => {
            let script =
                select_radio_script(&xpath, iframe_xpath.as_deref(), wait_until, timeout_ms)?;
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
            upload_file(&page, &xpath, iframe_xpath.as_deref(), &files).await?;
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
                iframe_xpath.as_deref(),
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
                iframe_xpath.as_deref(),
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
            let script = set_contenteditable_script(
                &xpath,
                iframe_xpath.as_deref(),
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
                iframe_xpath.as_deref(),
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
                iframe_xpath.as_deref(),
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
                iframe_xpath.as_deref(),
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
                iframe_xpath.as_deref(),
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
                iframe_xpath.as_deref(),
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
    }
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
