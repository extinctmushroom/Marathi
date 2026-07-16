// A deliberately small spaced-repetition scheduler.
// Records: { interval: days, due: ms epoch, reps: successful reviews in a row }

const DAY = 86400000;

export const GRADES = [
  { id: "again", mr: "पुन्हा", en: "Again", hint: "forgot it" },
  { id: "hard", mr: "कठीण", en: "Hard", hint: "barely" },
  { id: "good", mr: "ठीक", en: "Good", hint: "got it" },
  { id: "easy", mr: "सोपं", en: "Easy", hint: "instantly" },
];

export function newRecord(now = Date.now()) {
  // New cards come due the next day, so finishing a lesson
  // doesn't instantly flood the review queue.
  return { interval: 1, due: now + DAY, reps: 0 };
}

export function gradeRecord(rec, grade, now = Date.now()) {
  const interval = rec?.interval ?? 1;
  const reps = rec?.reps ?? 0;
  switch (grade) {
    case "again":
      return { interval: 0, due: now, reps: 0 };
    case "hard": {
      const i = Math.max(1, Math.round(interval * 1.2));
      return { interval: i, due: now + i * DAY, reps: reps + 1 };
    }
    case "easy": {
      const i = interval < 1 ? 4 : Math.round(interval * 3.2);
      return { interval: i, due: now + i * DAY, reps: reps + 1 };
    }
    case "good":
    default: {
      const i = interval < 1 ? 1 : Math.round(interval * 2.2);
      return { interval: i, due: now + i * DAY, reps: reps + 1 };
    }
  }
}

export function dueKeys(srs, now = Date.now()) {
  return Object.keys(srs).filter((k) => (srs[k].due ?? 0) <= now);
}
