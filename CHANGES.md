# What changed and why

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
