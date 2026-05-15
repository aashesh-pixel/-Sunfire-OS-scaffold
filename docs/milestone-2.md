# Phase 1 Milestone 2

Milestone 2 adds read-only AI insight agents, an evidence dashboard panel, a repeatable PostgreSQL proof script, and PR package notes.

## Scope

Implemented:

- `telemetry-analyst` agent for read-only telemetry summaries.
- `anomaly-detector` agent for advisory anomaly findings.
- `security-evidence-reviewer` agent for SBOM/security scan status.
- `demo-narrator` agent for demo talking points.
- Dashboard panels for AI insights and evidence.
- `scripts/prove-postgres.ps1` for Docker/PostgreSQL proof.
- Tests for agent logic and API routes.

Still intentionally excluded:

- Vehicle control.
- Vehicle-side output.
- Actuator behavior.
- Production OTA.
- Firmware update behavior.

## Agent Endpoints

```text
GET /agents/telemetry-summary
GET /agents/anomalies
GET /agents/security-summary
GET /agents/demo-narrative
GET /evidence/status
```

These endpoints read from telemetry/evidence only. They do not mutate vehicle state.

## PostgreSQL Proof

On a machine with Docker Desktop:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\prove-postgres.ps1
```

The script:

1. Starts `docker compose up --build -d`.
2. Waits for `GET /health`.
3. Publishes mock telemetry.
4. Reads `GET /telemetry/latest`.
5. Reads `GET /agents/telemetry-summary`.

Expected result:

```text
PostgreSQL proof succeeded.
Dashboard: http://localhost:8080
```

## Local Verification

In this environment, Docker was not available. Verified instead:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run-tests.ps1
powershell -ExecutionPolicy Bypass -File scripts\generate-evidence.ps1
```

The Python SQLite live demo and Node in-memory demo remain useful fallback paths.
