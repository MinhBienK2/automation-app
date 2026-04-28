use std::{fs, path::PathBuf, time::Duration};

use uuid::Uuid;
use workflow_automation_manager_lib::{
    domain::{ActionConfig, ClickWaitUntil, ScrollDirection},
    runner::{BrowserRunner, RunnerCancellation, RunnerOptions, RunnerStatus},
};

fn chrome_path() -> Option<PathBuf> {
    [
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
    ]
    .iter()
    .map(PathBuf::from)
    .find(|path| path.exists())
}

fn write_test_page() -> String {
    let path = std::env::temp_dir().join(format!("wam-runner-{}.html", Uuid::new_v4()));
    fs::write(
        &path,
        r#"
        <!doctype html>
        <html>
          <body style="height: 2000px">
            <input id="email" name="email" value="old value" />
            <button id="submit" onclick="document.getElementById('result').textContent = 'clicked'">Submit</button>
            <div id="result">idle</div>
          </body>
        </html>
        "#,
    )
    .expect("write test page");

    format!("file://{}", path.display())
}

fn write_phase_one_test_page() -> String {
    let path = std::env::temp_dir().join(format!("wam-phase-one-{}.html", Uuid::new_v4()));
    fs::write(
        &path,
        r#"
        <!doctype html>
        <html>
          <body>
            <button id="double" ondblclick="document.getElementById('double-result').textContent = 'double'">Double</button>
            <button id="right" oncontextmenu="event.preventDefault(); document.getElementById('right-result').textContent = 'right'">Right</button>
            <input id="search" onfocus="document.getElementById('focus-result').textContent = 'focused'" onblur="document.getElementById('blur-result').textContent = 'blurred'" />
            <textarea id="notes"></textarea>
            <input id="terms" type="checkbox" />
            <input id="radio-email" type="radio" name="contact" value="email" />
            <div id="source" draggable="true">Card</div>
            <div id="target" ondragover="event.preventDefault()" ondrop="event.preventDefault(); document.getElementById('drop-result').textContent = 'dropped'">Drop here</div>
            <div id="double-result">idle</div>
            <div id="right-result">idle</div>
            <div id="focus-result">idle</div>
            <div id="blur-result">idle</div>
            <div id="drop-result">idle</div>
          </body>
        </html>
        "#,
    )
    .expect("write phase one test page");

    format!("file://{}", path.display())
}

fn runner() -> BrowserRunner {
    BrowserRunner::new(RunnerOptions {
        headed: true,
        chrome_executable: chrome_path(),
    })
}

#[tokio::test]
#[ignore = "requires a local Chromium/Chrome process that can launch headed in this environment"]
async fn runner_executes_all_mvp_actions_against_visible_chromium() {
    let url = write_test_page();
    let cancel = RunnerCancellation::new();

    let mut outcome = runner()
        .run_steps(
            vec![
                ActionConfig::OpenUrl { url },
                ActionConfig::Sleep { seconds: 0.2 },
                ActionConfig::TypeText {
                    xpath: "//*[@name=\"email\"]".to_string(),
                    text: "user@example.com".to_string(),
                },
                ActionConfig::Click {
                    xpath: "//*[@id=\"submit\"]".to_string(),
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
                ActionConfig::Scroll {
                    mode: None,
                    direction: ScrollDirection::Down,
                    pixels: 400,
                    xpath: None,
                    iframe_xpath: None,
                    behavior: None,
                    block: None,
                    inline: None,
                    max_attempts: None,
                    wait_ms: None,
                },
            ],
            cancel,
        )
        .await
        .expect("run steps");

    assert_eq!(outcome.status, RunnerStatus::Success);
    assert!(outcome.session.is_open());
    assert_eq!(
        outcome
            .session
            .evaluate_string("document.getElementById('email').value")
            .await
            .expect("input value"),
        "user@example.com"
    );
    assert_eq!(
        outcome
            .session
            .evaluate_string("document.getElementById('result').textContent")
            .await
            .expect("click result"),
        "clicked"
    );
    assert!(
        outcome
            .session
            .evaluate_i64("Math.round(window.scrollY)")
            .await
            .expect("scroll value")
            >= 350
    );

    outcome.session.close().await.expect("close browser");
}

#[tokio::test]
#[ignore = "requires a local Chromium/Chrome process that can launch headed in this environment"]
async fn runner_fails_immediately_when_xpath_is_missing_and_keeps_browser_open() {
    let url = write_test_page();
    let cancel = RunnerCancellation::new();

    let mut outcome = runner()
        .run_steps(
            vec![
                ActionConfig::OpenUrl { url },
                ActionConfig::Click {
                    xpath: "//*[@id=\"missing\"]".to_string(),
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
            ],
            cancel,
        )
        .await
        .expect("run steps");

    assert_eq!(outcome.status, RunnerStatus::Failed);
    assert_eq!(
        outcome
            .failed_step
            .as_ref()
            .expect("failed step")
            .step_number,
        2
    );
    assert_eq!(
        outcome.failed_step.as_ref().expect("failed step").reason,
        "XPath not found"
    );
    assert!(outcome.session.is_open());

    outcome.session.close().await.expect("close browser");
}

#[tokio::test]
#[ignore = "requires a local Chromium/Chrome process that can launch headed in this environment"]
async fn runner_can_stop_during_sleep_without_closing_browser() {
    let url = write_test_page();
    let cancel = RunnerCancellation::new();
    let cancel_from_task = cancel.clone();

    let task = tokio::spawn(async move {
        runner()
            .run_steps(
                vec![
                    ActionConfig::OpenUrl { url },
                    ActionConfig::Sleep { seconds: 10.0 },
                    ActionConfig::Scroll {
                        mode: None,
                        direction: ScrollDirection::Down,
                        pixels: 400,
                        xpath: None,
                        iframe_xpath: None,
                        behavior: None,
                        block: None,
                        inline: None,
                        max_attempts: None,
                        wait_ms: None,
                    },
                ],
                cancel_from_task,
            )
            .await
    });

    tokio::time::sleep(Duration::from_millis(300)).await;
    cancel.cancel();

    let mut outcome = task.await.expect("join").expect("run steps");
    assert_eq!(outcome.status, RunnerStatus::Stopped);
    assert!(outcome.session.is_open());

    outcome.session.close().await.expect("close browser");
}

#[tokio::test]
#[ignore = "requires a local Chromium/Chrome process that can launch headed in this environment"]
async fn runner_executes_phase_one_human_interaction_actions_against_visible_chromium() {
    let url = write_phase_one_test_page();
    let cancel = RunnerCancellation::new();

    let mut outcome = runner()
        .run_steps(
            vec![
                ActionConfig::OpenUrl { url },
                ActionConfig::DoubleClick {
                    xpath: "//*[@id=\"double\"]".to_string(),
                    iframe_xpath: None,
                    wait_until: Some(ClickWaitUntil::Visible),
                    timeout_ms: Some(3000),
                },
                ActionConfig::RightClick {
                    xpath: "//*[@id=\"right\"]".to_string(),
                    iframe_xpath: None,
                    wait_until: Some(ClickWaitUntil::Visible),
                    timeout_ms: Some(3000),
                },
                ActionConfig::FocusElement {
                    xpath: "//*[@id=\"search\"]".to_string(),
                    iframe_xpath: None,
                    wait_until: Some(ClickWaitUntil::Visible),
                    timeout_ms: Some(3000),
                },
                ActionConfig::TypeSequence {
                    xpath: "//*[@id=\"search\"]".to_string(),
                    iframe_xpath: None,
                    text: "abc".to_string(),
                    delay_ms: None,
                    wait_until: Some(ClickWaitUntil::Visible),
                    timeout_ms: Some(3000),
                },
                ActionConfig::BlurElement {
                    xpath: "//*[@id=\"search\"]".to_string(),
                    iframe_xpath: None,
                    wait_until: Some(ClickWaitUntil::Visible),
                    timeout_ms: Some(3000),
                },
                ActionConfig::SetClipboard {
                    text: " pasted".to_string(),
                },
                ActionConfig::PasteClipboard {
                    xpath: "//*[@id=\"notes\"]".to_string(),
                    iframe_xpath: None,
                    wait_until: Some(ClickWaitUntil::Visible),
                    timeout_ms: Some(3000),
                },
                ActionConfig::Check {
                    xpath: "//*[@id=\"terms\"]".to_string(),
                    iframe_xpath: None,
                    wait_until: Some(ClickWaitUntil::Visible),
                    timeout_ms: Some(3000),
                },
                ActionConfig::Uncheck {
                    xpath: "//*[@id=\"terms\"]".to_string(),
                    iframe_xpath: None,
                    wait_until: Some(ClickWaitUntil::Visible),
                    timeout_ms: Some(3000),
                },
                ActionConfig::ToggleCheckbox {
                    xpath: "//*[@id=\"terms\"]".to_string(),
                    iframe_xpath: None,
                    wait_until: Some(ClickWaitUntil::Visible),
                    timeout_ms: Some(3000),
                },
                ActionConfig::SelectRadio {
                    xpath: "//*[@id=\"radio-email\"]".to_string(),
                    iframe_xpath: None,
                    wait_until: Some(ClickWaitUntil::Visible),
                    timeout_ms: Some(3000),
                },
                ActionConfig::DragAndDrop {
                    source_xpath: "//*[@id=\"source\"]".to_string(),
                    target_xpath: "//*[@id=\"target\"]".to_string(),
                    iframe_xpath: None,
                    wait_until: Some(ClickWaitUntil::Visible),
                    timeout_ms: Some(3000),
                },
            ],
            cancel,
        )
        .await
        .expect("run phase one steps");

    assert_eq!(outcome.status, RunnerStatus::Success);
    assert_eq!(
        outcome
            .session
            .evaluate_string("document.getElementById('double-result').textContent")
            .await
            .expect("double click result"),
        "double"
    );
    assert_eq!(
        outcome
            .session
            .evaluate_string("document.getElementById('right-result').textContent")
            .await
            .expect("right click result"),
        "right"
    );
    assert_eq!(
        outcome
            .session
            .evaluate_string("document.getElementById('focus-result').textContent")
            .await
            .expect("focus result"),
        "focused"
    );
    assert_eq!(
        outcome
            .session
            .evaluate_string("document.getElementById('blur-result').textContent")
            .await
            .expect("blur result"),
        "blurred"
    );
    assert_eq!(
        outcome
            .session
            .evaluate_string("document.getElementById('search').value")
            .await
            .expect("typed value"),
        "abc"
    );
    assert_eq!(
        outcome
            .session
            .evaluate_string("document.getElementById('notes').value")
            .await
            .expect("pasted value"),
        " pasted"
    );
    assert_eq!(
        outcome
            .session
            .evaluate_string("String(document.getElementById('terms').checked)")
            .await
            .expect("checkbox value"),
        "true"
    );
    assert_eq!(
        outcome
            .session
            .evaluate_string("String(document.getElementById('radio-email').checked)")
            .await
            .expect("radio value"),
        "true"
    );
    assert_eq!(
        outcome
            .session
            .evaluate_string("document.getElementById('drop-result').textContent")
            .await
            .expect("drop result"),
        "dropped"
    );

    outcome.session.close().await.expect("close browser");
}
