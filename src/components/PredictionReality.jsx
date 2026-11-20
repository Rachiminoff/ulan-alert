import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Clock3, CloudRain, MinusCircle } from "lucide-react";

const OUTCOMES = {
  true_positive: { label: "Correct warning", short: "TP", className: "pr-good", icon: CheckCircle2 },
  true_negative: { label: "Correct all-clear", short: "TN", className: "pr-good", icon: CheckCircle2 },
  false_positive: { label: "False alarm", short: "FP", className: "pr-warn", icon: CircleAlert },
  false_negative: { label: "Missed rain", short: "FN", className: "pr-bad", icon: CircleAlert },
};
const formatMetric = value => value == null ? "—" : `${Math.round(value * 100)}%`;
const formatTime = value => value ? new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default function PredictionReality({ sensitivity = "medium" }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let busy = false;
    const load = async () => {
      if (busy) return;
      busy = true;
      try {
        const response = await fetch(`/api/ml/prediction-vs-reality?sensitivity=${encodeURIComponent(sensitivity)}&limit=8`, { cache: "no-store" });
        if (!response.ok) throw new Error("Comparison data is unavailable.");
        const result = await response.json();
        if (active) { setData(result); setError(""); }
      } catch {
        if (active) setError("Prediction comparison is temporarily unavailable.");
      } finally { busy = false; }
    };
    load();
    const timer = setInterval(load, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [sensitivity]);

  const counts = data?.counts || {};
  return (
    <section className="prediction-reality" aria-labelledby="prediction-reality-title">
      <div className="pr-heading">
        <div className="pr-heading-icon"><CloudRain aria-hidden="true" /></div>
        <div><h3 id="prediction-reality-title">Prediction versus reality</h3><p>Did the rain prediction match what the simulator produced?</p></div>
      </div>
      <div className="pr-definition"><span><b>Prediction</b> · Will rain occur?</span><span><b>Reality</b> · Did rain occur?</span><small>Both are Boolean values (true/false). A prediction is marked “Yes” when its probability meets the selected {data ? `${Math.round(data.threshold * 100)}%` : "sensitivity"} threshold.</small></div>
      {error ? <p className="pr-empty">{error}</p> : !data ? <p className="pr-empty">Loading comparison…</p> : <>
        <div className="pr-metrics">
          <article><small>Accuracy</small><b>{formatMetric(data.accuracy)}</b><span>{data.evaluated} completed comparisons</span></article>
          <article><small>Precision</small><b>{formatMetric(data.precision)}</b><span>How often rain warnings were right</span></article>
          <article><small>Recall</small><b>{formatMetric(data.recall)}</b><span>How much actual rain was detected</span></article>
          <article><small>F1 score</small><b>{formatMetric(data.f1)}</b><span>Balance of precision and recall</span></article>
        </div>
        <div className="pr-matrix" aria-label="Prediction outcome counts">
          {Object.entries(OUTCOMES).map(([key, item]) => {
            const Icon = item.icon;
            return <div className={`pr-matrix-cell ${item.className}`} key={key}><span><Icon size={15} aria-hidden="true" />{item.label}</span><b>{counts[key] || 0}</b><small>{item.short}</small></div>;
          })}
        </div>
        <div className="pr-recent-heading"><b>Recently evaluated</b><span><Clock3 size={13} /> {data.horizon_minutes}-minute outcome window</span></div>
        {data.latest?.length ? <div className="pr-records">{data.latest.map((record, index) => {
          const outcome = OUTCOMES[record.outcome] || OUTCOMES.true_negative;
          return <article className="pr-record" key={`${record.timestamp}-${index}`}>
            <div className="pr-record-time">{formatTime(record.timestamp)}</div>
            <div className="pr-bool"><span>Prediction <b>{record.predicted_rain ? "YES" : "NO"}</b></span><span>Reality <b>{record.actual_rain ? "YES" : "NO"}</b></span></div>
            <span className={`pr-outcome ${outcome.className}`}>{outcome.short} · {outcome.label}</span>
          </article>;
        })}</div> : <p className="pr-empty">Waiting for enough simulated time to complete the first 30-minute comparison.</p>}
        <p className="pr-footnote"><MinusCircle size={13} /> The newest {data.pending} sample(s) are not scored yet because their full 30-minute outcome window has not elapsed. Synthetic simulation results only.</p>
      </>}
    </section>
  );
}
