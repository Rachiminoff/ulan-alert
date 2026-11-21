# API Reference

The backend is a FastAPI application. During local development, its base address is `http://127.0.0.1:8000`. The interactive API schema is available at `/docs` while the service is running.

The API is used by the React frontend and by the Research Lab interface. Responses are JSON unless otherwise noted.

## Endpoint summary

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/healthz` | Basic service health check |
| `GET` | `/api/status` | Current simulation state and live prediction information |
| `GET` | `/api/history` | Recent simulated sensor records |
| `POST` | `/api/simulation/scenario` | Change the active simulation scenario |
| `POST` | `/api/simulation/reset` | Reset simulation state |
| `POST` | `/api/simulation/speed` | Change simulation speed |
| `POST` | `/api/simulation/pause` | Pause or resume the simulation clock |
| `GET` | `/api/simulation/scenarios` | List available scenario presets |
| `POST` | `/api/location` | Update the simulation location |
| `GET` | `/api/ml/metrics` | Retrieve model evaluation metrics |
| `GET` | `/api/ml/features` | Retrieve feature names and descriptions |
| `GET` | `/api/ml/dataset` | Preview generated dataset records |
| `POST` | `/api/ml/train` | Request model retraining when enabled |
| `GET` | `/api/ml/live` | Evaluate model behavior on the running simulation |
| `GET` | `/api/ml/trace` | Retrieve a time-series trace for model and alert monitoring |
| `GET` | `/api/ml/prediction-vs-reality` | Compare prior predictions with subsequent rain-plate outcomes |

## Endpoint details

### `GET /healthz`

Returns a simple health response used by deployment platforms to check whether the service is responding. It is not a full diagnostic of model quality or simulation correctness.

### `GET /api/status`

Returns the current simulation status. The response includes the current rain state, sensor readings, model probability and readiness information, scenario, timestamp, location, and supporting model-driver information where available. This is the primary endpoint polled by the dashboard.

### `GET /api/history?limit=500`

Returns recent simulated records. The `limit` query parameter controls how many recent rows are requested. The default is 500. The endpoint is intended for the history view and related visualizations, not as permanent archival storage.

### `POST /api/simulation/scenario`

Changes the active scenario. The request body contains a `scenario` identifier matching one of the supported simulator scenarios. The response confirms the selected scenario when successful. Use `GET /api/simulation/scenarios` to discover the current list rather than assuming a preset exists.

### `POST /api/simulation/reset`

Resets the simulation. The request may include reset options such as a seed or scenario, depending on the current implementation. Check the FastAPI schema or `backend/main.py` before building an external client that depends on optional request fields.

### `POST /api/simulation/speed`

Changes the rate at which simulated time advances. The request body supplies the requested speed. The Research Lab uses this control for demonstrations and replay-like observation; it does not change the real passage of wall-clock time.

### `POST /api/simulation/pause`

Pauses or resumes the simulation clock using the request body's pause state. A paused simulation should stop advancing simulated weather while the service remains available.

### `GET /api/simulation/scenarios`

Returns the supported scenario presets and related descriptive information for the facilitator controls.

### `POST /api/location`

Updates the coordinates and location metadata used by the simulator. This changes simulation inputs such as solar timing and climate profile. It does not request a live forecast or retrieve live sensor observations.

### `GET /api/ml/metrics`

Returns offline evaluation results produced by the ML training/evaluation pipeline, including model comparisons and supporting metrics. These results are based on synthetic sequences.

### `GET /api/ml/features`

Returns the feature definitions used by the machine-learning pipeline. The feature implementation itself is maintained in `backend/features.py`.

### `GET /api/ml/dataset?limit=100`

Returns a limited preview of generated dataset records. The default preview limit is 100. This is a preview endpoint, not a complete dataset export facility.

### `POST /api/ml/train`

Requests model retraining. Training may take tens of seconds. Public deployment configuration can disable this endpoint through `ULAN_ENABLE_RETRAIN=false`; do not assume retraining is available in every environment.

### `GET /api/ml/live?minutes=1440`

Evaluates model behavior over a window of the running simulation. The `minutes` parameter controls the requested duration, with a default of 1440 minutes.

### `GET /api/ml/trace?minutes=180&warn=...`

Returns a time-series trace used by the Research Lab's live model monitor. It includes model scores and alert-related context for the requested interval. The `minutes` parameter selects the trace window; `warn` supplies the warning threshold used for the trace evaluation.

### `GET /api/ml/prediction-vs-reality`

Builds a comparison between earlier predictions and the rain-plate outcome in the following period. The `sensitivity` parameter selects the warning sensitivity, and `limit` controls the number of comparison items returned.

## API usage notes

- The frontend uses the relative `/api` path. In local development, Vite proxies it to FastAPI; in the single-service deployment, the same origin serves both frontend and API.
- Simulation history is held in memory and can be cleared by a process restart or reset.
- The API is a demonstration interface, not a public weather-data API.
- For exact request and response schemas, use the running FastAPI OpenAPI page. This document explains endpoint intent and avoids duplicating schema details that may change with implementation.

## Detailed contracts

See [API contracts and examples](contracts-and-examples.md) for representative request and response bodies, query parameters, readiness behavior, and error cases. The running FastAPI service also exposes its generated interactive reference at `/docs`.
