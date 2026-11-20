import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { getRecentEvents, subscribeToEvents } from "../sessionLog";

const ACTIONS = {
  tab_opened: "Opened page",
  scenario_set: "Weather scenario selected",
  status_changed: "Weather status changed",
  location_changed: "Simulation location changed",
  sensitivity_changed: "Warning sensitivity changed",
  setting_changed: "Setting changed",
  language_changed: "Display language changed",
  full_moon_mode: "Full Moon display",
  weather_trivia_changed: "Weather fact changed",
  alert_acknowledged: "Warning acknowledged",
  alert_snoozed: "Warning snoozed",
  cover_toggled: "Clothesline cover changed",
  details_toggled: "Sensor details toggled",
  developer_easter_egg_unlocked: "Secret developer message unlocked",
};

function describe(event) {
  const action = ACTIONS[event.action] || event.action.replaceAll("_", " ");
  return `${event.at || "--:--:--"}  ${action}${event.detail ? `: ${event.detail}` : ""}`;
}

export default function TerminalPanel({ onClose }) {
  const [events, setEvents] = useState(() => getRecentEvents(100).reverse());
  const outputRef = useRef(null);

  useEffect(() => subscribeToEvents((event) => setEvents((current) => [...current, event].slice(-100))), []);
  useEffect(() => {
    const node = outputRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [events]);

  return (
    <div className="terminal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="terminal-window" role="dialog" aria-modal="true" aria-labelledby="terminal-title">
        <header className="terminal-titlebar">
          <div><span className="terminal-app-icon">C:\</span><span id="terminal-title">Command Prompt</span></div>
          <button onClick={onClose} aria-label="Close Command Prompt"><X size={14} /></button>
        </header>
        <div className="terminal-output" ref={outputRef} aria-live="polite" aria-relevant="additions">
          <p>Microsoft Windows [Version 10.0.19045]</p>
          <p>(c) Microsoft Corporation. All rights reserved.</p>
          <p>&nbsp;</p>
          <p>C:\ULAN-ALERT&gt; monitor.exe</p>
          <p>Ulan Alert session monitor</p>
          <p>Monitoring recent application and simulation events...</p>
          <p>&nbsp;</p>
          {events.length ? events.map((event, index) => (
            <p className="terminal-line" key={`${event.t_ms}-${index}`}>{describe(event)}</p>
          )) : <p className="terminal-empty">No events recorded.</p>}
          <p className="terminal-command">C:\ULAN-ALERT&gt;<i aria-hidden="true" /></p>
        </div>
      </section>
    </div>
  );
}
