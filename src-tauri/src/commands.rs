use crate::data::{Magazine, Story, StorySubmission, MagazineStoryLink};
use crate::yaml_emit::{emit_magazines_md, emit_stories_md};
use gray_matter::{Matter, engine::YAML};
use std::fs;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

fn project_root() -> PathBuf {
    let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    path.pop();
    path
}

fn magazines_md_path() -> PathBuf {
    let mut p = project_root();
    p.push("magazines.md");
    p
}

fn stories_md_path() -> PathBuf {
    let mut p = project_root();
    p.push("stories.md");
    p
}

fn write_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}

// Serializes whole refresh runs (an async lock, since scraping awaits).
// Without this, the trigger poll and the Refresh button could scrape
// concurrently and race each other's writes.
fn refresh_lock() -> &'static tokio::sync::Mutex<()> {
    static LOCK: OnceLock<tokio::sync::Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| tokio::sync::Mutex::new(()))
}

// Atomic write: temp file + rename, so a crash mid-write doesn't truncate the file.
fn atomic_write(path: &PathBuf, content: &str) -> Result<(), String> {
    let tmp = path.with_extension("md.tmp");
    fs::write(&tmp, content).map_err(|e| format!("write tmp: {}", e))?;
    fs::rename(&tmp, path).map_err(|e| format!("rename tmp: {}", e))?;
    Ok(())
}

// Serializes background mobile-sync runs so two edits in quick succession don't
// race each other's git commit/push.
fn sync_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}

/// Rebuild the phone's static JSON and push the data files so GitHub Pages
/// redeploys. Runs on a background thread (best-effort): a refresh or edit
/// returns immediately and the phone catches up a moment later. Push requires
/// non-interactive git auth (SSH key or cached credential).
///
/// **Opt-in**: only runs when a `.mobile-sync` file exists in the project root.
/// Create it with `touch .mobile-sync` to enable; delete it to disable.
/// Without it this function returns immediately and no git operations happen.
fn spawn_mobile_sync() {
    let root = project_root();
    // Check for the opt-in marker before spawning anything.
    if !root.join(".mobile-sync").exists() {
        return;
    }
    std::thread::spawn(move || {
        let _g = match sync_lock().lock() {
            Ok(g) => g,
            Err(e) => { eprintln!("[Courier] mobile sync: lock poisoned: {}", e); return; }
        };
        // 1. Regenerate public/*.json from the markdown source of truth.
        match std::process::Command::new("node")
            .arg("scripts/build-data.mjs")
            .current_dir(&root)
            .status()
        {
            Ok(s) if s.success() => {}
            other => { eprintln!("[Courier] mobile sync: build-data failed: {:?}", other); return; }
        }
        // 2. Commit the data + generated JSON, then push (best-effort).
        let _ = std::process::Command::new("git").current_dir(&root)
            .args(["add", "magazines.md", "stories.md", "public/magazines.json", "public/stories.json"])
            .status();
        match std::process::Command::new("git").current_dir(&root)
            .args(["commit", "-m", "data: auto-sync from app"])
            .status()
        {
            Ok(s) if s.success() => {
                match std::process::Command::new("git").current_dir(&root).args(["push"]).status() {
                    Ok(s) if s.success() => eprintln!("[Courier] mobile sync: pushed"),
                    other => eprintln!("[Courier] mobile sync: push failed: {:?}", other),
                }
            }
            // Non-zero commit status usually just means "nothing changed".
            _ => eprintln!("[Courier] mobile sync: nothing to commit"),
        }
    });
}

/// One result row from the pi-powered resolver (scripts/resolve-deadlines.mjs).
#[derive(serde::Deserialize)]
struct ResolveResult {
    name: String,
    call_name: Option<String>,
    deadline: Option<String>,
    #[serde(default)]
    needs_review: bool,
    #[serde(default)]
    review_note: Option<String>,
}

/// Resolve submission windows by piping the filtered entries to the Node worker,
/// which runs the multi-model ensemble (Gemini + Haiku, qwen offline fallback)
/// and prints structured JSON. Rust stays the sole writer of magazines.md.
async fn resolve_via_pi(entries: &[Magazine]) -> Result<Vec<ResolveResult>, String> {
    use serde_json::json;
    use tokio::io::AsyncWriteExt;

    let input: Vec<_> = entries.iter().map(|m| json!({
        "name": m.name,
        "call_name": m.call_name,
        "submit_info": m.submit_info,
        "external_submit_url": m.external_submit_url,
        "guidelines": m.guidelines,
    })).collect();
    let input_str = serde_json::to_string(&input).map_err(|e| format!("serialize entries: {}", e))?;

    let root = project_root();
    let mut script = root.clone();
    script.push("scripts");
    script.push("resolve-deadlines.mjs");

    let mut child = tokio::process::Command::new("node")
        .arg(&script)
        .current_dir(&root)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::inherit())
        .spawn()
        .map_err(|e| format!("spawn node resolver: {}", e))?;

    {
        let mut stdin = child.stdin.take().ok_or("resolver: no stdin handle")?;
        stdin.write_all(input_str.as_bytes()).await.map_err(|e| format!("write resolver stdin: {}", e))?;
        stdin.shutdown().await.ok();
    }

    let output = tokio::time::timeout(
        std::time::Duration::from_secs(120),
        child.wait_with_output()
    )
    .await
    .map_err(|_| "resolver timeout (>2min) — check for stuck processes".to_string())?
    .map_err(|e| format!("wait resolver: {}", e))?;
    if !output.status.success() {
        return Err(format!("resolver exited with {}", output.status));
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(stdout.trim())
        .map_err(|e| format!("parse resolver output: {} (got: {})", e, stdout.chars().take(200).collect::<String>()))
}

fn parse_magazines_md() -> Result<(Vec<Magazine>, String), String> {
    let path = magazines_md_path();
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("read magazines.md: {}", e))?;
    let matter = Matter::<YAML>::new();
    let parsed = matter.parse(&content);
    let data = parsed.data.ok_or("no YAML frontmatter in magazines.md")?;
    let mags: Vec<Magazine> = serde_json::from_value(data["magazines"].clone().into())
        .map_err(|e| format!("parse magazines: {}", e))?;
    // Recover anything past the closing `---`. gray_matter exposes `.content` for this.
    Ok((mags, parsed.content))
}

fn parse_stories_md() -> Result<Vec<Story>, String> {
    let path = stories_md_path();
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("read stories.md: {}", e))?;
    let matter = Matter::<YAML>::new();
    let parsed = matter.parse(&content);
    let data = match parsed.data {
        Some(d) => d,
        None => return Ok(Vec::new()),
    };
    let stories: Vec<Story> = serde_json::from_value(data["stories"].clone().into())
        .map_err(|e| format!("parse stories: {}", e))?;
    Ok(stories)
}

fn assign_ids_and_compute(mags: &mut [Magazine]) {
    for (i, m) in mags.iter_mut().enumerate() {
        m.id = Some((i + 1) as i64);
        m.compute_deadline();
    }
}

#[tauri::command]
pub async fn load_magazines() -> Result<Vec<Magazine>, String> {
    let (mut mags, _trailing) = parse_magazines_md()?;
    assign_ids_and_compute(&mut mags);
    Ok(mags)
}

#[tauri::command]
pub async fn refresh_magazines(force: bool) -> Result<Vec<Magazine>, String> {
    let _refresh_guard = refresh_lock().lock().await;

    let (mags, _) = parse_magazines_md()?;
    let one_week_ago = chrono::Utc::now() - chrono::Duration::days(7);

    if force {
        println!("[Courier] Force refresh — bypassing 7-day cache");
    }

    let to_scrape: Vec<Magazine> = mags
        .into_iter()
        .filter(|mag| {
            // Entries with fixed_deadline are authoritative — never scrape.
            if mag.fixed_deadline.is_some() {
                return false;
            }
            // Honor the 7-day cache unless force. scraped_at is only stamped on
            // a successful scrape, so failed entries retry on the next refresh.
            if !force {
                if let Some(ref ts) = mag.scraped_at {
                    if let Ok(parsed) = chrono::DateTime::parse_from_rfc3339(ts) {
                        if parsed.with_timezone(&chrono::Utc) > one_week_ago {
                            println!("[Courier] {} — scraped recently, skipping network", mag.name);
                            return false;
                        }
                    }
                }
            }
            true
        })
        .collect();

    // Resolve windows via the pi-powered worker (multi-model ensemble). A null
    // deadline means failure/inconclusive — the existing value is left untouched.
    let results = if to_scrape.is_empty() {
        Vec::new()
    } else {
        resolve_via_pi(&to_scrape).await?
    };

    // Merge results into a *fresh* parse under the write lock. The user may
    // have edited entries (in-app or by hand) while we were scraping; merging
    // by (name, call_name) preserves those edits instead of clobbering them.
    let now = chrono::Utc::now().to_rfc3339();
    let (mut fresh, changed) = {
        let _g = write_lock().lock().map_err(|e| format!("lock: {}", e))?;
        let (mut fresh, trailing) = parse_magazines_md()?;
        let mut changed = false;
        for r in results {
            let Some(deadline) = r.deadline else { continue };
            if let Some(m) = fresh
                .iter_mut()
                .find(|m| m.name == r.name && m.call_name == r.call_name)
            {
                // Skip if the user pinned a fixed deadline mid-refresh.
                if m.fixed_deadline.is_some() {
                    continue;
                }
                m.scraped_deadline = Some(deadline);
                m.scraped_at = Some(now.clone());
                // Set the review flag on disagreement; clear it on consensus.
                m.needs_review = if r.needs_review { Some(true) } else { None };
                m.review_note = if r.needs_review { r.review_note } else { None };
                changed = true;
            }
        }
        if changed {
            atomic_write(&magazines_md_path(), &emit_magazines_md(&fresh, &trailing))?;
        }
        (fresh, changed)
    };

    if changed {
        spawn_mobile_sync();
    }
    assign_ids_and_compute(&mut fresh);
    Ok(fresh)
}

#[tauri::command]
pub async fn check_refresh_trigger() -> Result<bool, String> {
    let mut p = project_root();
    p.push("src-tauri");
    p.push(".refresh");
    if p.exists() {
        fs::remove_file(&p).ok();
        return Ok(true);
    }
    Ok(false)
}

#[tauri::command]
pub async fn save_magazine_overrides(
    name: String,
    call_name: Option<String>,
    word_length: Option<String>,
    fixed_deadline: Option<String>,
    notes: Option<String>,
    call_notes: Option<String>,
    custom_name: Option<String>,
    custom_call_name: Option<String>,
    custom_guidelines: Option<String>,
) -> Result<(), String> {
    let _g = write_lock().lock().map_err(|e| format!("lock: {}", e))?;
    let (mut mags, trailing) = parse_magazines_md()?;
    let target_call = call_name.unwrap_or_default();
    let mut found = false;
    for m in mags.iter_mut() {
        if m.name == name && m.call_name.clone().unwrap_or_default() == target_call {
            // Empty string means "clear it" → store as None for cleaner MD.
            m.word_length = word_length.clone().filter(|s| !s.is_empty());
            m.fixed_deadline = fixed_deadline.clone().filter(|s| !s.is_empty());
            m.notes = notes.clone().filter(|s| !s.is_empty());
            m.call_notes = call_notes.clone().filter(|s| !s.is_empty());
            m.custom_name = custom_name.clone().filter(|s| !s.is_empty());
            m.custom_call_name = custom_call_name.clone().filter(|s| !s.is_empty());
            m.custom_guidelines = custom_guidelines.clone().filter(|s| !s.is_empty());
            found = true;
            break;
        }
    }
    if !found {
        return Err(format!("magazine not found: {} / {}", name, target_call));
    }
    let new_md = emit_magazines_md(&mags, &trailing);
    atomic_write(&magazines_md_path(), &new_md)?;
    spawn_mobile_sync();
    Ok(())
}

#[tauri::command]
pub async fn load_stories() -> Result<Vec<Story>, String> {
    parse_stories_md()
}

fn next_story_id(stories: &[Story]) -> i64 {
    stories.iter().filter_map(|s| s.id).max().unwrap_or(0) + 1
}

#[tauri::command]
pub async fn add_story(
    title: String,
    word_count: Option<String>,
    status: String,
) -> Result<Story, String> {
    let _g = write_lock().lock().map_err(|e| format!("lock: {}", e))?;
    let mut stories = parse_stories_md()?;
    let id = next_story_id(&stories);
    let new = Story {
        id: Some(id),
        title,
        word_count,
        status,
        submitted_to: Vec::new(),
    };
    stories.push(new.clone());
    atomic_write(&stories_md_path(), &emit_stories_md(&stories))?;
    spawn_mobile_sync();
    Ok(new)
}

#[tauri::command]
pub async fn update_story(
    id: i64,
    title: String,
    word_count: Option<String>,
    status: String,
) -> Result<(), String> {
    let _g = write_lock().lock().map_err(|e| format!("lock: {}", e))?;
    let mut stories = parse_stories_md()?;
    let mut found = false;
    for s in stories.iter_mut() {
        if s.id == Some(id) {
            s.title = title.clone();
            s.word_count = word_count.clone();
            s.status = status.clone();
            found = true;
            break;
        }
    }
    if !found {
        return Err(format!("story id {} not found", id));
    }
    atomic_write(&stories_md_path(), &emit_stories_md(&stories))?;
    spawn_mobile_sync();
    Ok(())
}

#[tauri::command]
pub async fn delete_story(id: i64) -> Result<(), String> {
    let _g = write_lock().lock().map_err(|e| format!("lock: {}", e))?;
    let mut stories = parse_stories_md()?;
    let before = stories.len();
    stories.retain(|s| s.id != Some(id));
    if stories.len() == before {
        return Err(format!("story id {} not found", id));
    }
    atomic_write(&stories_md_path(), &emit_stories_md(&stories))?;
    spawn_mobile_sync();
    Ok(())
}

#[tauri::command]
pub async fn load_magazine_story_links() -> Result<Vec<MagazineStoryLink>, String> {
    let (mut mags, _) = parse_magazines_md()?;
    assign_ids_and_compute(&mut mags);
    let stories = parse_stories_md()?;

    let mut links = Vec::new();
    for s in &stories {
        let Some(story_id) = s.id else { continue };
        for sub in &s.submitted_to {
            for m in &mags {
                if m.name == sub.name && m.call_name.clone().unwrap_or_default() == sub.call_name {
                    if let Some(magazine_id) = m.id {
                        links.push(MagazineStoryLink { magazine_id, story_id });
                    }
                }
            }
        }
    }
    Ok(links)
}

#[tauri::command]
pub async fn set_magazine_stories(
    magazine_id: i64,
    story_ids: Vec<i64>,
) -> Result<(), String> {
    let _g = write_lock().lock().map_err(|e| format!("lock: {}", e))?;
    let (mut mags, _) = parse_magazines_md()?;
    assign_ids_and_compute(&mut mags);
    let target = mags
        .iter()
        .find(|m| m.id == Some(magazine_id))
        .ok_or_else(|| format!("magazine id {} not found", magazine_id))?;
    let target_sub = StorySubmission {
        name: target.name.clone(),
        call_name: target.call_name.clone().unwrap_or_default(),
    };

    let mut stories = parse_stories_md()?;
    for s in stories.iter_mut() {
        let Some(sid) = s.id else { continue };
        let already = s.submitted_to.iter().any(|sub| {
            sub.name == target_sub.name && sub.call_name == target_sub.call_name
        });
        let should = story_ids.contains(&sid);
        if should && !already {
            s.submitted_to.push(target_sub.clone());
        } else if !should && already {
            s.submitted_to.retain(|sub| {
                !(sub.name == target_sub.name && sub.call_name == target_sub.call_name)
            });
        }
    }
    atomic_write(&stories_md_path(), &emit_stories_md(&stories))?;
    spawn_mobile_sync();
    Ok(())
}

#[tauri::command]
pub async fn open_url(_app: tauri::AppHandle, url: String) -> Result<(), String> {
    std::process::Command::new("open")
        .arg(&url)
        .spawn()
        .map_err(|e| format!("Failed to open URL: {}", e))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    // Guards the parse → emit → parse cycle against data loss: every refresh
    // rewrites magazines.md through this path.
    #[test]
    fn magazines_md_roundtrip_is_lossless() {
        let (mags, trailing) = parse_magazines_md().expect("parse magazines.md");
        assert!(!mags.is_empty());

        let emitted = emit_magazines_md(&mags, &trailing);
        let matter = Matter::<YAML>::new();
        let parsed = matter.parse(&emitted);
        let data = parsed.data.expect("emitted file has frontmatter");
        let reparsed: Vec<Magazine> = serde_json::from_value(data["magazines"].clone().into())
            .expect("emitted file parses back");

        assert_eq!(mags.len(), reparsed.len());
        for (a, b) in mags.iter().zip(&reparsed) {
            assert_eq!(a.name, b.name);
            assert_eq!(a.call_name, b.call_name);
            assert_eq!(a.fixed_deadline, b.fixed_deadline);
            assert_eq!(a.scraped_deadline, b.scraped_deadline);
            assert_eq!(a.notes, b.notes);
            assert_eq!(a.extra, b.extra, "unknown fields must survive rewrite ({})", a.name);
        }
        assert_eq!(parsed.content, trailing, "content after frontmatter must survive");
    }
}
