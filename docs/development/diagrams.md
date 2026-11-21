# System Diagrams

These diagrams describe the current repository architecture. They use Mermaid syntax and can be rendered by many Markdown viewers, including GitHub.

## 1. Runtime architecture

```mermaid
flowchart LR
    U[User] --> UI[React interface]
    UI --> HOOK[useDevice hook]
    HOOK -->|GET /api/status| API[FastAPI backend]
    UI -->|History, settings and ML requests| API
    API --> LIVE[Live state manager]
    LIVE --> SIM[SyntheticWeather simulator]
    LIVE --> FEAT[Feature construction]
    FEAT --> MODEL[Calibrated ML model]
    MODEL --> LIVE
    SIM --> LIVE
    LIVE --> API
    API --> UI
```

The frontend requests data from the backend. The backend advances the synthetic environment, calculates features, obtains model output, and returns the latest state. The browser does not directly run the Python ML model.

## 2. Model development and inference flow

```mermaid
flowchart TD
    A[Seed and month configuration] --> B[Generate independent synthetic sequences]
    B --> C[Raw minute-level readings]
    C --> D[Compute historical features]
    C --> E[Create next-30-minute wet label]
    D --> F[Remove incomplete rows]
    E --> F
    F --> G[Split by sequence]
    G --> H[Training sequences]
    G --> I[Validation sequences]
    G --> J[Test sequences]
    H --> K[Fit candidate models and baselines]
    I --> L[Fit isotonic calibrators and choose validation threshold]
    K --> L
    L --> M[Evaluate once on test sequences]
    M --> N[Metrics, event evaluation, ablation and importance]
    O[Live synthetic readings] --> P[Same feature function]
    P --> Q[Active calibrated model]
    Q --> R[Probability and explanation drivers]
    R --> S[API status response]
```

The same feature-construction function is used for offline training and live inference. Validation data is used for calibration; test data is reserved for final reported evaluation.

## 3. Warning-state flow

```mermaid
flowchart TD
    A[Receive latest API status] --> B{API online?}
    B -- No --> OFF[Offline state]
    B -- Yes --> C{Rain plate wet?}
    C -- Yes --> RAIN[Raining state]
    C -- No --> D{Probability >= warning threshold?}
    D -- No --> E{Probability >= watch threshold?}
    E -- Yes --> WATCH[Watch state]
    E -- No --> SAFE[Safe state]
    D -- Yes --> F{Two consecutive frontend polls?}
    F -- No --> E
    F -- Yes --> G{Alert cooldown active or recently wet?}
    G -- Yes --> WATCH
    G -- No --> WARN[Warning state]
```

This is a simplified representation of the frontend state evaluation in `src/useDevice.js`. The backend event-evaluation rule is implemented separately in `backend/ml.py` and should be consulted when interpreting research metrics.

## 4. Prediction-versus-reality maturation

```mermaid
flowchart LR
    T[Prediction at simulated minute t] --> W[Wait for next 30 simulated minutes]
    W --> OBS[Inspect rain-plate wet observations in t+1 through t+30]
    OBS --> CLASS[Compare predicted class with observed outcome]
    CLASS --> CM[TP, FP, FN or TN]
    CM --> METRICS[Accuracy, precision, recall and F1]
```

The newest 30 prediction rows are pending because their observation windows have not elapsed. They should not be counted as correct or incorrect yet.

## 5. Source ownership map

| Concern | Main source |
|---|---|
| Application composition and navigation | `src/App.jsx` |
| API polling and frontend warning levels | `src/useDevice.js` |
| Overview composition | `src/components/HomeView.jsx` |
| Simulation state and API routes | `backend/main.py` |
| Synthetic weather behavior | `backend/simulator.py` |
| Feature definitions and target labels | `backend/features.py` |
| Training, calibration and evaluation | `backend/ml.py` |
```
