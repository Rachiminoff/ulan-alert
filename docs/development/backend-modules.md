# Backend Module and Function Reference

## 1. Backend overview

The Python backend is built with FastAPI. Its responsibilities are to advance the synthetic weather simulation, calculate model features, run the active classifier, retain recent readings and predictions in memory, and expose data to the frontend through HTTP endpoints.

The main source files are `backend/main.py`, `backend/simulator.py`, `backend/features.py`, and `backend/ml.py`.

## 2. `backend/main.py` — API and live application state

This module connects the simulator and ML code to the HTTP interface.

### Live state

`Live` is the in-process runtime manager. It owns the active simulator, recent rows, probability history, model drivers, selected location, simulation speed, running/paused state, and current scenario. The exact retained history is bounded by constants in this module.

### Startup and model lifecycle

- `_train_and_store()` runs model training and updates the shared model store when training completes.
- `_load_or_train()` initializes the model store from available persisted artifacts when supported by the configured paths, or trains models when necessary.
- `_ticker()` advances the simulation and appends new readings/predictions while the simulation is running.
- `lifespan(app)` coordinates application startup and shutdown tasks.
- `_status()` builds the current status response from the latest simulated row and model output.

The model and live state are held in process memory. Restarting the service therefore restarts the live simulation session unless a separate persistence mechanism is added.

### Prediction comparison

`build_prediction_reality(rows, probabilities, sensitivity, limit)` evaluates matured predictions against observed simulated rain in the following 30 minutes. It excludes the newest 30 rows because their outcome windows have not completed. The function counts true positives, false positives, false negatives, and true negatives, and derives accuracy, precision, recall, and F1 where denominators permit.

### HTTP route inventory

| Method and path | Purpose |
|---|---|
| `GET /healthz` | Lightweight service/model readiness check. |
| `GET /` | Serves the built frontend when available; otherwise returns API/service information. |
| `GET /api/status` | Current simulated readings, rain state, probability, model readiness, scenario, and simulation controls. |
| `POST /api/simulation/scenario` | Changes the active demonstration scenario. JSON body uses `scenario`. |
| `POST /api/simulation/reset` | Resets the simulation; accepts optional `seed` and `scenario`. |
| `POST /api/simulation/speed` | Sets simulation speed, clamped between 1 and 60. JSON body uses `speed`. |
| `POST /api/simulation/pause` | Pauses or resumes the ticker using a `paused` boolean. |
| `GET /api/ml/prediction-vs-reality` | Returns matured 30-minute prediction outcomes; query parameters include `sensitivity` and `limit`. |
| `GET /api/history` | Returns recent simulated records and aligned probabilities. Query parameter: `limit`. |
| `GET /api/simulation/scenarios` | Lists available scenario identifiers and labels. |
| `POST /api/location` | Updates the simulator's location name and coordinates. |
| `GET /api/ml/metrics` | Returns training/test metrics and model readiness/training state. |
| `GET /api/ml/features` | Returns feature names and human-readable definitions. |
| `GET /api/ml/dataset` | Returns a sampled synthetic dataset preview. Query parameter: `limit`. |
| `POST /api/ml/train` | Starts explicit retraining when enabled by server configuration. |
| `GET /api/ml/live` | Evaluates alert performance on the current simulation history. Query parameter: `minutes`. |
| `GET /api/ml/trace` | Returns a recent trace of model probabilities, sensor signals, wet state, and alert state. |

The final catch-all route serves frontend assets and is intentionally registered after API routes. It is not an API endpoint.

### Location behavior

`POST /api/location` validates latitude and longitude ranges. If coordinates change, the live simulation is reset so the simulator can use the new location context. Reposting the same coordinates does not reset the simulation.

## 3. `backend/simulator.py` — synthetic weather generation

### Main data structures

- `WeatherState` represents one minute of simulated conditions: timestamp, pressure, temperature, humidity, light, rainfall amount, rain-plate wet state, and scenario.
- `_System` represents a synthetic weather system with an approach period, onset, duration, strength, and decay behavior.
- `SyntheticWeather` manages the clock, random generators, active weather systems, environmental background state, scenarios, and each simulation step.

### Helper functions

- `solar_offset_hours(longitude)` estimates the difference between local clock time and local solar time for the longitude.
- `daylight_fraction(solar_hour)` estimates the daylight curve used by the light model.
- `month_wetness(month, latitude, longitude)` selects a seasonal wetness factor. Philippine coordinates in the configured geographic range use the module's monthly rainfall table; other locations use a broader seasonal heuristic.

### Weather system behavior

The simulator creates synthetic convective or frontal systems. Their approach phases can influence pressure, humidity, cloud/light conditions, and, for convective systems, temperature through an outflow signal. A system may produce rain or dissipate without rain. This variation is intentional: precursor-like conditions are correlated with rain in the generated world but do not guarantee it.

The rain-plate state includes a short dry-off delay after rainfall. Therefore, `raining` in the API represents the simulated plate's wet state, not necessarily the exact instant at which drops are falling.

### Scenarios

`SCENARIOS` defines the supported scenario identifiers. `set_scenario()` changes the scenario and configures/suppresses active systems as appropriate. Scenarios are controlled demonstrations, not observed real-world weather events. Refer to the source list in `backend/simulator.py` and the API scenario endpoint for the current authoritative identifiers.

## 4. `backend/features.py` — model input construction

This module is the single source of truth for model features. `compute_features(df)` converts minute-level raw sensor-like readings into the ordered feature columns consumed during both training and live inference. `future_wet_label(wet, horizon)` creates the supervised target: whether the rain plate becomes wet at any point in the next horizon minutes.

The feature list, definitions, and labels are exported as `FEATURES`, `DEFINITIONS`, and `LABELS`. The current history requirement is 181 rows, and the target horizon is 30 minutes.

## 5. `backend/ml.py` — model training and evaluation

This module creates synthetic training sequences, splits them by independent sequence, trains candidate models, calibrates probabilities, evaluates row-level and event-level performance, and creates feature explanations.

Key functions are described in [Simulation and Machine-Learning Algorithms](algorithms.md). Important public structures include `Seq` (a sequence and its features/labels), `Calibrated` (a classifier plus isotonic calibrator), and `candidates()` (the candidate model definitions).

## 6. Tests

- `backend/test_simulator.py` tests simulator behavior, feature construction, alert evaluation, and ML skill-related expectations.
- `backend/test_main.py` tests API behavior including scenario handling, deployment routes, location handling, and prediction-versus-reality calculations.

Run tests from the repository root with:

```bash
python -m unittest discover -s backend -p 'test_*.py'
```

Use the project's declared backend requirements to create the Python environment before running the suite.

## 7. Concurrency and operational cautions

The API uses a shared lock around access to mutable live state. Changes that read or update the live simulator, recent rows, or prediction arrays should follow the existing locking pattern. Avoid adding long-running model training directly inside a request handler; the existing retraining route starts a background worker. The application is designed around one in-process simulation state, so multiple independent worker processes would each have their own state unless the architecture is changed.
