import { useMemo, useRef, useState } from "react";
import { ALL_LEVELS, ALL_LESSONS, TOTAL_ITEMS } from "../data/index.js";
import { dueKeys } from "../lib/srs.js";
import { streakAlive } from "../lib/storage.js";
import { Shirorekha, ThemeToggle } from "./shared.jsx";

// Fold diacritics so "pani" finds "pāṇī" and "doka" finds "ḍokã".
function fold(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function SearchResults({ query, openLesson }) {
  const q = fold(query.trim());
  const hits = useMemo(() => {
    if (!q) return [];
    const out = [];
    for (const lesson of ALL_LESSONS) {
      for (const it of lesson.items) {
        if (it.mr.includes(q) || fold(it.tr).includes(q) || fold(it.en).includes(q)) {
          out.push({ it, lesson });
          if (out.length >= 40) return out;
        }
      }
    }
    return out;
  }, [q]);

  if (!q) return null;
  return (
    <div style={{ display: "grid", gap: 8, marginBottom: 28 }}>
      {hits.length === 0 && (
        <p className="muted">
          No matches for “{query}” — try Marathi, transliteration, or English.
        </p>
      )}
      {hits.map(({ it, lesson }, i) => (
        <button key={i} className="search-hit" onClick={() => openLesson(lesson.id)}>
          <span className="mr">{it.mr}</span>
          <span className="tr">{it.tr}</span>
          <span className="en">{it.en}</span>
          <span className="where">{lesson.title}</span>
        </button>
      ))}
    </div>
  );
}

export default function Home({
  store,
  openLesson,
  openReview,
  resetAll,
  exportProgress,
  importProgress,
  theme,
  onToggleTheme,
}) {
  const [query, setQuery] = useState("");
  const fileInput = useRef(null);
  const doneCount = ALL_LESSONS.filter((l) => store.lessons[l.id]?.done).length;
  const pct = Math.round((doneCount / ALL_LESSONS.length) * 100);
  const due = dueKeys(store.srs).length;
  const deckSize = Object.keys(store.srs).length;
  const streak = streakAlive(store.meta) ? store.meta.streak : 0;
  const nextLesson = ALL_LESSONS.find((l) => !store.lessons[l.id]?.done);

  return (
    <div>
      <header className="hero">
        <div className="hero-inner">
          <div className="header-top">
            <div className="eyebrow">A complete course · script to conversation</div>
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          </div>
          <div className="shirorekha">
            <h1>मराठी शिका</h1>
          </div>
          <p className="hero-sub">
            Learn Marathi — the language of 80&nbsp;million people, of Mumbai and Pune, of saints'
            poetry and street-corner वडा&nbsp;पाव.
          </p>
          <div className="hero-progress">
            <div className="hero-progress-labels">
              <span>
                {doneCount} of {ALL_LESSONS.length} lessons complete
              </span>
              <span>{pct}%</span>
            </div>
            <div className="hero-bar">
              <div style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="chip-row">
            <span className="chip">
              🔥 {streak} <span className="dim">day streak</span>
            </span>
            <span className="chip">
              📖 {deckSize}/{TOTAL_ITEMS} <span className="dim">words collected</span>
            </span>
            <span className="chip">
              ⏰ {due} <span className="dim">due for review</span>
            </span>
          </div>
          <div className="chip-row">
            {nextLesson ? (
              <button className="btn btn-gold" onClick={() => openLesson(nextLesson.id)}>
                ▶ Continue: {nextLesson.title}
              </button>
            ) : (
              <span className="chip">🎓 Course complete — अभिनंदन!</span>
            )}
            <button className="btn btn-ghost-light" onClick={openReview} disabled={deckSize === 0}>
              उजळणी · Review {due > 0 ? `(${due})` : ""}
            </button>
          </div>
        </div>
      </header>

      <main className="page">
        <input
          className="search-box"
          type="search"
          placeholder="🔍 Search the whole course — पाणी, pani, or water…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search all lessons"
          style={{ marginBottom: query.trim() ? 14 : 28 }}
        />
        <SearchResults query={query} openLesson={openLesson} />

        {!query.trim() &&
          ALL_LEVELS.map((level) => {
            const levelDone = level.lessons.filter((l) => store.lessons[l.id]?.done).length;
            return (
              <section key={level.id} style={{ marginBottom: 36 }}>
                <div className="level-head">
                  <Shirorekha size={28}>{level.mr}</Shirorekha>
                  <span className="level-tag">{level.en}</span>
                  <span className="level-progress">
                    {levelDone}/{level.lessons.length}
                  </span>
                </div>
                <p className="level-desc">{level.desc}</p>
                <div style={{ display: "grid", gap: 10 }}>
                  {level.lessons.map((lesson) => {
                    const p = store.lessons[lesson.id];
                    const done = p?.done;
                    return (
                      <button
                        key={lesson.id}
                        onClick={() => openLesson(lesson.id)}
                        className={`lesson-row${done ? " done" : ""}`}
                      >
                        <span className="lesson-check">{done ? "✓" : ""}</span>
                        <span style={{ flexGrow: 1 }}>
                          <span className="lesson-title">{lesson.title}</span>
                          <span className="lesson-sub">
                            {lesson.items.length} items
                            {p?.total ? ` · best quiz ${p.score}/${p.total}` : ""}
                          </span>
                        </span>
                        <span className="lesson-arrow">›</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}

        {!query.trim() && (
          <>
            <p className="footer-note">
              Your progress is saved on this device. ♪ buttons read words aloud (voice quality
              depends on your device's Marathi/Hindi voices).
            </p>
            <div className="io-row">
              <button className="io-btn" onClick={exportProgress}>
                ⭳ Back up progress
              </button>
              <button className="io-btn" onClick={() => fileInput.current?.click()}>
                ⭱ Restore backup
              </button>
              <button
                className="io-btn"
                onClick={() => {
                  if (
                    window.confirm(
                      "Erase all progress — lessons, quiz scores, and the review deck?"
                    )
                  ) {
                    resetAll();
                  }
                }}
              >
                Reset
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  // Reset the input so re-picking the same file still fires.
                  e.target.value = "";
                  if (file) importProgress(file);
                }}
              />
            </div>
            <p className="offline-note">
              Add it to your home screen for one-tap practice — no signup, no account.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
