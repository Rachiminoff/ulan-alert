import { useState } from "react";
import { Activity, Gauge, Droplets, Thermometer, Sun, Wifi, WifiOff, ChevronDown } from "lucide-react";
import { useLang } from "../lang";
import { THRESHOLDS } from "../useDevice";
import { logEvent } from "../sessionLog";
import StatusCard from "./StatusCard";
import ConfirmDialog from "./ConfirmDialog";
import SimulationInsights from "./SimulationInsights";
import ClotheslineVisualizer from "./ClotheslineVisualizer";
import PredictionReality from "./PredictionReality";
import WeatherTrivia from "./WeatherTrivia";

function trend(t, v, up = 0.3) {
  return v <= -up ? t("falling") : v >= up ? t("rising") : t("steady");
}

export default function HomeView({ device, settings, notify, coverClosed, setCoverClosed }) {
  const { t } = useLang();
  const [confirm, setConfirm] = useState(false);
  const { level, probability, readings, dP3, online, updatedAt } = device;
  const secs = Math.max(0, Math.round((Date.now() - updatedAt) / 1000));

  const ack = () => { logEvent("alert_acknowledged"); device.pauseAlerts(); notify(t("ackToast")); };
  const snooze = () => { logEvent("alert_snoozed"); device.pauseAlerts(); notify(t("snoozeToast")); };
  const doCover = () => {
    const next = !coverClosed;
    setCoverClosed(next); setConfirm(false);
    logEvent("cover_toggled", next ? "closed" : "open");
    notify(t("coverDone", { state: next ? t("coverClosed") : t("coverOpen") }));
  };

  const whyKey = { safe: "whySafe", watch: "whyWatch", warning: "whyWarning", raining: "whyRaining", offline: "whyOffline" }[level];

  return (
    <div className="space-y-4">
      {/* Visibility of system status: always say whether the unit is talking to us. */}
      <p className={`flex items-center gap-2 text-base font-semibold ${online ? "text-slate-700" : "text-slate-900"}`}>
        {online ? <Wifi aria-hidden="true" className="h-5 w-5" /> : <WifiOff aria-hidden="true" className="h-5 w-5" />}
        {online ? t("connected", { n: secs }) : t("offlineChip")}
      </p>

      <StatusCard level={level} probability={probability} thresholds={THRESHOLDS[settings.sensitivity]}
        modelReady={device.modelReady !== false} cooling={device.cooling} onAck={ack} onSnooze={snooze} />

      {settings.showTrivia !== false && <WeatherTrivia />}

      {(level === "watch" || level === "warning") && device.drivers?.length > 0 && (
        <section className="dashboard-explanation" aria-label="Reason for current warning">
          <div className="dashboard-section-heading"><Activity size={17}/><h3>What is driving this reading?</h3></div>
          <p>{device.drivers.filter(d => d.effect > 0).map(d => d.driver.toLowerCase()).join(", ") || "Several small changes together"}.</p>
        </section>
      )}

      <section className="sensor-overview" aria-labelledby="sensor-overview-title">
        <div className="dashboard-section-heading">
          <div><span className="dashboard-eyebrow">LIVE MEASUREMENTS</span><h3 id="sensor-overview-title">Sensor readings</h3></div>
          <span className={`sensor-live-state ${online ? "is-live" : "is-offline"}`}>{online ? "LIVE" : "OFFLINE"}</span>
        </div>
        {online ? <dl className="sensor-grid">
          <div className="sensor-tile"><dt><Gauge size={16}/>{t("pressure")}</dt><dd>{readings.pressure}<small>hPa</small></dd><span>{trend(t, dP3)} · 3-point change</span></div>
          <div className="sensor-tile"><dt><Droplets size={16}/>{t("humidity")}</dt><dd>{readings.humidity}<small>%</small></dd><span>Relative humidity</span></div>
          <div className="sensor-tile"><dt><Thermometer size={16}/>{t("temperature")}</dt><dd>{readings.temperature}<small>°C</small></dd><span>Ambient temperature</span></div>
          <div className="sensor-tile"><dt><Sun size={16}/>{t("light")}</dt><dd>{readings.light}<small>%</small></dd><span>Light intensity</span></div>
        </dl> : <p className="sensor-unavailable">Sensor readings are unavailable while the device is offline.</p>}
        <div className="sensor-context"><b>{t("why")}</b><span>{t(whyKey)}</span></div>
      </section>

      {settings.cover && (
        <ClotheslineVisualizer closed={coverClosed} onToggle={() => setConfirm(true)} />
      )}

      <details className="research-disclosure">
        <summary><span><span className="dashboard-eyebrow">MODEL EVALUATION</span><b>Prediction versus reality</b><small>Accuracy, precision, recall and recent outcomes</small></span><ChevronDown size={19}/></summary>
        <PredictionReality sensitivity={settings.sensitivity} />
      </details>

      <SimulationInsights scenario={device.scenario} location={device.location}/>

      {confirm && (
        <ConfirmDialog title={coverClosed ? t("coverConfirmOpen") : t("coverConfirmClose")} body={t("coverWarn")}
          onConfirm={doCover} onCancel={() => setConfirm(false)} />
      )}
    </div>
  );
}
