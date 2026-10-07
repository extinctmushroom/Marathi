// Text-to-speech for Marathi. Clips pre-generated with a neural Marathi voice
// (scripts/generate-audio.mjs → public/audio/) play when we have one for the
// text; anything else falls back to the browser's Web Speech API, restricted
// to a Marathi device voice.

import { audioKey, cleanSpeechText } from "./audioKey.js";

// How long a click waits for the manifest before using the device voice.
const MANIFEST_WAIT_MS = 1500;

let cachedVoice = null;
let voicesReady = false;

let clips = null; // Set of clip keys, once the manifest has loaded
let manifestLoad = null; // in-flight manifest request
let audio = null; // the one <audio> element, reused for every clip
let latest = 0; // id of the newest speak() call; older async work gives up
const warmed = new Set(); // clips already fetched whole for the offline cache

function hasSynth() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function pickVoice() {
  if (!hasSynth()) return null;
  // Marathi only: "mr-IN", or "mr_IN" as some Android builds report it.
  return window.speechSynthesis.getVoices().find((v) => /^mr([-_]|$)/i.test(v.lang || "")) || null;
}

export function ttsAvailable() {
  return Boolean(clips && clips.size) || hasSynth();
}

// Resolves to null (and is retried by the next call) on a network error, or to
// an empty set when there is simply no audio — a fork, or `npm run dev`.
async function fetchManifest() {
  let res;
  try {
    res = await fetch("audio/manifest.json");
  } catch {
    return null;
  }
  try {
    const manifest = res.ok ? await res.json() : null;
    return new Set(Array.isArray(manifest && manifest.keys) ? manifest.keys : []);
  } catch {
    return new Set();
  }
}

function loadManifest() {
  if (clips) return Promise.resolve();
  if (!manifestLoad) {
    manifestLoad = fetchManifest().then((found) => {
      manifestLoad = null;
      if (found) clips = found;
    });
  }
  return manifestLoad;
}

// Voice lists load asynchronously in most browsers; warm them up early.
// The clip manifest is fetched here too, so it is ready before the first click.
export function warmVoices() {
  if (typeof window === "undefined") return;
  loadManifest();
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

function playClip(key, clean, rate, id) {
  if (!audio) audio = new Audio();
  const url = `audio/${key}.mp3`;
  let fell = false; // a failed clip reports through both onerror and play()
  const fallBack = () => {
    if (fell || id !== latest) return;
    fell = true;
    speakWithDevice(clean, rate);
  };
  if (hasSynth()) window.speechSynthesis.cancel();
  audio.pause();
  audio.onerror = fallBack;
  audio.src = url;
  const started = audio.play();
  if (started) started.catch(fallBack);
  // <audio> asks for byte ranges, which the service worker can only answer
  // from a complete cached copy (see vite.config.js), so fetch each clip
  // whole once to make it playable offline later.
  if (navigator.serviceWorker && navigator.serviceWorker.controller && !warmed.has(key)) {
    warmed.add(key);
    fetch(url).catch(() => warmed.delete(key));
  }
}

export function speak(text, { rate = 0.85 } = {}) {
  try {
    const id = ++latest;
    const clean = cleanSpeechText(text);
    if (!clean) return;
    const key = audioKey(text);
    const go = () => {
      if (id !== latest) return;
      if (clips && clips.has(key)) playClip(key, clean, rate, id);
      else speakWithDevice(clean, rate);
    };
    // Normally the manifest is already here and playback starts synchronously,
    // inside the click (iOS Safari only unlocks audio from a user gesture). A
    // click that beats the manifest waits for it briefly instead.
    if (clips) go();
    else Promise.race([loadManifest(), new Promise((r) => setTimeout(r, MANIFEST_WAIT_MS))]).then(go);
  } catch {
    /* audio unavailable */
  }
}
