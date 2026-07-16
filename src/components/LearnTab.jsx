import { SpeakButton } from "./shared.jsx";

export default function LearnTab({ lesson }) {
  return (
    <div>
      <p className="intro">{lesson.intro}</p>
      <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
        {lesson.items.map((it, i) => (
          <div key={i} className="item-card">
            <div style={{ flexGrow: 1 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <span className="item-mr">{it.mr}</span>
                <span className="item-tr">{it.tr}</span>
              </div>
              <div className="item-en">{it.en}</div>
              {it.note && <div className="item-note">{it.note}</div>}
            </div>
            <SpeakButton text={it.mr} />
          </div>
        ))}
      </div>
      {lesson.tips && (
        <div className="tips">
          {lesson.tips.map((t, i) => (
            <p key={i}>{t}</p>
          ))}
        </div>
      )}
    </div>
  );
}
