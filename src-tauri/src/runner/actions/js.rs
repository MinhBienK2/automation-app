use chromiumoxide::Page;
use serde::Deserialize;

use crate::runner::RunnerError;

pub(super) async fn ensure_js_action(page: &Page, script: &str) -> Result<(), RunnerError> {
    let result: JsActionResult = page.evaluate(script).await?.into_value()?;
    if result.ok {
        Ok(())
    } else {
        Err(RunnerError::ActionFailed(result.reason))
    }
}

pub(super) fn json_string(value: &str) -> Result<String, RunnerError> {
    Ok(serde_json::to_string(value)?)
}

pub(super) fn optional_json_string(value: Option<&str>) -> Result<String, RunnerError> {
    value
        .map(json_string)
        .transpose()
        .map(|value| value.unwrap_or_else(|| "null".to_string()))
}

#[derive(Debug, Deserialize)]
struct JsActionResult {
    ok: bool,
    reason: String,
}
