// Minimal YAML emitter tuned to magazines.md and stories.md.
// Why hand-rolled: serde_yaml's output is unstable across versions and reorders fields;
// our files are read by humans and diffed in git, so format stability matters more than
// generality. We only emit the shapes we own.

use crate::data::{Magazine, Story};

const MAG_FIELD_ORDER: &[&str] = &[
    "name", "homepage", "guidelines", "submit_info", "external_submit_url",
    "genre", "call_name", "word_length", "fixed_deadline", "reopen",
    "custom_name", "custom_call_name", "custom_guidelines",
    "notes", "call_notes",
    "scraped_deadline", "scraped_at", "needs_review", "review_note",
];

fn quote(s: &str) -> String {
    let mut escaped = String::with_capacity(s.len() + 2);
    escaped.push('"');
    for c in s.chars() {
        match c {
            '\\' => escaped.push_str("\\\\"),
            '"' => escaped.push_str("\\\""),
            '\n' => escaped.push_str("\\n"),
            _ => escaped.push(c),
        }
    }
    escaped.push('"');
    escaped
}

fn field(key: &str, value: Option<&String>) -> Option<String> {
    value.map(|v| format!("    {}: {}", key, quote(v)))
}

fn emit_mag(mag: &Magazine) -> String {
    let mut lines: Vec<String> = Vec::new();
    let first = format!("  - name: {}", quote(&mag.name));
    lines.push(first);
    for &key in &MAG_FIELD_ORDER[1..] {
        let val_str = match key {
            "homepage" => Some(&mag.homepage),
            "guidelines" => Some(&mag.guidelines),
            "submit_info" => Some(&mag.submit_info),
            "external_submit_url" => mag.external_submit_url.as_ref(),
            "genre" => mag.genre.as_ref(),
            "call_name" => mag.call_name.as_ref(),
            "word_length" => mag.word_length.as_ref(),
            "fixed_deadline" => mag.fixed_deadline.as_ref(),
            "reopen" => mag.reopen.as_ref(),
            "custom_name" => mag.custom_name.as_ref(),
            "custom_call_name" => mag.custom_call_name.as_ref(),
            "custom_guidelines" => mag.custom_guidelines.as_ref(),
            "notes" => mag.notes.as_ref(),
            "call_notes" => mag.call_notes.as_ref(),
            "scraped_deadline" => mag.scraped_deadline.as_ref(),
            "scraped_at" => mag.scraped_at.as_ref(),
            "review_note" => mag.review_note.as_ref(),
            // Bool field: emit only when true, as an unquoted YAML bool.
            "needs_review" => {
                if mag.needs_review == Some(true) {
                    lines.push("    needs_review: true".to_string());
                }
                None
            }
            _ => None,
        };
        if let Some(s) = field(key, val_str) {
            lines.push(s);
        }
    }
    // Unknown fields captured at parse time (e.g. hand-added keys). Strings
    // are quoted like our own fields; anything else is emitted as JSON, which
    // is valid YAML flow syntax.
    for (k, v) in &mag.extra {
        let rendered = match v {
            serde_json::Value::String(s) => quote(s),
            other => other.to_string(),
        };
        lines.push(format!("    {}: {}", k, rendered));
    }
    lines.join("\n")
}

pub fn emit_magazines_md(mags: &[Magazine], trailing: &str) -> String {
    let body = mags.iter().map(emit_mag).collect::<Vec<_>>().join("\n\n");
    let trailing_prefix = if trailing.starts_with('\n') { "" } else { "\n" };
    format!("---\nmagazines:\n{}\n---{}{}", body, trailing_prefix, trailing)
}

fn emit_story(s: &Story) -> String {
    let mut lines = vec![format!("  - id: {}", s.id.unwrap_or(0))];
    lines.push(format!("    title: {}", quote(&s.title)));
    lines.push(format!(
        "    word_count: {}",
        s.word_count.as_ref().map(|w| quote(w)).unwrap_or_else(|| "null".to_string())
    ));
    lines.push(format!("    status: {}", quote(&s.status)));
    if s.submitted_to.is_empty() {
        lines.push("    submitted_to: []".to_string());
    } else {
        lines.push("    submitted_to:".to_string());
        for sub in &s.submitted_to {
            lines.push(format!(
                "      - {{ name: {}, call_name: {} }}",
                quote(&sub.name),
                quote(&sub.call_name)
            ));
        }
    }
    lines.join("\n")
}

pub fn emit_stories_md(stories: &[Story]) -> String {
    let body = stories.iter().map(emit_story).collect::<Vec<_>>().join("\n\n");
    format!("---\nstories:\n{}\n---\n", body)
}
