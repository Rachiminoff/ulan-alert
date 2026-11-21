# Operations and Maintenance

## 1. Environments

Ulan Alert has two primary ways to run:

- **Local development:** Vite serves the React frontend and FastAPI runs separately.
- **Hosted deployment:** the included Docker configuration builds the frontend and runs FastAPI as a single service. The frontend and API share one public origin.

The repository includes `Dockerfile`, `render.yaml`, `.dockerignore`, and `RENDER_DEPLOYMENT.md` for the hosted deployment path. Consult the deployment file for platform-specific setup steps.

## 2. Environment configuration

`.env.example` documents environment variables used by the project. Copy values into the environment appropriate for the local shell or hosting platform; do not commit secrets.

One important setting is `ULAN_ENABLE_RETRAIN`. Setting it to `false` disables public model retraining. The hosted configuration uses this safeguard so anonymous visitors cannot repeatedly trigger an expensive training job. Local development retains the existing behavior unless the variable is configured otherwise.

The exact variables and defaults should be checked against `.env.example`, `backend/main.py`, and the deployment configuration before changing them.

## 3. Deployment behavior and shared state

The deployed application runs as a shared service. Visitors interact with the same backend process and therefore the same in-memory simulation. Resetting the simulation, selecting a scenario, changing location, pausing, or changing speed can affect all visitors using that instance.

The deployment filesystem may be ephemeral. A restart or redeploy can remove cached model files and in-memory history. Do not assume that generated history or a trained model cache is permanently retained unless persistent storage has been explicitly configured.

## 4. Health checks

The `/healthz` endpoint provides a basic service health response for the hosting platform. A successful health check confirms that the application process can answer the request; it does not prove that the model is accurate or that the simulation is producing scientifically validated data.

For a more complete manual check, inspect `/api/status`, `/api/simulation/scenarios`, and `/api/ml/metrics` after deployment.

## 5. Running tests

From the backend directory, activate the project's Python virtual environment and run:

```bash
python -m unittest test_simulator test_main
```

The simulator tests protect weather-generation behavior. The main API tests cover service behavior and selected integration safeguards. Run the frontend production build from the repository root:

```bash
npm run build
```

A successful build checks that Vite can compile the frontend; it does not replace browser-based testing of the user experience.

## 6. Suggested regression checks

After changing the simulator or backend, verify:

1. The service starts without exceptions.
2. `/api/status` returns a valid response.
3. The scenario list contains the expected presets.
4. Selecting a scenario changes the active simulation as expected.
5. Pause, resume, speed, reset, and location controls behave correctly.
6. The ML status becomes ready after sufficient history is available.
7. Research endpoints return data and handle empty or warming-up periods safely.

After changing the frontend, verify:

1. All navigation destinations render.
2. The Now page handles safe, watch, warning, raining, and offline states.
3. Settings changes are reflected in the interface.
4. Mobile navigation and page layouts remain usable.
5. English and Filipino labels are present for new user-facing text.
6. Browser console and network panel show no unexpected errors.

## 7. Troubleshooting

### Service starts but model is not ready

The model may still be training or the live history may not yet contain enough rows for the longest feature window. Check backend logs and `/api/status` before assuming that the model has failed.

### Retraining endpoint is unavailable

Check `ULAN_ENABLE_RETRAIN` in the active environment. Hosted deployments intentionally disable anonymous retraining by default.

### History disappears after restart

The current history is in memory. Its disappearance after process restart is expected unless durable storage is added.

### Scenario changes affect other visitors

This is expected for a single shared backend instance. The current deployment does not isolate each visitor into a separate simulation session.

### Frontend route or asset returns an error

Confirm that the frontend build completed and that the deployment serves the generated assets. In local development, use the Vite URL rather than opening the HTML file directly.

## 8. Maintenance principles

- Keep dependencies and deployment settings documented when they change.
- Do not commit credentials, tokens, or private environment files.
- Preserve the separation between synthetic simulation and real sensor integration.
- Update API documentation when endpoints or payloads change.
- Run backend tests and a frontend build before considering a change complete.
- Treat model metrics as tied to the exact simulator and evaluation protocol used to produce them.
