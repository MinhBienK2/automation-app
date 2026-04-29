use std::{
    collections::HashSet,
    path::{Path, PathBuf},
    time::{Duration, Instant},
};

use chromiumoxide::{
    browser::{Browser, BrowserConfig},
    cdp::browser_protocol::browser::{SetDownloadBehaviorBehavior, SetDownloadBehaviorParams},
    Page,
};
use futures::StreamExt;
use tokio::task::JoinHandle;
use uuid::Uuid;

use crate::domain::ActionConfig;

use super::{
    actions::{execute_action, ActionExecution},
    cancellation::RunnerCancellation,
    error::RunnerError,
};

#[derive(Debug, Clone)]
pub struct RunnerOptions {
    pub headed: bool,
    pub chrome_executable: Option<PathBuf>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RunnerStatus {
    Success,
    Failed,
    Stopped,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FailedStep {
    pub step_number: usize,
    pub reason: String,
}

#[derive(Debug)]
pub struct RunnerOutcome {
    pub status: RunnerStatus,
    pub failed_step: Option<FailedStep>,
    pub session: BrowserSession,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RunnerProgress {
    StepStarted { step_number: usize },
    StepCompleted { step_number: usize },
}

#[derive(Debug)]
pub struct BrowserRunner {
    options: RunnerOptions,
}

impl BrowserRunner {
    pub fn new(options: RunnerOptions) -> Self {
        Self { options }
    }

    pub async fn run_steps(
        &self,
        steps: Vec<ActionConfig>,
        cancellation: RunnerCancellation,
    ) -> Result<RunnerOutcome, RunnerError> {
        self.run_steps_with_progress(steps, cancellation, |_| {})
            .await
    }

    pub async fn run_steps_with_progress(
        &self,
        steps: Vec<ActionConfig>,
        cancellation: RunnerCancellation,
        mut progress: impl FnMut(RunnerProgress) + Send,
    ) -> Result<RunnerOutcome, RunnerError> {
        let launch_settings = LaunchSettings::from_steps(&steps);
        let mut session = BrowserSession::launch(&self.options, &launch_settings).await?;

        for (index, step) in steps.into_iter().enumerate() {
            if cancellation.is_cancelled() {
                return Ok(RunnerOutcome {
                    status: RunnerStatus::Stopped,
                    failed_step: None,
                    session,
                });
            }

            let step_number = index + 1;
            progress(RunnerProgress::StepStarted { step_number });
            let result = execute_action(&mut session, step, &cancellation).await;

            match result {
                Ok(ActionExecution::Complete) => {
                    progress(RunnerProgress::StepCompleted { step_number });
                }
                Ok(ActionExecution::Stopped) => {
                    return Ok(RunnerOutcome {
                        status: RunnerStatus::Stopped,
                        failed_step: None,
                        session,
                    });
                }
                Ok(ActionExecution::StopSuccess) => {
                    progress(RunnerProgress::StepCompleted { step_number });
                    return Ok(RunnerOutcome {
                        status: RunnerStatus::Success,
                        failed_step: None,
                        session,
                    });
                }
                Err(RunnerError::ActionFailed(reason)) => {
                    let reason = session
                        .capture_failure_screenshot()
                        .await
                        .map(|path| format!("{reason}\nFailure screenshot: {}", path.display()))
                        .unwrap_or(reason);
                    return Ok(RunnerOutcome {
                        status: RunnerStatus::Failed,
                        failed_step: Some(FailedStep {
                            step_number,
                            reason,
                        }),
                        session,
                    });
                }
                Err(error) => return Err(error),
            }
        }

        Ok(RunnerOutcome {
            status: RunnerStatus::Success,
            failed_step: None,
            session,
        })
    }
}

#[derive(Debug)]
pub struct BrowserSession {
    browser: Option<Browser>,
    pages: Vec<Page>,
    current_page_index: usize,
    active_frame_xpath: Option<String>,
    download_directory: Option<PathBuf>,
    known_downloads: HashSet<PathBuf>,
    handler: JoinHandle<()>,
    user_data_dir: Option<PathBuf>,
    persistent_user_data_dir: bool,
    open: bool,
}

impl BrowserSession {
    async fn launch(
        options: &RunnerOptions,
        launch_settings: &LaunchSettings,
    ) -> Result<Self, RunnerError> {
        let persistent_user_data_dir = launch_settings.profile_name.is_some();
        let user_data_dir = launch_settings
            .profile_name
            .as_deref()
            .map(profile_user_data_dir)
            .unwrap_or_else(|| std::env::temp_dir().join(format!("wam-chrome-{}", Uuid::new_v4())));
        std::fs::create_dir_all(&user_data_dir)?;

        let config = browser_config(options, launch_settings, &user_data_dir)?;
        let (browser, mut handler) = Browser::launch(config).await?;
        let handler_task = tokio::spawn(async move {
            while let Some(message) = handler.next().await {
                if message.is_err() {
                    break;
                }
            }
        });

        let page = browser.new_page("about:blank").await?;

        Ok(Self {
            browser: Some(browser),
            pages: vec![page],
            current_page_index: 0,
            active_frame_xpath: None,
            download_directory: None,
            known_downloads: HashSet::new(),
            handler: handler_task,
            user_data_dir: Some(user_data_dir),
            persistent_user_data_dir,
            open: true,
        })
    }

    pub fn is_open(&self) -> bool {
        self.open
    }

    pub(super) fn current_page(&self) -> Result<Page, RunnerError> {
        self.pages
            .get(self.current_page_index)
            .cloned()
            .ok_or_else(|| RunnerError::ActionFailed("No active tab".to_string()))
    }

    pub(super) async fn open_new_tab(&mut self, url: Option<&str>) -> Result<(), RunnerError> {
        let current_page = self.current_page()?;
        let current_url = current_page.url().await?;
        if should_reuse_startup_blank_page(
            self.pages.len(),
            self.current_page_index,
            current_url.as_deref(),
        ) {
            if let Some(url) = url {
                current_page.goto(url).await?;
            }
            current_page.bring_to_front().await?;
            self.active_frame_xpath = None;
            return Ok(());
        }

        let browser = self
            .browser
            .as_ref()
            .ok_or_else(|| RunnerError::ActionFailed("Browser is closed".to_string()))?;
        let page = browser.new_page(url.unwrap_or("about:blank")).await?;
        page.bring_to_front().await?;
        self.pages.push(page);
        self.current_page_index = self.pages.len() - 1;
        self.active_frame_xpath = None;
        Ok(())
    }

    pub(super) async fn switch_tab(&mut self, index: usize) -> Result<(), RunnerError> {
        let page = self
            .pages
            .get(index)
            .ok_or_else(|| RunnerError::ActionFailed("Tab index not found".to_string()))?;
        page.bring_to_front().await?;
        self.current_page_index = index;
        self.active_frame_xpath = None;
        Ok(())
    }

    pub(super) async fn close_tab(&mut self, index: Option<usize>) -> Result<(), RunnerError> {
        if self.pages.len() <= 1 {
            return Err(RunnerError::ActionFailed(
                "Cannot close the last tab".to_string(),
            ));
        }

        let index = index.unwrap_or(self.current_page_index);
        if index >= self.pages.len() {
            return Err(RunnerError::ActionFailed("Tab index not found".to_string()));
        }

        let page = self.pages.remove(index);
        page.close().await?;
        if self.current_page_index >= self.pages.len() {
            self.current_page_index = self.pages.len() - 1;
        } else if index < self.current_page_index {
            self.current_page_index -= 1;
        }
        self.pages[self.current_page_index].bring_to_front().await?;
        self.active_frame_xpath = None;
        Ok(())
    }

    pub(super) fn frame_xpath(&self) -> Option<&str> {
        self.active_frame_xpath.as_deref()
    }

    pub(super) fn switch_frame(&mut self, xpath: Option<String>) {
        self.active_frame_xpath = xpath.filter(|xpath| !xpath.trim().is_empty());
    }

    pub(super) async fn set_download_directory(&mut self, path: &str) -> Result<(), RunnerError> {
        let browser = self
            .browser
            .as_ref()
            .ok_or_else(|| RunnerError::ActionFailed("Browser is closed".to_string()))?;
        let directory = PathBuf::from(path);
        std::fs::create_dir_all(&directory)?;
        let command = SetDownloadBehaviorParams::builder()
            .behavior(SetDownloadBehaviorBehavior::Allow)
            .download_path(directory.to_string_lossy().to_string())
            .events_enabled(false)
            .build()
            .map_err(RunnerError::ActionFailed)?;
        browser.execute(command).await?;
        self.known_downloads = stable_files_in(&directory)?;
        self.download_directory = Some(directory);
        Ok(())
    }

    pub(super) async fn wait_for_download(
        &mut self,
        timeout_ms: Option<u64>,
    ) -> Result<PathBuf, RunnerError> {
        let directory = self.download_directory.clone().ok_or_else(|| {
            RunnerError::ActionFailed("Download directory has not been set".to_string())
        })?;
        let deadline = Instant::now() + Duration::from_millis(timeout_ms.unwrap_or(30_000));

        loop {
            let current_files = stable_files_in(&directory)?;
            if let Some(path) = current_files
                .difference(&self.known_downloads)
                .next()
                .cloned()
            {
                self.known_downloads = current_files;
                return Ok(path);
            }

            if Instant::now() >= deadline {
                return Err(RunnerError::ActionFailed(
                    "Download did not complete before timeout".to_string(),
                ));
            }

            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    }

    pub async fn evaluate_string(&self, expression: &str) -> Result<String, RunnerError> {
        Ok(self
            .current_page()?
            .evaluate(expression)
            .await?
            .into_value()?)
    }

    pub async fn evaluate_i64(&self, expression: &str) -> Result<i64, RunnerError> {
        Ok(self
            .current_page()?
            .evaluate(expression)
            .await?
            .into_value()?)
    }

    async fn capture_failure_screenshot(&self) -> Result<PathBuf, RunnerError> {
        let page = self.current_page()?;
        let path = std::env::temp_dir().join(format!("wam-failure-{}.png", Uuid::new_v4()));
        let image = page
            .screenshot(
                chromiumoxide::page::ScreenshotParams::builder()
                    .format(
                        chromiumoxide::cdp::browser_protocol::page::CaptureScreenshotFormat::Png,
                    )
                    .full_page(true)
                    .build(),
            )
            .await?;
        std::fs::write(&path, image)?;
        Ok(path)
    }

    pub async fn close(&mut self) -> Result<(), RunnerError> {
        if let Some(browser) = &mut self.browser {
            browser.close().await?;
            let _ = browser.wait().await;
        }

        self.browser = None;
        self.open = false;
        self.handler.abort();

        if let Some(path) = self.user_data_dir.take() {
            if !self.persistent_user_data_dir {
                let _ = std::fs::remove_dir_all(path);
            }
        }

        Ok(())
    }
}

fn browser_config(
    options: &RunnerOptions,
    launch_settings: &LaunchSettings,
    user_data_dir: &Path,
) -> Result<BrowserConfig, RunnerError> {
    let mut builder = BrowserConfig::builder()
        .request_timeout(Duration::from_secs(10))
        .launch_timeout(Duration::from_secs(20))
        .window_size(1100, 800)
        .viewport(None)
        .user_data_dir(user_data_dir)
        .arg("no-startup-window")
        .no_sandbox();

    if options.headed {
        builder = builder.with_head();
    }

    if let Some(proxy_server) = launch_settings.proxy_server.as_deref() {
        builder = builder.arg(("proxy-server", proxy_server));
    }

    let chrome_executable = options
        .chrome_executable
        .clone()
        .or_else(default_chrome_executable);
    if let Some(executable) = &chrome_executable {
        builder = builder.chrome_executable(executable);
    }

    builder.build().map_err(RunnerError::Config)
}

fn should_reuse_startup_blank_page(
    page_count: usize,
    current_page_index: usize,
    current_url: Option<&str>,
) -> bool {
    page_count == 1 && current_page_index == 0 && current_url == Some("about:blank")
}

fn profile_user_data_dir(name: &str) -> PathBuf {
    let safe_name = name
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '_'
            }
        })
        .collect::<String>();
    std::env::temp_dir()
        .join("wam-profiles")
        .join(if safe_name.is_empty() {
            "default".to_string()
        } else {
            safe_name
        })
}

fn stable_files_in(directory: &Path) -> Result<HashSet<PathBuf>, RunnerError> {
    let mut files = HashSet::new();
    for entry in std::fs::read_dir(directory)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_file() && !is_temporary_download(&path) {
            files.insert(path);
        }
    }
    Ok(files)
}

fn is_temporary_download(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("crdownload"))
}

#[derive(Debug, Clone, Default)]
struct LaunchSettings {
    profile_name: Option<String>,
    proxy_server: Option<String>,
}

impl LaunchSettings {
    fn from_steps(steps: &[ActionConfig]) -> Self {
        let profile_name = steps.iter().find_map(|step| match step {
            ActionConfig::UseProfile { name } if !name.trim().is_empty() => {
                Some(name.trim().to_string())
            }
            _ => None,
        });
        let proxy_server = steps.iter().find_map(|step| match step {
            ActionConfig::UseProxy {
                server,
                username,
                password,
            } if !server.trim().is_empty() => {
                proxy_server_argument(server, username.as_deref(), password.as_deref())
            }
            _ => None,
        });

        Self {
            profile_name,
            proxy_server,
        }
    }
}

fn proxy_server_argument(
    server: &str,
    username: Option<&str>,
    password: Option<&str>,
) -> Option<String> {
    let server = server.trim();
    if server.is_empty() {
        return None;
    }

    let username = username.map(str::trim).filter(|value| !value.is_empty());
    let password = password.filter(|value| !value.is_empty());
    match (username, password) {
        (Some(username), Some(password)) if !server.contains('@') => {
            if let Some((scheme, rest)) = server.split_once("://") {
                Some(format!("{scheme}://{username}:{password}@{rest}"))
            } else {
                Some(format!("{username}:{password}@{server}"))
            }
        }
        _ => Some(server.to_string()),
    }
}

fn default_chrome_executable() -> Option<PathBuf> {
    [
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
    ]
    .iter()
    .map(PathBuf::from)
    .find(|path| path.exists())
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::{browser_config, should_reuse_startup_blank_page, LaunchSettings};
    use crate::domain::ActionConfig;
    use crate::runner::RunnerOptions;

    #[test]
    fn launch_settings_build_proxy_argument_with_credentials() {
        let settings = LaunchSettings::from_steps(&[ActionConfig::UseProxy {
            server: "http://proxy.local:8080".to_string(),
            username: Some("agent".to_string()),
            password: Some("secret".to_string()),
        }]);

        assert_eq!(
            settings.proxy_server.as_deref(),
            Some("http://agent:secret@proxy.local:8080")
        );
    }

    #[test]
    fn browser_config_suppresses_chrome_startup_tab() {
        let config = browser_config(
            &RunnerOptions {
                headed: true,
                chrome_executable: Some(PathBuf::from("/usr/bin/chromium")),
            },
            &LaunchSettings::default(),
            &std::env::temp_dir().join("wam-test-profile"),
        )
        .expect("build browser config");

        assert!(
            format!("{config:?}").contains("no-startup-window"),
            "Chrome should not create its own startup tab before the runner opens the first page"
        );
    }

    #[test]
    fn browser_config_uses_native_window_viewport() {
        let config = browser_config(
            &RunnerOptions {
                headed: true,
                chrome_executable: Some(PathBuf::from("/usr/bin/chromium")),
            },
            &LaunchSettings::default(),
            &std::env::temp_dir().join("wam-test-profile"),
        )
        .expect("build browser config");

        assert!(
            format!("{config:?}").contains("viewport: None"),
            "Visible browser runs should render to the full window instead of chromiumoxide's 800x600 default viewport"
        );
    }

    #[test]
    fn open_new_tab_reuses_single_startup_blank_page() {
        assert!(should_reuse_startup_blank_page(1, 0, Some("about:blank")));
        assert!(!should_reuse_startup_blank_page(
            1,
            0,
            Some("https://example.com")
        ));
        assert!(!should_reuse_startup_blank_page(2, 1, Some("about:blank")));
    }
}
