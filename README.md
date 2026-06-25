# Courier

A local-first literary magazine submission tracker for macOS. Track submission calls, deadlines, and which of your stories you've sent where — all stored in plain Markdown files you own and edit directly.

No cloud account, no subscription, no database to manage. The app reads and writes two Markdown files on your disk.

<img width="2600" height="1800" alt="2026-06-24 21 59 58" src="https://github.com/user-attachments/assets/8c00856a-ef20-4765-89ef-e69f59a0bf84" />


## Features

- **AI-powered deadline scraping** — refresh pulls the current submission window from each magazine's website using Claude (via [pi](https://github.com/earendil-works/pi-coding-agent))
- **Local-first data** — everything lives in `magazines.md` and `stories.md` at the project root; edit them in any text editor
- **Multi-call tracking** — one magazine can have many submission calls (e.g. "General Submissions" and "Flash Contest") tracked separately
- **Smart cache** — scrapes are cached for 7 days; set `fixed_deadline` on any entry to pin it permanently
- **Story tracker** — log your stories, word counts, status, and which calls each one is submitted to
- **Optional phone view** — deploy a read-only web view to GitHub Pages for checking deadlines on the go
- **Native macOS app** — built with Tauri; fast, no Electron overhead

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node | 22 | [nodejs.org](https://nodejs.org) or `nvm use` (see `.nvmrc`) |
| Rust | stable | [rustup.rs](https://rustup.rs) |
| pi | latest | `npm install -g @earendil-works/pi-coding-agent` |
| Xcode CLT | — | `xcode-select --install` |

> **macOS only** for the native Tauri window. The web preview (`npm run dev`) runs anywhere.

## Setup

### 1. Clone and install

```bash
git clone https://github.com/yourusername/courier
cd courier
npm install
```

### 2. Create your data files

```bash
cp magazines.example.md magazines.md
cp stories.example.md stories.md
```

Edit `magazines.md` with the magazines you want to track. The example file explains every field. `stories.md` is optional — delete its contents if you don't want story tracking yet.

### 3. Configure AI credentials (for deadline scraping)

Deadline extraction uses [pi](https://github.com/earendil-works/pi-coding-agent) to run Claude. Set up your Anthropic credentials once:

```bash
pi   # opens the interactive shell
/login
# follow the prompts to add your Anthropic API key
```

Credentials are stored in `~/.pi/agent/auth.json` — never in this repo.

**Optional offline fallback**: install [Ollama](https://ollama.com) and pull a local model:

```bash
ollama pull qwen2.5:7b
```

The scraper uses this automatically when the cloud model is unavailable.

### 4. Run

```bash
npm run tauri:dev
```

The app opens a native window. The Refresh button (or auto-refresh on load) scrapes deadlines for any entry not cached within 7 days.

## How It Works

### Data model

All data lives in two YAML-frontmatter Markdown files:

- **`magazines.md`** — submission calls with deadlines, URLs, notes, and scraper output
- **`stories.md`** — your stories and which calls they're submitted to

These files are gitignored by default. They're yours; back them up however you like.

### Refresh / scraping

When you click **Refresh** (or on app load), Rust pipes the unfixed entries to `scripts/resolve-deadlines.mjs`. That Node worker:

1. Fetches each magazine's submission/guidelines pages (plain HTTP, then Jina Reader for JS-heavy SPAs)
2. Sends the page text to Claude Haiku for extraction
3. Returns structured JSON: `{ deadline, confidence }`

Low-confidence results get a ⚠️ flag in the table ("needs review"). Entries with `fixed_deadline` are never scraped — set this field when you know the deadline is stable or the scraper can't read the site.

Requests are deduped by URL: multiple calls sharing the same pages cost a single model request. Results are cached for 7 days; use **Force Refresh** to bypass.

### Composite keys

Each entry is a **call**, not a magazine. `(name, call_name)` is the unique key — the same magazine can appear many times with different `call_name` values. Never dedupe by `name` alone.

## Adding Magazines

Edit `magazines.md` directly:

```yaml
- name: "Magazine Name"
  homepage: "https://example.com"
  guidelines: "https://example.com/guidelines"
  submit_info: "https://example.com/submit"
  external_submit_url: "https://example.submittable.com/submit"  # optional
  genre: "Fiction"
  call_name: "General Submissions"
  word_length: "up to 5,000 words"
  # Optional overrides:
  # fixed_deadline: "Always Open"   # scraper will never touch this entry
  # reopen: "September"             # displayed as a hint when closed
  # call_notes: "Notes about this call..."
  # custom_name: "Short Name"       # overrides display in the table
```

Reload the app (or click Refresh) to see new entries.

## Optional: Phone View (GitHub Pages)

You can deploy a read-only web view of your tracker to GitHub Pages.

### Setup

1. Push this repo to GitHub
2. In your repo settings, enable GitHub Pages from the `gh-pages` branch (or configure Actions to deploy `dist/`)
3. Set the base path for your repo name and build:

```bash
VITE_BASE_PATH=/your-repo-name/ npm run build:web
```

This runs `scripts/build-data.mjs` (writes `public/magazines.json` + `public/stories.json` from your Markdown files) then builds the static site.

### Auto-sync after edits (optional)

The app can automatically rebuild the JSON and push after every data change. To enable:

```bash
touch .mobile-sync
```

This creates the opt-in marker that activates `spawn_mobile_sync()` in Rust. It runs on a background thread after every refresh or in-app edit. Requires non-interactive git auth (SSH key or credential helper). Delete `.mobile-sync` to disable.

## Building for Production

```bash
npm run tauri:build
```

Creates a signed `.dmg` in `src-tauri/target/release/bundle/dmg/`.

## Project Structure

```
courier/
├── magazines.example.md   # template — copy to magazines.md
├── stories.example.md     # template — copy to stories.md
├── magazines.md           # your data (gitignored)
├── stories.md             # your data (gitignored)
├── scripts/
│   ├── build-data.mjs     # MD → public/*.json for web deploy
│   └── resolve-deadlines.mjs  # pi-powered AI deadline extractor
├── src/                   # React frontend
├── src-tauri/
│   └── src/
│       ├── commands.rs    # Tauri commands (read/write/refresh)
│       ├── data.rs        # data structs
│       └── yaml_emit.rs   # lossless YAML writer
└── public/
    ├── magazines.json     # built artifact (gitignored)
    └── stories.json       # built artifact (gitignored)
```

## Development Notes

See `CLAUDE.md` for data model details, field conventions, and workflow notes aimed at AI coding assistants.

## License

MIT — see [LICENSE](LICENSE).
