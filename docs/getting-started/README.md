# Getting Started

This guide explains how to prepare a development environment and run Ulan Alert on a local computer. It assumes basic familiarity with opening a terminal and running commands, but explains what each step accomplishes.

## 1. What you need

Install the following before starting:

- **Python 3.10 or newer** for the FastAPI backend, weather simulator, and machine-learning code.
- **Node.js and npm** for the React frontend and Vite development server.
- **Git** if you plan to clone the repository or contribute changes.
- A modern browser such as Chrome, Edge, Firefox, or Safari.

The frontend and backend are separate processes during local development. The frontend provides the user interface; the backend provides the simulation and API responses.

## 2. Project layout at a glance

```text
ulan-alert/
├── backend/          Python API, simulator, ML implementation, and tests
├── src/              React application and interface components
├── docs/             Project documentation
├── package.json      Frontend dependencies and scripts
├── vite.config.js    Frontend development/build configuration
├── Dockerfile        Container build instructions
└── render.yaml       Render deployment configuration
```

For a more complete explanation, see [System architecture](../architecture/README.md).

## 3. Prepare the Python backend

Open a terminal in the repository and run:

```bash
cd backend
python -m venv .venv
```

A virtual environment keeps this project's Python packages separate from packages used by other projects.

Activate it:

**Windows PowerShell**

```powershell
.venv\Scripts\Activate.ps1
```

**macOS or Linux**

```bash
source .venv/bin/activate
```

Install the backend packages:

```bash
pip install -r requirements.txt
```

Start the API server:

```bash
uvicorn main:app --reload --port 8000
```

The `--reload` option restarts the development server when backend source files change. The API is available at `http://127.0.0.1:8000`; its interactive OpenAPI page is at `http://127.0.0.1:8000/docs`.

Keep this terminal open while using the application.

## 4. Prepare the frontend

Open a second terminal at the repository root (not inside `backend/`) and run:

```bash
npm install
npm run dev
```

Vite prints a local address, normally `http://localhost:5173`. Open that address in your browser. The repository's Vite configuration proxies `/api` requests to the local backend on port 8000.

## 5. Confirm that it is running

Check the following:

1. The frontend page loads in the browser.
2. The backend terminal shows no startup exception.
3. `http://127.0.0.1:8000/healthz` responds successfully.
4. `http://127.0.0.1:8000/api/status` returns a JSON status response.
5. The dashboard updates as the simulation advances.

If the interface reports that the service is offline, confirm that the backend is still running and that the browser is using the Vite development address.

## 6. Useful commands

| Command | Run from | Purpose |
|---|---|---|
| `npm run dev` | Repository root | Start the frontend development server |
| `npm run build` | Repository root | Create the production frontend build |
| `npm run preview` | Repository root | Preview a previously built frontend |
| `uvicorn main:app --reload --port 8000` | `backend/` | Start the Python API in development mode |
| `python -m unittest test_simulator test_main` | `backend/` | Run backend tests |

## 7. Common setup problems

### The frontend loads but shows Offline

The frontend can load independently of the API. Start the backend in a separate terminal and check `/api/status` directly.

### The browser cannot reach the API

Confirm the backend is listening on port 8000 and that Vite is running with the repository's `vite.config.js`. Avoid opening the built HTML file directly from the filesystem; use the development server or deployed service.

### Python packages fail to install

Check the Python version, activate the virtual environment, and retry the requirements installation. Do not install backend requirements into the frontend's Node environment.

### Port already in use

Another process may already be using port 8000 or 5173. Stop that process or adjust the relevant development-server configuration consistently.

## 8. Next steps

- Read [System architecture](../architecture/README.md) before changing application behavior.
- Read [Weather simulation](../simulation/README.md) before changing generated readings or scenarios.
- Read [Machine learning](../machine-learning/README.md) before changing model inputs, labels, or evaluation.
- Read [Operations](../operations/README.md) before deploying or modifying runtime configuration.
