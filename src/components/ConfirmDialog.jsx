import { useEffect, useRef } from "react";
import { useLang } from "../lang";

// Error prevention: risky actions (moving the cover) need an explicit confirmation.
export default function ConfirmDialog({ title, body, onConfirm, onCancel }) {
  const { t } = useLang();
  const cancelRef = useRef(null);
  useEffect(() => { cancelRef.current?.focus(); }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-4 sm:items-center"
         role="dialog" aria-modal="true" aria-labelledby="dlg-title"
         onKeyDown={(e) => e.key === "Escape" && onCancel()}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h2 id="dlg-title" className="text-xl font-bold text-slate-900">{title}</h2>
        <p className="mt-2 text-base text-slate-700">{body}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button ref={cancelRef} onClick={onCancel}
            className="min-h-12 rounded-xl border-2 border-slate-400 px-4 font-semibold text-slate-900 focus-visible:outline-4 focus-visible:outline-blue-600">
            {t("cancel")}
          </button>
          <button onClick={onConfirm}
            className="min-h-12 rounded-xl bg-slate-900 px-4 font-semibold text-white focus-visible:outline-4 focus-visible:outline-blue-600">
            {t("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
