import { useCallback, useEffect, useRef, useState } from "react";
import { Download, RefreshCw, PlayCircle, FlaskConical, Info, Activity, AlertTriangle } from "lucide-react";
import { downloadLog } from "../sessionLog";
import ModelMonitor from "./ModelMonitor";

// [title, one-line description]
const scenarioInfo = {
  natural: ["Natural weather", "Unscripted baseline run"],
  cloud_build: ["Cloud buildup", "Humidity and cloud build, then rain"],
  shower: ["Passing shower", "Brief convective rain"],
  thunderstorm: ["Thunderstorm", "Strong build-up, long storm"],
  flash_shower: ["Flash shower", "Short build-up, intense rain"],
  habagat: ["Habagat rain", "Slow monsoon band"],
  habagat_surge: ["Strong Habagat", "Prolonged monsoon rain"],
  la_nina_wet: ["La Niña analogue", "Wet synthetic pattern"],
  typhoon_approach: ["Typhoon approach", "Long synthetic cyclone-like fall"],
  false_warning: ["Look-alike, no rain", "Looks like a storm but fizzles"],
  sunny: ["Clear skies", "Dry, no systems"],
  cool_evening: ["Cool evening", "Cooler and dry"],
  el_nino_dry: ["El Niño analogue", "Drier synthetic pattern"],
  rain_now: ["Rain now", "Already raining"],
  offline: ["Offline state", "Sensor link lost"],
};
const GROUPS = [
  { title: "Rain is coming", hint: "Expected: probability climbs and the alert usually fires 15–35 min before rain.", keys: ["cloud_build", "shower", "thunderstorm", "flash_shower", "habagat", "habagat_surge", "la_nina_wet", "typhoon_approach"] },
  { title: "Should stay calm, or is a hard case", hint: "Expected: low probability. The look-alike is a deliberate hard case where a false alarm is plausible.", keys: ["sunny", "cool_evening", "el_nino_dry", "false_warning"] },
  { title: "Baseline and device states", hint: "", keys: ["natural", "rain_now", "offline"] },
];
const featureLabels = { hour_cos: "Time of day (cosine)", hour_sin: "Time of day (sine)", pressure_delta_10m: "Pressure change · 10 min", pressure_delta_30m: "Pressure change · 30 min", pressure_delta_1h: "Pressure change · 1 hour", pressure_delta_3h: "Pressure change · 3 hours", pressure_accel: "Pressure-fall acceleration", pressure_std_30m: "Pressure variability", humidity: "Humidity", humidity_delta_30m: "Humidity change · 30 min", temp_delta_10m: "Temperature change · 10 min", temp_delta_30m: "Temperature change · 30 min", temp_vs_3h_mean: "Temperature vs 3-hour mean", light_ratio: "Relative light level", clearness: "Estimated cloud cover" };
const MODEL_ROWS = ["Random Forest", "Gradient Boosting", "Logistic Regression", "Decision Tree", "Pressure/humidity rule", "Hour-of-day climatology"];
const MODEL_LABEL = { "Pressure/humidity rule": "Hand-written pressure/humidity rule", "Hour-of-day climatology": "Time-of-day guess (no weather)" };

function Bars({ items, max, format }) {
  if (!items?.length) return <p className="chart-empty">No chart data is available.</p>;
  return (
    <div className="bar-chart" role="img" aria-label="Horizontal bar chart">
      {items.map((it, i) => (
        <div className="bar-chart-row" key={it.label ?? i}>
          <div className="bar-chart-label"><span>{it.label}</span><b>{format(it.value)}</b></div>
          <div className="bar-track"><i style={{ width: `${Math.max(0, Math.min(100, (it.value / max) * 100))}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

// Recall vs false alarms for the live model across thresholds, with the hand-written rule for comparison.
function OperatingCurve({ metrics, warn }) {
  const curve = metrics?.["Random Forest"]?.operating_curve;
  const rule = metrics?.["Pressure/humidity rule"]?.alert_eval;
  if (!curve?.length) return null;
  const W = 320, H = 250, ML = 36, MB = 34, MT = 20, MR = 12;
  const xmax = Math.max(1.3, ...curve.map((c) => c.false_alarms_per_day), rule?.false_alarms_per_day || 0) * 1.05;
  const x = (v) => ML + (v / xmax) * (W - ML - MR);
  const y = (v) => MT + (1 - v) * (H - MT - MB);
  const pts = [...curve].sort((a, b) => a.false_alarms_per_day - b.false_alarms_per_day);
  const near = curve.reduce((a, b) => (Math.abs(b.threshold - warn) < Math.abs(a.threshold - warn) ? b : a));
  return (
    <svg className="mm-curve" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Event recall against false alarms per day for each warning threshold">
      {[0, 0.25, 0.5, 0.75, 1].map((g) => (<g key={g}><line x1={ML} x2={W - MR} y1={y(g)} y2={y(g)} className="mm-grid" /><text x={ML - 6} y={y(g) + 3} textAnchor="end" className="mm-axis">{Math.round(g * 100)}%</text></g>))}
      {[0, 0.5, 1, 1.5].filter((g) => g <= xmax).map((g) => (<text key={g} x={x(g)} y={H - MB + 14} textAnchor="middle" className="mm-axis">{g}</text>))}
      <text x={(ML + W - MR) / 2} y={H - 4} textAnchor="middle" className="mm-axis">false alarms per day (lower is better)</text>
      <text x={ML - 30} y={MT - 8} className="mm-axis">rain caught</text>
      <polyline points={pts.map((c) => `${x(c.false_alarms_per_day)},${y(c.event_recall)}`).join(" ")} className="mm-line rf" />
      {pts.map((c) => (<circle key={c.threshold} cx={x(c.false_alarms_per_day)} cy={y(c.event_recall)} r="3.5" className="mm-dot"><title>{`threshold ${c.threshold}: catches ${Math.round(c.event_recall * 100)}% of rain, ${c.false_alarms_per_day.toFixed(2)} false alarms/day`}</title></circle>))}
      <circle cx={x(near.false_alarms_per_day)} cy={y(near.event_recall)} r="7" className="mm-dot-sel" />
      <text x={x(near.false_alarms_per_day) + 10} y={y(near.event_recall) + 18} className="mm-curve-label">your setting ({Math.round(near.threshold * 100)}%)</text>
      {rule && <g><rect x={x(rule.false_alarms_per_day) - 5} y={y(rule.event_recall) - 5} width="10" height="10" transform={`rotate(45 ${x(rule.false_alarms_per_day)} ${y(rule.event_recall)})`} className="mm-rule-dot" /><text x={x(rule.false_alarms_per_day) + 6} y={y(rule.event_recall) + 22} textAnchor="end" className="mm-curve-label rule">hand-written rule</text></g>}
    </svg>
  );
}

export default function FacilitatorPanel({ device, open, onClose, sensitivity }) {
  const [metrics, setMetrics] = useState(null), [training, setTraining] = useState(false), [seed, setSeed] = useState(73);
  const [resetting, setResetting] = useState(false), [busyScenario, setBusyScenario] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const pollRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const loadMetrics = useCallback(async () => {
    const r = await fetch("/api/ml/metrics");
    if (!r.ok) throw new Error(`Metrics request failed (${r.status})`);
    const j = await r.json();
    setMetrics(j); setTraining(!!j.training);
    return j;
  }, []);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try { const j = await loadMetrics(); if (!active) return; void j; } catch { if (active) setError("Research metrics are temporarily unavailable."); }
    };
    poll();
    pollRef.current = setInterval(poll, training ? 1200 : 10000);
    return () => { active = false; clearInterval(pollRef.current); };
  }, [training, loadMetrics]);

  const chooseScenario = async (key) => {
    setError(""); setNotice(""); setBusyScenario(true);
    try { await device.setScenario(key); setNotice(`${scenarioInfo[key]?.[0] || key} selected. Watch the monitor above.`); }
    catch (e) { setError(e.message || "Could not change scenario."); }
    finally { setBusyScenario(false); }
  };
  const reset = async () => {
    setError(""); setNotice(""); setResetting(true);
    try {
      const r = await fetch("/api/simulation/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seed, scenario: "natural" }) });
      if (!r.ok) throw new Error(`Reset failed (${r.status})`);
      const j = await r.json();
      if (!j.ok) throw new Error(j.message || "Reset failed");
      await device.setScenario("natural");
      setNotice(`Simulation reset with seed ${j.seed}.`);
    } catch (e) { setError(e.message || "Could not reset simulation."); } finally { setResetting(false); }
  };
  const retrain = async () => {
    setError(""); setNotice(""); setTraining(true);
    try {
      const r = await fetch("/api/ml/train", { method: "POST" });
      if (!r.ok) throw new Error(`Training request failed (${r.status})`);
      const j = await r.json();
      if (!j.ok && !j.training) throw new Error(j.message || j.error || "Training could not start.");
      setNotice(j.message || "Training started. Results will update when it finishes.");
      await loadMetrics();
    } catch (e) { setTraining(false); setError(e.message || "Could not start training."); }
  };

  const meta = metrics?.meta;
  const rows = MODEL_ROWS.filter((n) => metrics?.[n]?.alert_eval).map((n) => ({ name: n, m: metrics[n], a: metrics[n].alert_eval }));
  const features = (metrics?.feature_importance || []).slice(0, 8).map((x) => ({ label: featureLabels[x.feature] || x.feature, value: x.importance }));
  const ablation = (metrics?.ablation || []).map((x) => ({ label: x.features, value: x.pr_auc }));
  const warn = ({ low: 0.5, medium: 0.4, high: 0.3 })[sensitivity] ?? 0.4;
  if (!open) return null;

  return (
    <div className="fac-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <section className="facilitator-panel fac-modal" role="dialog" aria-modal="true" aria-labelledby="fac-modal-title">
        <header className="fac-modal-header">
          <div>
            <span id="fac-modal-title" className="fac-title"><FlaskConical size={19} /> Research lab &amp; demo controls</span>
            <span className="fac-caption">Live model monitor · scenario lab · model evaluation</span>
          </div>
          <button className="fac-close" onClick={onClose} aria-label="Close research controls">×</button>
        </header>
        <div className="fac-body">
          <p className="fac-intro">Everything here is simulated: no sensors, live weather feed or official forecast. Pick a preset, then watch the model react in the monitor.</p>
          {(error || notice) && <div className={error ? "fac-feedback error" : "fac-feedback"} role="status">{error ? <AlertTriangle size={16} /> : <Activity size={16} />}<span>{error || notice}</span></div>}

          <section className="fac-section">
            <div className="fac-heading"><h3>Live model monitor</h3><span>Active preset: {scenarioInfo[device.scenario]?.[0] || "Natural weather"}</span></div>
            <ModelMonitor sensitivity={sensitivity} open={open} />
          </section>

          <section className="fac-section">
            <div className="fac-heading"><h3>Demonstration presets</h3><span>{busyScenario ? "Applying…" : "Each preset starts with its build-up already visible in the history"}</span></div>
            {GROUPS.map((g) => (
              <div className="fac-group" key={g.title}>
                <h4>{g.title}</h4>
                {g.hint && <p>{g.hint}</p>}
                <div className="fac-scenarios">
                  {g.keys.map((k) => (
                    <button key={k} disabled={busyScenario} onClick={() => chooseScenario(k)} aria-pressed={device.scenario === k} className={device.scenario === k ? "selected" : ""}>
                      <b>{scenarioInfo[k][0]}</b><small>{scenarioInfo[k][1]}</small>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="fac-section">
            <h3>Replay and model operations</h3>
            <p>Resetting starts a fresh natural-weather run. Model retraining is disabled on the public demo to keep the shared service responsive.</p>
            <div className="fac-controls">
              <label>Starting seed<input type="number" min="0" max="999999" value={seed} onChange={(e) => setSeed(Math.max(0, Math.min(999999, Number(e.target.value) || 0)))} /></label>
              <button onClick={reset} disabled={resetting || busyScenario}><RefreshCw size={16} />{resetting ? "Resetting…" : "Reset simulation"}</button>
              <button onClick={downloadLog}><Download size={16} />Download session CSV</button>
              {metrics?.retraining_enabled === false
                ? <button disabled title="Model retraining is disabled on the public demo"><PlayCircle size={16} />Retraining disabled on public demo</button>
                : <button onClick={retrain} disabled={training}><PlayCircle size={16} />{training ? "Training in background…" : "Retrain models"}</button>}
            </div>
            {training && <div className="training-state"><span className="training-spinner" /> Training is running. This panel checks for updated results automatically.</div>}
          </section>

          <section className="fac-section research-results">
            <div className="fac-heading"><h3>How well does it warn? (held-out simulated months)</h3><span className={metrics?.model_ready ? "state-ready" : "state-pending"}>{metrics?.model_ready ? "Model ready" : "Waiting for model"}</span></div>
            <p>
              The app's real alert rule is replayed over {meta ? `${meta.test_months?.length ?? 5} unseen 30-day runs` : "unseen runs"}. A rain event counts as caught if the alert was on at least {meta?.min_lead_minutes ?? 10} minutes before it started. These runs come from the simulator, so they measure how well each model recovers its built-in structure, not accuracy on real weather.
            </p>
            {metrics?.error && <div className="research-caution">{metrics.error}</div>}
            {!rows.length ? <div className="chart-empty">{metrics?.training ? "The model is training. Results will appear here when it finishes." : "No completed model evaluation is available yet."}</div> : <>
              <div className="mm-table-wrap">
                <table className="mm-table">
                  <thead><tr><th>Method</th><th>Rain caught</th><th>Median warning lead</th><th>False alarms / day</th><th>PR-AUC</th></tr></thead>
                  <tbody>
                    {rows.map(({ name, m, a }) => (
                      <tr key={name} className={name === "Random Forest" ? "live" : ""}>
                        <th scope="row">{MODEL_LABEL[name] || name}{name === "Random Forest" && <em>live model</em>}</th>
                        <td>{Math.round(a.event_recall * 100)}% <small>({a.caught}/{a.events})</small></td>
                        <td>{a.caught ? `${Math.round(a.median_lead_min)} min` : "—"}</td>
                        <td>{a.false_alarms_per_day.toFixed(2)}</td>
                        <td>{m.pr_auc.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="research-chart-grid">
                <article className="metric-card"><h4>Catch rate vs false alarms</h4><p>Each dot is one warning threshold for the live model. Moving the Alert sensitivity setting moves the ring. A dot up and to the left of the diamond beats the hand-written rule.</p><OperatingCurve metrics={metrics} warn={warn} /></article>
                <article className="metric-card"><h4>What the model relies on</h4><p>Permutation importance on unseen data. It shows what the model used, not what causes rain.</p><Bars items={features} max={Math.max(...features.map((f) => f.value), 0.01)} format={(v) => `${(v * 100).toFixed(0)}%`} /></article>
                {ablation.length > 0 && <article className="metric-card"><h4>What each sensor adds</h4><p>Prediction quality (PR-AUC) when the model sees only that sensor, compared with all sensors together.</p><Bars items={ablation} max={Math.max(...ablation.map((f) => f.value), 0.01)} format={(v) => v.toFixed(2)} /></article>}
              </div>
            </>}
            <details className="metric-explain"><summary><Info size={16} /> How to read this</summary>
              <dl>
                <dt>Rain caught</dt><dd>Share of rain events where the alert was already on at least 10 minutes earlier.</dd>
                <dt>Median lead</dt><dd>Typical number of minutes of warning before rain started.</dd>
                <dt>False alarms</dt><dd>Alerts per day that were not followed by rain within 30 minutes.</dd>
                <dt>PR-AUC</dt><dd>Quality of the raw probabilities across all thresholds. Rain is rare (about 2% of minutes), so a random guess scores about 0.02.</dd>
              </dl>
            </details>
          </section>
        </div>
      </section>
    </div>
  );
}
