// Progress persistence. localStorage-backed, synchronous, versioned.

const KEY = "marathi-shika-v2";

export const EMPTY_STORE = {
  lessons: {}, // lessonId -> { done, score, total }
  srs: {}, // itemKey -> { interval (days), due (ms epoch), reps }
  meta: { lastStudy: null, streak: 0, best: 0 },
};

// Deliberately not structuredClone(): that's missing on older browsers
// (pre-15.4 Safari especially), and this runs before first paint — a
// throw here would blank the whole app.
export function emptyStore() {
  return { lessons: {}, srs: {}, meta: { ...EMPTY_STORE.meta } };
}

export function loadStore() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw);
    return {
      lessons: parsed.lessons || {},
      srs: parsed.srs || {},
      meta: { ...EMPTY_STORE.meta, ...(parsed.meta || {}) },
    };
  } catch {
    // Private-mode storage restrictions land here too.
    return emptyStore();
  }
}

export function saveStore(store) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* storage full or unavailable — progress just won't persist */
  }
}

export function clearStore() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/* ---------- backup / restore ----------
   Progress lives only on this device, so give people a way to carry it
   to another browser — or back after clearing site data. */

export function serializeStore(store) {
  return JSON.stringify(
    {
      app: "marathi-shika",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      lessons: store.lessons,
      srs: store.srs,
      meta: store.meta,
    },
    null,
    2
  );
}

// Throws a human-readable Error if the file isn't a progress backup.
export function parseStore(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("That doesn't look like a progress file.");
  }
  const { lessons, srs, meta } = parsed;
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  if (!isObj(lessons) || !isObj(srs)) {
    throw new Error("That doesn't look like a मराठी शिका progress file.");
  }
  return {
    lessons,
    srs,
    meta: { ...EMPTY_STORE.meta, ...(isObj(meta) ? meta : {}) },
  };
}

export function downloadStore(store) {
  const blob = new Blob([serializeStore(store)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
  a.href = url;
  a.download = `marathi-shika-progress-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the download a tick to start before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// Mark "studied today" and roll the streak. Returns an updated meta object.
export function touchStreak(meta) {
  const today = todayStr();
  if (meta.lastStudy === today) return meta;
  const yesterday = new Date(Date.now() - 86400000);
  const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(yesterday.getDate()).padStart(2, "0")}`;
  const streak = meta.lastStudy === yStr ? (meta.streak || 0) + 1 : 1;
  return { lastStudy: today, streak, best: Math.max(meta.best || 0, streak) };
}

// Is the streak still alive (studied today or yesterday)?
export function streakAlive(meta) {
  if (!meta.lastStudy) return false;
  const today = todayStr();
  if (meta.lastStudy === today) return true;
  const yesterday = new Date(Date.now() - 86400000);
  const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(yesterday.getDate()).padStart(2, "0")}`;
  return meta.lastStudy === yStr;
}
