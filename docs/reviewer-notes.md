# Reviewer Notes

Use this checklist for Claude Code or a manual second reviewer.

## Architecture

- The mock feed, adapter, API, repository, and dashboard boundaries are clear.
- PostgreSQL is used only for telemetry storage.
- Tests can run without external services.

## Documentation

- Demo setup is reproducible.
- Phase 1 limitations are visible in README, AGENTS, and security docs.
- AGL preparation status is clear.

## Tests

- Adapter accepts supported signals and rejects unsupported signals.
- API ingest and latest telemetry routes are covered.
- Forbidden implementation surfaces are scanned.

## Security

- Inputs fail closed.
- No command endpoints or command abstractions exist.
- Evidence scripts are deterministic enough for PR review.

## Open Follow-Ups

- Replace handcrafted SBOM with an approved CycloneDX generator once dependency policy is approved.
- Add authenticated API access before any non-local environment.
- Add container image scanning in CI once the CI provider is selected.
- Run the Python live demo on a machine with Python 3.11+ before presenting it externally.

## Manual Second Review - 2026-05-20

Claude Code was requested but was not available on PATH. Codex completed the second-pass review using the checklist above.

- Architecture: Phase 1 dataflow remains read-only and scoped to mock ARDUN/VSS ingestion, normalization, storage, display, evidence, and AGL preparation docs.
- Documentation: README, AGENTS, security notes, architecture notes, demo notes, AGL notes, and PR package describe the Phase 1 boundary and validation path.
- Tests: Adapter, API, read-only agent, Python live demo, and forbidden-surface coverage pass locally.
- Security: Unsupported signals and malformed JSON fail closed at the API boundary; generated security evidence reports no findings.
- Deployment and evidence: AGL artifacts are preparation-only, and SBOM/security evidence is generated under `evidence/`.
