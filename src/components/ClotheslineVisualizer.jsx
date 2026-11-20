import { useId } from "react";
import { CloudRain, ShieldCheck } from "lucide-react";

/**
 * A small animated illustration of the prototype's retractable clothesline cover.
 * This is a UI simulation only: it does not actuate physical hardware.
 */
export default function ClotheslineVisualizer({ closed, onToggle, disabled = false }) {
  const id = useId().replaceAll(":", "");
  return (
    <section className="clothesline-panel" aria-label="Simulated clothesline cover">
      <div className="clothesline-panel-heading">
        <div>
          <span className="section-kicker">SIMULATED HARDWARE</span>
          <h3>Retractable clothesline cover</h3>
          <p>The illustration animates to show the cover mechanism's state.</p>
        </div>
        <span className={`cover-state ${closed ? "is-closed" : "is-open"}`}>
          <span className="cover-state-dot" />{closed ? "Cover closed" : "Cover open"}
        </span>
      </div>

      <div className={`clothesline-scene ${closed ? "cover-is-closed" : "cover-is-open"}`}>
        <svg viewBox="0 0 640 230" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
          <title id={`${id}-title`}>Animated retractable clothesline cover</title>
          <desc id={`${id}-desc`}>{closed ? "The simulated canopy is extended over the clothes." : "The simulated canopy is retracted and the clothesline is exposed."}</desc>
          <rect x="1" y="1" width="638" height="228" rx="14" fill="#303f55"/>
          <circle cx="555" cy="43" r="20" fill="#f4d58b" opacity=".9" className="scene-sun"/>
          <g className="scene-clouds" fill="#aab7c9" opacity=".62">
            <ellipse cx="100" cy="48" rx="33" ry="12"/><circle cx="82" cy="43" r="13"/><circle cx="112" cy="37" r="17"/>
            <ellipse cx="485" cy="83" rx="29" ry="10"/><circle cx="470" cy="78" r="12"/><circle cx="495" cy="74" r="15"/>
          </g>
          <path d="M28 194H612" stroke="#718096" strokeWidth="3" strokeLinecap="round"/>
          <path d="M66 193V74M574 193V74" stroke="#c0c8d5" strokeWidth="7" strokeLinecap="round"/>
          <path d="M66 74H574" stroke="#d5dbe5" strokeWidth="4" strokeLinecap="round"/>
          <path d="M66 193L48 208M574 193L592 208" stroke="#8794a8" strokeWidth="5" strokeLinecap="round"/>
          <path d="M116 111H524" stroke="#dce3ed" strokeWidth="2.5" strokeDasharray="4 3"/>
          <g className="hanging-laundry">
            <path d="M172 113v10m-9 0h18" stroke="#e6eaf1" strokeWidth="2"/>
            <path d="M163 123h18l-3 47q-6 7-12 0z" fill="#f0b66d" stroke="#f6d5a9" strokeWidth="1.5"/>
            <path d="M252 113v10m-9 0h18" stroke="#e6eaf1" strokeWidth="2"/>
            <path d="M243 123h18l-2 50q-7 7-14 0z" fill="#72b9c9" stroke="#b7e4eb" strokeWidth="1.5"/>
            <path d="M335 113v10m-9 0h18" stroke="#e6eaf1" strokeWidth="2"/>
            <path d="M326 123h18l-3 44q-6 7-12 0z" fill="#c1a7e8" stroke="#e1d3f6" strokeWidth="1.5"/>
            <path d="M421 113v10m-9 0h18" stroke="#e6eaf1" strokeWidth="2"/>
            <path d="M412 123h18l-2 49q-7 7-14 0z" fill="#e58f9b" stroke="#f5c4ca" strokeWidth="1.5"/>
          </g>
          <g className="retractable-cover">
            <path d="M66 74L574 74L535 105H105Z" fill="#8996e8" stroke="#c6ccff" strokeWidth="2"/>
            <path d="M105 105H535" stroke="#e3e6ff" strokeWidth="3" strokeLinecap="round"/>
            <path d="M105 105L105 113M535 105L535 113" stroke="#c6ccff" strokeWidth="3"/>
          </g>
          <g className="cover-rails" stroke="#9ca8bb" strokeWidth="3" strokeLinecap="round">
            <path d="M66 74L66 48M574 74L574 48"/>
          </g>
          <text x="22" y="218" fill="#c7d0df" fontSize="10">ILLUSTRATIVE SIMULATION · NOT CONNECTED TO A MOTOR</text>
        </svg>
        <div className="scene-caption"><CloudRain size={15}/>{closed ? "Canopy extended above the laundry" : "Canopy retracted · laundry exposed"}</div>
      </div>

      <div className="clothesline-controls">
        <div className="cover-explanation"><ShieldCheck size={17}/><span>{closed ? "The simulated cover is protecting the laundry." : "The simulated cover is parked; the laundry is exposed."}</span></div>
        <button type="button" onClick={onToggle} disabled={disabled} className="cover-toggle-button">
          {closed ? "Open cover" : "Close cover"}
        </button>
      </div>
    </section>
  );
}
