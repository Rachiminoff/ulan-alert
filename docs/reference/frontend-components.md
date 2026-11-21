# Frontend Component and Utility Reference

This page documents the React components and JavaScript helpers in `src/`. Component prop names below are taken from the current component declarations. Where a component receives a grouped object or callback, consult its caller for the exact shape passed at runtime.

## Application entry

### `src/main.jsx`

The browser entry point. It imports the global stylesheet and mounts the React application into the root element in `index.html`.

### `src/App.jsx` — `App()`

The top-level application component. It owns cross-page state, loads and saves preferences, creates the device hook, provides translation context, chooses the active page, and opens shared overlays such as the Research & Demo panel and terminal.

**Important helpers and state:**

- `DEFAULTS` defines initial user preferences, including alert sensitivity, sound, vibration, cover display, language, Full Moon theme and trivia visibility.
- `loadSettings()` reads `ulan-alert-settings` from browser storage and merges stored values with defaults. Invalid stored JSON falls back to defaults.
- `KEY` is the local-storage key used for application settings.

Keep state in `App` when multiple pages or global navigation need it. Prefer component-local state for a disclosure or interaction used only inside one component.

## Device hook

### `src/useDevice.js` — `useDevice(sensitivity)`

A custom React hook that connects the interface to the backend simulation API.

**Input:** `sensitivity`, expected to be `low`, `medium`, or `high`.

**Returned value:** An object containing the current normalized device/simulation state, selected scenario, `setScenario`, `pauseAlerts`, and a `demo` marker.

**Main responsibilities:**

- Poll `/api/status` every two seconds.
- Convert the API response into the state shape consumed by the interface.
- Mark the interface offline if the API request fails.
- Evaluate the client-side warning level using `THRESHOLDS` and consecutive above-threshold polls.
- Record status and scenario changes through `sessionLog.js`.
- Expose `setScenario(key)` to request a backend scenario and update local selection only after the server confirms it.
- Expose `pauseAlerts()` to apply a short local reminder cooldown.

**Exports:**

- `THRESHOLDS`: watch and warning probability thresholds for each sensitivity setting.
- `SCENARIO_KEYS`: supported frontend scenario keys.
- `useDevice`: the custom hook.

**Design boundary:** The hook decides the displayed warning level; the backend supplies the simulated readings and model probability. Do not duplicate this evaluation logic in individual display components.

## Main screen components

### `HomeView({ device, settings, notify, coverClosed, setCoverClosed })`

Composes the Now/Overview dashboard. It receives live device state and shared preferences from `App`, then displays the current status, optional trivia, model-driver explanation, clothesline visualization, sensor details, prediction-versus-reality results and simulation context.

- `device`: normalized state and actions returned by `useDevice`.
- `settings`: application preferences used to decide which optional UI elements are visible.
- `notify`: parent-provided feedback callback.
- `coverClosed`: current simulated cover state.
- `setCoverClosed`: parent-provided state setter.

The component also owns local interaction state such as confirmation dialogs and alert acknowledgement/snoozing. Keep the source as the authority for the exact event sequence.

### `StatusCard({ level, probability, thresholds, onAck, onSnooze, cooling, modelReady = true })`

Displays the current alert level and probability, plus threshold context and alert actions.

| Prop | Meaning |
|---|---|
| `level` | Current normalized state such as safe, watch, warning, raining or offline. |
| `probability` | Model-estimated probability supplied by the parent. |
| `thresholds` | Threshold information used for display. |
| `onAck` | Callback for acknowledging the current alert. |
| `onSnooze` | Callback for temporarily quieting repeated reminders. |
| `cooling` | Whether the alert cooldown is active. |
| `modelReady` | Whether the model is ready to provide predictions. |

The component presents state; it does not poll the backend or train models.

### `ClotheslineVisualizer({ closed, onToggle, disabled = false })`

Displays the clothesline and its cover state.

- `closed`: whether the cover is shown closed.
- `onToggle`: callback requested when the user attempts to change the cover state.
- `disabled`: prevents interaction when true.

The parent owns the actual state and may require confirmation before accepting a toggle.

### `WeatherTrivia()`

Displays an informational weather fact selected from the component's local fact list. It is a presentation-only feature; trivia is not sent to the model and does not affect warning decisions.

### `PredictionReality({ sensitivity = 'medium' })`

Requests matured prediction-versus-reality data from `/api/ml/prediction-vs-reality` and renders the outcome counts and evaluation metrics. Sensitivity is passed to the backend so the same probability threshold used by the interface can be applied to the comparison.

### `SimulationInsights({ scenario, location })`

Presents explanatory text and recent trends for the active synthetic scenario and selected location. It displays simulator context; it does not generate the weather or calculate the ML prediction.

## Research and demonstration components

### `FacilitatorPanel({ device, open, onClose, sensitivity })`

The Research & Demo panel. It receives the current device state, whether the panel is open, a close callback and the selected alert sensitivity. It groups research/demo controls and monitoring panels. The backend remains responsible for scenario generation, model training and evaluation calculations.

### `ModelMonitor({ sensitivity, open })`

Displays model traces and monitoring information. It uses the backend trace endpoint and supports the monitoring views defined in the component. `sensitivity` controls the relevant warning threshold context; `open` is used by the parent to control visibility/lifecycle behavior.

### `TerminalPanel({ onClose })`

Displays the project's terminal-style demonstration interface. `onClose` is the parent callback for closing the panel. Its command/action behavior is defined by the local `ACTIONS` mapping in the component; this is not a general operating-system shell.

## Other page and interface components

| Component | Interface | Responsibility |
|---|---|---|
| `HistoryView({ demo })` | Receives a `demo` mode flag. | Displays recent history and related explanatory state. Check its current fetch logic before changing the data source. |
| `SettingsView({ settings, update, notify, location, onLocationChange, onOpenTerminal, onToggleFullMoon })` | Receives preferences, update/notification callbacks, location and action callbacks. | Presents user preferences and location controls. |
| `LocationPicker({ location, onChange, notify })` | Receives the current location, change callback and notification callback. | Selects a location and persists the selected location through its helper. |
| `HelpView()` | No declared props. | Displays grouped help questions and answers; it owns which answer is expanded. |
| `AboutView()` | No declared props. | Presents project information and explanatory stages. |
| `ConfirmDialog({ title, body, onConfirm, onCancel })` | Receives dialog text and confirm/cancel callbacks. | Reusable confirmation prompt. |
| `Toast({ message, onDone })` | Receives message text and completion callback. | Displays temporary feedback. |

## Shared JavaScript modules

### `src/lang.jsx`

| Export | Purpose |
|---|---|
| `STR` | Translation-string dictionary. |
| `LangContext` | React context carrying the current language and translation function. |
| `useLang()` | Reads the current translation context from a component. |
| `makeT(lang)` | Creates the translation function for a selected language. |

When adding user-visible text, update the translation dictionary where the interface expects localization. Avoid adding a visible string in only one language without considering the existing language behavior.

### `src/sessionLog.js`

| Export | Purpose |
|---|---|
| `logEvent(action, detail='')` | Adds a timestamped interaction event to the in-memory session log and notifies subscribers. |
| `getRecentEvents(limit=80)` | Returns a limited set of recent events. |
| `subscribeToEvents(listener)` | Registers a listener for log changes and returns the unsubscribe behavior defined by the implementation. |
| `downloadLog()` | Exports the current session events as a downloadable CSV. |

The log is held in browser memory for the current page session. It is not a durable server-side audit log.

### `src/mockHistory.js`

Exports `HISTORY`, a predefined history object, and `fmt(h)`, a formatting helper. Check imports before assuming this mock data is used by the current live history page.

### `src/components/LocationPicker.jsx`

Exports `getSavedLocation()`, which reads the saved location from the `ulan-alert-location` browser storage key. If the value is missing or invalid, it returns the default location defined in the module. The component is the UI for changing that value.

## Styling and interaction guidance

- Global styles and component-specific classes are maintained in `src/index.css`; Tailwind utility classes are also used in JSX.
- Keep API polling and alert-level decisions in `useDevice`, not in display-only components.
- Keep parent-owned state in `App` or `HomeView` when more than one child needs it.
- Use the existing translation mechanism for visible strings.
- Preserve keyboard-operable controls and meaningful accessible labels when changing interactive UI.
- Test narrow mobile layouts as well as desktop layouts after modifying component structure or CSS.
