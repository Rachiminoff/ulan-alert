import { BellRing, CheckCircle2, CloudDrizzle, CloudRain, WifiOff } from "lucide-react";
import { useLang } from "../lang";

// Status is shown with colour AND an icon AND text (accessibility: never colour alone).
const LEVELS = {
  safe:    { icon: CheckCircle2, box: "bg-emerald-50 border-emerald-700 text-emerald-950", icoc: "text-emerald-700", bar: "bg-emerald-600" },
  watch:   { icon: CloudDrizzle, box: "bg-amber-50 border-amber-600 text-amber-950", icoc: "text-amber-700", bar: "bg-amber-500" },
  warning: { icon: BellRing,     box: "bg-red-700 border-red-900 text-white", icoc: "text-white", bar: "bg-red-700" },
  raining: { icon: CloudRain,    box: "bg-sky-800 border-sky-950 text-white", icoc: "text-white", bar: "bg-sky-700" },
  offline: { icon: WifiOff,      box: "bg-slate-200 border-slate-600 border-dashed text-slate-900", icoc: "text-slate-700", bar: "bg-slate-400" },
};

export default function StatusCard({ level, probability, thresholds, onAck, onSnooze, cooling, modelReady = true }) {
  const { t } = useLang();
  const c = LEVELS[level];
  const Icon = c.icon;
  const showMeter = modelReady && (level === "safe" || level === "watch" || level === "warning");
  const pct = Math.round(probability * 100);
  return (
    <section aria-labelledby="status-title" className={`status-card rounded-3xl border-4 p-5 ${c.box}`}>
      <div className="flex items-start gap-4">
        <Icon aria-hidden="true" className={`mt-1 h-12 w-12 shrink-0 ${c.icoc}`} strokeWidth={2.2} />
        <div>
          <h2 id="status-title" className="text-2xl font-extrabold leading-tight">{modelReady ? t(`${level}Title`) : "Preparing rain prediction"}</h2>
          <p className="mt-1 text-lg">{modelReady ? t(`${level}Body`) : "The simulation is running, but the prediction model is not ready yet. A 0% reading is not being assumed."}</p>
        </div>
      </div>

      {showMeter && (
        <div className="mt-5">
          <p className="text-base font-semibold">{t("chance", { n: pct })}</p>
          <div className="relative mt-2 h-4 overflow-hidden rounded-full bg-black/15" role="presentation">
            <div className={`h-full rounded-full ${level === "warning" ? "bg-white" : c.bar}`} style={{ width: `${pct}%` }} />
            {[thresholds.watch, thresholds.warn].map((v) => (
              <span key={v} className="absolute top-0 h-full w-0.5 bg-black/50" style={{ left: `${v * 100}%` }} />
            ))}
          </div>
        </div>
      )}

      {level === "warning" && (
        <div className="mt-5 grid gap-3">
          <button onClick={onAck}
            className="min-h-14 rounded-2xl bg-white px-4 text-lg font-bold text-red-900 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-yellow-300">
            {t("gotIt")}
          </button>
          <button onClick={onSnooze}
            className="min-h-14 rounded-2xl border-2 border-white px-4 text-lg font-semibold text-white focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-yellow-300">
            {t("snooze")}
          </button>
        </div>
      )}
      {cooling && level !== "warning" && level !== "offline" && level !== "raining" && (
        <p className="mt-4 text-base font-medium">{t("coolingDown")}</p>
      )}
    </section>
  );
}
