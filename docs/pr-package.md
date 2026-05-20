# Pull Request Package

## Title

Phase 1 scaffold: mock telemetry ingest, dashboard, and evidence package

## Summary

- Create the Sunfire OS Phase 1 scaffold for mock ARDUN/VSS signal ingestion, normalization, storage, dashboard display, and evidence generation.
- Keep all adapter, API, dashboard, and agent behavior read-only from a vehicle perspective.
- Add API fail-closed handling for malformed JSON request bodies.
- Include tests, documentation, SBOM/security evidence scripts, AGL preparation artifacts, and reviewer notes.

## Tests

```powershell
npm.cmd test
npm.cmd run evidence
```

Latest local result on 2026-05-20: 17 tests passed, SBOM generated, and the Phase 1 security scan passed.

## PostgreSQL Proof

Pending on a machine with Docker Desktop:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\prove-postgres.ps1
```

## Safety

- Adapters, API routes, dashboard, and agents are read-only.
- Agent endpoints summarize, classify, and recommend human review only.
- No vehicle control, actuator behavior, production OTA, or firmware update behavior was added.

## Reviewer Notes

Claude Code was requested in the project instructions, but `claude` was not available on PATH in this environment. Manual second-review coverage is recorded in `docs/reviewer-notes.md`.

## PR Status

This checkout does not have a Git remote configured, so Codex could not push a branch or open a pull request from the local environment. Use this package as the PR title/body once a remote is added.
