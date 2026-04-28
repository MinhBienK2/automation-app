use std::{
    fs,
    io::{Read, Write},
    net::TcpListener,
    path::PathBuf,
    thread,
    time::Duration,
};

use uuid::Uuid;
use workflow_automation_manager_lib::{
    domain::{
        ActionConfig, AssertElementState, AssertTextMatchMode, ClickWaitUntil, ScrollDirection,
        StopWorkflowStatus, WaitCondition, WorkflowCondition,
    },
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

fn write_phase_two_test_page() -> (String, String) {
    let page_path = std::env::temp_dir().join(format!("wam-phase-two-{}.html", Uuid::new_v4()));
    let upload_path = std::env::temp_dir().join(format!("wam-upload-{}.txt", Uuid::new_v4()));
    fs::write(&upload_path, "upload contents").expect("write upload file");
    fs::write(
        &page_path,
        r#"
        <!doctype html>
        <html>
          <body>
            <form id="form" onsubmit="event.preventDefault(); document.getElementById('submit-result').textContent = 'submitted'">
              <input id="file" type="file" onchange="document.getElementById('upload-result').textContent = this.files[0]?.name || 'none'" />
              <button id="submit" type="submit">Submit</button>
            </form>
            <button id="combo" role="combobox" onclick="document.getElementById('option-vn').hidden = false">Country</button>
            <button id="option-vn" role="option" hidden onclick="document.getElementById('custom-result').textContent = 'Vietnam'">Vietnam</button>
            <div id="editor" contenteditable="true">Old</div>
            <div id="upload-result">idle</div>
            <div id="custom-result">idle</div>
            <div id="submit-result">idle</div>
          </body>
        </html>
        "#,
    )
    .expect("write phase two test page");

    (
        format!("file://{}", page_path.display()),
        upload_path.display().to_string(),
    )
}

fn write_phase_four_test_page() -> (String, String) {
    let page_path = std::env::temp_dir().join(format!("wam-phase-four-{}.html", Uuid::new_v4()));
    let screenshot_path =
        std::env::temp_dir().join(format!("wam-screenshot-{}.png", Uuid::new_v4()));
    fs::write(
        &page_path,
        r#"
        <!doctype html>
        <html>
          <body>
            <h1 id="title">Quarterly Report</h1>
            <a id="link" href="/orders/42" data-id="order-42">Order link</a>
            <input id="email" value="user@example.com" />
            <ul id="items">
              <li>Alpha</li>
              <li>Beta</li>
            </ul>
            <table id="orders">
              <tr><th>ID</th><th>Status</th></tr>
              <tr><td>42</td><td>Paid</td></tr>
            </table>
          </body>
        </html>
        "#,
    )
    .expect("write phase four test page");

    (
        format!("file://{}", page_path.display()),
        screenshot_path.display().to_string(),
    )
}

fn write_phase_three_test_pages() -> (String, String) {
    let page_one_path =
        std::env::temp_dir().join(format!("wam-phase-three-one-{}.html", Uuid::new_v4()));
    let page_two_path =
        std::env::temp_dir().join(format!("wam-phase-three-two-{}.html", Uuid::new_v4()));
    fs::write(
        &page_one_path,
        r#"
        <!doctype html>
        <html>
          <head><title>Page One</title></head>
          <body><h1 id="title">Page One</h1></body>
        </html>
        "#,
    )
    .expect("write phase three page one");
    fs::write(
        &page_two_path,
        r#"
        <!doctype html>
        <html>
          <head><title>Page Two</title></head>
          <body><h1 id="title">Page Two</h1></body>
        </html>
        "#,
    )
    .expect("write phase three page two");

    (
        format!("file://{}", page_one_path.display()),
        format!("file://{}", page_two_path.display()),
    )
}

fn write_phase_three_frame_dialog_download_page() -> (String, String) {
    let page_path =
        std::env::temp_dir().join(format!("wam-phase-three-context-{}.html", Uuid::new_v4()));
    let download_dir = std::env::temp_dir().join(format!("wam-downloads-{}", Uuid::new_v4()));
    fs::create_dir_all(&download_dir).expect("create download dir");
    fs::write(
        &page_path,
        r#"
        <!doctype html>
        <html>
          <body>
            <iframe id="checkout-frame" srcdoc='<input id="frame-input" /><div id="frame-label">Frame Ready</div>'></iframe>
            <button id="prompt" onclick="setTimeout(() => { document.getElementById('prompt-result').textContent = window.prompt('Approve?', '') || 'empty'; }, 0)">Prompt</button>
            <button id="confirm" onclick="setTimeout(() => { document.getElementById('confirm-result').textContent = window.confirm('Cancel?') ? 'accepted' : 'dismissed'; }, 0)">Confirm</button>
            <a id="download" download="invoice.txt" href="data:text/plain,invoice-42">Download</a>
            <div id="prompt-result">idle</div>
            <div id="confirm-result">idle</div>
          </body>
        </html>
        "#,
    )
    .expect("write phase three context page");

    (
        format!("file://{}", page_path.display()),
        download_dir.display().to_string(),
    )
}

fn write_phase_five_logic_page() -> String {
    let page_path = std::env::temp_dir().join(format!("wam-phase-five-{}.html", Uuid::new_v4()));
    fs::write(
        &page_path,
        r#"
        <!doctype html>
        <html>
          <body>
            <input id="name" />
            <button id="increment" onclick="document.getElementById('count').textContent = String(Number(document.getElementById('count').textContent) + 1)">Increment</button>
            <div id="status">Ready</div>
            <div id="count">0</div>
            <script>
              setTimeout(() => {
                document.getElementById('status').textContent = 'Eventually Ready';
              }, 250);
            </script>
          </body>
        </html>
        "#,
    )
    .expect("write phase five logic page");

    format!("file://{}", page_path.display())
}

fn write_phase_six_session_page() -> (String, String) {
    let session_path = std::env::temp_dir().join(format!("wam-session-{}.json", Uuid::new_v4()));
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind phase six server");
    let address = listener.local_addr().expect("phase six server address");
    let html = r#"
        <!doctype html>
        <html>
          <body>
            <input id="password" />
            <button id="save-local" onclick="localStorage.setItem('profileKey', 'kept')">Save Local</button>
            <button id="read-local" onclick="document.getElementById('status').textContent = localStorage.getItem('profileKey') || ''">Read Local</button>
            <button id="read-cookie" onclick="document.getElementById('cookie').textContent = document.cookie">Read Cookie</button>
            <div id="status"></div>
            <div id="cookie"></div>
          </body>
        </html>
        "#
    .as_bytes()
    .to_vec();
    thread::spawn(move || {
        for stream in listener.incoming().take(16) {
            let mut stream = stream.expect("phase six server stream");
            let mut buffer = [0; 1024];
            let _ = stream.read(&mut buffer);
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\n\r\n",
                html.len()
            );
            if stream.write_all(response.as_bytes()).is_ok() {
                let _ = stream.write_all(&html);
            }
        }
    });

    (
        format!("http://{address}/"),
        session_path.display().to_string(),
    )
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

#[tokio::test]
#[ignore = "requires a local Chromium/Chrome process that can launch headed in this environment"]
async fn runner_executes_phase_two_form_and_file_actions_against_visible_chromium() {
    let (url, upload_file) = write_phase_two_test_page();
    let upload_name = PathBuf::from(&upload_file)
        .file_name()
        .expect("upload file name")
        .to_string_lossy()
        .to_string();
    let cancel = RunnerCancellation::new();

    let mut outcome = runner()
        .run_steps(
            vec![
                ActionConfig::OpenUrl { url },
                ActionConfig::UploadFile {
                    xpath: "//*[@id=\"file\"]".to_string(),
                    iframe_xpath: None,
                    files: vec![upload_file],
                    wait_until: Some(ClickWaitUntil::Visible),
                    timeout_ms: Some(3000),
                },
                ActionConfig::SetContenteditable {
                    xpath: "//*[@id=\"editor\"]".to_string(),
                    iframe_xpath: None,
                    text: "New editor text".to_string(),
                    clear_before_input: true,
                    wait_until: Some(ClickWaitUntil::Visible),
                    timeout_ms: Some(3000),
                },
                ActionConfig::SelectCustomOption {
                    trigger_xpath: "//*[@id=\"combo\"]".to_string(),
                    option_text: "Vietnam".to_string(),
                    iframe_xpath: None,
                    timeout_ms: Some(3000),
                },
                ActionConfig::SubmitForm {
                    xpath: Some("//*[@id=\"form\"]".to_string()),
                    iframe_xpath: None,
                    wait_until: Some(ClickWaitUntil::Visible),
                    timeout_ms: Some(3000),
                },
            ],
            cancel,
        )
        .await
        .expect("run phase two steps");

    assert_eq!(outcome.status, RunnerStatus::Success);
    assert_eq!(
        outcome
            .session
            .evaluate_string("document.getElementById('file').files[0].name")
            .await
            .expect("uploaded file name"),
        upload_name
    );
    assert_eq!(
        outcome
            .session
            .evaluate_string("document.getElementById('editor').textContent")
            .await
            .expect("editor content"),
        "New editor text"
    );
    assert_eq!(
        outcome
            .session
            .evaluate_string("document.getElementById('custom-result').textContent")
            .await
            .expect("custom select result"),
        "Vietnam"
    );
    assert_eq!(
        outcome
            .session
            .evaluate_string("document.getElementById('submit-result').textContent")
            .await
            .expect("submit result"),
        "submitted"
    );

    outcome.session.close().await.expect("close browser");
}

#[tokio::test]
#[ignore = "requires a local Chromium/Chrome process that can launch headed in this environment"]
async fn runner_executes_phase_four_data_capture_actions_against_visible_chromium() {
    let (url, screenshot_path) = write_phase_four_test_page();
    let cancel = RunnerCancellation::new();

    let mut outcome = runner()
        .run_steps(
            vec![
                ActionConfig::OpenUrl { url },
                ActionConfig::ExtractText {
                    xpath: "//*[@id=\"title\"]".to_string(),
                    iframe_xpath: None,
                    output_name: "title".to_string(),
                    timeout_ms: Some(3000),
                },
                ActionConfig::ExtractAttribute {
                    xpath: "//*[@id=\"link\"]".to_string(),
                    iframe_xpath: None,
                    attribute: "data-id".to_string(),
                    output_name: "link_id".to_string(),
                    timeout_ms: Some(3000),
                },
                ActionConfig::ExtractInputValue {
                    xpath: "//*[@id=\"email\"]".to_string(),
                    iframe_xpath: None,
                    output_name: "email".to_string(),
                    timeout_ms: Some(3000),
                },
                ActionConfig::ExtractList {
                    xpath: "//*[@id=\"items\"]".to_string(),
                    iframe_xpath: None,
                    output_name: "items".to_string(),
                    timeout_ms: Some(3000),
                },
                ActionConfig::ExtractTable {
                    xpath: "//*[@id=\"orders\"]".to_string(),
                    iframe_xpath: None,
                    output_name: "orders".to_string(),
                    timeout_ms: Some(3000),
                },
                ActionConfig::TakeScreenshot {
                    path: screenshot_path.clone(),
                    output_name: Some("screenshot_path".to_string()),
                    full_page: false,
                },
            ],
            cancel,
        )
        .await
        .expect("run phase four steps");

    assert_eq!(outcome.status, RunnerStatus::Success);
    let outputs_json = outcome
        .session
        .evaluate_string("JSON.stringify(window.__wamOutputs)")
        .await
        .expect("outputs json");
    let outputs: serde_json::Value = serde_json::from_str(&outputs_json).expect("outputs");

    assert_eq!(outputs["title"], "Quarterly Report");
    assert_eq!(outputs["link_id"], "order-42");
    assert_eq!(outputs["email"], "user@example.com");
    assert_eq!(outputs["items"][0], "Alpha");
    assert_eq!(outputs["orders"][1][1], "Paid");
    assert_eq!(outputs["screenshot_path"], screenshot_path);
    assert!(PathBuf::from(&screenshot_path).is_file());

    outcome.session.close().await.expect("close browser");
}

#[tokio::test]
#[ignore = "requires a local Chromium/Chrome process that can launch headed in this environment"]
async fn runner_executes_phase_three_browser_context_actions_against_visible_chromium() {
    let (page_one, page_two) = write_phase_three_test_pages();
    let cancel = RunnerCancellation::new();

    let mut outcome = runner()
        .run_steps(
            vec![
                ActionConfig::OpenUrl {
                    url: page_one.clone(),
                },
                ActionConfig::Navigate {
                    url: page_two.clone(),
                    wait_until: None,
                    timeout_ms: None,
                },
                ActionConfig::GoBack {},
                ActionConfig::Wait {
                    condition: WaitCondition::TextVisible,
                    xpath: None,
                    text: Some("Page One".to_string()),
                    url: None,
                    duration_ms: None,
                    timeout_ms: Some(3000),
                },
                ActionConfig::GoForward {},
                ActionConfig::Wait {
                    condition: WaitCondition::TextVisible,
                    xpath: None,
                    text: Some("Page Two".to_string()),
                    url: None,
                    duration_ms: None,
                    timeout_ms: Some(3000),
                },
                ActionConfig::Reload {},
                ActionConfig::OpenNewTab {
                    url: Some(page_one.clone()),
                },
                ActionConfig::SwitchTab { index: 0 },
                ActionConfig::ExtractText {
                    xpath: "//*[@id=\"title\"]".to_string(),
                    iframe_xpath: None,
                    output_name: "tab_zero_title".to_string(),
                    timeout_ms: Some(3000),
                },
                ActionConfig::SwitchTab { index: 1 },
                ActionConfig::ExtractText {
                    xpath: "//*[@id=\"title\"]".to_string(),
                    iframe_xpath: None,
                    output_name: "tab_one_title".to_string(),
                    timeout_ms: Some(3000),
                },
                ActionConfig::CloseTab { index: Some(1) },
                ActionConfig::ExtractText {
                    xpath: "//*[@id=\"title\"]".to_string(),
                    iframe_xpath: None,
                    output_name: "after_close_title".to_string(),
                    timeout_ms: Some(3000),
                },
            ],
            cancel,
        )
        .await
        .expect("run phase three steps");

    assert_eq!(outcome.status, RunnerStatus::Success);
    let outputs_json = outcome
        .session
        .evaluate_string("JSON.stringify(window.__wamOutputs)")
        .await
        .expect("outputs json");
    let outputs: serde_json::Value = serde_json::from_str(&outputs_json).expect("outputs");

    assert_eq!(outputs["tab_zero_title"], "Page Two");
    assert_eq!(outputs["after_close_title"], "Page Two");

    outcome.session.close().await.expect("close browser");
}

#[tokio::test]
#[ignore = "requires a local Chromium/Chrome process that can launch headed in this environment"]
async fn runner_executes_phase_three_frame_dialog_download_actions_against_visible_chromium() {
    let (url, download_dir) = write_phase_three_frame_dialog_download_page();
    let cancel = RunnerCancellation::new();

    let mut outcome = runner()
        .run_steps(
            vec![
                ActionConfig::OpenUrl { url },
                ActionConfig::SwitchFrame {
                    xpath: Some("//*[@id=\"checkout-frame\"]".to_string()),
                },
                ActionConfig::InputText {
                    xpath: "//*[@id=\"frame-input\"]".to_string(),
                    iframe_xpath: None,
                    text: "frame value".to_string(),
                    clear_before_input: true,
                    typing_mode: None,
                    delay_ms: None,
                    wait_until: None,
                    timeout_ms: Some(3000),
                },
                ActionConfig::ExtractInputValue {
                    xpath: "//*[@id=\"frame-input\"]".to_string(),
                    iframe_xpath: None,
                    output_name: "frame_value".to_string(),
                    timeout_ms: Some(3000),
                },
                ActionConfig::SwitchFrame { xpath: None },
                ActionConfig::Click {
                    xpath: "//*[@id=\"prompt\"]".to_string(),
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
                    timeout_ms: Some(3000),
                    retry_interval_ms: None,
                    post_click_wait_ms: Some(100),
                },
                ActionConfig::AcceptDialog {
                    prompt_text: Some("approved".to_string()),
                },
                ActionConfig::Click {
                    xpath: "//*[@id=\"confirm\"]".to_string(),
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
                    timeout_ms: Some(3000),
                    retry_interval_ms: None,
                    post_click_wait_ms: Some(100),
                },
                ActionConfig::DismissDialog {},
                ActionConfig::SetDownloadDirectory {
                    path: download_dir.clone(),
                },
                ActionConfig::Click {
                    xpath: "//*[@id=\"download\"]".to_string(),
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
                    timeout_ms: Some(3000),
                    retry_interval_ms: None,
                    post_click_wait_ms: None,
                },
                ActionConfig::WaitForDownload {
                    output_name: "download_path".to_string(),
                    timeout_ms: Some(5000),
                },
            ],
            cancel,
        )
        .await
        .expect("run phase three frame dialog download steps");

    assert_eq!(outcome.status, RunnerStatus::Success);
    assert_eq!(
        outcome
            .session
            .evaluate_string("document.getElementById('prompt-result').textContent")
            .await
            .expect("prompt result"),
        "approved"
    );
    assert_eq!(
        outcome
            .session
            .evaluate_string("document.getElementById('confirm-result').textContent")
            .await
            .expect("confirm result"),
        "dismissed"
    );
    let outputs_json = outcome
        .session
        .evaluate_string("JSON.stringify(window.__wamOutputs)")
        .await
        .expect("outputs json");
    let outputs: serde_json::Value = serde_json::from_str(&outputs_json).expect("outputs");
    assert_eq!(outputs["frame_value"], "frame value");
    let download_path = outputs["download_path"]
        .as_str()
        .expect("download path output");
    assert!(PathBuf::from(download_path).is_file());
    assert!(download_path.starts_with(&download_dir));

    outcome.session.close().await.expect("close browser");
}

#[tokio::test]
#[ignore = "requires a local Chromium/Chrome process that can launch headed in this environment"]
async fn runner_executes_phase_five_logic_actions_against_visible_chromium() {
    let url = write_phase_five_logic_page();
    let cancel = RunnerCancellation::new();

    let mut outcome = runner()
        .run_steps(
            vec![
                ActionConfig::OpenUrl { url },
                ActionConfig::SetVariable {
                    name: "customer".to_string(),
                    value: "Ada".to_string(),
                },
                ActionConfig::InputText {
                    xpath: "//*[@id=\"name\"]".to_string(),
                    iframe_xpath: None,
                    text: "Hello {{customer}}".to_string(),
                    clear_before_input: true,
                    typing_mode: None,
                    delay_ms: None,
                    wait_until: None,
                    timeout_ms: Some(3000),
                },
                ActionConfig::AssertElement {
                    xpath: "//*[@id=\"name\"]".to_string(),
                    iframe_xpath: None,
                    state: AssertElementState::Visible,
                    timeout_ms: Some(3000),
                },
                ActionConfig::AssertText {
                    xpath: Some("//*[@id=\"status\"]".to_string()),
                    iframe_xpath: None,
                    text: "Ready".to_string(),
                    match_mode: AssertTextMatchMode::Contains,
                    timeout_ms: Some(3000),
                },
                ActionConfig::IfCondition {
                    condition: WorkflowCondition::OutputEquals {
                        name: "customer".to_string(),
                        value: "Ada".to_string(),
                    },
                    then_steps: vec![ActionConfig::SetVariable {
                        name: "branch".to_string(),
                        value: "then".to_string(),
                    }],
                    else_steps: vec![ActionConfig::StopWorkflow {
                        status: StopWorkflowStatus::Failure,
                        reason: Some("wrong branch".to_string()),
                    }],
                },
                ActionConfig::RepeatTimes {
                    times: 2,
                    steps: vec![ActionConfig::Click {
                        xpath: "//*[@id=\"increment\"]".to_string(),
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
                        timeout_ms: Some(3000),
                        retry_interval_ms: None,
                        post_click_wait_ms: None,
                    }],
                },
                ActionConfig::RepeatForEach {
                    item_name: "item".to_string(),
                    items: vec!["One".to_string(), "Two".to_string()],
                    steps: vec![ActionConfig::SetVariable {
                        name: "last_item".to_string(),
                        value: "{{item}}".to_string(),
                    }],
                },
                ActionConfig::RetryBlock {
                    max_attempts: 3,
                    delay_ms: Some(200),
                    steps: vec![ActionConfig::AssertText {
                        xpath: Some("//*[@id=\"status\"]".to_string()),
                        iframe_xpath: None,
                        text: "Eventually Ready".to_string(),
                        match_mode: AssertTextMatchMode::Equals,
                        timeout_ms: Some(100),
                    }],
                },
                ActionConfig::StopWorkflow {
                    status: StopWorkflowStatus::Success,
                    reason: Some("done".to_string()),
                },
                ActionConfig::AssertText {
                    xpath: Some("//*[@id=\"status\"]".to_string()),
                    iframe_xpath: None,
                    text: "this should not run".to_string(),
                    match_mode: AssertTextMatchMode::Contains,
                    timeout_ms: Some(100),
                },
            ],
            cancel,
        )
        .await
        .expect("run phase five logic steps");

    assert_eq!(outcome.status, RunnerStatus::Success);
    assert_eq!(
        outcome
            .session
            .evaluate_string("document.getElementById('name').value")
            .await
            .expect("input value"),
        "Hello Ada"
    );
    assert_eq!(
        outcome
            .session
            .evaluate_string("document.getElementById('count').textContent")
            .await
            .expect("count"),
        "2"
    );
    let outputs_json = outcome
        .session
        .evaluate_string("JSON.stringify(window.__wamOutputs)")
        .await
        .expect("outputs json");
    let outputs: serde_json::Value = serde_json::from_str(&outputs_json).expect("outputs");
    assert_eq!(outputs["customer"], "Ada");
    assert_eq!(outputs["branch"], "then");
    assert_eq!(outputs["last_item"], "Two");

    outcome.session.close().await.expect("close browser");
}

#[tokio::test]
#[ignore = "requires a local Chromium/Chrome process that can launch headed in this environment"]
async fn runner_executes_phase_six_session_profile_secret_actions_against_visible_chromium() {
    let (url, session_path) = write_phase_six_session_page();
    let profile = format!("phase-six-{}", Uuid::new_v4());
    let cancel = RunnerCancellation::new();

    let mut first = runner()
        .run_steps(
            vec![
                ActionConfig::UseProfile {
                    name: profile.clone(),
                },
                ActionConfig::OpenUrl { url: url.clone() },
                ActionConfig::Click {
                    xpath: "//*[@id=\"save-local\"]".to_string(),
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
                    timeout_ms: Some(3000),
                    retry_interval_ms: None,
                    post_click_wait_ms: None,
                },
                ActionConfig::SaveSession {
                    path: session_path.clone(),
                },
            ],
            cancel.clone(),
        )
        .await
        .expect("run first phase six profile steps");
    assert_eq!(first.status, RunnerStatus::Success);
    first.session.close().await.expect("close first browser");

    let mut second = runner()
        .run_steps(
            vec![
                ActionConfig::UseProfile {
                    name: profile.clone(),
                },
                ActionConfig::OpenUrl { url: url.clone() },
                ActionConfig::Click {
                    xpath: "//*[@id=\"read-local\"]".to_string(),
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
                    timeout_ms: Some(3000),
                    retry_interval_ms: None,
                    post_click_wait_ms: None,
                },
                ActionConfig::AssertText {
                    xpath: Some("//*[@id=\"status\"]".to_string()),
                    iframe_xpath: None,
                    text: "kept".to_string(),
                    match_mode: AssertTextMatchMode::Equals,
                    timeout_ms: Some(3000),
                },
                ActionConfig::SetSecret {
                    name: "password".to_string(),
                    value: "s3cret".to_string(),
                },
                ActionConfig::InputText {
                    xpath: "//*[@id=\"password\"]".to_string(),
                    iframe_xpath: None,
                    text: "{{secret:password}}".to_string(),
                    clear_before_input: true,
                    typing_mode: None,
                    delay_ms: None,
                    wait_until: None,
                    timeout_ms: Some(3000),
                },
                ActionConfig::SetCookie {
                    name: "token".to_string(),
                    value: "abc".to_string(),
                    domain: None,
                    path: Some("/".to_string()),
                },
                ActionConfig::Click {
                    xpath: "//*[@id=\"read-cookie\"]".to_string(),
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
                    timeout_ms: Some(3000),
                    retry_interval_ms: None,
                    post_click_wait_ms: None,
                },
                ActionConfig::AssertText {
                    xpath: Some("//*[@id=\"cookie\"]".to_string()),
                    iframe_xpath: None,
                    text: "token=abc".to_string(),
                    match_mode: AssertTextMatchMode::Contains,
                    timeout_ms: Some(3000),
                },
                ActionConfig::ClearCookies { domain: None },
            ],
            cancel.clone(),
        )
        .await
        .expect("run second phase six profile steps");
    assert_eq!(second.failed_step, None);
    assert_eq!(second.status, RunnerStatus::Success);
    assert_eq!(
        second
            .session
            .evaluate_string("document.getElementById('password').value")
            .await
            .expect("password value"),
        "s3cret"
    );
    second.session.close().await.expect("close second browser");

    let mut third = runner()
        .run_steps(
            vec![
                ActionConfig::OpenUrl { url },
                ActionConfig::LoadSession { path: session_path },
                ActionConfig::Click {
                    xpath: "//*[@id=\"read-local\"]".to_string(),
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
                    timeout_ms: Some(3000),
                    retry_interval_ms: None,
                    post_click_wait_ms: None,
                },
                ActionConfig::AssertText {
                    xpath: Some("//*[@id=\"status\"]".to_string()),
                    iframe_xpath: None,
                    text: "kept".to_string(),
                    match_mode: AssertTextMatchMode::Equals,
                    timeout_ms: Some(3000),
                },
            ],
            cancel,
        )
        .await
        .expect("run third phase six session steps");
    assert_eq!(third.status, RunnerStatus::Success);
    third.session.close().await.expect("close third browser");
}
