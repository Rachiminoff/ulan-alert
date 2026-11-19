import { useState } from "react";
import { ChevronDown, ChevronUp, Wifi, WifiOff } from "lucide-react";
import { useLang } from "../lang";
import { THRESHOLDS } from "../useDevice";
import { logEvent } from "../sessionLog";
import StatusCard from "./StatusCard";
import ConfirmDialog from "./ConfirmDialog";

function trend(t, v, up = 0.3) {
  return v <= -up ? t("falling") : v >= up ? t("rising") : t("steady");
}

export default function HomeView({ device, settings, notify, coverClosed, setCoverClosed }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const { level, probability, readings, dP3, online, updatedAt } = device;
  const secs = Math.max(0, Math.round((Date.now() - updatedAt) / 1000));

  const ack = () => { logEvent("alert_acknowledged"); device.pauseAlerts(); notify(t("ackToast")); };
  const snooze = () => { logEvent("alert_snoozed"); device.pauseAlerts(); notify(t("snoozeToast")); };
  const toggleDetails = () => { logEvent("details_toggled", open ? "hide" : "show"); setOpen(!open); };
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
        cooling={device.cooling} onAck={ack} onSnooze={snooze} />

      {settings.cover && (
        <section className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{t("coverTitle")}</h3>
            <p className="text-base text-slate-700">{coverClosed ? t("coverClosed") : t("coverOpen")}</p>
          </div>
          <button onClick={() => setConfirm(true)}
            className="min-h-12 rounded-xl border-2 border-slate-900 px-4 font-semibold text-slate-900 focus-visible:outline-4 focus-visible:outline-blue-600">
            {coverClosed ? t("coverOpenBtn") : t("coverClose")}
          </button>
        </section>
      )}

      {/* Minimalism: sensor numbers are one tap away, not on the main screen. */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <button onClick={toggleDetails} aria-expanded={open}
          className="flex min-h-12 w-full items-center justify-between text-left text-lg font-semibold text-slate-900 focus-visible:outline-4 focus-visible:outline-blue-600">
          {open ? t("hideDetails") : t("details")}
          {open ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
        </button>
        {open && (
          <div className="mt-3 space-y-4">
            <div>
              <h4 className="font-bold text-slate-900">{t("why")}</h4>
              <p className="text-base text-slate-700">{t(whyKey)}</p>
            </div>
            {online && (
              <dl className="grid grid-cols-2 gap-3 text-base">
                {[
                  [t("pressure"), `${readings.pressure} hPa`, trend(t, dP3)],
                  [t("humidity"), `${readings.humidity}%`, null],
                  [t("temperature"), `${readings.temperature} °C`, null],
                  [t("light"), `${readings.light}%`, null],
                ].map(([k, v, tr]) => (
                  <div key={k} className="rounded-xl bg-slate-100 p-3">
                    <dt className="text-sm font-semibold text-slate-600">{k}</dt>
                    <dd className="text-lg font-bold text-slate-900">{v}</dd>
                    {tr && <dd className="text-sm text-slate-700">{tr}</dd>}
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
      </section>

      {confirm && (
        <ConfirmDialog title={coverClosed ? t("coverConfirmOpen") : t("coverConfirmClose")} body={t("coverWarn")}
          onConfirm={doCover} onCancel={() => setConfirm(false)} />
      )}
    </div>
  );
}
