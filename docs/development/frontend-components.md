# Frontend Component Reference

## 1. Application entry and composition

The frontend is a React application built with Vite. Its package manifest declares React and React DOM, Vite, the React Vite plugin, Tailwind CSS tooling, and Lucide React icons.

### `src/main.jsx`

This is the browser entry point. It mounts the React application into the HTML document. Global styling is supplied by `src/index.css` and the application tree is rooted in `App`.

### `src/App.jsx`

`App` is the application shell and central coordinator. It:

- Loads user preferences from browser `localStorage` under the key `ulan-alert-settings` and merges them with defaults.
- Maintains the active navigation tab and global interface state such as toast messages, Research Lab visibility, location, terminal visibility, and the clothesline cover state.
- Creates the device state through `useDevice(settings.sensitivity)`.
- Provides translation context through `LangContext` and `makeT`.
- Renders the desktop sidebar, mobile navigation, page heading, location strip, active page, Research Lab panel, toast, and optional terminal.
- Sends the selected location to the backend through `/api/location`.

The application tabs are Overview (`now`), Weather history, Settings, About, and Help. The Research Lab is opened separately through `FacilitatorPanel`; it is not one of the primary navigation tabs.

## 2. Device state and polling

### `src/useDevice.js`

`useDevice(sensitivity)` is the frontend's bridge to the simulation API. It polls `/api/status` every two seconds and normalizes the response into the state consumed by the interface.

It also owns the client-side alert-level decision. The current threshold table is:

| Sensitivity | Watch threshold | Warning threshold |
|---|---:|---:|
| Low | 0.30 | 0.50 |
| Medium | 0.20 | 0.40 |
| High | 0.15 | 0.30 |

A warning requires the probability to meet or exceed the selected warning threshold for two consecutive polls. A warning is suppressed while the plate is wet and during the client-side cooldown. A current rain-plate wet state takes precedence and produces the `raining` level. If the API cannot be reached, the state becomes `offline`.

The hook exposes `setScenario` to request a simulator scenario, and `pauseAlerts` to apply a short client-side alert cooldown. The hook's `demo: true` marker and simulator responses reinforce that this is a demonstration system, not a physical sensor connection.

## 3. Overview components

### `src/components/HomeView.jsx`

`HomeView` composes the Now/Overview screen. It currently renders:

1. Connection or offline status.
2. Optional weather trivia, controlled by `settings.showTrivia`.
3. `StatusCard` for the current rain-warning state and probability.
4. A short explanation from model drivers when the level is watch or warning.
5. `ClotheslineVisualizer` when the cover setting is enabled.
6. Expandable sensor details, including pressure, humidity, temperature, and light.
7. `PredictionReality` for matured prediction outcomes.
8. `SimulationInsights` for the selected scenario and location.

The sensor detail disclosure is intentionally collapsed initially. The component also handles alert acknowledgement/snoozing and confirmation before changing the clothesline cover simulation state.

### `StatusCard.jsx`

Presents the current state, probability, threshold context, model readiness, and available acknowledgement/snooze actions. It is a presentation component; the polling and state evaluation occur in `useDevice`.

### `WeatherTrivia.jsx`

Displays a trivia item. Visibility is controlled by the application setting. Trivia is informational and is not an input to the precipitation model.

### `ClotheslineVisualizer.jsx`

Renders the clothesline/cover interaction when the corresponding setting is enabled. The parent `HomeView` owns the cover state and confirmation dialog.

### `ConfirmDialog.jsx`

Reusable confirmation interface used before changing the simulated cover state.

### `PredictionReality.jsx`

Requests `/api/ml/prediction-vs-reality` and presents prediction outcomes after their 30-minute observation window has elapsed. Its sensitivity value determines which probability threshold is used to classify a prediction as positive.

### `SimulationInsights.jsx`

Displays contextual information about the active simulation scenario and selected location. Scenario generation and weather-state updates are performed by the backend, not by this component.

## 4. Other interface components

| Component or module | Responsibility |
|---|---|
| `HistoryView.jsx` | Fetches `/api/history`, groups consecutive wet readings into rain periods, and displays recent readings. The current backend does not provide a separate yesterday archive. |
| `SettingsView.jsx` | Presents preferences and settings callbacks supplied by `App`. |
| `LocationPicker.jsx` | Handles saved location selection and location-related UI. `App` sends the selected coordinates/name to the backend. |
| `FacilitatorPanel.jsx` | Hosts the Research Lab experience and its research-oriented panels. |
| `ModelMonitor.jsx` | Presents model monitoring information using backend ML endpoints. |
| `TerminalPanel.jsx` | Provides the in-app terminal-style interface used by the project. |
| `HelpView.jsx` | Presents user-facing help. |
| `AboutView.jsx` | Presents project information. |
| `Toast.jsx` | Displays transient application feedback. |
| `PredictionReality.jsx` | Displays matured prediction-versus-observation results. |

## 5. Shared utilities

### `src/lang.jsx`

Contains the translation strings, `LangContext`, `useLang`, and `makeT`. Components use `useLang()` to access the current language and translation function. When adding visible text, follow the existing translation structure instead of hard-coding text in only one language where localization is expected.

### `src/sessionLog.js`

Maintains an in-memory list of interaction events for the current page session. `logEvent(action, detail)` adds an event, `getRecentEvents(limit)` returns recent events, `subscribeToEvents(listener)` registers a listener, and `downloadLog()` exports the log. This is session-level browser logging, not a persistent server audit database.

### `src/mockHistory.js`

Contains predefined history data and a formatting helper. The current `HistoryView` fetches the backend history endpoint; do not assume this mock data is the source of the live history display without checking its current imports and use.

### `src/useDevice.js`

Also exports the scenario definitions and threshold constants used by the interface.

## 6. Styling and accessibility

`src/index.css` contains global styling and custom application styles. Tailwind utility classes are also used directly in JSX. Prefer the existing styling approach when editing a component, and verify both desktop and narrow mobile layouts.

Use semantic elements and accessible attributes already present in the interface, such as button labels, `aria-expanded`, `aria-selected`, and dialog roles. Interactive controls should remain keyboard-operable and have visible focus treatment.

## 7. Change guidance

- Keep API polling and alert-state logic in the device hook rather than duplicating it in individual visual components.
- Keep presentation components focused on rendering and user interaction.
- Keep global settings in `App` when multiple pages need them; keep local disclosure/dialog state inside the component that owns that interaction.
- When changing a displayed status, inspect both the backend response and the `useDevice` state mapping.
- When changing a prediction metric, inspect `PredictionReality`, the corresponding API endpoint, and the backend evaluation function together.
