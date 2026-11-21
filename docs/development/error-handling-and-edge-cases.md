# Error Handling and Edge Cases

This document records edge cases that are visible in the current implementation and explains how the application responds. It is useful when changing API routes, frontend state handling, simulation controls, or model lifecycle behavior.

## 1. Model is not ready yet

**Situation:** the API has started, but the background worker has not loaded or trained a model.

**Current behavior:** `/api/status` includes `model_ready`; `/api/ml/metrics` includes readiness and training flags; `/api/ml/trace` returns `{ "model_ready": false }` until models are ready. Live probabilities can be unavailable/NaN internally before the model is loaded; status converts a NaN probability to `0.0` for its response.

**Contributor guidance:** do not infer readiness from HTTP success alone. Keep the readiness indicator visible and avoid presenting a placeholder zero as a meaningful model estimate when `model_ready` is false.

## 2. Model training fails

**Situation:** loading or training raises an exception.

**Current behavior:** the exception representation is stored in `store["error"]`; the metrics endpoint returns a user-safe training failure message. The code comments state that a previous model, if available, remains active. The training flag is cleared in the worker's `finally` block.

**Contributor guidance:** preserve useful server-side diagnostics while avoiding raw tracebacks in user-facing responses. If adding logging, avoid logging secrets or personal data.

## 3. Cached model is incompatible

**Situation:** a cache exists but was produced with a different scikit-learn version or cannot be loaded.

**Current behavior:** the loader rejects or skips the cache and proceeds to train a fresh model.

**Contributor guidance:** update cache serialization and loading together. Do not assume a cache file is portable across arbitrary dependency versions.

## 4. API request fails in the browser

**Situation:** the browser cannot reach `/api/status` or receives a non-success response.

**Current behavior:** `useDevice()` catches the failure and evaluates an offline-shaped state. The UI can display the offline state instead of continuing to present stale data as connected.

**Contributor guidance:** keep the last successful timestamp/freshness concept distinct from the current connectivity state. Avoid silently treating a failed request as a valid dry-weather observation.

## 5. Local offline demonstration mode

**Situation:** the user selects the `offline` scenario in the frontend.

**Current behavior:** `useDevice()` supplies a local offline state without calling the backend scenario endpoint. This is a frontend demonstration state, not proof that the backend or a physical sensor has actually disconnected.

**Contributor guidance:** retain wording that makes the demonstration nature clear. Do not use this local mode as a network outage test.

## 6. Unknown scenario identifier

**Situation:** a caller submits an unsupported scenario.

**Current behavior:** backend scenario logic falls back to `natural`; the scenario list endpoint exposes the supported identifiers. The frontend also checks its known scenario map before sending a request.

**Contributor guidance:** clients should populate controls from supported identifiers and handle a returned scenario that differs from the requested one.

## 7. Location coordinates are out of range

**Situation:** a location request contains latitude outside `-90..90` or longitude outside `-180..180`.

**Current behavior:** the route returns an application-level failure object with `ok: false` and a validation message. It does not raise an HTTP validation exception for this check.

**Contributor guidance:** inspect the response's `ok` field in addition to `response.ok`. A successful HTTP status does not necessarily mean the location was accepted.

## 8. Location is posted repeatedly with unchanged coordinates

**Situation:** the frontend posts its saved location on page load, or a user saves the same coordinates again.

**Current behavior:** the backend compares coordinates and avoids resetting the simulation when they are unchanged. It still updates the location metadata.

**Contributor guidance:** preserve this behavior so a routine page load does not unexpectedly restart a demonstration.

## 9. Prediction outcome is not mature

**Situation:** fewer than 30 simulated minutes have elapsed after a stored prediction.

**Current behavior:** prediction-versus-reality excludes the final 30 rows from completed evaluation and reports a pending count.

**Contributor guidance:** do not classify pending predictions as false positives or false negatives. Their outcome is not yet known.

## 10. Evaluation window is small

**Situation:** `/api/ml/live` evaluates a short section of simulation history.

**Current behavior:** the response includes a note that small windows are noisy.

**Contributor guidance:** avoid drawing strong conclusions from a small number of rain events. Report the window and sample size with metrics.

## 11. Retaining too much history

**Situation:** the simulation runs for a long time.

**Current behavior:** `live.rows` and `live.probs` are deques capped by `MAX_ROWS` (20,000). The history endpoint also caps requested rows at that retention limit.

**Contributor guidance:** features requiring long lookbacks must account for retained-history boundaries. Do not imply the in-memory history is permanent or unlimited.

## 12. Retraining is disabled or already active

**Situation:** a user requests retraining on a deployment where retraining is disabled, or while another training job is active.

**Current behavior:** disabled retraining returns HTTP 403. An already-running training job returns `ok: false` with a message indicating that training is already running.

**Contributor guidance:** disable the UI action or show a clear explanation when retraining is unavailable. Treat the in-progress response as a normal state, not an unexpected server failure.

## 13. Simulation speed is outside the supported range

**Situation:** a caller requests a speed below 1 or above 60.

**Current behavior:** the backend clamps the value to the inclusive range 1–60.

**Contributor guidance:** if the supported range changes, update the UI controls and API documentation together.

## 14. Frontend build is missing

**Situation:** the backend is running but `dist/index.html` does not exist.

**Current behavior:** `/` returns a small JSON description that indicates the frontend has not been built. The static asset catch-all returns HTTP 404 with a build-first message if no frontend build is available.

**Contributor guidance:** run the frontend production build before testing the packaged single-origin deployment. During development, use the Vite development server as documented in Getting Started.

## 15. Shared process state and multiple users

**Situation:** several browser sessions connect to one backend process.

**Current behavior:** they share the same `live` simulation, scenario, speed, location, and model store. The lock coordinates concurrent access within that process.

**Contributor guidance:** do not describe this as per-user isolation. If independent sessions become a requirement, the architecture will need session-scoped simulation state and a different lifecycle/storage design.

## General error-handling principles

1. Distinguish transport failure, application-level rejection, and a valid response that reports a not-ready state.
2. Do not convert missing or invalid data into a confident weather conclusion.
3. Keep synthetic-data provenance visible when reporting or exporting results.
4. Preserve enough server-side context to diagnose failures without exposing sensitive internals to end users.
5. When behavior changes, update the corresponding test, API contract, workflow, and this edge-case guide.
