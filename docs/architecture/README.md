# System Architecture

## 1. Purpose

Ulan Alert is organized as a browser-based interface backed by a Python service. The backend advances a synthetic weather simulation, maintains recent readings, runs the machine-learning prediction pipeline, and exposes results through HTTP endpoints. The frontend requests those results and turns them into status information, visualizations, settings, and demonstration controls.

This is a software prototype. The architecture imitates parts of an IoT data flow, but the current repository does not communicate with physical IoT hardware.

## 2. Main parts

### Frontend: React and Vite

The frontend lives in `src/`. React components render the pages and interface elements. Vite provides the development server and creates the optimized static frontend build.

The main application is `src/App.jsx`. It coordinates navigation, settings, language context, the device-state hook, notifications, and the facilitator/research interface. Page-specific components are kept in `src/components/`.

### Backend: FastAPI

The backend lives in `backend/`. `main.py` creates the FastAPI application, manages the running simulation, loads or trains the ML model, and exposes the HTTP API. It is also responsible for serving the built frontend in the single-service deployment configuration.

### Weather simulator

`backend/simulator.py` generates weather-like minute-by-minute records. It models approaching weather systems and their effects on pressure, humidity, temperature, light, and rain-plate state. The simulator is designed to create precursor patterns that can occur before rain, while retaining variation and false-warning-like conditions.

### Feature engineering and ML

`backend/features.py` transforms recent sensor history into the feature columns used by the model. `backend/ml.py` creates simulated training sequences, trains candidate classifiers, calibrates probabilities, and calculates evaluation metrics.

## 3. Data flow

The normal dashboard flow is:

1. The Python simulation advances and produces a new weather state.
2. The backend records the state in its in-memory history.
3. The backend derives model features from recent history and obtains a rain probability when the model is ready.
4. The frontend periodically requests `/api/status`.
5. The frontend interprets the response and displays the current state, probability, readings, and supporting information.
6. User actions such as choosing a scenario or changing simulation speed are sent to backend control endpoints.

The frontend's `useDevice` hook polls `/api/status` every two seconds. This is a UI polling interval; the simulator's own clock and speed determine how quickly simulated time advances.

## 4. Warning state versus model probability

A model probability is not identical to a warning state. The backend supplies the probability and rain status. The frontend's `useDevice` hook applies the selected sensitivity thresholds and state rules to determine whether the interface should show safe, watch, warning, raining, or offline.

The warning rule requires the probability to meet the warning threshold on two consecutive polls, and it avoids issuing a warning while the plate is wet or during the relevant recent-wet period. The hook also maintains a short alert cooldown after acknowledgement. This separation allows the model score to be inspected independently from the user-facing status.

## 5. Runtime and persistence

The running simulation and its recent history are held in process memory. The model can be cached under `backend/.cache` when training is enabled. Browser session interaction events are held in the current page session and can be exported as CSV.

This has operational consequences:

- A backend restart resets in-memory simulation state and history.
- A deployment restart may remove an ephemeral model cache, depending on the hosting filesystem.
- A single shared deployment has one shared running simulation; visitor actions that control it can affect other visitors.
- Browser session logs are not a durable, centralized research database.

## 6. Deployment shape

For local development, Vite and FastAPI run as separate processes. For the included Render deployment, the Docker image builds the frontend and runs FastAPI as the single public service. FastAPI serves the frontend assets and API routes from the same origin. See [Operations](../operations/README.md).

## 7. Source map

| Path | Responsibility |
|---|---|
| `src/App.jsx` | Application shell, navigation, shared state and page selection |
| `src/components/` | Page views and reusable interface components |
| `src/useDevice.js` | API polling and user-facing status evaluation |
| `src/lang.jsx` | English and Filipino interface strings |
| `src/sessionLog.js` | In-session interaction event collection and CSV export |
| `backend/main.py` | FastAPI app, simulation lifecycle, endpoints, static frontend serving |
| `backend/simulator.py` | Synthetic weather generation |
| `backend/features.py` | Shared feature engineering and future-wet target helper |
| `backend/ml.py` | Dataset creation, model training, calibration and evaluation |
| `backend/test_*.py` | Backend regression tests |

## 8. Design boundaries

The simulator is the source of environmental readings in this version. The model estimates a defined future rain-plate state from those readings. The frontend presents the estimate and applies interface-level warning behavior. Do not describe this data path as live sensor telemetry, a real meteorological forecast, or a deployed physical clothesline controller.

## Detailed architecture references

- [Application workflows](workflows.md) — sequence diagrams for startup, polling, scenario changes, evaluation, location changes, and retraining.
- [Core data model](data-model.md) — weather rows, features, labels, model store, frontend state, and session events.
- [Implementation decisions](../development/design-decisions.md) — rationale and trade-offs visible in the current source.
