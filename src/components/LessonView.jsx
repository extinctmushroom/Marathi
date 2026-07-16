import { useEffect, useState } from "react";
import { ALL_LESSONS, findLevel } from "../data/index.js";
import CardsTab from "./CardsTab.jsx";
import LearnTab from "./LearnTab.jsx";
import QuizTab from "./QuizTab.jsx";

const TABS = [
  ["learn", "Learn"],
  ["cards", "Flashcards"],
  ["quiz", "Quiz"],
];

export default function LessonView({ lessonId, store, finishQuiz, goHome, openLesson }) {
  const [tab, setTab] = useState("learn");
  const li = ALL_LESSONS.findIndex((l) => l.id === lessonId);
  const lesson = ALL_LESSONS[li];
  const prev = ALL_LESSONS[li - 1];
  const next = ALL_LESSONS[li + 1];
  const level = findLevel(lesson.levelId);
  const progress = store.lessons[lessonId];

  useEffect(() => {
    setTab("learn");
    window.scrollTo(0, 0);
  }, [lessonId]);

  return (
    <div>
      <header className="lesson-header">
        <div className="lesson-header-inner">
          <button className="link-btn" onClick={goHome}>
            ‹ All lessons
          </button>
          <div className="lesson-level-tag">{level.en}</div>
          <div className="shirorekha">
            <h2>{lesson.title}</h2>
          </div>
          <nav className="tab-row" aria-label="Lesson sections">
            {TABS.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`tab-btn${tab === key ? " active" : ""}`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="page-narrow">
        {tab === "learn" && <LearnTab lesson={lesson} />}
        {tab === "cards" && <CardsTab key={lessonId} lesson={lesson} />}
        {tab === "quiz" && (
          <QuizTab
            key={lessonId}
            lesson={lesson}
            best={progress}
            onFinish={(score, total) => finishQuiz(lessonId, score, total)}
          />
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 30,
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          {tab === "learn" && (
            <button className="btn btn-primary" onClick={() => setTab("cards")}>
              Practice with flashcards ›
            </button>
          )}
          {tab === "cards" && (
            <button className="btn btn-primary" onClick={() => setTab("quiz")}>
              Take the quiz ›
            </button>
          )}
          {tab === "quiz" && prev && (
            <button className="btn" onClick={() => openLesson(prev.id)}>
              ‹ {prev.title}
            </button>
          )}
          {next && progress?.done && (
            <button
              className="btn btn-green"
              style={{ marginLeft: "auto" }}
              onClick={() => openLesson(next.id)}
            >
              Next lesson: {next.title} ›
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
