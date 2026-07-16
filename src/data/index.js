import level1 from "./level1-script.js";
import level2 from "./level2-foundations.js";
import level3 from "./level3-grammar.js";
import level4 from "./level4-vocabulary.js";
import level5 from "./level5-conversation.js";
import level6 from "./level6-advanced.js";
import level7 from "./level7-mastery.js";

export const ALL_LEVELS = [level1, level2, level3, level4, level5, level6, level7];

export const ALL_LESSONS = ALL_LEVELS.flatMap((lv) =>
  lv.lessons.map((l) => ({ ...l, levelId: lv.id, levelEn: lv.en }))
);

export const TOTAL_ITEMS = ALL_LESSONS.reduce((n, l) => n + l.items.length, 0);

export function findLesson(id) {
  return ALL_LESSONS.find((l) => l.id === id);
}

export function findLevel(id) {
  return ALL_LEVELS.find((lv) => lv.id === id);
}

// Stable key for an item, used by the spaced-repetition store.
export function itemKey(lessonId, item) {
  return `${lessonId}|${item.mr}`;
}

// Resolve an SRS key back to its item + lesson (null if content changed).
export function resolveKey(key) {
  const sep = key.indexOf("|");
  if (sep < 0) return null;
  const lessonId = key.slice(0, sep);
  const mr = key.slice(sep + 1);
  const lesson = findLesson(lessonId);
  if (!lesson) return null;
  const item = lesson.items.find((it) => it.mr === mr);
  return item ? { item, lesson } : null;
}
