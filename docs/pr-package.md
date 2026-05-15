# Pull Request Package

## Title

Phase 1 Milestone 2: add read-only AI insight agents and evidence dashboard

## Summary

- Add read-only AI insight agents for telemetry, anomaly detection, security evidence, and demo narration.
- Add API routes for agent summaries and evidence status.
- Add dashboard panels for AI insights and SBOM/security evidence.
- Add PostgreSQL proof script for Docker-based end-to-end validation.
- Add tests and documentation for Milestone 2.

## Tests

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run-tests.ps1
powershell -ExecutionPolicy Bypass -File scripts\generate-evidence.ps1
```

## PostgreSQL Proof

Pending on a machine with Docker Desktop:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\prove-postgres.ps1
```

## Safety

- Agents are read-only.
- Agent endpoints summarize, classify, and recommend human review only.
- No vehicle control, actuator behavior, production OTA, or firmware update behavior was added.

## Reviewer Notes

Claude Code was requested in the project instructions, but it was not available as a callable tool in this environment. Use `docs/reviewer-notes.md` for manual second-review coverage if Claude Code remains unavailable.
