import { useEffect } from "react";

// Immediate feedback after every action (HCI principle: feedback). Announced to screen readers.
export default function Toast({ message, onDone }) {
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(onDone, 4000);
    return () => clearTimeout(id);
  }, [message, onDone]);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
      {message && (
        <div className="pointer-events-auto max-w-md rounded-xl bg-slate-900 px-4 py-3 text-base font-medium text-white shadow-lg">
          {message}
        </div>
      )}
    </div>
  );
}
