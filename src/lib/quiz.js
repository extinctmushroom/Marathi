// Quiz generation: a mix of multiple-choice (both directions), listening,
// and typed-transliteration questions, built from a lesson's items.

import { ttsAvailable } from "./speech.js";

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Diacritic-insensitive normalization so learners can type "pani" for "pāṇī".
export function normalizeTr(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

// Accepted typed answers for an item ("bābā / vaḍīl" accepts either).
export function typedAnswers(item) {
  return item.tr
    .split("/")
    .map((s) => normalizeTr(s))
    .filter(Boolean);
}

function typingEligible(item) {
  const answers = typedAnswers(item);
  return answers.length > 0 && answers.every((a) => a.length >= 2 && a.length <= 12);
}

function mcOptions(item, pool, field) {
  const others = shuffle(pool.filter((x) => x !== item && x[field] !== item[field])).slice(0, 3);
  return shuffle([item[field], ...others.map((o) => o[field])]);
}

// Build a quiz of up to `size` questions from a lesson.
// Question shapes:
//   { type: "mc",     item, prompt, promptSub, promptIsMarathi, options, optionsAreMarathi, correct }
//   { type: "listen", item, options (Marathi), correct }
//   { type: "type",   item, answers (normalized), display (tr) }
export function buildQuiz(lesson, size = 10) {
  const pool = lesson.items;
  const picked = shuffle(pool).slice(0, Math.min(size, pool.length));
  const canListen = ttsAvailable();
  let listens = 0;
  let typings = 0;

  return picked.map((item, i) => {
    // Sprinkle in up to 2 listening and 2 typing questions per quiz.
    if (canListen && listens < 2 && item.mr.length <= 18 && i % 4 === 1) {
      listens++;
      return {
        type: "listen",
        item,
        options: mcOptions(item, pool, "mr"),
        correct: item.mr,
      };
    }
    if (typings < 2 && typingEligible(item) && i % 4 === 3) {
      typings++;
      return {
        type: "type",
        item,
        answers: typedAnswers(item),
        display: item.tr,
      };
    }
    const toEnglish = Math.random() < 0.55;
    return {
      type: "mc",
      item,
      prompt: toEnglish ? item.mr : item.en,
      promptSub: toEnglish ? item.tr : null,
      promptIsMarathi: toEnglish,
      options: mcOptions(item, pool, toEnglish ? "en" : "mr"),
      optionsAreMarathi: !toEnglish,
      correct: toEnglish ? item.en : item.mr,
    };
  });
}

export const PASS_RATIO = 0.7;
