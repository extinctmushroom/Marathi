import { useEffect, useState } from "react";
import Home from "./components/Home.jsx";
import LessonView from "./components/LessonView.jsx";
import ReviewView from "./components/ReviewView.jsx";
import { findLesson, itemKey } from "./data/index.js";
import { PASS_RATIO } from "./lib/quiz.js";
import { warmVoices } from "./lib/speech.js";
import { gradeRecord, newRecord } from "./lib/srs.js";
import { clearStore, EMPTY_STORE, loadStore, saveStore, touchStreak } from "./lib/storage.js";

export default function App() {
  const [store, setStore] = useState(loadStore);
  const [view, setView] = useState({ name: "home" });

  useEffect(() => {
    warmVoices();
  }, []);

  useEffect(() => {
    saveStore(store);
  }, [store]);

  const openLesson = (id) => {
    setView({ name: "lesson", id });
    window.scrollTo(0, 0);
  };

  const goHome = () => {
    setView({ name: "home" });
    window.scrollTo(0, 0);
  };

  const openReview = () => {
    setView({ name: "review", session: Date.now() });
    window.scrollTo(0, 0);
  };

  // A passed quiz completes the lesson and enrolls its items in the review deck.
  const finishQuiz = (lessonId, score, total) => {
    setStore((prev) => {
      const passed = score / total >= PASS_RATIO;
      const old = prev.lessons[lessonId] || {};
      const lessons = {
        ...prev.lessons,
        [lessonId]: {
          done: old.done || passed,
          score: Math.max(old.score || 0, score),
          total,
        },
      };
      let srs = prev.srs;
      if (passed) {
        const lesson = findLesson(lessonId);
        srs = { ...srs };
        for (const item of lesson.items) {
          const key = itemKey(lessonId, item);
          if (!srs[key]) srs[key] = newRecord();
        }
      }
      return { ...prev, lessons, srs, meta: touchStreak(prev.meta) };
    });
  };

  const gradeCard = (key, grade) => {
    setStore((prev) => ({
      ...prev,
      srs: { ...prev.srs, [key]: gradeRecord(prev.srs[key], grade) },
      meta: touchStreak(prev.meta),
    }));
  };

  const resetAll = () => {
    clearStore();
    setStore(structuredClone(EMPTY_STORE));
    setView({ name: "home" });
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      {view.name === "home" ? (
        <Home store={store} openLesson={openLesson} openReview={openReview} resetAll={resetAll} />
      ) : view.name === "review" ? (
        <ReviewView key={view.session} store={store} gradeCard={gradeCard} goHome={goHome} />
      ) : (
        <LessonView
          lessonId={view.id}
          store={store}
          finishQuiz={finishQuiz}
          goHome={goHome}
          openLesson={openLesson}
        />
      )}
    </div>
  );
}
