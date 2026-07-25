import { useCallback, useEffect, useRef, useState } from "react";
import Home from "./components/Home.jsx";
import LessonView from "./components/LessonView.jsx";
import ReviewView from "./components/ReviewView.jsx";
import { findLesson, itemKey } from "./data/index.js";
import { PASS_RATIO } from "./lib/quiz.js";
import { warmVoices } from "./lib/speech.js";
import { gradeRecord, newRecord } from "./lib/srs.js";
import {
  clearStore,
  downloadStore,
  emptyStore,
  loadStore,
  parseStore,
  saveStore,
  touchStreak,
} from "./lib/storage.js";
import { applyTheme, effectiveTheme, setTheme } from "./lib/theme.js";

export default function App() {
  const [store, setStore] = useState(loadStore);
  const [view, setView] = useState({ name: "home" });
  const [theme, setThemeState] = useState(effectiveTheme);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    warmVoices();
  }, []);

  useEffect(() => {
    saveStore(store);
  }, [store]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const notify = useCallback((message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
  };

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
    setStore(emptyStore());
    setView({ name: "home" });
    notify("Progress cleared.");
  };

  const exportProgress = () => {
    downloadStore(store);
    notify("Progress file downloaded.");
  };

  const importProgress = async (file) => {
    try {
      const next = parseStore(await file.text());
      const lessonCount = Object.values(next.lessons).filter((l) => l?.done).length;
      const ok = window.confirm(
        `Restore this backup?\n\n${lessonCount} completed lesson${
          lessonCount === 1 ? "" : "s"
        } and ${Object.keys(next.srs).length} review card${
          Object.keys(next.srs).length === 1 ? "" : "s"
        }.\n\nThis replaces the progress currently on this device.`
      );
      if (!ok) return;
      setStore(next);
      setView({ name: "home" });
      notify("Progress restored.");
    } catch (err) {
      notify(err.message || "Couldn't read that file.");
    }
  };

  const themeProps = { theme, onToggleTheme: toggleTheme };

  return (
    <div style={{ minHeight: "100vh" }}>
      {view.name === "home" ? (
        <Home
          store={store}
          openLesson={openLesson}
          openReview={openReview}
          resetAll={resetAll}
          exportProgress={exportProgress}
          importProgress={importProgress}
          {...themeProps}
        />
      ) : view.name === "review" ? (
        <ReviewView
          key={view.session}
          store={store}
          gradeCard={gradeCard}
          goHome={goHome}
          {...themeProps}
        />
      ) : (
        <LessonView
          lessonId={view.id}
          store={store}
          finishQuiz={finishQuiz}
          goHome={goHome}
          openLesson={openLesson}
          {...themeProps}
        />
      )}
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}
