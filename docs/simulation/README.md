# Synthetic Weather Simulation

## 1. Why the simulator exists

A predictive model needs examples of conditions before rain as well as conditions during dry weather. The simulator creates controlled, repeatable weather-like sequences so the application can demonstrate sensor monitoring, prediction, warning behavior, and model evaluation without requiring a physical weather station.

The generated readings are synthetic. They are not observations from a live sensor network and should not be presented as verified local weather measurements.

## 2. What a simulated record contains

The simulator produces a timestamped state with:

- Atmospheric pressure in hectopascals (hPa).
- Air temperature in degrees Celsius.
- Relative humidity in percent.
- Light level in lux.
- Rain amount in millimetres.
- A Boolean rain-plate wet/raining state.
- The active scenario identifier.

The backend stores recent states and makes them available to the frontend through the status and history endpoints.

## 3. Weather systems and precursor behavior

The simulation uses weather-system objects rather than simply switching rain on at random. A system has an initial precursor time, an approach lead, a possible rain duration, a strength, and an indication of whether it produces rain.

During the approach phase, the generated readings can change before rain begins. The modeled signals include falling pressure, increasing humidity, increasing cloud influence, reduced light, and—in convective cases—cooler outflow shortly before onset. These are tendencies within a synthetic model, not deterministic physical laws.

The strength of a system is related to its potential effects, but does not guarantee rainfall. Some systems dissipate without producing rain. This makes the prediction task less trivial and allows the application to demonstrate false alarms and missed events.

## 4. Types of systems

The simulator distinguishes short-lived convective systems from longer frontal or monsoon/trough-like systems. Convective systems have a shorter approach and rain duration and may include a temperature drop associated with outflow. Frontal systems have a longer approach and can produce longer periods of rain.

The simulator also includes nuisance variation such as pressure tides, slow background pressure changes, environmental drift, and sensor noise. These variations prevent the generated readings from being perfectly clean indicators of the underlying system.

## 5. Rain-plate behavior

The simulated rain plate remains wet for a short dry-off period after the last simulated rainfall. The configured delay in `backend/simulator.py` is three minutes. Consequently, the plate's wet state is not exactly the same as instantaneous rainfall amount: it represents a sensor that takes time to return to dry.

This distinction matters to both labels and warning logic. The ML target is based on whether the plate becomes wet, and the warning rules avoid treating an already-wet plate as a useful advance warning.

## 6. Time, daylight, and location

The simulator uses local clock timestamps and derives a solar-time offset from longitude. Daylight influences the expected clear-sky light level. Location settings provide latitude and longitude to the simulation, which uses them when determining solar timing and a broad climate wetness profile.

For Philippine coordinates within the simulator's supported geographic box, the monthly rainfall table is used as a seasonal input. For other locations, a broad latitude/hemisphere heuristic is used. This is a simplified simulation input, not a location-specific climatological service.

## 7. Demonstration scenarios

The available scenario identifiers are defined in `backend/simulator.py` and exposed through `/api/simulation/scenarios`. They include natural operation, sunny conditions, cloud build-up, shower, thunderstorm, Habagat, false warning, cool evening, rain now, typhoon approach, El Niño dry, La Niña wet, Habagat surge, and flash shower.

Scenarios are controlled demonstration presets. Rain-producing presets use the simulator's system model so that precursor behavior can appear before rainfall. The false-warning scenario intentionally creates rain-like signals without rain. Sunny and cool-evening modes suppress new systems.

A scenario is not a claim that the corresponding real-world weather event is occurring at the selected location.

## 8. Reproducibility

The simulator accepts a seed and uses seeded random generators. Given the same seed, starting time, location, and sequence of operations, the generated behavior can be reproduced. Reproducibility is useful for regression tests and repeatable demonstrations.

Changing a seed or scenario can change the generated sequence. The active public simulation is shared by visitors when deployed as one server process; it should not be treated as an isolated private session for each visitor.

## 9. Safe interpretation

Use the simulator to demonstrate the software pipeline and explore controlled conditions. Do not use its output to make real-world safety decisions, claim that rain will occur at a particular place, or replace official weather information. The current project has not established field accuracy using physical sensor measurements.
