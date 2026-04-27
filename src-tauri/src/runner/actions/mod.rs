mod click;
mod js;
mod scroll;
mod type_text;

use std::time::Duration;

use chromiumoxide::{layout::Point, types::ClickOptions, Page};

use crate::domain::{ActionConfig, ClickMode};

use self::{
    click::{click_script, force_dom_click_script, ClickScriptOptions, ClickTargetResult},
    js::ensure_js_action,
    scroll::{scroll_script, ScrollScriptOptions},
    type_text::type_text_script,
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
        ActionConfig::TypeText { xpath, text } => {
            let script = type_text_script(&xpath, &text)?;
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
    }
}
