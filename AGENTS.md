# Sunfire OS Agent Guide

Sunfire OS Phase 1 is a controlled development scaffold for Ardun-style retro vehicle telemetry. The goal is an end-to-end mock demo, not a production vehicle operating system.

## Phase 1 Scope

Build and maintain this path:

1. Mock ARDUN/VSS signal feed
2. Sunfire adapter normalization
3. Telemetry API
4. PostgreSQL storage
5. Browser dashboard
6. SBOM and security scan evidence
7. AGL deployment preparation artifacts

Every task must include tests, docs, and a pull request.

## Hard Safety Boundaries

Do not implement or scaffold any capability for:

- Vehicle control
- CAN writes
- Ignition disable
- Door lock actuation
- Steering
- Brake
- Throttle
- Production OTA
- Firmware flashing

Code may ingest, validate, normalize, store, and display vehicle-like signals. Code must not send commands to vehicles or simulate command paths that could later be mistaken for control interfaces.

## Architecture Expectations

- Keep adapters read-only and deterministic.
- Treat ARDUN/VSS input as untrusted data.
- Store normalized telemetry with source metadata and timestamps.
- Prefer explicit schemas and validation over permissive pass-through fields.
- Keep dashboard behavior display-only.
- Generate evidence artifacts under `evidence/`.
- Keep AGL preparation in deployment manifests and docs only until a later phase approves runtime integration.

## Testing Expectations

- Adapter mappings require unit tests.
- API routes require integration-style tests with the in-memory repository.
- Security boundary tests must prove forbidden control surfaces are absent.
- Evidence generation scripts require smoke tests or deterministic output checks.

## Review Expectations

Use Claude Code as a second reviewer when it is available in the development environment. Ask it to review:

- Architecture gaps
- Documentation gaps
- Test coverage gaps
- Security and vehicle-control boundary risks
- Deployment and evidence reproducibility risks

If Claude Code is unavailable, record that in the PR and complete a manual second-pass review using the same checklist.

## Pull Request Checklist

- [ ] Change is inside Phase 1 scope.
- [ ] No prohibited vehicle-control capability was added.
- [ ] Tests were added or updated.
- [ ] Documentation was added or updated.
- [ ] SBOM/security evidence was generated when relevant.
- [ ] AGL impact was considered.
- [ ] Claude Code or manual second reviewer notes are included.
