#!/usr/bin/env node
/* Curriculum sanity check — run with `npm run check`.
 *
 * The whole course is plain data, so a typo in a lesson file can silently
 * break quizzes or the review deck. This catches the ways that happens:
 * duplicate ids, missing fields, duplicate Marathi entries within a lesson
 * (which would collide as spaced-repetition keys), lessons too small to
 * build a 4-option question, and quiz generation itself misbehaving.
 *
 * It also warns (without failing) about spoken items that have no speech clip
 * in either public/audio/manifest.json (primary voice) or
 * public/audio-backup/manifest.json (backup voice), so new content shows up
 * as missing audio, and counts items that only one of the two sets covers.
 */

import { readFileSync } from "node:fs";
import { ALL_LESSONS, ALL_LEVELS, TOTAL_ITEMS, itemKey, resolveKey } from "../src/data/index.js";
import { audioKey, cleanSpeechText } from "../src/lib/audioKey.js";
import { buildQuiz, typedAnswers } from "../src/lib/quiz.js";

let errors = 0;
const fail = (msg) => {
  console.error("  ✗ " + msg);
  errors++;
};

// Unique ids across levels and lessons.
const levelIds = ALL_LEVELS.map((l) => l.id);
if (new Set(levelIds).size !== levelIds.length) fail("duplicate level id");
const lessonIds = ALL_LESSONS.map((l) => l.id);
for (const id of new Set(lessonIds)) {
  if (lessonIds.filter((x) => x === id).length > 1) fail(`duplicate lesson id: ${id}`);
}

for (const lesson of ALL_LESSONS) {
  if (!lesson.title) fail(`${lesson.id}: missing title`);
  if (!lesson.intro) fail(`${lesson.id}: missing intro`);
  // Multiple-choice needs the item plus three distractors.
  if (lesson.items.length < 4) fail(`${lesson.id}: only ${lesson.items.length} items (need 4+)`);

  const seen = new Set();
  for (const item of lesson.items) {
    if (!item.mr || !item.tr || !item.en) {
      fail(`${lesson.id}: incomplete item ${JSON.stringify(item)}`);
      continue;
    }
    if (seen.has(item.mr)) fail(`${lesson.id}: duplicate "${item.mr}" — SRS keys would collide`);
    seen.add(item.mr);

    // Every item must survive a round trip through its review-deck key.
    const resolved = resolveKey(itemKey(lesson.id, item));
    if (!resolved || resolved.item !== item) {
      fail(`${lesson.id}: "${item.mr}" does not resolve from its SRS key`);
    }
  }
}

// Generated quizzes must always be answerable.
for (const lesson of ALL_LESSONS) {
  for (let round = 0; round < 5; round++) {
    for (const q of buildQuiz(lesson)) {
      if (q.type === "type") {
        if (!q.answers.length || q.answers.some((a) => !/^[a-z]+$/.test(a))) {
          fail(`${lesson.id}: bad typed answer ${JSON.stringify(q.answers)}`);
        }
      } else {
        if (!q.options.includes(q.correct)) fail(`${lesson.id}: correct answer missing from options`);
        if (new Set(q.options).size !== q.options.length) {
          fail(`${lesson.id}: duplicate options ${JSON.stringify(q.options)}`);
        }
      }
    }
  }
}

// Typed answers should be reachable without diacritics.
if (!typedAnswers({ tr: "bābā / vaḍīl" }).includes("vadil")) {
  fail("typedAnswers: alternatives (a / b) not accepted");
}

// Spoken items without a clip. Not an error: the app plays the primary clip
// (public/audio), else the backup clip (public/audio-backup), else the device's
// Marathi voice, so this only nudges you to regenerate audio after editing the
// lessons.
{
  const sets = ["audio", "audio-backup"].map((dir) => {
    try {
      const manifest = JSON.parse(readFileSync(new URL(`../public/${dir}/manifest.json`, import.meta.url), "utf8"));
      if (Array.isArray(manifest.keys)) return new Set(manifest.keys);
    } catch {
      /* reported below */
    }
    console.warn(`⚠ public/${dir}/manifest.json is missing or unreadable — that set of speech clips is empty.`);
    return new Set();
  });
  const [primary, backup] = sets;
  const missing = []; // in neither set
  const backupOnly = []; // in the backup set only
  const primaryOnly = []; // in the primary set only
  const seen = new Set();
  for (const lesson of ALL_LESSONS) {
    for (const item of lesson.items) {
      // Items without Marathi text are already reported above.
      if (typeof item.mr !== "string" || !cleanSpeechText(item.mr)) continue;
      const key = audioKey(item.mr);
      if (seen.has(key)) continue;
      seen.add(key);
      if (primary.has(key)) {
        if (!backup.has(key)) primaryOnly.push(key);
        continue;
      }
      (backup.has(key) ? backupOnly : missing).push(`${lesson.id}: ${item.mr}`);
    }
  }
  if (missing.length) {
    console.warn(`⚠ ${missing.length} spoken item(s) have no audio clip in either set (the app will use the device voice):`);
    for (const line of missing.slice(0, 15)) console.warn("    " + line);
    if (missing.length > 15) console.warn(`    …and ${missing.length - 15} more`);
    console.warn("  Primary (public/audio): run Actions → Generate voice clips, or `npm run audio` with a cloud key.");
    console.warn("  Backup (public/audio-backup): python scripts/generate-audio-local.py. See README → Audio voices.");
  }
  if (backupOnly.length) {
    console.log(`ℹ ${backupOnly.length} spoken item(s) use the backup voice only; Generate voice clips adds them to public/audio.`);
  }
  if (primaryOnly.length) {
    console.log(
      `ℹ ${primaryOnly.length} spoken item(s) have no backup clip in public/audio-backup; run python scripts/generate-audio-local.py.`
    );
  }
}

console.log(
  `${ALL_LEVELS.length} levels · ${ALL_LESSONS.length} lessons · ${TOTAL_ITEMS} items`
);
console.log(errors ? `${errors} problem(s) found` : "✓ curriculum looks good");
process.exit(errors ? 1 : 0);
