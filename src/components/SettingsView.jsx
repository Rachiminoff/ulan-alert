import { useLang } from "../lang";
import { logEvent } from "../sessionLog";
import LocationPicker from "./LocationPicker";

function Toggle({ label, desc, checked, onChange }) {
  const { t } = useLang();
  return (
    <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 py-2">
      <span>
        <span className="block text-lg font-semibold text-slate-900">{label}</span>
        {desc && <span className="block text-base text-slate-700">{desc}</span>}
      </span>
      <span className="flex items-center gap-2">
        <span className="w-12 text-right text-base font-semibold text-slate-800">{checked ? t("on") : t("off")}</span>
        <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)}
          className="settings-switch-input focus-visible:outline-4 focus-visible:outline-blue-600" />
      </span>
    </label>
  );
}

export default function SettingsView({ settings, update, notify, location, onLocationChange }) {
  const { t } = useLang();
  const levels = ["low", "medium", "high"];
  const cap = { low: "sensLow", medium: "sensMedium", high: "sensHigh" };

  const setSens = (v) => {
    update({ sensitivity: v });
    logEvent("sensitivity_changed", v);
    notify(v === "high" ? t("sensHighToast") : t("sensToast", { level: t(cap[v]) }));
  };
  const setToggle = (k, v) => { update({ [k]: v }); logEvent("setting_changed", `${k}=${v}`); notify(t("settingSaved")); };
  const setLang = (l) => { update({ lang: l }); logEvent("language_changed", l); };

  return (
    <div className="settings-stack">
      {location && <LocationPicker location={location} onChange={onLocationChange} notify={notify} />}
      <section className="settings-panel settings-sensitivity rounded-2xl bg-white p-4 shadow-sm" aria-labelledby="settings-sensitivity-title">
        <h2 className="settings-panel-title" id="settings-sensitivity-title">{t("sensitivity")}</h2>
        <fieldset className="settings-choice-group">
          <legend className="sr-only">{t("sensitivity")}</legend>
          <div className="settings-sensitivity-options">
            {levels.map((l) => (
              <label key={l} className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border-2 p-3 ${
                settings.sensitivity === l ? "border-slate-900 bg-slate-50" : "border-slate-200"}`}>
                <input type="radio" name="sens" checked={settings.sensitivity === l} onChange={() => setSens(l)}
                  className="mt-1 h-6 w-6 accent-slate-900 focus-visible:outline-4 focus-visible:outline-blue-600" />
                <span>
                  <span className="block text-lg font-semibold text-slate-900">{t(cap[l])}</span>
                  <span className="block text-base text-slate-700">{t(`${cap[l]}Desc`)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="settings-panel settings-alerts rounded-2xl bg-white p-4 shadow-sm" aria-labelledby="settings-alerts-title">
        <h2 className="settings-panel-title" id="settings-alerts-title">{t("alerts")}</h2>
        <div className="settings-alert-options mt-2 divide-y divide-slate-200">
          <Toggle label={t("sound")} checked={settings.sound} onChange={(v) => setToggle("sound", v)} />
          <Toggle label={t("vibration")} checked={settings.vibration} onChange={(v) => setToggle("vibration", v)} />
          <Toggle label={t("cover")} desc={t("coverDesc")} checked={settings.cover} onChange={(v) => setToggle("cover", v)} />
        </div>
      </section>

      <section className="settings-panel settings-language rounded-2xl bg-white p-4 shadow-sm" aria-labelledby="settings-language-title">
        <h2 className="settings-panel-title" id="settings-language-title">{t("language")}</h2>
        <div className="grid grid-cols-2 gap-2">
          {[["en", "English"], ["fil", "Filipino"]].map(([code, name]) => (
            <button key={code} onClick={() => setLang(code)} aria-pressed={settings.lang === code}
              className={`min-h-12 rounded-xl border-2 text-lg font-semibold focus-visible:outline-4 focus-visible:outline-blue-600 ${
                settings.lang === code ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-900"}`}>
              {name}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
