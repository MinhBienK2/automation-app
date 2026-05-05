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
        ActionConfig, AssertElementState, AssertTextMatchMode, ClickWaitUntil, HeaderPair,
        ScrollDirection, StopWorkflowStatus, WaitCondition, WorkflowCondition,
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

fn phase_seven_server() -> String {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind phase seven server");
    let address = listener.local_addr().expect("phase seven address");

    thread::spawn(move || {
        for stream in listener.incoming().take(4) {
            let mut stream = stream.expect("accept phase seven request");
            let mut request = [0; 8192];
            let bytes = stream.read(&mut request).expect("read phase seven request");
            let request = String::from_utf8_lossy(&request[..bytes]);
            let header_value = if request
                .lines()
                .any(|line| line.eq_ignore_ascii_case("X-WAM-Phase: seven"))
            {
                "seven"
            } else {
                "missing"
            };
            let body = format!(
                r#"<!doctype html>
                <html>
                  <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                  </head>
                  <body>
                    <div id="ua"></div>
                    <div id="viewport"></div>
                    <div id="headers">{header_value}</div>
                    <div id="geo">pending</div>
                    <script>
                      document.getElementById('ua').textContent = navigator.userAgent;
                      document.getElementById('viewport').textContent = window.innerWidth + 'x' + window.innerHeight + '|touch=' + navigator.maxTouchPoints;
                      navigator.geolocation.getCurrentPosition(
                        (position) => {{
                          document.getElementById('geo').textContent =
                            position.coords.latitude.toFixed(2) + ',' + position.coords.longitude.toFixed(2);
                        }},
                        (error) => {{
                          document.getElementById('geo').textContent = 'error:' + error.code;
                        }}
                      );
                    </script>
                  </body>
                </html>"#
            );
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            );
            stream
                .write_all(response.as_bytes())
                .expect("write phase seven response");
        }
    });

    format!("http://{}", address)
}

fn write_phase_eight_challenge_page() -> String {
    let path = std::env::temp_dir().join(format!("wam-phase-eight-{}.html", Uuid::new_v4()));
    fs::write(
        &path,
        r#"
        <!doctype html>
        <html>
          <body>
            <section id="challenge">Verify you are human before continuing</section>
            <button id="solve" onclick="document.getElementById('challenge').remove(); document.getElementById('content').hidden = false">Solved</button>
            <main id="content" hidden>Welcome after verification</main>
          </body>
        </html>
        "#,
    )
    .expect("write phase eight challenge page");

    format!("file://{}", path.display())
}

fn write_phase_nine_reliability_page() -> (String, String) {
    let path = std::env::temp_dir().join(format!("wam-phase-nine-{}.html", Uuid::new_v4()));
    let checkpoint_path =
        std::env::temp_dir().join(format!("wam-phase-nine-checkpoint-{}.png", Uuid::new_v4()));
    fs::write(
        &path,
        r#"
        <!doctype html>
        <html>
          <body>
            <button id="real-save" onclick="document.getElementById('status').textContent = 'Saved'">Save</button>
            <div id="status">Loading</div>
            <script>
              setTimeout(() => {
                document.getElementById('status').textContent = 'Ready';
              }, 350);
            </script>
          </body>
        </html>
        "#,
    )
    .expect("write phase nine reliability page");

    (
        format!("file://{}", path.display()),
        checkpoint_path.display().to_string(),
    )
}

fn phase_eleven_server() -> String {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind phase eleven server");
    let address = listener.local_addr().expect("phase eleven address");

    thread::spawn(move || {
        for stream in listener.incoming().take(8) {
            let mut stream = stream.expect("accept phase eleven request");
            let mut request = [0; 8192];
            let bytes = stream
                .read(&mut request)
                .expect("read phase eleven request");
            let request = String::from_utf8_lossy(&request[..bytes]);
            let first_line = request.lines().next().unwrap_or_default();
            let (content_type, body) = if first_line.contains("/api/live") {
                ("application/json", r#"{"name":"live"}"#.to_string())
            } else {
                (
                    "text/html",
                    r#"<!doctype html>
                    <html>
                      <body>
                        <button id="live-button" onclick="fetch('/api/live').then(r => r.json()).then(data => document.getElementById('live').textContent = data.name)">Live</button>
                        <button id="mock-button" onclick="fetch('/api/mock').then(r => r.json()).then(data => document.getElementById('mock').textContent = data.name)">Mock</button>
                        <button id="blocked-button" onclick="fetch('/analytics').catch(() => document.getElementById('blocked').textContent = 'blocked')">Blocked</button>
                        <div id="live">idle</div>
                        <div id="mock">idle</div>
                        <div id="blocked">idle</div>
                      </body>
                    </html>"#
                        .to_string(),
                )
            };
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            );
            stream
                .write_all(response.as_bytes())
                .expect("write phase eleven response");
        }
    });

    format!("http://{}", address)
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
                ActionConfig::Navigate {
                    url,
                    wait_until: None,
                    timeout_ms: None,
                },
                ActionConfig::Wait {
                    condition: WaitCondition::Duration,
                    xpath: None,
                    text: None,
                    url: None,
                    duration_ms: Some((0.2 * 1000.0) as u64),
                    timeout_ms: None,
                },
                ActionConfig::InputText {
                    xpath: "//*[@name=\"email\"]".to_string(),
                    iframe_xpath: None,
                    text: "user@example.com".to_string(),
                    clear_before_input: true,
                    typing_mode: None,
                    delay_ms: None,
                    wait_until: None,
                    timeout_ms: None,
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
                ActionConfig::Navigate {
                    url,
                    wait_until: None,
                    timeout_ms: None,
                },
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
                    ActionConfig::Navigate {
                        url,
                        wait_until: None,
                        timeout_ms: None,
                    },
                    ActionConfig::Wait {
                        condition: WaitCondition::Duration,
                        xpath: None,
                        text: None,
                        url: None,
                        duration_ms: Some((10.0 * 1000.0) as u64),
                        timeout_ms: None,
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
                ActionConfig::Navigate {
                    url,
                    wait_until: None,
                    timeout_ms: None,
                },
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
                ActionConfig::Navigate {
                    url,
                    wait_until: None,
                    timeout_ms: None,
                },
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
                ActionConfig::Navigate {
                    url,
                    wait_until: None,
                    timeout_ms: None,
                },
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
                ActionConfig::Navigate {
                    url: page_one.clone(),
                    wait_until: None,
                    timeout_ms: None,
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
                ActionConfig::Navigate {
                    url,
                    wait_until: None,
                    timeout_ms: None,
                },
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
                ActionConfig::Navigate {
                    url,
                    wait_until: None,
                    timeout_ms: None,
                },
                ActionConfig::SetVariable {
                    name: Some("customer".to_string()),
                    value: Some("Ada".to_string()),
                    value_type: None,
                    variables: Vec::new(),
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
                        name: Some("branch".to_string()),
                        value: Some("then".to_string()),
                        value_type: None,
                        variables: Vec::new(),
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
                    array_variable: None,
                    items: vec!["One".to_string(), "Two".to_string()],
                    steps: vec![ActionConfig::SetVariable {
                        name: Some("last_item".to_string()),
                        value: Some("{{item}}".to_string()),
                        value_type: None,
                        variables: Vec::new(),
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
                    failed_steps: Vec::new(),
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
async fn runner_fails_try_catch_when_error_branch_is_missing() {
    let url = write_phase_five_logic_page();
    let cancel = RunnerCancellation::new();

    let mut outcome = runner()
        .run_steps(
            vec![
                ActionConfig::Navigate {
                    url,
                    wait_until: None,
                    timeout_ms: None,
                },
                ActionConfig::TryCatch {
                    try_steps: vec![ActionConfig::AssertText {
                        xpath: Some("//*[@id=\"status\"]".to_string()),
                        iframe_xpath: None,
                        text: "Missing".to_string(),
                        match_mode: AssertTextMatchMode::Equals,
                        timeout_ms: Some(100),
                    }],
                    success_steps: Vec::new(),
                    error_steps: Vec::new(),
                    finally_steps: Vec::new(),
                },
            ],
            cancel,
        )
        .await
        .expect("run try/catch missing error branch");
    let status = outcome.status;
    let reason = outcome
        .failed_step
        .as_ref()
        .map(|step| step.reason.clone())
        .unwrap_or_default();
    outcome.session.close().await.expect("close browser");

    assert_eq!(status, RunnerStatus::Failed);
    assert!(
        reason.contains("Missing")
            || reason.contains("Expected text")
            || reason.contains("Text assertion failed"),
        "{reason}"
    );
}

#[tokio::test]
#[ignore = "requires a local Chromium/Chrome process that can launch headed in this environment"]
async fn runner_fails_fallback_when_fallback_branch_is_missing() {
    let url = write_phase_five_logic_page();
    let cancel = RunnerCancellation::new();

    let mut outcome = runner()
        .run_steps(
            vec![
                ActionConfig::Navigate {
                    url,
                    wait_until: None,
                    timeout_ms: None,
                },
                ActionConfig::FallbackBlock {
                    primary_steps: vec![ActionConfig::AssertText {
                        xpath: Some("//*[@id=\"status\"]".to_string()),
                        iframe_xpath: None,
                        text: "Missing".to_string(),
                        match_mode: AssertTextMatchMode::Equals,
                        timeout_ms: Some(100),
                    }],
                    fallback_steps: Vec::new(),
                },
            ],
            cancel,
        )
        .await
        .expect("run fallback missing fallback branch");
    let status = outcome.status;
    let reason = outcome
        .failed_step
        .as_ref()
        .map(|step| step.reason.clone())
        .unwrap_or_default();
    outcome.session.close().await.expect("close browser");

    assert_eq!(status, RunnerStatus::Failed);
    assert!(
        reason.contains("Missing")
            || reason.contains("Expected text")
            || reason.contains("Text assertion failed"),
        "{reason}"
    );
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
                ActionConfig::Navigate {
                    url: url.clone(),
                    wait_until: None,
                    timeout_ms: None,
                },
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
                ActionConfig::Navigate {
                    url: url.clone(),
                    wait_until: None,
                    timeout_ms: None,
                },
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
                ActionConfig::Navigate {
                    url,
                    wait_until: None,
                    timeout_ms: None,
                },
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

#[tokio::test]
#[ignore = "requires a local Chromium/Chrome process that can launch headed in this environment"]
async fn runner_executes_phase_seven_network_device_actions_against_visible_chromium() {
    let url = phase_seven_server();
    let cancel = RunnerCancellation::new();

    let mut outcome = runner()
        .run_steps(
            vec![
                ActionConfig::SetUserAgent {
                    user_agent: "WAMPhaseSeven/1.0".to_string(),
                },
                ActionConfig::SetViewport {
                    width: 390,
                    height: 844,
                    device_scale_factor: Some(2.0),
                    mobile: true,
                    touch: true,
                },
                ActionConfig::GrantPermission {
                    origin: Some(url.clone()),
                    permissions: vec!["geolocation".to_string()],
                },
                ActionConfig::SetGeolocation {
                    latitude: 10.77,
                    longitude: 106.70,
                    accuracy: Some(10.0),
                },
                ActionConfig::SetExtraHeaders {
                    headers: vec![HeaderPair {
                        name: "X-WAM-Phase".to_string(),
                        value: "seven".to_string(),
                    }],
                },
                ActionConfig::Navigate {
                    url,
                    wait_until: None,
                    timeout_ms: None,
                },
                ActionConfig::AssertText {
                    xpath: Some("//*[@id=\"ua\"]".to_string()),
                    iframe_xpath: None,
                    text: "WAMPhaseSeven/1.0".to_string(),
                    match_mode: AssertTextMatchMode::Contains,
                    timeout_ms: Some(3000),
                },
                ActionConfig::AssertText {
                    xpath: Some("//*[@id=\"viewport\"]".to_string()),
                    iframe_xpath: None,
                    text: "390x".to_string(),
                    match_mode: AssertTextMatchMode::Contains,
                    timeout_ms: Some(3000),
                },
                ActionConfig::AssertText {
                    xpath: Some("//*[@id=\"headers\"]".to_string()),
                    iframe_xpath: None,
                    text: "seven".to_string(),
                    match_mode: AssertTextMatchMode::Equals,
                    timeout_ms: Some(3000),
                },
                ActionConfig::AssertText {
                    xpath: Some("//*[@id=\"geo\"]".to_string()),
                    iframe_xpath: None,
                    text: "10.77,106.70".to_string(),
                    match_mode: AssertTextMatchMode::Equals,
                    timeout_ms: Some(5000),
                },
            ],
            cancel,
        )
        .await
        .expect("run phase seven network device steps");

    assert_eq!(outcome.failed_step, None);
    assert_eq!(outcome.status, RunnerStatus::Success);
    outcome.session.close().await.expect("close browser");
}

#[tokio::test]
#[ignore = "requires a local Chromium/Chrome process that can launch headed in this environment"]
async fn runner_executes_phase_eight_human_verification_actions_against_visible_chromium() {
    let url = write_phase_eight_challenge_page();
    let cancel = RunnerCancellation::new();

    let mut outcome = runner()
        .run_steps(
            vec![
                ActionConfig::Navigate {
                    url,
                    wait_until: None,
                    timeout_ms: None,
                },
                ActionConfig::DetectChallenge {
                    output_name: "challenge_found".to_string(),
                    patterns: vec!["verify you are human".to_string(), "captcha".to_string()],
                    timeout_ms: Some(1000),
                },
                ActionConfig::PauseForHuman {
                    reason: "Manual verification required".to_string(),
                    timeout_ms: Some(100),
                },
                ActionConfig::Click {
                    xpath: "//*[@id=\"solve\"]".to_string(),
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
                ActionConfig::ResumeWhenCondition {
                    condition: WorkflowCondition::ElementVisible {
                        xpath: "//*[@id=\"content\"]".to_string(),
                    },
                    timeout_ms: Some(3000),
                },
                ActionConfig::AssertText {
                    xpath: Some("//*[@id=\"content\"]".to_string()),
                    iframe_xpath: None,
                    text: "Welcome after verification".to_string(),
                    match_mode: AssertTextMatchMode::Equals,
                    timeout_ms: Some(3000),
                },
            ],
            cancel,
        )
        .await
        .expect("run phase eight human verification steps");

    assert_eq!(outcome.failed_step, None);
    assert_eq!(outcome.status, RunnerStatus::Success);
    let outputs_json = outcome
        .session
        .evaluate_string("JSON.stringify(window.__wamOutputs)")
        .await
        .expect("outputs json");
    let outputs: serde_json::Value = serde_json::from_str(&outputs_json).expect("outputs");
    assert_eq!(outputs["challenge_found"], "true");
    assert_eq!(
        outputs["human_verification_pause"],
        "Manual verification required"
    );
    outcome.session.close().await.expect("close browser");
}

#[tokio::test]
#[ignore = "requires a local Chromium/Chrome process that can launch headed in this environment"]
async fn runner_executes_phase_nine_reliability_actions_against_visible_chromium() {
    let (url, checkpoint_path) = write_phase_nine_reliability_page();
    let cancel = RunnerCancellation::new();

    let mut outcome = runner()
        .run_steps(
            vec![
                ActionConfig::Navigate {
                    url,
                    wait_until: None,
                    timeout_ms: None,
                },
                ActionConfig::FallbackSelector {
                    output_name: "save_xpath".to_string(),
                    xpaths: vec![
                        "//*[@id=\"missing-save\"]".to_string(),
                        "//*[@id=\"real-save\"]".to_string(),
                    ],
                    timeout_ms: Some(1000),
                },
                ActionConfig::RetryStep {
                    max_attempts: 5,
                    delay_ms: Some(150),
                    step: Box::new(ActionConfig::AssertText {
                        xpath: Some("//*[@id=\"status\"]".to_string()),
                        iframe_xpath: None,
                        text: "Ready".to_string(),
                        match_mode: AssertTextMatchMode::Equals,
                        timeout_ms: Some(100),
                    }),
                },
                ActionConfig::Click {
                    xpath: "//*[@id=\"real-save\"]".to_string(),
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
                ActionConfig::Checkpoint {
                    name: "after_save".to_string(),
                    screenshot_path: Some(checkpoint_path.clone()),
                },
                ActionConfig::AssertText {
                    xpath: Some("//*[@id=\"status\"]".to_string()),
                    iframe_xpath: None,
                    text: "Saved".to_string(),
                    match_mode: AssertTextMatchMode::Equals,
                    timeout_ms: Some(3000),
                },
            ],
            cancel,
        )
        .await
        .expect("run phase nine reliability steps");

    assert_eq!(outcome.failed_step, None);
    assert_eq!(outcome.status, RunnerStatus::Success);
    assert!(PathBuf::from(&checkpoint_path).exists());
    let outputs_json = outcome
        .session
        .evaluate_string("JSON.stringify(window.__wamOutputs)")
        .await
        .expect("outputs json");
    let outputs: serde_json::Value = serde_json::from_str(&outputs_json).expect("outputs");
    assert_eq!(outputs["save_xpath"], "//*[@id=\"real-save\"]");
    assert_eq!(outputs["checkpoint:after_save"], checkpoint_path);
    outcome.session.close().await.expect("close browser");
}

#[tokio::test]
#[ignore = "requires a local Chromium/Chrome process that can launch headed in this environment"]
async fn runner_adds_failure_screenshot_path_to_failed_step_reason() {
    let (url, _) = write_phase_nine_reliability_page();
    let cancel = RunnerCancellation::new();

    let mut outcome = runner()
        .run_steps(
            vec![
                ActionConfig::Navigate {
                    url,
                    wait_until: None,
                    timeout_ms: None,
                },
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
                    timeout_ms: Some(200),
                    retry_interval_ms: None,
                    post_click_wait_ms: None,
                },
            ],
            cancel,
        )
        .await
        .expect("run failing phase nine steps");

    assert_eq!(outcome.status, RunnerStatus::Failed);
    let failed = outcome.failed_step.expect("failed step");
    assert!(failed.reason.contains("Failure screenshot: "));
    let screenshot_path = failed
        .reason
        .split("Failure screenshot: ")
        .nth(1)
        .expect("screenshot path")
        .trim();
    assert!(PathBuf::from(screenshot_path).exists());
    outcome.session.close().await.expect("close browser");
}

#[tokio::test]
#[ignore = "requires a local Chromium/Chrome process that can launch headed in this environment"]
async fn runner_executes_phase_eleven_advanced_runtime_actions_against_visible_chromium() {
    let url = phase_eleven_server();
    let cancel = RunnerCancellation::new();

    let mut outcome = runner()
        .run_steps(
            vec![
                ActionConfig::Navigate { url, wait_until: None, timeout_ms: None },
                ActionConfig::SetLocalStorage {
                    key: "token".to_string(),
                    value: "local".to_string(),
                },
                ActionConfig::SetSessionStorage {
                    key: "token".to_string(),
                    value: "session".to_string(),
                },
                ActionConfig::ExecuteJs {
                    script: "return localStorage.getItem('token') + '|' + sessionStorage.getItem('token');".to_string(),
                    output_name: Some("storage_tokens".to_string()),
                    timeout_ms: Some(1000),
                },
                ActionConfig::MockResponse {
                    url_contains: "/api/mock".to_string(),
                    status: 200,
                    body: r#"{"name":"mocked"}"#.to_string(),
                    content_type: Some("application/json".to_string()),
                },
                ActionConfig::BlockRequest {
                    url_patterns: vec!["/analytics".to_string()],
                },
                ActionConfig::Click {
                    xpath: "//*[@id=\"live-button\"]".to_string(),
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
                ActionConfig::WaitForRequest {
                    url_contains: "/api/live".to_string(),
                    timeout_ms: Some(3000),
                },
                ActionConfig::WaitForResponse {
                    url_contains: "/api/live".to_string(),
                    status: Some(200),
                    timeout_ms: Some(3000),
                },
                ActionConfig::Click {
                    xpath: "//*[@id=\"mock-button\"]".to_string(),
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
                ActionConfig::Click {
                    xpath: "//*[@id=\"blocked-button\"]".to_string(),
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
                    xpath: Some("//*[@id=\"mock\"]".to_string()),
                    iframe_xpath: None,
                    text: "mocked".to_string(),
                    match_mode: AssertTextMatchMode::Equals,
                    timeout_ms: Some(3000),
                },
                ActionConfig::AssertText {
                    xpath: Some("//*[@id=\"blocked\"]".to_string()),
                    iframe_xpath: None,
                    text: "blocked".to_string(),
                    match_mode: AssertTextMatchMode::Equals,
                    timeout_ms: Some(3000),
                },
            ],
            cancel,
        )
        .await
        .expect("run phase eleven advanced runtime steps");

    assert_eq!(outcome.failed_step, None);
    assert_eq!(outcome.status, RunnerStatus::Success);
    let outputs_json = outcome
        .session
        .evaluate_string("JSON.stringify(window.__wamOutputs)")
        .await
        .expect("outputs json");
    let outputs: serde_json::Value = serde_json::from_str(&outputs_json).expect("outputs");
    assert_eq!(outputs["storage_tokens"], "local|session");
    outcome.session.close().await.expect("close browser");
}
