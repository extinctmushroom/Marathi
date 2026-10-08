// Naming for pre-generated speech clips. Shared by scripts/generate-audio.mjs
// (Node, writes public/audio/<key>.mp3) and src/lib/speech.js (browser, plays
// it), so the two must agree byte-for-byte: keep this file dependency-free
// and don't change either function without regenerating every clip.
// scripts/generate-audio-local.py never computes keys itself: it reads them
// from `node scripts/generate-audio.mjs --list`.

// Strip parenthetical asides — they're glosses for the reader, not words to
// say aloud — and surrounding whitespace.
export function cleanSpeechText(text) {
  return text.replace(/\(.*?\)/g, "").trim();
}

// cyrb53 (public domain): a fast 53-bit string hash. Synchronous, so the click
// handler can look a clip up without awaiting crypto.subtle, and identical in
// every JS engine because it only uses 32-bit integer maths on UTF-16 units.
function cyrb53(str) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// File name (without extension) of the clip for `text`: 14 hex digits.
export function audioKey(text) {
  return cyrb53(cleanSpeechText(text)).toString(16).padStart(14, "0");
}
