# Development Reference

This section describes the repository at the source-code level. It is intended for contributors who need to trace a user-visible behavior to the React component, API route, simulator, or machine-learning code responsible for it.

## Documents

- [Frontend component reference](frontend-components.md)
- [Backend module and function reference](backend-modules.md)
- [Simulation and machine-learning algorithms](algorithms.md)
- [System diagrams](diagrams.md)
- [Documentation maintenance standard](documentation-standard.md)
- [Implementation decisions and rationale](design-decisions.md)
- [Error handling and edge cases](error-handling-and-edge-cases.md)

## How to use this section

Start with the component reference when changing the interface. Start with the backend reference when changing API behavior or simulated readings. Use the algorithm guide before changing feature construction, labels, training, calibration, or alert evaluation. Consult the diagrams when a change crosses more than one layer. Read the implementation decisions before changing shared runtime behavior, and check the edge-case guide when modifying error paths or readiness handling.

## Accuracy note

These documents describe the source snapshot used to prepare them. A code change can make documentation stale. Before relying on a detail, compare the cited file and function with the current branch. The project is simulation-oriented: generated weather readings and model results must not be described as live measurements or official forecasts.
