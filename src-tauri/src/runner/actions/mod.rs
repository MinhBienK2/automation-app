mod click;
mod js;
mod scroll;
mod type_text;
mod user_interaction;

use std::time::Duration;

use chromiumoxide::{layout::Point, types::ClickOptions, Page};

use crate::domain::{ActionConfig, ClickMode, WaitCondition};

use self::{
    click::{click_script, force_dom_click_script, ClickScriptOptions, ClickTargetResult},
    js::ensure_js_action,
    scroll::{scroll_script, ScrollScriptOptions},
    type_text::type_text_script,
    user_interaction::{
        clear_input_script, hotkey_script, hover_script, input_text_script, press_key_script,
        select_option_script, set_checkbox_script, wait_script, InputTextScriptOptions,
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
            ..
        } => {
            let script = clear_input_script(&xpath, iframe_xpath.as_deref(), method)?;
            ensure_js_action(page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::Click {
            xpath,
            iframe_xpath,
            mode,
            button: _,
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
                page.click_with(
                    Point::new(target.x, target.y),
                    ClickOptions::builder()
                        .click_count(i64::from(click_count.unwrap_or(1).max(1)))
                        .build(),
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
            ..
        } => {
            let script = select_option_script(&xpath, iframe_xpath.as_deref(), match_by, &value)?;
            ensure_js_action(page, &script).await?;
            Ok(ActionExecution::Complete)
        }
        ActionConfig::SetCheckbox {
            xpath,
            iframe_xpath,
            state,
            ..
        } => {
            let script = set_checkbox_script(&xpath, iframe_xpath.as_deref(), state)?;
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
            ..
        } => {
            let script = hover_script(&xpath, iframe_xpath.as_deref())?;
            ensure_js_action(page, &script).await?;
            Ok(ActionExecution::Complete)
        }
    }
}
