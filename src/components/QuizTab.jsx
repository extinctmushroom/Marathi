import { useEffect, useRef, useState } from "react";
import { buildQuiz, normalizeTr, PASS_RATIO } from "../lib/quiz.js";
import { useKeyboard } from "../lib/useKeyboard.js";
import { ProgressBar, SpeakButton } from "./shared.jsx";

export default function QuizTab({ lesson, onFinish, best }) {
  const [quiz, setQuiz] = useState(null);
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState(null); // chosen option (mc/listen)
  const [typed, setTyped] = useState("");
  const [typedResult, setTypedResult] = useState(null); // "right" | "wrong"
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const q = quiz ? quiz[qi] : null;
  const answered = q ? (q.type === "type" ? typedResult !== null : picked !== null) : false;

  const start = () => {
    clearTimeout(timer.current);
    setQuiz(buildQuiz(lesson));
    setQi(0);
    setPicked(null);
    setTyped("");
    setTypedResult(null);
    setScore(0);
    setDone(false);
  };

  const advance = (newScore, wasRight) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () => {
        if (qi + 1 >= quiz.length) {
          setDone(true);
          onFinish(newScore, quiz.length);
        } else {
          setQi(qi + 1);
          setPicked(null);
          setTyped("");
          setTypedResult(null);
        }
      },
      // Linger on wrong answers so the correction is readable.
      wasRight ? 900 : 1800
    );
  };

  const choose = (opt) => {
    if (!q || answered) return;
    setPicked(opt);
    const right = opt === q.correct;
    const newScore = right ? score + 1 : score;
    setScore(newScore);
    advance(newScore, right);
  };

  const submitTyped = () => {
    if (!q || answered || !typed.trim()) return;
    const right = q.answers.includes(normalizeTr(typed));
    setTypedResult(right ? "right" : "wrong");
    const newScore = right ? score + 1 : score;
    setScore(newScore);
    advance(newScore, right);
  };

  // 1–4 picks an answer, matching the review screen's grading keys.
  useKeyboard((e) => {
    if (!q || done || answered) return;
    if (e.target.closest("input, textarea")) return;
    if (q.type === "type") return;
    const n = Number(e.key);
    if (n >= 1 && n <= q.options.length) {
      e.preventDefault();
      choose(q.options[n - 1]);
    }
  });

  if (!quiz) {
    return (
      <div style={{ textAlign: "center", padding: "30px 0" }}>
        <p style={{ fontSize: 16 }}>
          Ready to test yourself? Score {Math.round(PASS_RATIO * 100)}% or more to complete this
          lesson and add its words to your review deck.
        </p>
        {best?.total ? (
          <p className="muted">
            Your best so far: {best.score}/{best.total}
          </p>
        ) : null}
        <button className="btn btn-primary" style={{ marginTop: 10, fontSize: 16 }} onClick={start}>
          Start quiz
        </button>
      </div>
    );
  }

  if (done) {
    const total = quiz.length;
    const passed = score / total >= PASS_RATIO;
    return (
      <div style={{ textAlign: "center", padding: "30px 0" }}>
        <div
          className="mr"
          style={{ fontSize: 38, color: passed ? "var(--green)" : "var(--magenta)" }}
        >
          {passed ? "शाब्बास!" : "पुन्हा प्रयत्न करा"}
        </div>
        <p className="muted" style={{ marginTop: 4 }}>
          {passed ? "(shābbās — well done!)" : "(punhā prayatna karā — try again)"}
        </p>
        <p style={{ fontSize: 20, fontWeight: 700 }}>
          {score} / {total}
        </p>
        {passed && (
          <p style={{ fontSize: 14.5, color: "var(--green)" }}>
            Lesson complete — words added to your review deck.
          </p>
        )}
        <button className="btn" style={{ marginTop: 8 }} onClick={start}>
          Retake quiz
        </button>
      </div>
    );
  }

  const feedback =
    answered &&
    (q.type === "type" ? (
      typedResult === "wrong" ? (
        <div className="quiz-feedback">
          Answer: <strong>{q.display}</strong> — {q.item.en}
        </div>
      ) : null
    ) : q.type === "mc" && (picked !== q.correct || q.item.note) ? (
      <div className="quiz-feedback">
        {picked !== q.correct && (
          <>
            Answer: <strong>{q.correct}</strong>
            {!q.promptIsMarathi ? ` (${q.item.tr})` : ""}
            <br />
          </>
        )}
        {q.item.note}
      </div>
    ) : null);

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <ProgressBar pct={(qi / quiz.length) * 100} />
        <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          Question {qi + 1} of {quiz.length} · Score {score}
        </p>
      </div>

      {q.type === "listen" ? (
        <>
          <div className="quiz-prompt">
            <p className="quiz-prompt-label">Listen — which one do you hear?</p>
            <div style={{ marginTop: 12 }}>
              <SpeakButton text={q.item.mr} big />
            </div>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {q.options.map((opt, i) => (
              <button
                key={i}
                disabled={answered}
                onClick={() => choose(opt)}
                className={`quiz-option is-mr${
                  answered && opt === q.correct
                    ? " correct"
                    : answered && opt === picked
                      ? " wrong"
                      : ""
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      ) : q.type === "type" ? (
        <>
          <div className="quiz-prompt">
            <p className="quiz-prompt-label">Type this word in English letters (accents optional)</p>
            <div className="quiz-prompt-main is-mr">{q.item.mr}</div>
            <div style={{ marginTop: 8 }}>
              <SpeakButton text={q.item.mr} />
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitTyped();
            }}
            style={{ display: "grid", gap: 8 }}
          >
            <input
              className="type-input"
              value={typed}
              disabled={answered}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="e.g. pani"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              style={
                typedResult === "right"
                  ? { borderColor: "var(--green)", background: "var(--green-soft)" }
                  : typedResult === "wrong"
                    ? { borderColor: "var(--red)", background: "var(--red-soft)" }
                    : undefined
              }
            />
            <button className="btn btn-primary" type="submit" disabled={answered || !typed.trim()}>
              Check
            </button>
          </form>
        </>
      ) : (
        <>
          <div className="quiz-prompt">
            <p className="quiz-prompt-label">What does this mean?</p>
            <div className={`quiz-prompt-main ${q.promptIsMarathi ? "is-mr" : "is-en"}`}>
              {q.prompt}
            </div>
            {q.promptSub && <div className="quiz-prompt-sub">{q.promptSub}</div>}
            {q.promptIsMarathi && (
              <div style={{ marginTop: 8 }}>
                <SpeakButton text={q.prompt} />
              </div>
            )}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {q.options.map((opt, i) => (
              <button
                key={i}
                disabled={answered}
                onClick={() => choose(opt)}
                className={`quiz-option${q.optionsAreMarathi ? " is-mr" : ""}${
                  answered && opt === q.correct
                    ? " correct"
                    : answered && opt === picked
                      ? " wrong"
                      : ""
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}

      {feedback}

      {q.type === "listen" && answered && (
        <div className="quiz-feedback">
          {q.item.mr} · {q.item.tr} — {q.item.en}
        </div>
      )}

      {q.type !== "type" && (
        <p className="kbd-hint">
          <kbd>1</kbd>–<kbd>{q.options.length}</kbd> to answer
        </p>
      )}
    </div>
  );
}
