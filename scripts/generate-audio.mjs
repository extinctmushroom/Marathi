#!/usr/bin/env node
/* Pre-generate the primary Marathi speech clips — run with `npm run audio`.
 *
 * There's no backend, so the Text-to-Speech API key can't live in the app.
 * Instead this script (run by the "Generate voice clips" workflow, which
 * commits the result, or locally) synthesizes every string the app can speak
 * with a Google Cloud or Azure neural mr-IN voice and writes the results to
 * public/audio/<key>.mp3 plus a manifest.json listing what exists. Those are
 * the primary clips. The browser (src/lib/speech.js) plays a primary clip when
 * its key is in that manifest, else the backup clip in public/audio-backup
 * (an open-source voice made by scripts/generate-audio-local.py; this script
 * never touches it), else the device's own Marathi voice.
 *
 *   npm run audio                  generate whatever is missing
 *   npm run audio -- --dry-run     count clips and characters, no network
 *   npm run audio -- --require-credentials
 *                                  fail (exit 1) instead of skipping when the
 *                                  credentials are missing (used by the workflow)
 *   node scripts/generate-audio.mjs --list
 *                                  print every clip as JSON [{key, text}]
 *                                  (used by scripts/generate-audio-local.py)
 *
 * Environment (empty values count as unset):
 *   TTS_PROVIDER         google | azure. Default: google if GOOGLE_TTS_API_KEY
 *                        is set, else azure if AZURE_SPEECH_KEY and
 *                        AZURE_SPEECH_REGION are set.
 *   TTS_VOICE            override the provider's default voice
 *   GOOGLE_TTS_API_KEY   Google Cloud Text-to-Speech API key
 *   AZURE_SPEECH_KEY / AZURE_SPEECH_REGION   Azure Speech resource
 *
 * With no credentials it prints a warning and exits 0 without touching
 * public/audio (or, with --require-credentials, exits 1), so local builds and
 * forks keep the committed clips. The
 * deploy workflow doesn't run this script at all; it ships the committed
 * clips.
 *
 * With credentials this script owns public/audio. Re-runs are incremental: the
 * committed manifest records Google, the default voice and rate below, so a
 * run with GOOGLE_TTS_API_KEY only synthesizes new or edited text (check with
 * --dry-run). Changing provider, voice or speaking rate regenerates everything
 * and removes the clips it replaces.
 */

import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ALL_LESSONS } from "../src/data/index.js";
import { audioKey, cleanSpeechText } from "../src/lib/audioKey.js";

const OUT_DIR = fileURLToPath(new URL("../public/audio/", import.meta.url));
const MANIFEST_PATH = OUT_DIR + "manifest.json";

// Google offers three tiers for mr-IN: Chirp3-HD (30 voices), WaveNet (A-C)
// and Standard (A-C). Chirp3-HD sounds best but ignores speakingRate (Google
// documents no rate/pitch control for it), and a slower pace matters for
// learners — so the default is WaveNet, the best tier that honours it.
// Wavenet-A is female; -B is the male alternative. A Chirp3-HD voice set via
// TTS_VOICE still works; it is just sent without a rate. The committed clips in
// public/audio were made with these two defaults, so changing either one
// regenerates every clip on the next run.
const GOOGLE_DEFAULT_VOICE = "mr-IN-Wavenet-A";
const GOOGLE_RATE = 0.9;
// Azure's female neural voice; mr-IN-ManoharNeural is the male alternative.
const AZURE_DEFAULT_VOICE = "mr-IN-AarohiNeural";
const AZURE_RATE = "-10%";

const CONCURRENCY = 4;
const MAX_ATTEMPTS = 5;
const REQUEST_TIMEOUT_MS = 30_000;

const env = (name) => (process.env[name] || "").trim() || undefined;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const chars = (text) => [...text].length;

// Anything that should abort the whole run: bad credentials, a rejected
// request, or a transient error that outlasted every retry.
class FatalError extends Error {}

function redact(text) {
  let out = String(text);
  for (const secret of [env("GOOGLE_TTS_API_KEY"), env("AZURE_SPEECH_KEY")]) {
    if (secret) out = out.split(secret).join("***");
  }
  return out;
}

// ---------- what to say ----------

// Every ♪ button (SpeakButton in components/shared.jsx) is given an item's
// Marathi text: item.mr in the Learn, Flashcards and Review tabs, and in the
// Quiz tab (whose q.prompt is item.mr whenever the prompt is Marathi). So the
// full set of spoken strings is the `mr` of every item in every lesson.
function collectClips() {
  const clips = new Map(); // key -> text to synthesize
  let items = 0;
  for (const lesson of ALL_LESSONS) {
    for (const item of lesson.items) {
      items++;
      const text = cleanSpeechText(item.mr);
      if (!text) continue;
      const key = audioKey(item.mr);
      const seen = clips.get(key);
      if (seen !== undefined && seen !== text) {
        throw new FatalError(`audio key collision ${key}: "${seen}" vs "${text}" — change the hash in src/lib/audioKey.js`);
      }
      clips.set(key, text);
    }
  }
  return { clips, items };
}

// ---------- providers ----------

const isChirp = (voice) => /chirp/i.test(voice);

function resolveSettings() {
  const requested = (env("TTS_PROVIDER") || "").toLowerCase();
  if (requested && requested !== "google" && requested !== "azure") {
    throw new FatalError(`TTS_PROVIDER must be "google" or "azure" (got "${requested}")`);
  }
  const hasGoogle = Boolean(env("GOOGLE_TTS_API_KEY"));
  const hasAzure = Boolean(env("AZURE_SPEECH_KEY") && env("AZURE_SPEECH_REGION"));
  const provider = requested || (hasGoogle ? "google" : hasAzure ? "azure" : null);
  const ready = provider === "google" ? hasGoogle : provider === "azure" ? hasAzure : false;
  const shown = provider || "google";
  const voice = env("TTS_VOICE") || (shown === "google" ? GOOGLE_DEFAULT_VOICE : AZURE_DEFAULT_VOICE);
  const rate = shown === "google" ? (isChirp(voice) ? null : GOOGLE_RATE) : AZURE_RATE;
  return { provider, shown, ready, voice, rate };
}

function xmlEscape(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Each builder returns the fetch arguments and a function that pulls the MP3
// bytes out of a successful response.
const requests = {
  google({ voice, rate }, text) {
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(env("GOOGLE_TTS_API_KEY"))}`;
    const audioConfig = { audioEncoding: "MP3" };
    if (rate !== null) audioConfig.speakingRate = rate;
    return {
      url,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { text }, voice: { languageCode: "mr-IN", name: voice }, audioConfig }),
      },
      async read(res) {
        const { audioContent } = await res.json();
        return Buffer.from(audioContent || "", "base64");
      },
    };
  },

  azure({ voice, rate }, text) {
    const region = env("AZURE_SPEECH_REGION");
    if (!/^[a-z0-9-]+$/i.test(region)) throw new FatalError(`AZURE_SPEECH_REGION looks wrong: "${region}"`);
    const ssml =
      `<speak version="1.0" xml:lang="mr-IN"><voice name="${xmlEscape(voice)}">` +
      `<prosody rate="${rate}">${xmlEscape(text)}</prosody></voice></speak>`;
    return {
      url: `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      init: {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": env("AZURE_SPEECH_KEY"),
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
          "User-Agent": "marathi-shika-audio",
        },
        body: ssml,
      },
      async read(res) {
        return Buffer.from(await res.arrayBuffer());
      },
    };
  },
};

// An error response, redacted, pretty-printed when it is JSON, and in full
// (capped only so that a runaway HTML error page can't flood the log).
function fullErrorBody(body) {
  let text = redact(body);
  try {
    text = JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    /* not JSON: keep as is */
  }
  return text.length > 20_000 ? text.slice(0, 20_000) + "\n… (truncated)" : text;
}

const backoff = (attempt) => Math.min(30_000, 1000 * 2 ** (attempt - 1)) * (0.5 + Math.random() / 2);

async function synthesize(settings, text) {
  const { provider } = settings;
  const req = requests[provider](settings, text);
  const label = provider === "google" ? "Google" : "Azure";
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(req.url, { ...req.init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS) {
        throw new FatalError(`${label} request failed after ${attempt} attempts: ${redact(err.cause?.message || err.message)}`);
      }
      await sleep(backoff(attempt));
      continue;
    }

    if (res.ok) {
      const audio = await req.read(res);
      if (!audio.length) throw new FatalError(`${label} returned an empty clip for "${text}"`);
      return audio;
    }

    const body = (await res.text().catch(() => "")).trim();
    const detail = redact(body.slice(0, 300));
    if (res.status === 401 || res.status === 403) {
      // The whole body, not a prefix: Google puts the reason (for example
      // API_KEY_SERVICE_BLOCKED) and the project in the ErrorInfo details at
      // the end, which is what a 403 is debugged from.
      throw new FatalError(
        provider === "google"
          ? `Google rejected the API key (HTTP ${res.status}). Check GOOGLE_TTS_API_KEY, that the Cloud Text-to-Speech API is enabled for its project, and that any key restrictions allow it.\n${fullErrorBody(body)}`
          : `Azure rejected the credentials (HTTP ${res.status}). Check AZURE_SPEECH_KEY and that AZURE_SPEECH_REGION is the region the key was issued in.\n${fullErrorBody(body)}`
      );
    }
    const transient = res.status === 429 || res.status >= 500;
    if (!transient || attempt >= MAX_ATTEMPTS) {
      throw new FatalError(`${label} returned HTTP ${res.status}${transient ? ` after ${attempt} attempts` : ""}: ${detail}`);
    }
    const retryAfter = Number(res.headers.get("retry-after"));
    await sleep(retryAfter > 0 ? Math.min(retryAfter, 60) * 1000 : backoff(attempt));
  }
}

// ---------- files ----------

async function readManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  } catch {
    return null;
  }
}

async function listDir() {
  try {
    return await readdir(OUT_DIR);
  } catch {
    return [];
  }
}

// Write via a temp file so an interrupted run never leaves a truncated clip
// that a later run would mistake for a finished one.
async function writeAtomic(path, data) {
  await writeFile(path + ".tmp", data);
  await rename(path + ".tmp", path);
}

const writeManifest = (settings, keys) =>
  writeAtomic(
    MANIFEST_PATH,
    JSON.stringify({ voice: settings.voice, provider: settings.provider, rate: settings.rate, keys: [...keys].sort() }) + "\n"
  );

// ---------- main ----------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const list = args.includes("--list");
  const requireCredentials = args.includes("--require-credentials");
  const unknown = args.filter((a) => a !== "--dry-run" && a !== "--list" && a !== "--require-credentials");
  if (unknown.length) {
    throw new FatalError(`unknown argument: ${unknown.join(" ")} (supported: --dry-run, --list, --require-credentials)`);
  }

  // JSON only on stdout, no settings or credentials involved: the Python
  // generator reads this instead of recomputing keys or cleaning text itself.
  if (list) {
    const { clips } = collectClips();
    console.log(JSON.stringify([...clips].map(([key, text]) => ({ key, text }))));
    return;
  }

  const settings = resolveSettings();
  if (!dryRun && !settings.ready) {
    const need =
      settings.provider === "azure"
        ? "AZURE_SPEECH_KEY and AZURE_SPEECH_REGION"
        : settings.provider === "google"
          ? "GOOGLE_TTS_API_KEY"
          : "GOOGLE_TTS_API_KEY, or AZURE_SPEECH_KEY and AZURE_SPEECH_REGION";
    if (requireCredentials) {
      throw new FatalError(
        `No text-to-speech credentials (need ${need}). In GitHub, set them under ` +
          "Settings → Secrets and variables → Actions, then run again. See README → Audio voices."
      );
    }
    console.warn(`⚠ No text-to-speech credentials (need ${need}) — skipping audio generation.`);
    console.warn("  public/audio is left as it is, so the committed clips keep working. See README → Audio voices.");
    return;
  }

  const { clips, items } = collectClips();
  const keys = [...clips.keys()];
  const totalChars = keys.reduce((n, k) => n + chars(clips.get(k)), 0);

  // Existing clips are only reusable if they were made with the same
  // provider, voice and rate; otherwise they are all stale.
  const prev = await readManifest();
  const files = await listDir();
  const onDisk = new Set(files.filter((f) => f.endsWith(".mp3")).map((f) => f.slice(0, -4)));
  const reuse =
    prev !== null &&
    prev.provider === settings.shown &&
    prev.voice === settings.voice &&
    (prev.rate ?? null) === settings.rate;
  const cached = reuse ? keys.filter((k) => onDisk.has(k)) : [];
  const cachedSet = new Set(cached);
  const todo = keys.filter((k) => !cachedSet.has(k));
  const todoChars = todo.reduce((n, k) => n + chars(clips.get(k)), 0);
  const stale = new Set([...onDisk].filter((k) => !clips.has(k) || !reuse));

  const rateText = settings.rate === null ? "default pace" : `rate ${settings.rate}`;
  console.log(`${dryRun ? "Dry run (no network) · " : ""}${settings.shown} · ${settings.voice} · ${rateText}`);
  if (dryRun && !settings.ready) {
    console.log("  (no credentials set — showing the default provider; a real run would skip)");
  }
  console.log(`${keys.length} unique clips from ${items} items · ${totalChars.toLocaleString("en-US")} characters`);
  if (prev && !reuse) {
    console.log(`existing audio is from ${prev.provider} / ${prev.voice}${prev.rate != null ? ` / ${prev.rate}` : ""} — all of it will be regenerated`);
  }
  console.log(`already on disk: ${cached.length} · to generate: ${todo.length} (${todoChars.toLocaleString("en-US")} characters)`);
  if (dryRun) {
    if (stale.size) console.log(`would remove ${stale.size} stale clip(s)`);
    return;
  }

  // Synthesize one clip before deleting or rewriting anything, so a rejected
  // key or an exhausted quota cannot cost the clips that are already there.
  const first = todo.length ? await synthesize(settings, clips.get(todo[0])) : null;

  if (stale.size) console.log(`removing ${stale.size} stale clip(s)`);
  await mkdir(OUT_DIR, { recursive: true });
  for (const f of files) {
    const orphan = f.endsWith(".mp3") ? stale.has(f.slice(0, -4)) : f.endsWith(".tmp");
    if (orphan) await rm(OUT_DIR + f, { force: true });
  }
  // Record the settings before spending the rest of the quota, so that if this
  // run is interrupted the next one can tell which clips are reusable.
  await writeManifest(settings, cached);

  const done = new Set(cached);
  if (first) {
    await writeAtomic(`${OUT_DIR}${todo[0]}.mp3`, first);
    done.add(todo[0]);
  }
  let failure = null;
  let next = first ? 1 : 0;
  async function lane() {
    while (!failure && next < todo.length) {
      const key = todo[next++];
      try {
        await writeAtomic(`${OUT_DIR}${key}.mp3`, await synthesize(settings, clips.get(key)));
        done.add(key);
        const n = done.size - cached.length;
        if (n % 100 === 0) console.log(`  ${n}/${todo.length}`);
      } catch (err) {
        failure ??= err;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, lane));

  await writeManifest(settings, done);
  console.log(`${done.size - cached.length} generated · ${done.size}/${keys.length} clips available`);
  if (failure) throw failure;
  console.log("✓ audio is up to date");
}

main().catch((err) => {
  console.error("✗ " + redact(err instanceof FatalError ? err.message : err.stack || err));
  process.exit(1);
});
