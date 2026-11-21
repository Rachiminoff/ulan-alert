# Application Workflows

This guide follows the main operations through the current code. It is intended to help contributors understand which component initiates an action, which component performs it, and where the resulting state is used.

## 1. Application startup and model readiness

```mermaid
sequenceDiagram
    participant Browser
    participant FastAPI
    participant Lifespan as FastAPI lifespan
    participant Worker as Training/loading thread
    participant Cache as Model cache
    participant Simulator

    Browser->>FastAPI: Request application / API
    FastAPI->>Lifespan: Start application lifespan
    Lifespan->>Worker: Start _load_or_train()
    Lifespan->>FastAPI: Start background ticker
    Worker->>Cache: Check cached model bundle
    alt Compatible cache exists
        Cache-->>Worker: Models, metrics, medians
    else Cache missing or incompatible
        Worker->>Worker: Run ml.train_all()
        Worker->>Cache: Save model bundle
    end
    Worker->>Simulator: Reset live simulation after model becomes ready
    Browser->>FastAPI: GET /api/status
    FastAPI-->>Browser: model_ready and current simulation status
```

The HTTP service can start before model training finishes. During that interval, status and metrics responses should be interpreted using their readiness fields. A successful HTTP response does not itself prove that inference is ready.

## 2. Background simulation tick and browser polling

```mermaid
sequenceDiagram
    participant Ticker
    participant Live as Live simulation
    participant Features as compute_features()
    participant Model as Random Forest
    participant Browser
    participant API as GET /api/status

    loop Every TICK_SECONDS
        Ticker->>Live: tick()
        Live->>Live: Generate one or more simulated minute(s)
        Live->>Features: Build rolling feature rows
        Features-->>Live: Feature values
        opt Model is ready and features are valid
            Live->>Model: predict_proba()
            Model-->>Live: Rain probability
        end
        Live->>Live: Store rows, probabilities and drivers
    end
    loop Browser polling interval
        Browser->>API: Request current status
        API->>Live: Read latest state under lock
        Live-->>API: Snapshot
        API-->>Browser: JSON status
        Browser->>Browser: Evaluate UI alert level
    end
```

The ticker, not the browser, advances the simulation. Browser polling only reads the latest snapshot. This is why opening additional tabs should not make the simulation advance faster.

## 3. Scenario selection

```mermaid
sequenceDiagram
    participant User
    participant UI as Frontend scenario control
    participant Hook as useDevice()
    participant API
    participant Live
    participant Generator as SyntheticWeather

    User->>UI: Select a scenario
    UI->>Hook: setScenario(key)
    Hook->>API: POST /api/simulation/scenario
    API->>Live: apply_scenario(identifier)
    Live->>Generator: Set or construct scenario conditions
    Generator-->>Live: Updated synthetic environment
    API-->>Hook: Confirm selected scenario
    Hook->>Hook: Reset local alert counters
    Hook-->>UI: Update selected scenario state
```

The frontend waits for the backend to confirm the scenario before committing the new selection for API-backed scenarios. The special `offline` demonstration state is handled locally by `useDevice()` and does not post a scenario to the backend.

## 4. Prediction compared with later reality

```mermaid
flowchart TD
    A[Generate one simulated minute] --> B[Calculate past-only features]
    B --> C[Model produces probability]
    C --> D[Store probability with timestamp]
    D --> E[Allow next 30 simulated minutes to elapse]
    E --> F[Check whether rain occurred in that window]
    F --> G[Compare probability with selected threshold]
    G --> H[Assign TP, FP, FN or TN]
    H --> I[Update aggregate metrics and recent records]
```

The final 30 rows are pending because their full outcome windows have not elapsed. They are intentionally excluded from completed prediction-versus-reality counts. This avoids marking a prediction as incorrect merely because the simulation has not yet had time to reveal its outcome.

## 5. Location change

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant Live
    participant Generator

    User->>Frontend: Choose a location
    Frontend->>API: POST /api/location with name and coordinates
    API->>API: Validate latitude and longitude ranges
    alt Coordinates invalid
        API-->>Frontend: ok=false and validation message
    else Coordinates valid and changed
        API->>Live: Store location and reset simulation
        Live->>Generator: Create generator with new coordinates
        API-->>Frontend: ok=true, reset=true
    else Coordinates unchanged
        API->>Live: Update location metadata without reset
        API-->>Frontend: ok=true, reset=false
    end
```

The location is an input to the synthetic generator. It does not initiate a request to a live weather provider.

## 6. Retraining

A retraining request is accepted only when `ULAN_ENABLE_RETRAIN` is enabled. The endpoint checks whether training is already active, starts a worker thread, and returns without waiting for the full training process. When training succeeds, the model bundle is saved and the in-memory model store is updated. The live simulation is reset so subsequent inference uses the newly trained model.

## Workflow maintenance notes

- Keep the ticker as the owner of simulation progression.
- Keep GET handlers observational; do not add hidden state advancement to read routes.
- Keep feature calculations shared between training and inference.
- Preserve the 30-minute maturation delay in prediction-versus-reality evaluation unless the research target itself changes.
- Ensure scenario and location actions update both backend state and frontend state consistently.
- Treat model readiness and API connectivity as separate conditions.
