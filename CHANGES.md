# What changed and why

## Combined demo reliability and Render deployment (2026-11-20)
- Applied the preset rewind-and-replay fix to the current application while retaining the latest UI, live model monitor, `/api/ml/trace`, and existing location re-post behavior.
- Extended the same preset timing behavior to all rain-producing presets currently exposed by the UI, including Strong Habagat, La Niña analogue, and Typhoon approach.
- Kept `backend/main.py` as the single API implementation; no duplicate `src/main.py` is included.
- Added a single-service Docker deployment for Render. FastAPI serves the built Vite frontend and API from one public URL, with SPA fallback and `/healthz`.
- Disabled public model retraining through `ULAN_ENABLE_RETRAIN=false`; local development keeps the existing behavior unless configured otherwise.
- Combined preset regression coverage with the current location endpoint tests and frontend-serving/retraining guard tests.


## Problems found in the original
1. **The ML did not work.** On its own test split every model was at or below the "always dry" baseline (PR-AUC 0.04-0.06 vs 0.047 base rate; Random Forest Brier 0.105 vs 0.047 for always-dry). Feature importance was led by hour-of-day, i.e. fitting noise.
2. **Rain had no precursors.** In `natural` mode rain started at the same instant pressure began to fall, or at random (0.08%/min), so nothing in the sensors could predict onset. Scenario presets drew rain independently each minute, and the models were trained only on `natural`.
3. **The sun was ~8 hours off.** `solar_hour = hour + longitude/15` on a local-clock timestamp put peak light at ~4 AM and darkness from 10:00 to 22:00.
4. **Hand-written baseline never fired** (thresholds too strict), so it could not be compared against.
5. **Duplicated feature code** in training and live paths (skew risk), a hard-coded 26 C temperature baseline, and `GET /api/status` advanced the simulation (extra tabs sped it up).
6. Model retrained at every start and never saved; probabilities were distorted by `class_weight="balanced"`; threshold 0.60 was applied without being chosen on validation data.

## Changes
See README (simulator, ML methodology, API). Frontend: thresholds retuned for calibrated probabilities, "why" line on watch/warning, post-rain alert suppression, event-level results table in the facilitator panel, help text updated.

## Still open (ideas)
- Fit the simulator's parameters to real PAGASA/Indang station data (even one month of hourly data) to make the synthetic claims defensible.
- Collect a short real sensor log from a BME280 + LDR to replace or sanity-check the synthetic data.
- Multi-horizon outputs (15/30/60 min) and a "likely in about N minutes" message.
- Cost-sensitive threshold chosen from a stated cost ratio (missed rain vs unnecessary trip).

## Lab panel and demo presets (this round)
- Presets no longer inject the pressure/humidity fall in one minute: each is replayed from a snapshot so the history shows a real approach and rain starts ~20 min after the click (all presets, including the long Habagat/typhoon ones). `src/main.py`, a stale copy of the backend, was removed.
- New `GET /api/ml/trace` and a live model monitor in the lab panel; speed/pause controls; presets grouped by expected outcome.
- Results table now uses event-level metrics (rain caught, lead, false alarms/day) instead of F1 cards; added catch-rate vs false-alarm curve and sensor ablation.
- Fixed: page load re-posted the saved location and reset the simulation (wiping the active preset).
- Tests: no step change per preset, rain ~20 min after click, back-to-back presets, location re-post.


## Interface delights

- Added a hidden developer message unlocked by clicking the Ulan Alert logo five times within three seconds.
- Added a persistent Full Moon appearance mode, saved with the user's settings.
- Added a weather trivia card with rotating meteorology facts on the Overview screen.
- Added a terminal-style live event viewer for application interactions and simulation status changes. The terminal identifies itself as an application event log, not raw sensor telemetry.


## Display and terminal refinements (2026-11-20)
- Reworked Full Moon as a true AMOLED presentation with black page surfaces and flat fills.
- Removed SVG gradient definitions from the model-monitor chart and clothesline illustration; the interface now uses solid fills only.
- Rebuilt the event viewer as a plain Windows Command Prompt-style window with green monospace output and a live prompt.
- Kept Full Moon, trivia visibility, and Command Prompt access together in Settings under Display & extras.
- Increased trivia card contrast and text size, and moved it above the main status card so it is visible immediately on the Overview screen.
