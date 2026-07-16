import { useEffect, useState } from "react";
import { shuffle } from "../lib/quiz.js";
import { SpeakButton } from "./shared.jsx";

// Flashcards with two directions (read Marathi → recall meaning, or the
// reverse), shuffle, and keyboard control: space/enter flips, arrows move.
export default function CardsTab({ lesson }) {
  const [deck, setDeck] = useState(lesson.items);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reverse, setReverse] = useState(false); // false: MR front · true: EN front
  const it = deck[idx];

  const go = (d) => {
    setFlipped(false);
    setIdx((i) => (i + d + deck.length) % deck.length);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest("input, textarea")) return;
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === " " || e.key === "Enter") {
        if (e.target.tagName === "BUTTON") return;
        e.preventDefault();
        setFlipped((f) => !f);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deck.length]);

  return (
    <div style={{ textAlign: "center" }}>
      <p className="muted">
        Card {idx + 1} of {deck.length} — tap the card to flip
      </p>
      <div
        onClick={() => setFlipped(!flipped)}
        role="button"
        tabIndex={0}
        aria-label="Flashcard — activate to flip"
        onKeyDown={(e) => e.key === "Enter" && setFlipped(!flipped)}
        className={`flashcard${flipped ? " flipped" : ""}`}
      >
        {!flipped ? (
          reverse ? (
            <div className="flashcard-front-en">{it.en}</div>
          ) : (
            <>
              <div className="flashcard-front-mr">{it.mr}</div>
              <div style={{ marginTop: 14 }}>
                <SpeakButton text={it.mr} />
              </div>
            </>
          )
        ) : reverse ? (
          <>
            <div className="flashcard-back-mr">{it.mr}</div>
            <div className="flashcard-tr">{it.tr}</div>
            {it.note && <div className="flashcard-note">{it.note}</div>}
            <div style={{ marginTop: 12 }}>
              <SpeakButton text={it.mr} dark />
            </div>
          </>
        ) : (
          <>
            <div className="flashcard-tr">{it.tr}</div>
            <div className="flashcard-back-main">{it.en}</div>
            {it.note && <div className="flashcard-note">{it.note}</div>}
          </>
        )}
      </div>
      <div className="card-controls">
        <button className="btn" onClick={() => go(-1)}>
          ‹ Previous
        </button>
        <button className="btn btn-primary" onClick={() => go(1)}>
          Next ›
        </button>
        <button
          className="btn"
          onClick={() => {
            setDeck(shuffle(deck));
            setIdx(0);
            setFlipped(false);
          }}
        >
          Shuffle
        </button>
        <button
          className="btn"
          onClick={() => {
            setReverse(!reverse);
            setFlipped(false);
          }}
          title="Swap which side of the card you see first"
        >
          {reverse ? "EN → मराठी" : "मराठी → EN"} ⇄
        </button>
      </div>
      <p className="kbd-hint">
        <kbd>space</kbd> flip · <kbd>←</kbd> <kbd>→</kbd> navigate
      </p>
    </div>
  );
}
