use crate::domain::ClickWaitUntil;

pub(super) fn click_wait_until_value(wait_until: Option<ClickWaitUntil>) -> &'static str {
    match wait_until {
        Some(ClickWaitUntil::Attached) => "attached",
        Some(ClickWaitUntil::Visible) => "visible",
        Some(ClickWaitUntil::Enabled) => "enabled",
        Some(ClickWaitUntil::Clickable) | None => "clickable",
    }
}
