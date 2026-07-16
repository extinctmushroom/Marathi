// Progress persistence. localStorage-backed, synchronous, versioned.

const KEY = "marathi-shika-v2";

export const EMPTY_STORE = {
  lessons: {}, // lessonId -> { done, score, total }
  srs: {}, // itemKey -> { interval (days), due (ms epoch), reps }
  meta: { lastStudy: null, streak: 0, best: 0 },
};

export function loadStore() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return structuredClone(EMPTY_STORE);
    const parsed = JSON.parse(raw);
    return {
      lessons: parsed.lessons || {},
      srs: parsed.srs || {},
      meta: { ...EMPTY_STORE.meta, ...(parsed.meta || {}) },
    };
  } catch {
    return structuredClone(EMPTY_STORE);
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
