# Deploy Ulan Alert on Render (single service)

This project can run as one public Render Web Service. Docker builds the Vite frontend and packages it with FastAPI; FastAPI serves both the website and `/api/*` endpoints from the same origin.

## Deploy

1. Push this project to a GitHub repository.
2. Sign in to [Render](https://render.com/) and choose **New → Blueprint**.
3. Connect the repository containing `render.yaml`.
4. Review the `ulan-alert` web service and apply the Blueprint.
5. Wait for the first Docker build and deployment to finish.
6. Open the `onrender.com` URL shown on the service page.

The Blueprint selects Render's free instance type. Free services can spin down after inactivity, so the first visit after a quiet period may take a little while. The first boot also trains the ML models if no compatible model cache exists, so the model may initially show as not ready while training runs in the background.

## What the public demo does

- Visitors can open the app in a browser without installing anything or creating an account.
- The frontend and API share one origin and one deployment.
- The simulation is shared by all visitors. Changing the location, scenario, speed, pause state, or resetting it affects the same running simulation for everyone.
- Simulation history and the trained model cache are stored in the container's writable filesystem. On the free service, that filesystem is ephemeral; a restart or redeploy can clear the cache and reset the in-memory simulation. The model will be trained again when needed.
- Model retraining is disabled in the public deployment to prevent anonymous visitors from repeatedly starting CPU-intensive training jobs. Scenario selection and ordinary simulation controls remain available.

## Optional environment settings

These are already set by `render.yaml`:

| Variable | Default in Render Blueprint | Purpose |
|---|---:|---|
| `ULAN_ENABLE_RETRAIN` | `false` | Keep public model retraining disabled. Set to `true` only if you intentionally want to expose this operation. |
| `ULAN_TICK_SECONDS` | `2.0` | Interval between simulation ticks. |

`PORT` is supplied by Render automatically. Do not hard-code it in the dashboard.

## Verify the deployment

After deployment, open these URLs (replace the hostname with your service URL):

- `/` — Ulan Alert frontend
- `/healthz` — service health check
- `/api/status` — current synthetic simulation status
- `/api/ml/metrics` — model metrics and readiness state
- `/docs` — FastAPI interactive API documentation

The app is a synthetic simulation, not a live weather service or official forecast. Its model metrics describe performance on generated synthetic data, not field accuracy.

## Local development remains unchanged

Run the backend from `backend/` with `uvicorn main:app --reload --port 8000`, then run `npm run dev` from the project root. Vite continues to proxy `/api` requests to the local backend.
