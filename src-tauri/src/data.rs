use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorySubmission {
    pub name: String,
    pub call_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Story {
    pub id: Option<i64>,
    pub title: String,
    pub word_count: Option<String>,
    pub status: String,
    #[serde(default)]
    pub submitted_to: Vec<StorySubmission>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MagazineStoryLink {
    pub magazine_id: i64,
    pub story_id: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Magazine {
    #[serde(default)]
    pub id: Option<i64>,
    pub name: String,
    #[serde(default)]
    pub homepage: String,
    #[serde(default)]
    pub guidelines: String,
    #[serde(default)]
    pub submit_info: String,
    pub external_submit_url: Option<String>,
    pub genre: Option<String>,
    pub call_name: Option<String>,
    pub word_length: Option<String>,
    pub fixed_deadline: Option<String>,
    pub reopen: Option<String>,
    pub notes: Option<String>,
    pub call_notes: Option<String>,
    pub custom_name: Option<String>,
    pub custom_call_name: Option<String>,
    pub custom_guidelines: Option<String>,
    pub scraped_deadline: Option<String>,
    pub scraped_at: Option<String>,
    pub scraped_summary: Option<String>,
    // Set by the resolver when the two cloud models disagree (or only one
    // answered): the scraped_deadline is a best guess and a human should
    // verify it. Cleared on a refresh that reaches consensus.
    pub needs_review: Option<bool>,
    pub review_note: Option<String>,
    // Computed for frontend convenience: fixed_deadline.or(scraped_deadline)
    #[serde(default)]
    pub deadline: Option<String>,
    // Fields we don't know about (e.g. hand-added in magazines.md) are kept
    // here so rewriting the file never silently drops them.
    #[serde(flatten, default)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}

impl Magazine {
    pub fn compute_deadline(&mut self) {
        self.deadline = self.fixed_deadline.clone().or_else(|| self.scraped_deadline.clone());
    }
}
