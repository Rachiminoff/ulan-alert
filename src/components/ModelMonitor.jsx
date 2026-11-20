import { useEffect, useMemo, useState } from "react";
import { Pause, Play } from "lucide-react";
import { THRESHOLDS } from "../useDevice";

// Live view of what the model "thinks" about the running simulation: probability over time, the alert rule's
// thresholds, rain periods, and how early each warning came. Data comes from GET /api/ml/trace.

const W = 720, H = 260, ML = 38, MR = 10, MT = 32, MB = 26;
const SPEEDS = [1, 5, 15, 60];
const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

function runs(flags) {
  const out = [];
  let start = null;
  flags.forEach((f, i) => {
    if (f && start === null) start = i;
    if ((!f || i === flags.length - 1) && start !== null) { out.push([start, f ? i : i - 1]); start = null; }
  });
  return out;
}

function leadText(ev) {
  if (!ev) return { text: "No rain has started in this window yet.", tone: "neutral" };
  if (ev.lead_min == null) return { text: "Rain started with no warning beforehand (missed).", tone: "bad" };
  if (ev.lead_min < 10) return { text: `Warned only ${ev.lead_min} min ahead (too late to act).`, tone: "warn" };
  return { text: `Warned ${ev.lead_min} min before the rain started.`, tone: "good" };
}

function Chart({ trace, thresholds, showModels }) {
  const n = trace.t.length;
  const rf = trace.rf.map((v) => (v == null ? 0 : v));
  const ymax = Math.min(1, Math.max(0.6, Math.max(...rf, ...(showModels ? trace.gb.map((v) => v ?? 0) : [0])) * 1.15));
  const x = (i) => ML + (i / Math.max(1, n - 1)) * (W - ML - MR);
  const y = (p) => MT + (1 - Math.min(p, ymax) / ymax) * (H - MT - MB);
  const line = (arr) => arr.map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean).join(" ");
  const wetRuns = runs(trace.wet), alertRuns = runs(trace.alert), ruleRuns = runs(trace.rule.map((v) => v > 0));
  const ticks = [];
  for (let i = 0; i < n; i++) if (new Date(trace.t[i]).getMinutes() % 30 === 0 && (i === 0 || new Date(trace.t[i - 1]).getMinutes() % 30 !== 0) && x(i) < W - MR - 36) ticks.push(i);
  const grid = [0, 0.2, 0.4, 0.6, 0.8, 1].filter((g) => g <= ymax + 0.001);
  const area = `${x(0)},${y(0)} ${line(rf.map((v) => v))} ${x(n - 1)},${y(0)}`;

  return (
    <svg className="mm-chart" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label="Rain probability over the last simulated hours, with warning thresholds and rain periods">
      <defs>
        <linearGradient id="mm-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#8fa0ff" stopOpacity=".38" /><stop offset="1" stopColor="#8fa0ff" stopOpacity=".02" />
        </linearGradient>
      </defs>
      {grid.map((g) => (
        <g key={g}>
          <line x1={ML} x2={W - MR} y1={y(g)} y2={y(g)} className="mm-grid" />
          <text x={ML - 6} y={y(g) + 3} textAnchor="end" className="mm-axis">{Math.round(g * 100)}%</text>
        </g>
      ))}
      {wetRuns.map(([a, b], i) => (
        <g key={`w${i}`}>
          <rect x={x(a)} y={MT} width={Math.max(2, x(b) - x(a))} height={H - MT - MB} className="mm-wet" />
          <text x={Math.min(x(a) + 4, W - MR - 24)} y={MT + 22} className="mm-wet-label">rain</text>
        </g>
      ))}
      {alertRuns.map(([a, b], i) => (
        <rect key={`a${i}`} x={x(a)} y={MT - 14} width={Math.max(2, x(b) - x(a))} height="8" rx="2" className="mm-alert" />
      ))}
      <text x={ML} y={MT - 17} className="mm-axis">alert active</text>
      <line x1={ML} x2={W - MR} y1={y(thresholds.warn)} y2={y(thresholds.warn)} className="mm-thr-warn" />
      <text x={W - MR - 2} y={y(thresholds.warn) - 4} textAnchor="end" className="mm-thr-label warn">warn at {Math.round(thresholds.warn * 100)}%</text>
      <line x1={ML} x2={W - MR} y1={y(thresholds.watch)} y2={y(thresholds.watch)} className="mm-thr-watch" />
      <text x={W - MR - 2} y={y(thresholds.watch) - 4} textAnchor="end" className="mm-thr-label watch">watch {Math.round(thresholds.watch * 100)}%</text>
      {ruleRuns.map(([a, b], i) => (
        <rect key={`r${i}`} x={x(a)} y={H - MB - 7} width={Math.max(2, x(b) - x(a))} height="6" className="mm-rule" />
      ))}
      {showModels && <polyline points={line(trace.lr)} className="mm-line lr" />}
      {showModels && <polyline points={line(trace.gb)} className="mm-line gb" />}
      <polygon points={area} fill="url(#mm-fill)" />
      <polyline points={line(trace.rf)} className="mm-line rf" />
      {trace.events.map((e, i) => (
        <g key={`e${i}`}>
          <line x1={x(e.index)} x2={x(e.index)} y1={MT} y2={H - MB} className="mm-onset" />
          <text x={x(e.index)} y={H - MB + 13} textAnchor={x(e.index) > W - 70 ? "end" : "middle"} className="mm-onset-label">
            {e.lead_min == null ? "missed" : `+${e.lead_min}m lead`}
          </text>
        </g>
      ))}
      {ticks.map((i) => (
        <text key={i} x={x(i)} y={H - 4} textAnchor="middle" className="mm-axis">{clock(trace.t[i])}</text>
      ))}
      <text x={W - MR} y={H - 4} textAnchor="end" className="mm-axis now">now</text>
    </svg>
  );
}

export default function ModelMonitor({ sensitivity, open }) {
  const [trace, setTrace] = useState(null);
  const [win, setWin] = useState(120);
  const [showModels, setShowModels] = useState(true);
  const [busy, setBusy] = useState(false);
  const thresholds = THRESHOLDS[sensitivity] || THRESHOLDS.medium;

  useEffect(() => {
    if (!open) return undefined;
    let alive = true, inflight = false;
    const load = async () => {
      if (inflight) return;
      inflight = true;
      try {
        const r = await fetch(`/api/ml/trace?minutes=${win}&warn=${thresholds.warn}`, { cache: "no-store" });
        if (r.ok && alive) setTrace(await r.json());
      } catch { /* backend busy or offline: keep the last trace */ } finally { inflight = false; }
    };
    load();
    const id = setInterval(load, 1500);
    return () => { alive = false; clearInterval(id); };
  }, [open, win, thresholds.warn]);

  const post = async (path, body) => {
    setBusy(true);
    try { await fetch(`/api/simulation/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
    finally { setBusy(false); }
  };

  const view = useMemo(() => {
    if (!trace?.model_ready) return null;
    const last = [...trace.rf].reverse().find((v) => v != null) ?? 0;
    const alerting = trace.alert.at(-1) === 1;
    const state = trace.wet.at(-1) ? "Raining" : alerting ? "Warning" : last >= thresholds.watch ? "Watch" : "Calm";
    const lastEvent = trace.events.at(-1);
    const ruleNow = trace.rule.at(-1) > 0;
    return { last, state, lead: leadText(lastEvent), ruleNow };
  }, [trace, thresholds]);

  if (!trace) return <p className="chart-empty">Connecting to the model…</p>;
  if (!trace.model_ready) return <p className="chart-empty">The model is still training. The live monitor will appear when it is ready.</p>;

  return (
    <div className="mm">
      <div className="mm-stats">
        <div className={`mm-stat state-${view.state.toLowerCase()}`}><small>Model says</small><b>{view.state}</b></div>
        <div className="mm-stat"><small>Rain in next 30 min</small><b>{Math.round(view.last * 100)}%</b></div>
        <div className={`mm-stat tone-${view.lead.tone}`}><small>Latest rain event</small><b className="mm-lead">{view.lead.text}</b></div>
        <div className="mm-stat"><small>Hand-written rule</small><b>{view.ruleNow ? "Firing" : "Quiet"}</b></div>
      </div>

      <div className="mm-toolbar">
        <div className="mm-group" role="group" aria-label="Simulation speed">
          <span>Speed</span>
          {SPEEDS.map((s) => (
            <button key={s} disabled={busy} className={trace.speed === s ? "on" : ""} onClick={() => post("speed", { speed: s })}>{s}×</button>
          ))}
          <button disabled={busy} onClick={() => post("pause", { paused: trace.running })} aria-label={trace.running ? "Pause simulation" : "Resume simulation"}>
            {trace.running ? <Pause size={14} /> : <Play size={14} />}{trace.running ? "Pause" : "Resume"}
          </button>
        </div>
        <div className="mm-group" role="group" aria-label="Chart window">
          <span>Window</span>
          {[[60, "1 h"], [120, "2 h"], [240, "4 h"]].map(([m, l]) => (
            <button key={m} className={win === m ? "on" : ""} onClick={() => setWin(m)}>{l}</button>
          ))}
          <label className="mm-check"><input type="checkbox" checked={showModels} onChange={(e) => setShowModels(e.target.checked)} /> Other models</label>
        </div>
      </div>

      <div className="mm-chart-wrap"><Chart trace={trace} thresholds={thresholds} showModels={showModels} /></div>

      <div className="mm-legend">
        <span><i className="sw rf" />Random Forest (live model)</span>
        {showModels && <span><i className="sw gb" />Gradient Boosting</span>}
        {showModels && <span><i className="sw lr" />Logistic Regression</span>}
        <span><i className="sw wet" />Rain sensor wet</span>
        <span><i className="sw alert" />Alert active</span>
        <span><i className="sw rule" />Hand-written rule fires</span>
      </div>
      <p className="mm-note">1× = one simulated minute every 2 seconds. Use 5× or 15× to watch a build-up unfold quickly. At rain onset, the label shows how many minutes before the rain the alert was already on.</p>

      <div className="mm-drivers">
        <h4>Why the model is concerned right now</h4>
        {trace.drivers?.length ? trace.drivers.map((d) => (
          <div className="mm-driver" key={d.driver}>
            <span>{d.driver}</span>
            <div className="mm-driver-track"><i className={d.effect >= 0 ? "up" : "down"} style={{ width: `${Math.min(100, Math.abs(d.effect) * 180)}%` }} /></div>
            <b>{d.effect >= 0 ? "+" : "−"}{Math.round(Math.abs(d.effect) * 100)} pts</b>
          </div>
        )) : <p className="chart-empty">Drivers appear once the probability is above 10%. Try a rain preset.</p>}
        <small>Each bar shows how many percentage points the probability would change if that input looked ordinary (occlusion explanation).</small>
      </div>
    </div>
  );
}
