# Courier Development Workflow

## Data Model: Markdown Is the Source of Truth

All app data lives in two YAML-frontmatter Markdown files at the repo root:

- **`magazines.md`** — every submission call (catalog, deadlines, notes, overrides, scraped values)
- **`stories.md`** — your stories and which calls each is submitted to

There is **no database**. Tauri commands read and write these files directly.
These files are gitignored — copy from `magazines.example.md` / `stories.example.md` to get started.

### Entries Are Unique Calls, Not Unique Magazines

Each entry in `magazines.md` represents a **submission call**, not a magazine. The same magazine routinely appears multiple times with different `call_name` values (e.g. "Fiction Submissions" and "Flash Contest" with different word limits). The composite key is `(name, call_name)` — never dedupe by `name` alone.

### Field Conventions

User-edited fields:
- `name`, `homepage`, `guidelines`, `submit_info`, `external_submit_url`, `genre`, `call_name`, `word_length`, `reopen` — catalog data
- `fixed_deadline` — set this when you know the deadline; **the scraper will not touch entries that have it**
- `notes` (magazine-level), `call_notes` (call-level)
- `custom_name`, `custom_call_name`, `custom_guidelines` — display overrides

Scraper-written fields (don't hand-edit, but harmless if you do):
- `scraped_deadline` — what the scraper found (only when `fixed_deadline` is unset)
- `scraped_at` — RFC 3339 timestamp of last scrape

The frontend reads `mag.deadline` which Rust computes as `fixed_deadline.or(scraped_deadline)`.

### Refresh Behavior

- **Auto-refresh on app load**: applies a 7-day cache (skips network for entries scraped within 7 days)
- **Manual Refresh button**: passes `force: true`, bypasses the cache
- Entries with `fixed_deadline` always skip network — they're considered authoritative
- Refresh writes scraped values back into `magazines.md` atomically (temp file + rename)

## Editing Data

Two paths, both safe:

1. **In-app**: click to edit word_length, deadline, notes, custom names. Writes to MD via Tauri commands.
2. **Direct edit**: open `magazines.md` or `stories.md` in any editor, save. Reload the app (or refresh) to see changes.

Concurrent writes are serialized via a process-wide mutex in `commands.rs`.

## Local Dev Server

Run with:
```bash
npm run tauri:dev
```

Or use the provided helper script:
```bash
./run-dev.sh
```

To run as a LaunchAgent (macOS, auto-start at login), create a plist at
`~/Library/LaunchAgents/com.yourname.courier-dev.plist` pointing at `run-dev.sh`.
Customize the identifier and paths to match your setup.

## Mobile / Phone View (Optional)

`scripts/build-data.mjs` reads `magazines.md` + `stories.md` and writes `public/magazines.json` + `public/stories.json` for a GitHub Pages deploy. Phone view is read-only — edits happen on the Mac.

To enable auto-sync (rebuild JSON and push after every data change):
1. Set up non-interactive git auth (SSH key or cached credential)
2. `touch .mobile-sync` in the project root — this opt-in marker activates `spawn_mobile_sync()` in `commands.rs`

Without `.mobile-sync`, no git operations happen automatically.

When deploying to GitHub Pages, set `VITE_BASE_PATH=/your-repo-name/` before running `npm run build:web`.

## Verification Before Commit

1. `npm run build` — must pass
2. `cd src-tauri && cargo check --no-default-features` — must pass
3. Smoke-test the running Tauri app for any UI/data changes
4. **Update CHANGELOG.md** via the `update_changelog` tool
