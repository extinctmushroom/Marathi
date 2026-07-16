// Text-to-speech for Marathi, with a Hindi fallback (the scripts and most
// phonemes overlap, so a Hindi voice reads Marathi acceptably).

let cachedVoice = null;
let voicesReady = false;

function pickVoice() {
  const synth = window.speechSynthesis;
  if (!synth) return null;
  const voices = synth.getVoices();
  return (
    voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("mr")) ||
    voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("hi")) ||
    null
  );
}

export function ttsAvailable() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// Voice lists load asynchronously in most browsers; warm them up early.
export function warmVoices() {
  if (!ttsAvailable()) return;
  const synth = window.speechSynthesis;
  synth.getVoices();
  synth.onvoiceschanged = () => {
    cachedVoice = pickVoice();
    voicesReady = true;
  };
}

export function speak(text, { rate = 0.85 } = {}) {
  try {
    if (!ttsAvailable()) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    // Strip parenthetical asides and digit prefixes like "१० " duplicated in words.
    const clean = text.replace(/\(.*?\)/g, "").trim();
    if (!clean) return;
    const u = new SpeechSynthesisUtterance(clean);
    if (!voicesReady || !cachedVoice) cachedVoice = pickVoice();
    if (cachedVoice) u.voice = cachedVoice;
    u.lang = cachedVoice ? cachedVoice.lang : "mr-IN";
    u.rate = rate;
    synth.speak(u);
  } catch {
    /* audio unavailable */
  }
}
