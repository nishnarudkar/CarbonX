# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres
to [Semantic Versioning](https://semver.org/).

## [1.1.0] - 2026-06-11

### Added

- Enforced coverage gates: backend `--cov-fail-under=90` (100% achieved),
  frontend vitest thresholds (≥90% statements / ≥85% branches).
- Backend test suites for the Firestore repository (via fake client), Gemini
  structured-response parsing and fallbacks, SPA static serving, configuration
  parsing, schema bounds, and dependency wiring.
- Frontend test suites for `HistoryPanel`, `InsightsPanel`, `NumberField`,
  device identity, and the API client — with per-component axe accessibility
  assertions.
- ESLint (typescript-eslint, react-hooks, jsx-a11y) and Prettier with CI gates.
- Strict mypy type checking for the backend in CI.
- Screen-reader announcements (`role="status"`) for asynchronous results,
  `aria-busy` on busy buttons, `aria-describedby` hint association, and
  browser-level input bounds mirroring the API schema.
- Project meta: CONTRIBUTING guide, architecture notes,
  `.editorconfig`, and pre-commit hooks.

### Changed

- Calculator form fields extracted into a reusable, type-safe `NumberField`
  component; app state orchestration extracted into a `useFootprint` hook.
- Rule-engine tuning fractions promoted to named, documented constants.

## [1.0.0] - 2026-06-08

### Added

- Carbon footprint calculation engine with cited emission factors
  (DEFRA 2023, EPA, IPCC / Our World in Data).
- Personalized insights: Gemini on Vertex AI with a deterministic rule-based
  fallback (graceful degradation, response tagged with its source).
- Anonymous tracking history in Firestore keyed by a device id — no accounts,
  no personal data.
- Accessible React + TypeScript SPA: semantic HTML, labelled controls, skip
  link, AA-contrast theme, data-table chart equivalent.
- Single-container deployment to Google Cloud Run (FastAPI serving API + SPA).
