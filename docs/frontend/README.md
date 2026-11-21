# Frontend Guide

## 1. Overview

The user interface is a React application built with Vite. It is designed to present the simulated weather state in a clear, responsive interface and to provide controls for settings and facilitated demonstrations.

The application should be understood as a view and interaction layer. The Python backend generates the weather records and performs the ML inference; the frontend does not independently generate meteorological observations.

## 2. Application shell

`src/App.jsx` is the main application shell. It coordinates the selected page, shared settings, language context, device state, notifications, and facilitator tools. It chooses which page component to render based on the active navigation tab.

The primary pages are:

- **Now / Overview:** current simulated conditions and the user-facing status.
- **History:** previously recorded simulated rain periods and related history information.
- **Settings:** preferences such as sensitivity, notifications, language, cover-control visibility, and location selection.
- **About:** an explanation of the application.
- **Help Center:** user guidance and explanations of statuses and controls.

The Research Lab is opened separately through the top navigation and contains facilitator-oriented model and simulation tools.

## 3. Device state and polling

`src/useDevice.js` defines the `useDevice` hook. It requests `/api/status` every two seconds and translates the backend response into frontend state. It also evaluates the user-facing status using the selected sensitivity thresholds.

The status levels include safe, watch, warning, raining, and offline. The hook requires two consecutive readings at or above the warning threshold before raising a warning. It avoids warning while the rain plate is wet or recently wet, and it supports a cooldown after the user acknowledges an alert.

The hook also supports a frontend offline demonstration state. This is a simulated UI condition; it does not physically disconnect a device.

## 4. Sensitivity settings

The current thresholds are defined in `useDevice.js`:

| Sensitivity | Watch threshold | Warning threshold |
|---|---:|---:|
| Low | 0.30 | 0.50 |
| Medium | 0.20 | 0.40 |
| High | 0.15 | 0.30 |

These thresholds operate on the calibrated probability returned by the backend. Higher sensitivity makes the interface more responsive to lower probabilities, which can also increase false warnings. Threshold changes should be evaluated against the warning behavior and should not be described as improving the underlying model itself.

## 5. Component organization

Reusable and page-level interface components are stored in `src/components/`. Important examples include:

| Component | Role |
|---|---|
| `HomeView.jsx` | Main Now/Overview page |
| `HistoryView.jsx` | History page |
| `SettingsView.jsx` | Settings interface |
| `AboutView.jsx` | About page |
| `HelpView.jsx` | Help Center |
| `ClotheslineVisualizer.jsx` | Visual representation of the clothesline state |
| `StatusCard.jsx` | Current status presentation |
| `FacilitatorPanel.jsx` | Research and demonstration controls |
| `ModelMonitor.jsx` | Live model and warning trace visualization |
| `PredictionReality.jsx` | Prediction-versus-outcome comparison |
| `SimulationInsights.jsx` | Simulation and model insights |
| `TerminalPanel.jsx` | Optional live event/terminal-style panel |
| `WeatherTrivia.jsx` | Informational trivia content |
| `LocationPicker.jsx` | Location selection interface |
| `ConfirmDialog.jsx` | Confirmation dialog |
| `Toast.jsx` | Short-lived feedback messages |

Before adding a component, check whether an existing component already owns the relevant behavior. Keep page composition in page components and reusable visual behavior in focused components where practical.

## 6. Language support

`src/lang.jsx` contains English and Filipino interface strings and the language context. Components should use the translation helper rather than embedding user-facing text in multiple places. When adding a visible label or message, add corresponding translations and preserve the existing interpolation convention for dynamic values.

## 7. Session logging

`src/sessionLog.js` records interaction events in memory during the current browser session. The facilitator interface can export those events as CSV. The log includes elapsed milliseconds, a local time label, an action, and a detail value.

This is session-level usability support. It is not a persistent analytics service, and the data should not be described as automatically uploaded to a central research database.

## 8. Styling and responsive behavior

Global styling is maintained in `src/index.css`. The interface supports desktop navigation and a mobile navigation layout, with responsive cards and controls. Keep mobile usability in mind when changing page structure: avoid excessive vertical stacking, tiny touch targets, and controls that become difficult to reach on narrow screens.

The current visual identity uses a dark midnight/navy palette with blue and cyan accents. Use original project assets and maintain adequate text contrast.

## 9. Frontend contribution guidance

- Keep API calls pointed at the relative `/api` path unless there is a documented reason to change it.
- Treat backend response values as data; handle offline and not-ready states explicitly.
- Do not hardcode simulated predictions in the interface when the backend is the source of truth.
- Keep user-facing strings in the language dictionary.
- Preserve keyboard access, visible focus states, accessible labels, and responsive layouts.
- When changing a state rule, update this guide and add or adjust tests where possible.
