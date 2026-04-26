use std::{fs, path::PathBuf, time::Duration};

use uuid::Uuid;
use workflow_automation_manager_lib::{
    domain::{ActionConfig, ScrollDirection},
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

fn runner() -> BrowserRunner {
    BrowserRunner::new(RunnerOptions {
        headed: true,
        chrome_executable: chrome_path(),
    })
}

#[tokio::test]
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
                },
                ActionConfig::Scroll {
                    direction: ScrollDirection::Down,
                    pixels: 400,
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
async fn runner_fails_immediately_when_xpath_is_missing_and_keeps_browser_open() {
    let url = write_test_page();
    let cancel = RunnerCancellation::new();

    let mut outcome = runner()
        .run_steps(
            vec![
                ActionConfig::OpenUrl { url },
                ActionConfig::Click {
                    xpath: "//*[@id=\"missing\"]".to_string(),
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
                        direction: ScrollDirection::Down,
                        pixels: 400,
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
