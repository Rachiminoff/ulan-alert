# Configuration and Environment Reference

This page collects the configuration points visible in the repository snapshot. It distinguishes environment variables, package scripts, and application constants so contributors know where a setting is controlled.

## Backend environment variables

| Variable | Default in source | Purpose |
|---|---|---|
| `ULAN_TICK_SECONDS` | `2.0` | Number of real seconds between background simulation ticker cycles. A tick advances the simulation by the configured simulation speed. |
| `ULAN_ENABLE_RETRAIN` | `true` | Enables the `POST /api/ml/train` endpoint when its value is one of `1`, `true`, `yes`, or `on` (case-insensitive). Other values disable it. |
| `ULAN_ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated browser origins allowed by the FastAPI CORS middleware. Each entry is stripped of surrounding whitespace. |

Set environment variables in the shell or deployment environment before starting the backend. `.env.example` is a reference file; the application code shown in this repository reads environment variables directly and does not itself load a `.env` file.

## Backend paths and runtime constants

| Name | Location | Purpose |
|---|---|---|
| `CACHE` | `backend/main.py` | Serialized model cache at `backend/.cache/model.joblib`. |
| `FRONTEND_DIST` | `backend/main.py` | Vite build output directory at the repository's `dist/` folder. |
| `LIVE_MODEL` | `backend/main.py` | Model selected for the main live probability stream (`Random Forest`). |
| `MAX_ROWS` | `backend/main.py` | Maximum number of recent readings and probabilities retained in memory (`20000`). |
| `HISTORY` | `backend/features.py` | Number of historical rows required for the longest feature calculation (`181`). |
| `HORIZON` | `backend/features.py` | Number of future minutes used for the supervised label (`30`). |
| `WARN_DEFAULT` | `backend/ml.py` | Default model warning threshold (`0.40`) used by the ML evaluation utilities. |
| `CONSEC` | `backend/ml.py` | Consecutive above-threshold minutes required by the replayed warning rule (`2`). |
| `MIN_LEAD` | `backend/ml.py` | Lead time used to classify an event warning as useful (`10` minutes). |
| `TRAIN_STRIDE` | `backend/ml.py` | Row sampling stride for fitting the training set (`3`). |

These are source constants rather than user-facing settings. Changing one can affect model evaluation, live behavior, or comparability with earlier results. Update the research and algorithm documentation when changing them.

## Frontend package scripts

The root `package.json` defines these scripts:

| Command | Purpose |
|---|---|
| `npm run dev` | Starts the Vite development server. |
| `npm run build` | Creates the production frontend bundle in `dist/`. |
| `npm run preview` | Serves the already-built Vite bundle for local preview. |

The frontend package uses React and React DOM, Vite, the React Vite plugin, Tailwind CSS tooling and Lucide React icons. Exact dependency versions and ranges are recorded in `package.json` and `package-lock.json`.

## Browser storage keys

| Key | Source | Stored information |
|---|---|---|
| `ulan-alert-settings` | `src/App.jsx` | User interface preferences such as sensitivity, sound, vibration, language, cover visibility and trivia visibility. |
| `ulan-alert-location` | `src/components/LocationPicker.jsx` | Selected location name, coordinates and source metadata. |

These values are stored in the current browser profile. Clearing site data or using another browser/device removes or changes the locally saved preferences; they are not a user account synchronized through the backend.

## Local development and deployment files

| File | Purpose |
|---|---|
| `.env.example` | Example environment configuration values. |
| `Dockerfile` | Container build instructions. |
| `render.yaml` | Render service configuration. |
| `RENDER_DEPLOYMENT.md` | Deployment instructions specific to Render. |
| `run-simulation.bat` | Windows helper for starting the local simulation workflow. |
| `vite.config.js` | Vite development/build configuration, including the frontend development setup. |
| `backend/requirements.txt` | Python backend dependencies. |

For deployment changes, read the deployment guide and inspect the deployment manifest together. Do not assume a local development setting is automatically used in production.

## Changing configuration safely

1. Identify whether the setting is an environment variable, source constant, browser preference or deployment setting.
2. Search for every reference before changing its name or meaning.
3. Update `.env.example` or the relevant documentation when an environment variable changes.
4. Update the API, operations and research documentation if the setting changes externally visible behavior or evaluation results.
5. Verify the local development and deployment paths separately.
