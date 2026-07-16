import { speak } from "../lib/speech.js";

// Title text hanging from a gold headstroke, like Devanagari letters.
export function Shirorekha({ children, size = 34 }) {
  return (
    <div className="shirorekha">
      <span className="mr" style={{ fontSize: size, lineHeight: 1.25 }}>
        {children}
      </span>
    </div>
  );
}

export function SpeakButton({ text, dark, big }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        speak(text);
      }}
      aria-label={"Listen to " + text}
      title="Listen"
      className={`speak-btn${dark ? " dark" : ""}${big ? " big" : ""}`}
    >
      ♪
    </button>
  );
}

export function ProgressBar({ pct }) {
  return (
    <div className="progress-track">
      <div className={`progress-fill${pct >= 100 ? " full" : ""}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
