# Documentation Maintenance Standard

## 1. Purpose

This standard keeps repository documentation accurate, approachable, and useful to future contributors. Documentation is part of the software: when behavior changes, the relevant explanation should be reviewed in the same work item.

## 2. Audience and tone

Write for a reader who may understand basic programming but may not know this project's internal design or machine-learning terminology.

- Use a formal, neutral, helpful tone.
- Prefer plain language without removing technical accuracy.
- Explain an unfamiliar term the first time it appears.
- Define acronyms before relying on them.
- Avoid promotional claims such as “highly accurate,” “real-time forecasting,” or “intelligent” unless the code and evaluation support the claim.
- Distinguish what the system does from what it is intended to do.

## 3. Explain purpose, behavior, and boundaries

For each significant module, component, endpoint, or algorithm, answer as many of these questions as are relevant:

1. **Purpose:** Why does this part exist?
2. **Responsibility:** What work does it own?
3. **Inputs:** What information does it receive?
4. **Process:** What important steps does it perform?
5. **Outputs:** What does it return, display, or change?
6. **Dependencies:** Which other modules or services does it rely on?
7. **Failure behavior:** What happens when input, a request, or a dependency is unavailable?
8. **Limitations:** What should a reader not assume it can do?

Do not merely paraphrase each line of code. Explain the design reason or the behavior that a maintainer needs to understand.

## 4. Documenting Python modules

For each backend module, include:

- Module purpose and its place in the architecture.
- Important classes and their state/responsibilities.
- Public or significant functions, including their parameters, return values, side effects, and important assumptions.
- How errors and invalid inputs are handled.
- Concurrency or shared-state considerations where applicable.
- Related tests.

For functions, document non-obvious behavior and contracts. Avoid repeating a function signature without explaining its meaning.

## 5. Documenting React components

For each significant component or hook, describe:

- What the user sees or what state it manages.
- Props and callbacks that affect behavior.
- Local state versus state owned by a parent.
- API calls or context dependencies.
- Important conditional rendering and loading/error/offline behavior.
- Accessibility considerations for interactive controls.

Do not claim a component calls an API unless the source confirms it. Distinguish data fetching from data presentation.

## 6. Documenting APIs

Each endpoint entry should state:

- HTTP method and path.
- Purpose.
- Query parameters or JSON body fields.
- Important validation and default values.
- Successful response shape, with a minimal example where stable.
- Relevant error responses.
- Whether the endpoint reads or mutates simulation state.

Examples must be copied from or checked against the current implementation. Do not invent response properties for readability.

## 7. Documenting machine learning and simulation

Explain the data flow in order: raw data, feature construction, target/label, split strategy, model fitting, calibration, thresholding, evaluation, and live inference.

Always state whether data is synthetic or real. Clearly identify prediction horizon, unit of time, label definition, threshold, and evaluation split when discussing metrics. Do not call model explanations causal evidence. Do not present a single metric as proof of general real-world accuracy.

## 8. Markdown organization

- Use one clear H1 heading per file.
- Use H2 headings for major topics and H3 for subtopics.
- Use relative links between repository documents.
- Use fenced code blocks with language identifiers.
- Use tables for concise inventories and comparisons, not for long paragraphs.
- Keep filenames lowercase and use hyphens between words.
- Prefer focused files over one very long catch-all document.
- Put a short overview and links in each documentation folder's `README.md` when the folder contains multiple documents.

## 9. Accuracy and source verification

Before documenting a behavior, inspect the current implementation and, where possible, its tests. Treat code and tests as the authority for current behavior; treat design notes and older documentation as context that may need updating.

When implementation and documentation disagree:

1. Determine the actual behavior from code and tests.
2. Update the documentation to match the implementation, or change the implementation if the documented behavior is the intended contract.
3. Do not silently describe planned behavior as implemented.
4. Record unresolved uncertainty explicitly.

Include source paths and function names when they help a reader locate the implementation. Avoid line numbers because they become stale after edits.

## 10. Change checklist

Before merging a change, ask:

- [ ] Does this change alter a documented feature, endpoint, setting, algorithm, or workflow?
- [ ] Have the affected Markdown files been updated?
- [ ] Are request/response examples still accurate?
- [ ] Are synthetic-data and research limitations still stated correctly?
- [ ] Do internal relative links resolve?
- [ ] Do code examples and commands match the repository?
- [ ] Have tests or build checks relevant to the change been run?

## 11. Suggested documentation change format

A useful documentation update explains the user/developer impact, the new or changed behavior, configuration or migration requirements, and known limitations. Avoid changelog entries that say only “updated documentation.”
