import { useState } from "react";
import { Lightbulb, RefreshCw } from "lucide-react";
import { logEvent } from "../sessionLog";

const FACTS = [
  { title: "Pressure is a clue, not a promise", body: "Falling air pressure can signal an approaching weather system, but pressure alone cannot tell you exactly when or where rain will fall." },
  { title: "Relative humidity depends on temperature", body: "Relative humidity describes how close the air is to saturation at its current temperature. Cooling air can raise relative humidity even when its water-vapor content barely changes." },
  { title: "Clouds are made of tiny droplets", body: "Most visible cloud droplets are so small that rising air can keep them suspended. Rain begins when droplets or ice particles grow large enough to fall." },
  { title: "A rain probability is not a rain timer", body: "A 40% probability does not mean rain will start in 40 minutes. It expresses likelihood over a defined forecast area and period." },
  { title: "Thunderstorms need more than moisture", body: "Thunderstorms typically require moisture, atmospheric instability, and a lifting mechanism that helps air rise." },
  { title: "Daytime heating can fuel convection", body: "When the ground warms the air above it, that air can become buoyant and rise. In an unstable atmosphere, this can help build towering convective clouds." },
  { title: "Wind can change what a sensor observes", body: "A weather station measures conditions at its own location. Nearby showers and gust fronts can make local readings change quickly over short distances." },
  { title: "A forecast model can be uncertain", body: "Weather observations are incomplete and the atmosphere is chaotic. Good warnings communicate uncertainty rather than treating a model score as certainty." },
  { title: "Dew point tells you about moisture", body: "The dew point is the temperature air would need to cool to, at roughly constant pressure and water-vapor content, to become saturated. A higher dew point generally means more moisture in the air." },
  { title: "Lightning heats the air extremely quickly", body: "A lightning channel can heat nearby air to temperatures hotter than the surface of the Sun. The rapid expansion of that heated air creates the sound wave we hear as thunder." },
  { title: "Thunder tells you how far away lightning may be", body: "If you can hear thunder, you are close enough to be at risk from lightning. The flash-to-bang count can give a rough distance estimate, but it is not a safety guarantee." },
  { title: "Radar does not see every raindrop", body: "Weather radar sends out radio waves and measures energy scattered back by targets such as raindrops, hail, and sometimes insects or ground clutter. Very light rain and distant targets can be harder to detect." },
  { title: "Virga is rain that evaporates before reaching the ground", body: "Virga appears as streaks hanging beneath a cloud. The precipitation falls into a dry layer and evaporates or sublimates before it reaches the surface." },
  { title: "Mountains can make one side wetter", body: "Moist air forced up a mountain can cool and form clouds or precipitation on the windward side. Descending air on the leeward side often becomes warmer and drier, creating a rain-shadow effect." },
  { title: "A monsoon is a seasonal wind pattern", body: "Monsoons involve seasonal shifts in prevailing winds and often bring distinct wet and dry periods. The term describes a circulation pattern, not simply a synonym for heavy rain." },
  { title: "A typhoon is a regional name for a tropical cyclone", body: "The same type of warm-core rotating storm is called a hurricane in some ocean basins and a typhoon in the western North Pacific. The name depends on where it occurs." },
  { title: "The eye is not the storm's strongest part", body: "In a mature tropical cyclone, the most intense winds and heaviest rainfall are usually found in the eyewall surrounding the eye, not in the relatively calm eye itself." },
  { title: "Rain gauges need a clear exposure", body: "Nearby roofs, trees, and walls can block wind-driven rain or cause splashing. Weather stations place gauges carefully so the collected water better represents rainfall at the site." },
  { title: "A short shower can still cause a lot of runoff", body: "Rainfall intensity matters as well as total rainfall. A brief burst can overwhelm drains or run off hard surfaces quickly, especially where the ground is already saturated." },
  { title: "Cloud names describe their shape and height", body: "The word stratus refers to layered clouds, cumulus to heaps or puffs, and cirrus to wispy high clouds. These names help describe cloud appearance, but do not guarantee a particular weather outcome." },
  { title: "Warm air can hold more water vapor", body: "At higher temperatures, saturation vapor pressure is greater. This is why warm air can contain more water vapor before reaching saturation, although actual humidity also depends on moisture supply and air movement." },
  { title: "A 1 mm rainfall is a measurable depth", body: "One millimeter of rainfall means one liter of water collected over each square meter of level surface, assuming no runoff, evaporation, or infiltration." },
  { title: "A weather station measures its own surroundings", body: "A sensor mounted near a hot wall, shaded by a roof, or exposed to exhaust may not represent the wider area. Sensor placement and maintenance are part of measurement quality." },
  { title: "Not every dark cloud produces rain", body: "Cloud appearance alone cannot confirm rainfall at the ground. Cloud depth, droplet growth, atmospheric dryness below the cloud, and wind all influence whether precipitation reaches you." },
  { title: "Rain probability needs a defined place and time", body: "A probability is meaningful only when its forecast area and time window are specified. A chance of rain over a town during an afternoon is different from a chance at one sensor during the next 30 minutes." },
];

export default function WeatherTrivia() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * FACTS.length));
  const fact = FACTS[index];
  const next = () => {
    const offset = 1 + Math.floor(Math.random() * (FACTS.length - 1));
    const nextIndex = (index + offset) % FACTS.length;
    setIndex(nextIndex);
    logEvent("weather_trivia_changed", FACTS[nextIndex].title);
  };

  return (
    <section className="weather-trivia dashboard-trivia" aria-labelledby="weather-trivia-title">
      <div className="weather-trivia-heading">
        <div className="weather-trivia-icon"><Lightbulb aria-hidden="true" /></div>
        <div><div className="weather-trivia-kicker">A QUICK WEATHER FACT</div><h3 id="weather-trivia-title">Did you know?</h3></div>
        <button className="weather-trivia-next" onClick={next} aria-label="Show another weather fact" title="Another fact"><RefreshCw size={16} /></button>
      </div>
      <div className="weather-trivia-copy">
        <h4>{fact.title}</h4>
        <p>{fact.body}</p>
      </div>
    </section>
  );
}
