# Sunfire OS

Sunfire OS is the Phase 1 scaffold for a controlled Ardun-style retro vehicle telemetry environment. It ingests mock ARDUN/VSS signals, normalizes them through a read-only adapter, stores telemetry, displays vehicle state, and produces SBOM/security evidence for review.

This repository intentionally does not implement vehicle control, CAN writes, ignition disable, door locks, steering, brake, throttle, production OTA, or firmware flashing.

## Milestone Demo

The first milestone is:

```text
Mock ARDUN/VSS signal feed -> Sunfire adapter -> Telemetry API -> PostgreSQL -> Dashboard -> SBOM/security evidence
```

## Quick Start

Install dependencies:

```powershell
npm install
```

If `npm` is not available but `node` is available, you can still run the in-memory Phase 1 demo:

```powershell
.\scripts\run-tests.ps1
.\scripts\generate-evidence.ps1
.\scripts\start-dev.ps1
```

Then open:

```text
http://localhost:8080
```

In another PowerShell window, publish mock telemetry:

```powershell
.\scripts\run-mock-feed.ps1
```

For a single-command Python live demo with SQLite, adapter, API, dashboard, mock generator, and SBOM evidence:

```powershell
.\scripts\start-live-demo.ps1
```

Then open:

```text
http://localhost:3000
```

This path requires Python 3.11+ and uses only the Python standard library.

Milestone 2 adds read-only AI insight agents and evidence status panels:

```text
GET /agents/telemetry-summary
GET /agents/anomalies
GET /agents/security-summary
GET /agents/demo-narrative
GET /evidence/status
```

To prove the PostgreSQL-backed path on a machine with Docker Desktop:

```powershell
.\scripts\prove-postgres.ps1
```

Run tests:

```powershell
npm test
```

Generate evidence:

```powershell
npm run evidence
```

Run the PostgreSQL-backed demo:

```powershell
docker compose up --build
```

Then open:

```text
http://localhost:8080
```

In another shell, publish mock signals:

```powershell
npm run mock:feed
```

## Repository Layout

- `services/adapter/` normalizes mock ARDUN/VSS signals.
- `services/api/` exposes telemetry routes and serves the dashboard.
- `services/mock-feed/` emits mock read-only vehicle signals.
- `dashboard/` contains the display-only browser UI.
- `database/` contains PostgreSQL schema.
- `deploy/agl/` contains AGL preparation notes and sample service metadata.
- `scripts/` generates SBOM and security evidence.
- `tests/` covers adapter, API, evidence, and forbidden-surface boundaries.
- `docs/` captures architecture, demo, security, and reviewer guidance.

## Evidence

Evidence artifacts are generated under `evidence/`:

- `evidence/sbom.json`
- `evidence/security-scan.json`

These files are ignored by Git by default because they are generated review artifacts.
