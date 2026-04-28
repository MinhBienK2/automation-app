mod click;
mod js;
mod scroll;
mod type_text;
mod user_interaction;

use std::time::Duration;

use chromiumoxide::{
    cdp::browser_protocol::input::{DispatchMouseEventParams, DispatchMouseEventType, MouseButton},
    layout::Point,
    Page,
};

use crate::domain::{ActionConfig, ClickButton, ClickMode, WaitCondition};

use self::{
    click::{click_script, force_dom_click_script, ClickScriptOptions, ClickTargetResult},
    js::ensure_js_action,
    scroll::{scroll_script, ScrollScriptOptions},
    type_text::type_text_script,
    user_interaction::{
        blur_element_script, clear_input_script, drag_and_drop_script, focus_element_script,
        hotkey_script, hover_script, input_text_script, paste_clipboard_script, press_key_script,
        select_option_script, select_radio_script, set_checkbox_script, set_clipboard_script,
        toggle_checkbox_script, type_sequence_script, wait_script, InputTextScriptOptions,
        WaitScriptOptions,
    },
};
use super::{cancellation::RunnerCancellation, error::RunnerError};

pub(super) enum ActionExecution {
    Complete,
    Stopped,
}

pub(super) async fn execute_action(
    page: &Page,
    config: ActionConfig,
    cancellation: &RunnerCancellation,
) -> Result<ActionExecution, RunnerError> {
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
            ensure_js_action(page, &script).await?;
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
            ensure_js_action(page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::TypeText { xpath, text } => {
            let script = type_text_script(&xpath, &text)?;
            ensure_js_action(page, &script).await?;
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
            ensure_js_action(page, &script).await?;
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
                ensure_js_action(page, &script).await?;
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
                    page,
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
            ensure_js_action(page, &script).await?;
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
            ensure_js_action(page, &script).await?;
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
            ensure_js_action(page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::PressKey { key } => {
            let script = press_key_script(&key)?;
            ensure_js_action(page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::Hotkey { keys } => {
            let script = hotkey_script(&keys)?;
            ensure_js_action(page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::Hover {
            xpath,
            iframe_xpath,
            wait_until,
            timeout_ms,
        } => {
            let script = hover_script(&xpath, iframe_xpath.as_deref(), wait_until, timeout_ms)?;
            ensure_js_action(page, &script).await?;
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
            dispatch_mouse_click(page, Point::new(target.x, target.y), None, 2).await?;
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
                page,
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
            ensure_js_action(page, &script).await?;
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
            ensure_js_action(page, &script).await?;
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
            ensure_js_action(page, &script).await?;
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
            ensure_js_action(page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::SetClipboard { text } => {
            let script = set_clipboard_script(&text)?;
            ensure_js_action(page, &script).await?;
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
            ensure_js_action(page, &script).await?;
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
            ensure_js_action(page, &script).await?;
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
            ensure_js_action(page, &script).await?;
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
            ensure_js_action(page, &script).await?;
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
            ensure_js_action(page, &script).await?;
            Ok(ActionExecution::Complete)
        }
    }
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
