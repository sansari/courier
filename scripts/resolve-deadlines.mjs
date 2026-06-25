#!/usr/bin/env node
/**
 * resolve-deadlines.mjs — pi-powered deadline extractor.
 *
 * Input  (stdin):  JSON array of entries to resolve:
 *   [{ name, call_name, submit_info, external_submit_url, guidelines }]
 * Output (stdout): JSON array of results:
 *   [{ name, call_name, deadline, model, needs_review, review_note }]
 *   - deadline is null when the scrape was inconclusive (caller keeps old value)
 *   - needs_review is true when the answer is low-confidence (eyeball it)
 *
 * Model strategy (configurable via ~/.pi/agent/auth.json + ~/.pi/agent/models.json):
 *   Primary:  anthropic/claude-haiku-4-5  (fast, reliable via pi login)
 *             -> flags needs_review when the model reports low confidence.
 *   Fallback: ollama/qwen2.5:7b  (local; used only when the cloud is unavailable,
 *             so a network/provider outage still yields an answer — flagged)
 *
 * Fetching: plain HTTP first; falls back to Jina Reader (r.jina.ai) to render
 * JS-heavy SPA pages (e.g. Submittable, Moksha) that return an empty shell.
 */

import {
  AuthStorage,
  ModelRegistry,
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  getAgentDir,
} from "@earendil-works/pi-coding-agent";

// Single cloud model (fast + reliable via the pi Anthropic login), with the
// local model as an offline fallback when the cloud is unavailable.
const PRIMARY = ["anthropic", "claude-haiku-4-5"];
const FALLBACK = ["ollama", "qwen2.5:7b"];
const CONCURRENCY = 3;
const MAX_CHARS_PER_PAGE = 6000;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

const today = new Date().toLocaleDateString("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

// ---------- fetching ----------

function htmlToText(html) {
  return html
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPlain(url) {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const text = htmlToText(await res.text());
    return text.length >= 100 ? text : null;
  } catch {
    return null;
  }
}

async function fetchJina(url) {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { "user-agent": UA },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const text = (await res.text()).replace(/\s+/g, " ").trim();
    return text.length >= 100 ? text : null;
  } catch {
    return null;
  }
}

function isSpa(url) {
  return /submittable\.com|moksha\.io/.test(url || "");
}

/** Fetch one URL: plain first, Jina render fallback for SPAs or thin pages. */
async function fetchOne(url) {
  if (isSpa(url)) {
    return (await fetchJina(url)) ?? (await fetchPlain(url));
  }
  return (await fetchPlain(url)) ?? (await fetchJina(url));
}

async function gatherText(entry) {
  const urls = [
    entry.submit_info,
    entry.external_submit_url,
    entry.guidelines,
  ].filter((u, i, arr) => u && arr.indexOf(u) === i);

  const pages = await Promise.all(
    urls.map(async (url) => {
      const text = await fetchOne(url);
      return text ? { url, text } : null;
    }),
  );
  return pages.filter(Boolean);
}

// ---------- extraction ----------

const SYSTEM_PROMPT =
  "You are a precise data extractor for literary-magazine submission pages. " +
  "Follow the output format exactly. Do not explain.";

function buildPrompt(pages) {
  const body = pages
    .map(
      (p, i) =>
        `--- Page ${i + 1} (${p.url}) ---\n${p.text.slice(0, MAX_CHARS_PER_PAGE)}`,
    )
    .join("\n\n");

  return `Today's date: ${today}

Extract the current or next FICTION submission window from these literary magazine webpages. Synthesize across all pages.

Reply with ONLY a single JSON object, no markdown fences, no other text:
{"deadline": <VALUE>, "confidence": "high" | "low"}

<VALUE> must be exactly one of:
- A date range "MMM DD - MMM DD, YYYY"  (e.g. "Aug 15 - Nov 15, 2026") — PREFERRED when open and close are both known
- A single date "MMM DD, YYYY"          (e.g. "May 01, 2026") — only the close date is known
- "Closed to submissions"
- "Currently open to submissions"
- "Rolling submissions"
- "Check website for details"

Rules:
- MMM is a THREE-LETTER MONTH abbreviation: Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec. NEVER use weekday names (Mon, Tue, ...).
- For ranges, OPENING date first, CLOSING date second.
- If multiple windows exist, return the one currently open; else the next upcoming.
- Ignore workshop/event dates. Fiction submissions only.
- Use confidence "low" if the pages are empty, a JS app shell, ambiguous, or you are guessing.

Pages:
${body}`;
}

const DEADLINE_RE =
  /^[A-Za-z]{3}\s+\d{1,2}(\s*-\s*[A-Za-z]{3}\s+\d{1,2})?,\s*\d{4}$/;
const WEEKDAYS = /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/;

function isValidDeadline(s) {
  if (typeof s !== "string") return false;
  const t = s.trim();
  if (
    [
      "Closed to submissions",
      "Always Open",
      "Currently open to submissions",
      "Rolling submissions",
    ].includes(t)
  ) {
    return true;
  }
  // Must match the date shape AND not be weekday names mistaken for months.
  return DEADLINE_RE.test(t) && !WEEKDAYS.test(t);
}

function parseReply(raw) {
  if (!raw) return null;
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[0]);
    const deadline =
      typeof obj.deadline === "string" ? obj.deadline.trim() : null;
    return {
      deadline,
      confidence: obj.confidence === "high" ? "high" : "low",
      valid: isValidDeadline(deadline),
    };
  } catch {
    return null;
  }
}

// Shared across all sessions.
const authStorage = AuthStorage.create();
const modelRegistry = ModelRegistry.create(authStorage);
const resourceLoader = new DefaultResourceLoader({
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  systemPrompt: SYSTEM_PROMPT,
  noExtensions: true,
  noSkills: true,
  noPromptTemplates: true,
  noThemes: true,
  noContextFiles: true,
});
await resourceLoader.reload();

/** Pull assistant text from the final message (reliable), falling back to
 *  streamed deltas. Throws on a model error (e.g. HTTP 429 rate limit) so the
 *  caller can tell "unavailable" apart from "answered but unparseable". */
async function runModel([provider, id], prompt) {
  const model = modelRegistry.find(provider, id);
  if (!model) throw new Error(`model not found: ${provider}/${id}`);
  const { session } = await createAgentSession({
    model,
    noTools: "all",
    resourceLoader,
    authStorage,
    modelRegistry,
    sessionManager: SessionManager.inMemory(),
    thinkingLevel: "off",
  });
  let deltas = "";
  const unsub = session.subscribe((ev) => {
    if (
      ev.type === "message_update" &&
      ev.assistantMessageEvent.type === "text_delta"
    ) {
      deltas += ev.assistantMessageEvent.delta;
    }
  });
  let last;
  try {
    await session.prompt(prompt);
    last = session.messages.at(-1);
  } finally {
    unsub();
    session.dispose();
  }
  if (last && last.stopReason === "error") {
    let code = "";
    try { code = ` (HTTP ${JSON.parse(last.errorMessage)?.error?.code})`; } catch {}
    throw new Error(`${provider}/${id} model error${code}`);
  }
  const text = Array.isArray(last?.content)
    ? last.content.filter((p) => p?.type === "text").map((p) => p.text).join("")
    : "";
  return parseReply(text || deltas);
}

function result(entry, deadline, model, needs_review = false, review_note = null) {
  return {
    name: entry.name,
    call_name: entry.call_name ?? null,
    deadline,
    model,
    needs_review,
    review_note,
  };
}

async function resolveEntry(entry) {
  const label = `${entry.name}${entry.call_name ? ` / ${entry.call_name}` : ""}`;
  const pages = await gatherText(entry);
  if (pages.length === 0) {
    process.stderr.write(`[resolve] ${label} — no pages fetched, skipping\n`);
    return result(entry, null, null);
  }
  const prompt = buildPrompt(pages);

  // Primary: the cloud model. A ⚠️ (needs_review) is set only when the model
  // itself reports low confidence on an otherwise-valid answer.
  let cloudUnavailable = false;
  try {
    const r = await runModel(PRIMARY, prompt);
    if (r && r.valid) {
      const lowConf = r.confidence === "low";
      process.stderr.write(`[resolve] ${label} → ${r.deadline}${lowConf ? " (low confidence — flagged)" : ""}\n`);
      return result(entry, r.deadline, "anthropic/claude-haiku-4-5", lowConf,
        lowConf ? "model was uncertain — verify manually" : null);
    }
  } catch (e) {
    cloudUnavailable = true;
    process.stderr.write(`[resolve] ${label} — cloud unavailable (${e.message}), trying local\n`);
  }

  // Offline fallback: only when the cloud model was actually unavailable.
  if (cloudUnavailable) {
    try {
      const fb = await runModel(FALLBACK, prompt);
      if (fb && fb.valid) {
        process.stderr.write(`[resolve] ${label} → ${fb.deadline} (local fallback — flagged)\n`);
        return result(entry, fb.deadline, "ollama/qwen2.5:7b", true,
          "resolved by local fallback (cloud unavailable) — verify manually");
      }
    } catch (e) {
      process.stderr.write(`[resolve] ${label} — fallback failed (${e.message})\n`);
    }
  }

  process.stderr.write(`[resolve] ${label} — inconclusive, keeping existing value\n`);
  return result(entry, null, null);
}

// ---------- concurrency runner ----------

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  // Timeout after 2 minutes to prevent zombie processes.
  const timeoutHandle = setTimeout(() => {
    process.stderr.write("[resolve] TIMEOUT (2min) — aborting\n");
    process.exit(1);
  }, 120_000);

  const input = (await readStdin()).trim();
  const entries = input ? JSON.parse(input) : [];
  if (!Array.isArray(entries)) throw new Error("stdin must be a JSON array");

  // Dedupe by URL set: calls that read the exact same pages share one request
  // (extraction ignores call_name, so the window is identical for all of them).
  const groups = new Map();
  for (const e of entries) {
    const key = JSON.stringify([e.submit_info || "", e.external_submit_url || "", e.guidelines || ""]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  const groupList = [...groups.values()];
  process.stderr.write(`[resolve] ${entries.length} calls → ${groupList.length} requests after URL dedupe\n`);

  const grouped = await mapLimit(groupList, CONCURRENCY, async (members) => {
    const base = await resolveEntry(members[0]);
    // Fan the one resolved window out to every call that shares these pages.
    return members.map((e) => ({
      ...base,
      name: e.name,
      call_name: e.call_name ?? null,
    }));
  });
  clearTimeout(timeoutHandle);
  process.stdout.write(JSON.stringify(grouped.flat()));
}

main().catch((e) => {
  process.stderr.write(`[resolve] fatal: ${e.stack || e}\n`);
  process.exit(1);
});
