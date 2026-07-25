import { useEffect, useRef } from "react";

// Bind a window keydown handler exactly once, always invoking the latest
// callback. Registering the listener directly in an effect without deps
// re-subscribes on every render; this keeps it to a single subscription
// while avoiding stale closures over state.
export function useKeyboard(handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const onKey = (event) => ref.current?.(event);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
