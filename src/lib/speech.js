// Text-to-speech for Marathi, from the best source that has the text:
//   1. audio/         primary clips (a cloud neural voice, Google's as
//                     committed, made by scripts/generate-audio.mjs);
//   2. audio-backup/  backup clips (the open-source AI4Bharat Indic-TTS voice,
//                     made by scripts/generate-audio-local.py);
//   3. the browser's Web Speech API, restricted to a Marathi device voice.
// Both sets are committed. A primary clip that fails to load or play is
// retried from the backup set before the device voice is used.

import { audioKey, cleanSpeechText } from "./audioKey.js";

// How long a click waits for the manifests before deciding without them.
const MANIFEST_WAIT_MS = 1500;

let cachedVoice = null;
let voicesReady = false;

// The clip sets, in order of preference. `keys` is the Set of clip keys once
// that set's manifest has loaded; `rev` identifies the voice it was made with.
const SETS = [
  { dir: "audio", keys: null, rev: "", load: null },
  { dir: "audio-backup", keys: null, rev: "", load: null },
];

let audio = null; // the one <audio> element, reused for every clip
let latest = 0; // id of the newest speak() call; older async work gives up
const warmed = new Set(); // clip URLs already fetched whole for the offline cache

function hasSynth() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function pickVoice() {
  if (!hasSynth()) return null;
  // Marathi only: "mr-IN", or "mr_IN" as some Android builds report it.
  return window.speechSynthesis.getVoices().find((v) => /^mr([-_]|$)/i.test(v.lang || "")) || null;
}

export function ttsAvailable() {
  return SETS.some((set) => set.keys && set.keys.size) || hasSynth();
}

// Resolves to null (and is retried by the next call) on a network error, or to
// an empty manifest when a set has no manifest (404), e.g. a build without
// that folder.
async function fetchManifest(dir) {
  let res;
  try {
    res = await fetch(`${dir}/manifest.json`);
  } catch {
    return null;
  }
  try {
    return (res.ok && (await res.json())) || {};
  } catch {
    return {};
  }
}

function loadSet(set) {
  if (set.keys) return Promise.resolve();
  if (!set.load) {
    set.load = fetchManifest(set.dir).then((manifest) => {
      set.load = null;
      if (!manifest) return;
      // Clip names hash only the text, so the voice goes in the query string:
      // after a voice change the service worker misses its cache instead of
      // replaying clips in the old voice. Set before `keys`, which marks the
      // set as ready.
      set.rev = audioKey(`${manifest.provider}|${manifest.voice}|${manifest.rate}`);
      set.keys = new Set(Array.isArray(manifest.keys) ? manifest.keys : []);
    });
  }
  return set.load;
}

// Both manifests, fetched concurrently; resolves once both have settled.
const loadManifests = () => Promise.all(SETS.map(loadSet));

// Voice lists load asynchronously in most browsers; warm them up early.
// The clip manifests are fetched here too, so they are ready before the first click.
export function warmVoices() {
  if (typeof window === "undefined") return;
  loadManifests();
  if (!hasSynth()) return;
  const synth = window.speechSynthesis;
  synth.getVoices();
  synth.onvoiceschanged = () => {
    cachedVoice = pickVoice();
    voicesReady = true;
  };
}

function speakWithDevice(clean, rate) {
  if (!hasSynth()) return;
  const synth = window.speechSynthesis;
  if (audio) audio.pause();
  synth.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  if (!voicesReady || !cachedVoice) cachedVoice = pickVoice();
  if (cachedVoice) u.voice = cachedVoice;
  // With no Marathi voice installed, still ask for mr-IN rather than guess at
  // a different language's voice.
  u.lang = cachedVoice ? cachedVoice.lang : "mr-IN";
  u.rate = rate;
  synth.speak(u);
}

// <audio> asks for byte ranges, which the service worker can only answer from
// a complete cached copy (see vite.config.js), so fetch each clip whole once
// to make it playable offline later.
function warm(url) {
  if (warmed.has(url) || !navigator.serviceWorker || !navigator.serviceWorker.controller) return;
  warmed.add(url);
  fetch(url)
    .then((res) => {
      if (!res.ok) warmed.delete(url);
    })
    .catch(() => warmed.delete(url));
}

// Plays the clip for `key` from the first set that lists it, then from the
// next one if that fails to load or play, then falls back to the device
// voice. Sets are looked up at each step, so a backup manifest that arrives
// after the click still counts. Only the first attempt runs inside the click;
// a retry reuses the same <audio> element, which that click already unlocked
// (iOS Safari only lets a user gesture start audio).
function playClip(key, clean, rate, id) {
  if (!audio) audio = new Audio();
  if (hasSynth()) window.speechSynthesis.cancel();
  let from = 0;
  const attempt = () => {
    if (id !== latest) return;
    const set = SETS.slice(from).find((s) => s.keys && s.keys.has(key));
    if (!set) {
      speakWithDevice(clean, rate);
      return;
    }
    from = SETS.indexOf(set) + 1;
    const url = `${set.dir}/${key}.mp3?v=${set.rev}`;
    let failed = false; // a failed clip reports through both onerror and play()
    const fail = () => {
      if (failed || id !== latest) return;
      failed = true;
      attempt();
    };
    audio.pause();
    audio.onerror = fail;
    audio.src = url;
    const started = audio.play();
    if (started) started.catch(fail);
    warm(url);
  };
  attempt();
}

export function speak(text, { rate = 0.85 } = {}) {
  try {
    const id = ++latest;
    const clean = cleanSpeechText(text);
    if (!clean) return;
    const key = audioKey(text);
    // Whether the source can be chosen yet: a set that is still loading only
    // matters while every set before it has loaded without this clip.
    const decided = () => {
      for (const set of SETS) {
        if (!set.keys) return false;
        if (set.keys.has(key)) return true;
      }
      return true;
    };
    const go = () => {
      if (id !== latest) return;
      // After a timed-out wait, a set that still hasn't loaded doesn't count.
      if (SETS.some((set) => set.keys && set.keys.has(key))) playClip(key, clean, rate, id);
      else speakWithDevice(clean, rate);
    };
    // (Re)starts any manifest that hasn't loaded; a no-op once both have.
    const loading = loadManifests();
    // Normally the manifests are already here and playback starts
    // synchronously, inside the click (iOS Safari only unlocks audio from a
    // user gesture). A click that beats them waits briefly, until the source
    // can be decided, both manifests have settled, or the timer runs out.
    if (decided()) go();
    else {
      const ready = new Promise((r) => SETS.forEach((set) => loadSet(set).then(() => decided() && r())));
      Promise.race([ready, loading, new Promise((r) => setTimeout(r, MANIFEST_WAIT_MS))]).then(go);
    }
  } catch {
    /* audio unavailable */
  }
}
