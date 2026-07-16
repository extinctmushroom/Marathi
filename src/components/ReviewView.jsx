import { useEffect, useState } from "react";
import { resolveKey } from "../data/index.js";
import { shuffle } from "../lib/quiz.js";
import { dueKeys, GRADES } from "../lib/srs.js";
import { ProgressBar, SpeakButton } from "./shared.jsx";

// Spaced-repetition session over every word you've unlocked by passing
// lesson quizzes. Self-graded flashcards: Again / Hard / Good / Easy.
export default function ReviewView({ store, gradeCard, goHome }) {
  const [queue, setQueue] = useState(() => {
    const due = shuffle(dueKeys(store.srs)).slice(0, 30);
    return due.map((key) => ({ key, ...resolveKey(key) })).filter((c) => c.item);
  });
  const [total] = useState(queue.length);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  const card = queue[0];

  const grade = (g) => {
    if (!card) return;
    gradeCard(card.key, g);
    setFlipped(false);
    setReviewed((r) => r + 1);
    // "Again" sends the card to the back of today's queue; anything
    // better retires it until its next due date.
    setQueue((prev) => (g === "again" ? [...prev.slice(1), prev[0]] : prev.slice(1)));
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest("input, textarea")) return;
      if (e.key === " " || e.key === "Enter") {
        if (e.target.tagName === "BUTTON") return;
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && ["1", "2", "3", "4"].includes(e.key)) {
        grade(GRADES[Number(e.key) - 1].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div>
      <header className="lesson-header" style={{ paddingBottom: 20 }}>
        <div className="lesson-header-inner">
          <button className="link-btn" onClick={goHome}>
            ‹ All lessons
          </button>
          <div className="lesson-level-tag">Spaced repetition</div>
          <div className="shirorekha">
            <h2>उजळणी · Review</h2>
          </div>
        </div>
      </header>

      <main className="page-narrow">
        {!card ? (
          <div style={{ textAlign: "center", padding: "30px 0" }}>
            <div className="mr" style={{ fontSize: 38, color: "var(--green)" }}>
              {reviewed > 0 ? "झकास!" : "सगळं झालं!"}
            </div>
            <p className="muted" style={{ marginTop: 4 }}>
              {reviewed > 0
                ? `(jhakās — superb!) You reviewed ${reviewed} card${reviewed === 1 ? "" : "s"}.`
                : "(sagḷã jhālã — all done!) Nothing is due right now."}
            </p>
            <p style={{ fontSize: 14.5, lineHeight: 1.6 }}>
              Cards you rate <em>Good</em> or <em>Easy</em> come back at growing intervals —
              a few minutes a day keeps every word fresh. Pass more lesson quizzes to grow the deck.
            </p>
            <button className="btn btn-primary" onClick={goHome}>
              Back to lessons
            </button>
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ marginBottom: 12 }}>
              <ProgressBar pct={total ? (reviewed / total) * 100 : 0} />
              <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                {queue.length} card{queue.length === 1 ? "" : "s"} left · from “{card.lesson.title}”
              </p>
            </div>
            <div
              onClick={() => setFlipped(!flipped)}
              role="button"
              tabIndex={0}
              aria-label="Review card — activate to flip"
              onKeyDown={(e) => e.key === "Enter" && setFlipped(!flipped)}
              className={`flashcard${flipped ? " flipped" : ""}`}
            >
              {!flipped ? (
                <>
                  <div className="flashcard-front-mr">{card.item.mr}</div>
                  <div style={{ marginTop: 14 }}>
                    <SpeakButton text={card.item.mr} />
                  </div>
                </>
              ) : (
                <>
                  <div className="flashcard-tr">{card.item.tr}</div>
                  <div className="flashcard-back-main">{card.item.en}</div>
                  {card.item.note && <div className="flashcard-note">{card.item.note}</div>}
                </>
              )}
            </div>
            {!flipped ? (
              <button className="btn btn-primary" onClick={() => setFlipped(true)}>
                Show answer
              </button>
            ) : (
              <div className="grade-row">
                {GRADES.map((g) => (
                  <button key={g.id} className={`grade-btn ${g.id}`} onClick={() => grade(g.id)}>
                    <span className="g-mr">{g.mr}</span>
                    <span className="g-en">
                      {g.en} · {g.hint}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <p className="kbd-hint">
              <kbd>space</kbd> flip · <kbd>1</kbd>–<kbd>4</kbd> grade
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
