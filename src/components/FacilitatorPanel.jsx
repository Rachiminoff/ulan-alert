import { useCallback, useEffect, useRef, useState } from "react";
import { Download, RefreshCw, PlayCircle, FlaskConical, Info, Activity, AlertTriangle } from "lucide-react";
import { SCENARIO_KEYS } from "../useDevice";
import { downloadLog } from "../sessionLog";

const scenarioInfo = {
  natural:["Natural weather","Unscripted baseline simulation"], sunny:["Clear skies","Sunny and dry conditions"],
  cloud_build:["Cloud buildup","Increasing humidity and changing pressure"], shower:["Passing shower","A brief convective rain event"],
  thunderstorm:["Thunderstorm","Strong pre-rain signal and storm event"], habagat:["Habagat rain","Longer southwest-monsoon rain band"],
  false_warning:["False alarm","Cloudy and humid, but no rain onset"], cool_evening:["Cool evening","Cooler, mostly dry conditions"],
  rain_now:["Rain now","Rain is already occurring"], typhoon_approach:["Typhoon approach","Synthetic cyclone-like pressure and rain pattern"],
  el_nino_dry:["El Niño analogue","Drier synthetic climate background; not current ENSO status"],
  la_nina_wet:["La Niña analogue","Wetter synthetic climate background; not current ENSO status"],
  habagat_surge:["Strong Habagat","Prolonged southwest-monsoon rain band"], flash_shower:["Flash shower","Sudden, intense short-duration rain"],
  offline:["Offline state","Locally demonstrates loss of sensor connectivity"]
};
const labels = {"Random Forest":"Random Forest", "Gradient Boosting":"Gradient Boosting", "Logistic Regression":"Logistic Regression", "Pressure/humidity rule":"Pressure / humidity rule", "Hour-of-day climatology":"Hour-of-day climatology"};
const featureLabels = {hour_cos:"Time of day (cosine)",hour_sin:"Time of day (sine)",pressure_delta_10m:"Pressure change · 10 min",pressure_delta_30m:"Pressure change · 30 min",pressure_delta_1h:"Pressure change · 1 hour",pressure_delta_3h:"Pressure change · 3 hours",pressure_accel:"Pressure-fall acceleration",pressure_std_30m:"Pressure variability",humidity:"Humidity",humidity_delta_30m:"Humidity change · 30 min",temp_delta_10m:"Temperature change · 10 min",temp_delta_30m:"Temperature change · 30 min",temp_vs_3h_mean:"Temperature vs 3-hour mean",light_ratio:"Relative light level",clearness:"Estimated cloud cover"};

function MiniBars({items, valueKey, labelKey, max=1, suffix=""}) {
  if (!items?.length) return <p className="chart-empty">No chart data is available.</p>;
  return <div className="bar-chart" role="img" aria-label="Horizontal bar chart">
    {items.map((item,i)=>{const v=Number(item[valueKey])||0;return <div className="bar-chart-row" key={item[labelKey]??i}><div className="bar-chart-label"><span>{item[labelKey]}</span><b>{(v*100).toFixed(1)}{suffix}</b></div><div className="bar-track"><i style={{width:`${Math.max(0,Math.min(100,v/max*100))}%`}}/></div></div>})}
  </div>;
}
function MetricCard({name,metric}) { return <article className="metric-card"><h4>{labels[name]||name}</h4><div className="metric-numbers">{[["Precision",metric.precision],["Recall",metric.recall],["F1",metric.f1],["PR-AUC",metric.pr_auc]].map(([label,value])=><span key={label}>{label}<b>{Number.isFinite(value)?value.toFixed(3):"—"}</b></span>)}</div><div className="metric-score-track" aria-label={`F1 score ${(metric.f1*100).toFixed(1)} percent`}><i style={{width:`${Math.max(0,Math.min(100,(metric.f1||0)*100))}%`}}/></div></article> }

export default function FacilitatorPanel({device,open,onClose}) {
  const [metrics,setMetrics]=useState(null),[training,setTraining]=useState(false),[seed,setSeed]=useState(73),[resetting,setResetting]=useState(false),[busyScenario,setBusyScenario]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const pollRef=useRef(null);
  useEffect(()=>{if(!open)return;const onKey=e=>{if(e.key==="Escape")onClose?.()};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey)},[open,onClose]);
  const loadMetrics=useCallback(async()=>{const r=await fetch("/api/ml/metrics");if(!r.ok)throw new Error(`Metrics request failed (${r.status})`);const j=await r.json();setMetrics(j);setTraining(!!j.training);return j;},[]);
  useEffect(()=>{let active=true;const poll=async()=>{try{const r=await fetch("/api/ml/metrics");if(!r.ok)throw new Error();const j=await r.json();if(active){setMetrics(j);setTraining(!!j.training)}}catch{if(active)setError("Research metrics are temporarily unavailable.")}};poll();pollRef.current=setInterval(poll,training?1200:10000);return()=>{active=false;clearInterval(pollRef.current)}},[training]);
  const chooseScenario=async key=>{setError("");setNotice("");setBusyScenario(true);try{await device.setScenario(key);setNotice(`${scenarioInfo[key]?.[0]||key} scenario selected.`)}catch(e){setError(e.message||"Could not change scenario.")}finally{setBusyScenario(false)}};
  const reset=async()=>{setError("");setNotice("");setResetting(true);try{const r=await fetch("/api/simulation/reset",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({seed,scenario:"natural"})});if(!r.ok)throw new Error(`Reset failed (${r.status})`);const j=await r.json();if(!j.ok)throw new Error(j.message||"Reset failed");await device.setScenario("natural");setNotice(`Simulation reset with seed ${j.seed}.`)}catch(e){setError(e.message||"Could not reset simulation.")}finally{setResetting(false)}};
  const retrain=async()=>{setError("");setNotice("");setTraining(true);try{const r=await fetch("/api/ml/train",{method:"POST"});if(!r.ok)throw new Error(`Training request failed (${r.status})`);const j=await r.json();if(!j.ok&&!j.training)throw new Error(j.message||j.error||"Training could not start.");setNotice(j.message||"Training started. Results will update when it finishes.");await loadMetrics()}catch(e){setTraining(false);setError(e.message||"Could not start training.")}};
  const models=metrics?Object.entries(metrics).filter(([n,m])=>m&&typeof m.f1==="number"&&n!=="meta"):[];
  const features=(metrics?.feature_importance||[]).slice(0,8).map(x=>({label:featureLabels[x.feature]||x.feature,value:x.importance}));
  const alertRows=models.filter(([,m])=>m.alert_eval).map(([name,m])=>({label:name,value:m.alert_eval.event_recall}));
  if(!open)return null;
  return <div className="fac-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose?.()}}><section className="facilitator-panel fac-modal" role="dialog" aria-modal="true" aria-labelledby="fac-modal-title"><header className="fac-modal-header"><div><span id="fac-modal-title" className="fac-title"><FlaskConical size={19}/> Research lab &amp; demo controls</span><span className="fac-caption">Simulation trainer · scenario lab · model evaluation</span></div><button className="fac-close" onClick={onClose} aria-label="Close research controls">×</button></header>
    <div className="fac-body"><p className="fac-intro">This is the experimentation layer of the simulated prototype. Change synthetic weather scenarios, replay deterministic runs, and inspect model performance on held-out synthetic data. No physical clothesline, sensor hardware, live weather feed, or official forecast is controlled here.</p>
      {(error||notice)&&<div className={error?"fac-feedback error":"fac-feedback"} role="status">{error?<AlertTriangle size={16}/>:<Activity size={16}/>}<span>{error||notice}</span></div>}
      <section className="fac-section"><div className="fac-heading"><h3>Demonstration scenarios</h3><span>{busyScenario?"Applying…":`Active: ${scenarioInfo[device.scenario]?.[0]||"Natural weather"}`}</span></div><p>Choose a controlled sensor pattern. Changes are sent to the simulator and confirmed before the selection is treated as active.</p><div className="fac-scenarios">{SCENARIO_KEYS.map(k=><button key={k} disabled={busyScenario} onClick={()=>chooseScenario(k)} aria-pressed={device.scenario===k} className={device.scenario===k?"selected":""}><b>{scenarioInfo[k]?.[0]||k}</b><small>{scenarioInfo[k]?.[1]}</small></button>)}</div></section>
      <section className="fac-section"><h3>Replay and model operations</h3><p>Resetting starts a fresh natural-weather run. Retraining is an explicit, longer-running research operation; it no longer blocks the API response.</p><div className="fac-controls"><label>Starting seed<input type="number" min="0" max="999999" value={seed} onChange={e=>setSeed(Math.max(0,Math.min(999999,Number(e.target.value)||0)))}/></label><button onClick={reset} disabled={resetting||busyScenario}><RefreshCw size={16}/>{resetting?"Resetting…":"Reset simulation"}</button><button onClick={downloadLog}><Download size={16}/>Download session CSV</button><button onClick={retrain} disabled={training}><PlayCircle size={16}/>{training?"Training in background…":"Retrain models"}</button></div>{training&&<div className="training-state"><span className="training-spinner"/> Training is running. This panel checks for updated results automatically.</div>}</section>
      <section className="fac-section research-results"><div className="fac-heading"><h3>Model test results</h3><span className={metrics?.model_ready?"state-ready":"state-pending"}>{metrics?.model_ready?"Model ready":"Waiting for model"}</span></div><p>Evaluation metrics are generated by the backend using held-out synthetic simulation periods. They are not evidence of real-world weather accuracy.</p>
        {metrics?.error&&<div className="research-caution">{metrics.error}</div>}
        {!metrics?.model_ready&&!models.length?<div className="chart-empty">{metrics?.training?"The model is training. Results will appear here when it finishes.":"No completed model evaluation is available yet."}</div>:<>
          <div className="metrics-grid">{models.map(([name,m])=><MetricCard key={name} name={name} metric={m}/>)}</div>
          <div className="research-chart-grid">
            <article className="metric-card"><h4>F1 score comparison</h4><p>Higher scores indicate a better balance of precision and recall on the held-out synthetic test data.</p><MiniBars items={models.map(([name,m])=>({label:name,value:m.f1}))} labelKey="label" valueKey="value"/></article>
            {features.length>0&&<article className="metric-card"><h4>Most influential Random Forest inputs</h4><p>Relative feature importance from the fitted model; importance does not establish causation.</p><MiniBars items={features} labelKey="label" valueKey="value" max={Math.max(...features.map(x=>x.value),0.01)}/></article>}
            {alertRows.length>0&&<article className="metric-card"><h4>Rain-event detection</h4><p>Event recall: share of rain events caught under the evaluated warning rule.</p><MiniBars items={alertRows} labelKey="label" valueKey="value"/></article>}
          </div>
          {metrics["Random Forest"]?.alert_eval&&<div className="metric-card alert-summary"><h4>Warning behavior</h4><p>Event-based evaluation of the alert rule, not just individual time-step classification.</p><div className="alert-stat-grid">{[["Events caught",`${metrics["Random Forest"].alert_eval.caught}/${metrics["Random Forest"].alert_eval.events}`],["Median lead",`${Number(metrics["Random Forest"].alert_eval.median_lead_min||0).toFixed(0)} min`],["False alarms/day",Number(metrics["Random Forest"].alert_eval.false_alarms_per_day||0).toFixed(2)],["Minimum lead",`${metrics.meta?.min_lead_minutes??10} min`]].map(([k,v])=><div key={k}><small>{k}</small><b>{v}</b></div>)}</div></div>}
        </>}
        <details className="metric-explain"><summary><Info size={16}/> How to interpret the results</summary><dl><dt>Precision</dt><dd>Of the model's rain predictions, how many were correct?</dd><dt>Recall</dt><dd>Of the rain observations in the test set, how many did it identify?</dd><dt>F1</dt><dd>Harmonic mean of precision and recall.</dd><dt>PR-AUC</dt><dd>Area under the precision-recall curve across decision thresholds.</dd></dl></details>
      </section>
    </div>
  </section></div>;
}
