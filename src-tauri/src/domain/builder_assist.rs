use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ElementSnapshot {
    pub tag: String,
    pub id: Option<String>,
    pub test_id: Option<String>,
    pub name: Option<String>,
    pub text: Option<String>,
    pub classes: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SelectorCandidate {
    pub selector_type: String,
    pub selector: String,
    pub score: u32,
    pub reason: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum RecordedEvent {
    Click { xpath: String },
    InputText { xpath: String, text: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GeneratedFixture {
    pub path: String,
}
