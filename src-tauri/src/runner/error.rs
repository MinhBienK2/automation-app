#[derive(Debug, thiserror::Error)]
pub enum RunnerError {
    #[error("browser config error: {0}")]
    Config(String),
    #[error("browser error: {0}")]
    Browser(#[from] chromiumoxide::error::CdpError),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("{0}")]
    ActionFailed(String),
}
