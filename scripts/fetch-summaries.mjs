#!/usr/bin/env node
/**
 * fetch-summaries.mjs — generates a brief magazine blurb from its homepage/masthead.
 *
 * Input  (stdin):  JSON array of unique magazines needing a summary:
 *   [{ name, homepage }]
 * Output (stdout): JSON array of results:
 *   [{ name, summary }]
 *   - summary is null when the page couldn't be fetched or the model was inconclusive
 *
 * The summary is a 1–2 sentence description of what the magazine publishes,
 * drawn from the about/mission section of their homepage.
 */

import {
  AuthStorage,
  ModelRegistry,
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  getAgentDir,
} from "@earendil-works/pi-coding-agent";

const PRIMARY = ["anthropic", "claude-haiku-4-5"];
const FALLBACK = ["ollama", "qwen2.5:7b"];
const CONCURRENCY = 3;
const MAX_CHARS = 6000;

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

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

/** Fetch one URL: plain first, Jina fallback. */
async function fetchOne(url) {
  return (await fetchPlain(url)) ?? (await fetchJina(url));
}

/**
 * Try to find and fetch an about/mission page linked from the homepage.
 * Returns the best text we could find: about page preferred, homepage fallback.
 */
async function gatherMastheadText(homepage) {
  const homeText = await fetchOne(homepage);
  if (!homeText) return null;

  // Look for an /about, /mission, /masthead, /who-we-are style link.
  const aboutRe = /https?:\/\/[^\s"'<>]+\/(?:about|mission|masthead|who-we-are|our-story)[^\s"'<>]*/gi;
  const candidates = [...new Set([...homeText.matchAll(aboutRe)].map((m) => m[0]))].slice(0, 3);

  for (const url of candidates) {
    const aboutText = await fetchOne(url);
    if (aboutText && aboutText.length >= 200) {
      return aboutText.slice(0, MAX_CHARS);
    }
  }

  return homeText.slice(0, MAX_CHARS);
}

// ---------- AI extraction ----------

const SYSTEM_PROMPT =
  "You are a precise literary magazine cataloguer. " +
  "Follow the output format exactly. Do not explain or add commentary.";

function buildPrompt(name, pageText) {
  return `You are cataloguing the literary magazine "${name}".

Below is text from their homepage or about page. Write a single short description (1–2 sentences, max 40 words) of what this magazine publishes — the kinds of writing, themes, aesthetics, or audiences they focus on. Be specific, not generic. Do not mention submission deadlines or fees.

Reply with ONLY a JSON object, no markdown fences:
{"summary": "<your description here>"}

Page text:
${pageText}`;
}

function parseReply(raw) {
  if (!raw) return null;
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[0]);
    const s = typeof obj.summary === "string" ? obj.summary.trim() : null;
    return s && s.length > 10 ? s : null;
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

async function summariseEntry({ name, homepage }) {
  const pageText = await gatherMastheadText(homepage);
  if (!pageText) {
    process.stderr.write(`[summary] ${name} — could not fetch homepage, skipping\n`);
    return { name, summary: null };
  }

  const prompt = buildPrompt(name, pageText);

  // Try primary model first, fall back to local on unavailability.
  let cloudUnavailable = false;
  try {
    const summary = await runModel(PRIMARY, prompt);
    if (summary) {
      process.stderr.write(`[summary] ${name} → "${summary}"\n`);
      return { name, summary };
    }
  } catch (e) {
    cloudUnavailable = true;
    process.stderr.write(`[summary] ${name} — cloud unavailable (${e.message}), trying local\n`);
  }

  if (cloudUnavailable) {
    try {
      const summary = await runModel(FALLBACK, prompt);
      if (summary) {
        process.stderr.write(`[summary] ${name} → "${summary}" (local fallback)\n`);
        return { name, summary };
      }
    } catch (e) {
      process.stderr.write(`[summary] ${name} — fallback failed (${e.message})\n`);
    }
  }

  process.stderr.write(`[summary] ${name} — inconclusive\n`);
  return { name, summary: null };
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
  const timeoutHandle = setTimeout(() => {
    process.stderr.write("[summary] TIMEOUT (3min) — aborting\n");
    process.exit(1);
  }, 180_000);

  const input = (await readStdin()).trim();
  const entries = input ? JSON.parse(input) : [];
  if (!Array.isArray(entries)) throw new Error("stdin must be a JSON array");

  process.stderr.write(`[summary] Generating summaries for ${entries.length} magazine(s)\n`);

  const results = await mapLimit(entries, CONCURRENCY, summariseEntry);
  clearTimeout(timeoutHandle);
  process.stdout.write(JSON.stringify(results));
}

main().catch((e) => {
  process.stderr.write(`[summary] fatal: ${e.stack || e}\n`);
  process.exit(1);
});
