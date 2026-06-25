# Changelog

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Changed
- **Prepared project for public release:**
  - `magazines.md`, `stories.md`, `public/magazines.json`, `public/stories.json` added to `.gitignore` (personal data — not for the repo)
  - Created `magazines.example.md` and `stories.example.md` as starter templates
  - `scripts/build-data.mjs` now prints a helpful error pointing to the example file when `magazines.md` is missing
  - `spawn_mobile_sync()` is now opt-in: only runs when a `.mobile-sync` marker file exists in the project root (`.mobile-sync` also gitignored)
  - `build:web` script no longer hardcodes `VITE_BASE_PATH=/courier/`; set `VITE_BASE_PATH` in the environment before building
  - `CLAUDE.md` generalized: removed personal LaunchAgent identifier, documented `.mobile-sync` opt-in
  - Added MIT `LICENSE`
  - Full `README.md` rewrite with accurate setup instructions, architecture overview, and optional features documented
- **Changelog management extension is now global**: moved from `.pi/extensions/changelog.ts`
  to `~/.pi/agent/extensions/changelog.ts` so it works across all projects that have a
  CHANGELOG.md file.

### Fixed
- **Refresh timeout protection**: added 2-minute timeouts in both Rust (`commands.rs`)
  and Node (`resolve-deadlines.mjs`) to prevent hung refresh operations from zombie
  processes. Rust now kills the child process if it doesn't respond, and Node
  auto-exits to prevent orphaned processes.

### Changed
- **Category thresholds adjusted**: Flash fiction now < 2000 words (was 1000),
  Short Stories now >= 2000 words (was 1000). Short Stories category still caps
  at markets accepting up to 5000 words to exclude novella markets.
- **Deadline extraction now runs through pi (the coding-agent SDK)** instead of a
  direct Anthropic API call plus a regex fallback. A refresh pipes the entries to
  a Node worker (`scripts/resolve-deadlines.mjs`) that fetches each magazine's
  pages and extracts the submission window; the Rust backend remains the sole
  writer of `magazines.md`, merging results by `(name, call_name)`.
  - Primary model: `claude-haiku-4-5` (via the pi Anthropic login).
  - Offline fallback: local `ollama/qwen2.5:7b`, used only when the cloud model
    is unavailable.
  - Requests are deduped by URL set, so multiple calls that read the same pages
    cost a single request.
- Credentials moved out of `.env` (`ANTHROPIC_API_KEY`) into pi's config
  (`~/.pi/agent/auth.json`, `~/.pi/agent/models.json`). `.env.example`,
  `run-dev.sh`, and `README.md` updated accordingly.

### Added
- `needs_review` / `review_note` fields on magazine entries, surfaced as a ⚠️ in
  the table (desktop + mobile) and in the phone JSON. Set when the model reports
  low confidence (or a result came from the local fallback); cleared on a
  confident refresh.
- **Auto-sync to mobile**: after any data write (refresh or in-app edit) the app
  rebuilds `public/*.json` and commits + pushes in the background, triggering the
  GitHub Pages redeploy. Requires non-interactive git auth.
- Two new submission calls: Kestrel (Fairmont State) and Haven Spec Magazine.
- Nix + direnv development environment (`flake.nix`, `.envrc`) providing a
  reproducible Rust/Node toolchain; `setup-nix.sh` / `uninstall-nix.sh` helpers.

### Removed
- `src-tauri/src/scraper.rs` and `src-tauri/prompt.txt` — the old
  Claude-or-regex scraper (replaced by the pi worker).
