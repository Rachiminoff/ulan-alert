# Python Function Reference

This page explains the principal Python functions and methods in the repository. It is written as a guide to the source, not as a replacement for reading the implementation when changing behavior.

## `backend/features.py`

This module defines the input columns used by the classifiers and creates the future-rain target. Training and live inference both call the same feature function; this helps prevent the training process and running application from interpreting sensor history differently.

### `compute_features(df: pandas.DataFrame) -> pandas.DataFrame`

**Purpose:** Convert minute-by-minute sensor-like readings into the ordered model input columns listed in `FEATURES`.

**Input:** A DataFrame containing `timestamp`, `pressure`, `temperature`, `humidity`, and `light` columns. Each row represents one simulated minute.

**Output:** A DataFrame with the same index and one column for each item in `FEATURES`. Early rows contain missing values until enough history exists for the longest rolling calculation.

**How it works:** It calculates pressure changes over 10 minutes, 30 minutes, one hour and three hours; pressure acceleration and variability; humidity level and change; temperature changes and deviation from its recent mean; relative light and estimated clearness; and cyclical time-of-day values.

**Important:** The feature calculations use current and earlier readings only. The target label is created separately. Do not add future readings to this function: doing so would leak the answer into the model inputs.

### `future_wet_label(wet: numpy.ndarray, horizon: int = HORIZON) -> numpy.ndarray`

**Purpose:** Create the supervised learning target for each minute.

**Input:** A Boolean-like array indicating whether the simulated rain plate is wet, plus the number of future minutes to inspect.

**Output:** An array containing `1` when the plate becomes wet at least once in the next `horizon` minutes, `0` when it does not, and `NaN` where the complete future window is unavailable.

**Important:** The current default horizon is 30 minutes. The current row is not counted as a future event; the inspected interval begins at the following minute.

## `backend/simulator.py`

This module creates the synthetic weather world. It does not read physical sensors or retrieve a meteorological forecast.

### Module-level helpers

| Symbol | Purpose | Inputs and result |
|---|---|---|
| `solar_offset_hours(longitude)` | Estimates the offset between clock time and local solar time. | Longitude in degrees; returns an hour offset. |
| `daylight_fraction(solar_hour)` | Produces a normalized daylight curve for the light model. | Solar hour; returns a fraction used to scale clear-sky light. |
| `month_wetness(month, latitude, longitude)` | Chooses a seasonal wetness factor for the synthetic environment. | Calendar month and coordinates; returns a relative wetness factor. |

### `WeatherState`

A data structure for one generated simulation step. It carries the timestamp and environmental values used by downstream feature generation and display code. Inspect its declaration for the authoritative field names and types before changing the simulator output contract.

### `_System`

Represents one synthetic weather system and its lifecycle.

| Method | Responsibility |
|---|---|
| `__init__(kind, n0, lead, dur, strength, rains, amp_p, amp_h, outflow, bump, intensity)` | Stores the system's type, starting point, approach time, duration, intensity and signal parameters. |
| `onset()` | Determines the simulated onset point from the system's start and lead values. |
| `envelope(n)` | Calculates how strongly the system influences the environment at a given simulation minute. |
| `finished(n)` | Reports whether the system has passed its active period. |

### `SyntheticWeather`

The main weather generator. It owns its random-number generators, clock, geographic context, background conditions, active systems and selected scenario.

| Method | Responsibility |
|---|---|
| `__init__(seed=42, scenario='natural', start=None, latitude=..., longitude=...)` | Initializes a repeatable synthetic environment. A seed makes a run reproducible under the same code and inputs. |
| `_new_system(kind, ...)` | Creates and schedules a synthetic weather system using the supplied or generated parameters. |
| `_start_preset_system(kind, lead, strength, dur, rains=True)` | Starts a controlled system for a preset demonstration. |
| `_arrival_rate_per_min()` | Calculates the rate used when deciding whether a new system should form. |
| `set_scenario(scenario)` | Changes the active scenario behavior. Unknown identifiers should be checked against `SCENARIOS`. |
| `step()` | Advances the simulator by one minute and returns the resulting weather state. |

**Implementation note:** A scenario is a controlled synthetic condition, not a statement about actual weather at the selected coordinates. The selected location influences the synthetic climate context; it does not connect to a live weather provider.

## `backend/ml.py`

This module creates synthetic training sequences, fits classifiers and baselines, calibrates model probabilities, and evaluates both individual time points and complete warning events.

### Dataset preparation

| Function or class | Purpose |
|---|---|
| `simulate_sequence(seed, month, days=DAYS)` | Runs `SyntheticWeather` for the requested simulated period and returns minute-level raw readings in a DataFrame. |
| `Seq` | Holds one generated sequence: sequence index, month, raw data, computed features, future-wet labels and a validity mask. |
| `build_sequences(n_seq=len(SEQ_MONTHS), days=DAYS)` | Builds the independent sequences used in training, validation and testing. It computes features and labels, then marks rows that have complete inputs and outcomes and are currently dry. |
| `stack(seqs, stride=1)` | Combines valid rows from multiple sequences into NumPy feature and target arrays. A stride greater than one keeps only every nth valid row. |

### Models and probability calibration

| Function or class | Purpose |
|---|---|
| `Calibrated(model, iso)` | Wraps a fitted classifier and an isotonic calibration model. |
| `Calibrated.predict_proba(X)` | Gets the classifier's positive-class scores, calibrates them, and returns a two-column probability array. |
| `candidates()` | Creates the four candidate classifiers: Logistic Regression, Decision Tree, Random Forest and Gradient Boosting. |
| `fit_rule(Xtr, ytr)` | Searches a small set of pressure/humidity thresholds on the training data and returns a callable rule plus its chosen parameters. |

### Warning and event evaluation

| Function | Purpose |
|---|---|
| `warn_active(prob, wet, warn=WARN_DEFAULT, consec=CONSEC, refractory=30)` | Replays the application's warning rule over a probability sequence. It requires consecutive threshold crossings, avoids warnings while wet, and suppresses alerts during the post-rain refractory period. |
| `alert_eval(prob, wet, warn=..., min_lead=..., window=..., quiet_gap=...)` | Measures warning performance against rain onsets. It distinguishes caught, late and missed events and counts warning episodes and false alarms. |
| `merge_alert_evals(evals)` | Combines event-level results from multiple independent sequences and recalculates aggregate rates and median lead time. |

### Row-level metrics and training

| Function | Purpose |
|---|---|
| `row_metrics(y, prob, thr)` | Calculates threshold-based classification metrics, ranking metrics, Brier score and confusion matrix for a set of labeled rows. |
| `calibration_bins(y, prob, bins=10)` | Groups probabilities into intervals and compares average predicted probability with observed event frequency. Bins with too few examples are omitted. |
| `train_all(progress=None)` | Runs the complete training and evaluation workflow. It builds sequences, separates train/validation/test groups, fits candidate models, calibrates probabilities on validation data, evaluates on test data, and prepares comparison outputs. An optional callback receives progress updates as candidate models finish. |
| `explain(model, x, medians, top=3)` | Produces a compact explanation of influential input features by comparing the current row with a median/reference row. Review the implementation before interpreting the returned values as causal explanations. |

**Evaluation caution:** Row-level classification scores and event-level warning scores answer different questions. A strong score on individual minutes does not automatically mean the system issues useful warnings early enough for a person to act.

## `backend/main.py`

This is the FastAPI application. It owns the active in-process simulation, coordinates model startup, exposes HTTP endpoints and serves the built frontend when present.

### Live simulation manager

`Live` is the mutable runtime state holder.

| Method | Responsibility |
|---|---|
| `__init__()` | Establishes default seed, scenario, speed, running state and location, then initializes the simulation. |
| `reset(seed=None, scenario=None)` | Recreates the simulator, clears retained readings/probabilities, warms up the feature history and repopulates the current state. |
| `_advance(k)` | Advances `k` simulated minutes, stores readings, computes features and probabilities for the new rows, and refreshes the current feature explanation. |
| `apply_scenario(scenario)` | Applies a scenario. Preset scenarios can rewind to a stored point and replay a weather system so precursor conditions are visible; other scenarios are delegated to the simulator. |
| `tick()` | Advances by the configured speed only while the simulation is running. |

### Startup and shared-state functions

| Function | Responsibility |
|---|---|
| `_train_and_store()` | Trains all models, adjusts model parallelism for live single-row inference, saves the model bundle to the cache, updates shared readiness state and resets the live simulation. Errors are recorded in the shared store. |
| `_load_or_train()` | Loads a compatible cached model bundle when the stored scikit-learn version matches; otherwise starts training. |
| `_ticker()` | Runs the asynchronous background loop that waits for the configured tick interval and advances the live simulation under the shared lock. |
| `lifespan(app)` | Starts model loading/training and the ticker during application startup, then cancels the ticker during shutdown. |
| `_status()` | Builds the current status payload from the latest simulated reading, probability, model readiness, location, controls and feature drivers. Callers use the lock when accessing shared live state. |
| `build_prediction_reality(rows, probabilities, sensitivity='medium', limit=12)` | Compares predictions with the rain state observed during the following 30 minutes. It excludes rows whose future outcome window has not yet matured and returns counts, summary metrics and recent records. |
| `_preview()` | Builds and caches a small synthetic dataset sample for the dataset-preview endpoint. |

### HTTP route functions

The following names are route handlers. Their URL and HTTP method are the public interface; the Python function name is an implementation detail.

| Function | Route | What it does |
|---|---|---|
| `healthcheck()` | `GET /healthz` | Returns basic service and model-readiness status. |
| `frontend_root()` | `GET /` | Serves the built frontend index when present; otherwise returns API information. |
| `get_status()` | `GET /api/status` | Returns the current status snapshot while holding the live-state lock. |
| `change_scenario(payload)` | `POST /api/simulation/scenario` | Applies the requested scenario identifier. |
| `reset(payload=None)` | `POST /api/simulation/reset` | Resets the simulation with an optional seed and scenario. |
| `set_speed(payload)` | `POST /api/simulation/speed` | Changes the number of simulated minutes advanced per ticker cycle; the value is clamped to the supported range. |
| `pause(payload)` | `POST /api/simulation/pause` | Pauses or resumes the background simulation. |
| `prediction_vs_reality(sensitivity='medium', limit=12)` | `GET /api/ml/prediction-vs-reality` | Returns matured prediction-versus-reality comparisons using the selected sensitivity threshold. |
| `history(limit=500)` | `GET /api/history` | Returns recent synthetic readings with their aligned prediction probabilities. |
| `scenarios()` | `GET /api/simulation/scenarios` | Lists the scenario identifiers and labels exposed by the API. |
| `set_location(payload)` | `POST /api/location` | Validates and stores a location name and coordinates. A coordinate change resets the simulator so the new geographic context is applied. |
| `get_metrics()` | `GET /api/ml/metrics` | Returns stored training/evaluation metrics and model readiness, training, retraining and error state. |
| `get_features()` | `GET /api/ml/features` | Returns the feature names and their plain-language definitions. |
| `dataset_preview(limit=100)` | `GET /api/ml/dataset` | Returns a sampled synthetic dataset preview. |
| `retrain()` | `POST /api/ml/train` | Starts model retraining in a background thread when retraining is enabled; otherwise returns an HTTP 403 response. |
| `live_eval(minutes=1440)` | `GET /api/ml/live` | Evaluates the warning rule against the current simulation's recent history. Results can be noisy when the selected window is short. |
| `trace(minutes=180, warn=...)` | `GET /api/ml/trace` | Returns per-minute probabilities for selected models, sensor values, rain state, alert state and detected rain-event lead times. |
| `frontend_assets(asset_path)` | `GET /{asset_path:path}` | Serves a built frontend asset or falls back to the single-page application entry point. It is registered after API routes. |

### Internal constants worth knowing

| Constant | Role |
|---|---|
| `CACHE` | Location of the serialized model bundle under `backend/.cache/model.joblib`. |
| `TICK_SECONDS` | Real-time delay between background ticker cycles, configured by `ULAN_TICK_SECONDS`. |
| `LIVE_MODEL` | Candidate model used for the main live prediction stream. |
| `MAX_ROWS` | Maximum number of live rows and probabilities retained in memory. |
| `RAIN_AHEAD`, `PRESETS`, `PREROLL_MIN`, `WARMUP` | Control how selected demonstration presets are introduced and how much history is generated before display. |
| `ENABLE_RETRAIN` | Whether the public retraining endpoint is enabled, controlled by `ULAN_ENABLE_RETRAIN`. |
| `FRONTEND_DIST` | Built Vite frontend directory served by FastAPI. |
| `lock` | Re-entrant lock protecting shared mutable live and model state. |
| `store` | Shared in-process dictionary containing trained models, metrics, medians and training/readiness flags. |

## Practical change checklist

When modifying a Python function:

1. Check all callers before changing its arguments or return structure.
2. Check whether the function is used in both offline training and live inference.
3. Preserve the shared lock when reading or changing mutable live state in route handlers or background tasks.
4. Update the API guide if a route or response changes.
5. Update the algorithm guide if feature, label, training, calibration or evaluation behavior changes.
6. Run the backend test suite after the change.
