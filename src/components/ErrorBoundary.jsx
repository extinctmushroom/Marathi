import React from "react";

// A crash used to leave a blank page with no explanation. Show something
// readable instead — and surface the actual error, so a bug report can be
// specific rather than "it doesn't work".
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        style={{
          fontFamily: "Karla, system-ui, sans-serif",
          maxWidth: "34rem",
          margin: "14vh auto 0",
          padding: "0 1.5rem",
          textAlign: "center",
          color: "#6b5573",
        }}
      >
        <div style={{ fontFamily: "'Tiro Devanagari Marathi', serif", fontSize: "2.5rem", color: "#8e2a5c" }}>
          अरेरे!
        </div>
        <p style={{ fontSize: "1.05rem", color: "#33203b" }}>
          Something went wrong loading the course.
        </p>
        <p style={{ fontSize: "0.9rem" }}>
          Reloading usually fixes it. If it keeps happening, the details below help pin it down.
        </p>
        <pre
          style={{
            textAlign: "left",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            background: "#f4e9d2",
            border: "1px solid #e5d7bc",
            borderRadius: "10px",
            padding: "12px 14px",
            fontSize: "0.8rem",
            color: "#33203b",
          }}
        >
          {String(error?.message || error)}
        </pre>
        <button
          onClick={() => window.location.reload()}
          style={{
            fontFamily: "inherit",
            fontSize: "0.95rem",
            fontWeight: 700,
            background: "#8e2a5c",
            color: "#fff",
            border: "none",
            borderRadius: "12px",
            padding: "11px 24px",
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}
