# Source-Level Reference

This section is for contributors who need to move from the conceptual guides into the actual source code. It describes the callable functions, component interfaces, configuration values, and the places where behavior is coordinated.

The reference reflects the repository snapshot used to prepare this documentation. Line numbers are intentionally omitted because they change frequently; use the file paths and symbol names to locate the current implementation.

## Reference pages

- [Python function reference](python-functions.md) — backend functions and class methods, grouped by module.
- [Frontend component and utility reference](frontend-components.md) — React component props, hooks, helpers, and their responsibilities.
- [Configuration and environment reference](configuration.md) — environment variables, package scripts, constants, and local storage keys.

## How to read a function entry

Each entry identifies the source file, the function's role, its inputs, its output or side effects, and important behavior to preserve. A function's exact runtime behavior is determined by its implementation, not by this prose. When a function changes, update the corresponding entry in the same change where practical.
