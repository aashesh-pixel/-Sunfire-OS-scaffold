# Architecture

Sunfire OS Phase 1 is a read-only telemetry scaffold. It models the demo path needed for Ardun-style signal ingestion and review evidence without implementing vehicle-control behavior.

## Components

```text
Mock Feed -> Sunfire Adapter -> Telemetry API -> Repository -> Dashboard
                                      |
                                      +-> PostgreSQL in Docker Compose
                                      +-> In-memory repository for tests
```

## Signal Contract

The adapter accepts a small ARDUN-style envelope:

```json
{
  "source": "mock-ardun-feed",
  "name": "ARDUN.Vehicle.Speed",
  "value": 42,
  "timestamp": "2026-05-13T12:00:00.000Z"
}
```

The adapter emits normalized telemetry:

```json
{
  "source": "mock-ardun-feed",
  "signalName": "Vehicle.Speed",
  "value": 42,
  "unit": "km/h",
  "observedAt": "2026-05-13T12:00:00.000Z",
  "receivedAt": "2026-05-13T12:00:01.000Z"
}
```

## Data Storage

PostgreSQL stores append-only telemetry events in `telemetry_events`. The API also supports an in-memory repository for deterministic tests.

## Deployment Direction

The Docker Compose setup is the local development environment. AGL preparation artifacts live under `deploy/agl/` and are intentionally non-production placeholders until later phases define target hardware and runtime constraints.

## Python Live Demo Path

`demos/phase1_live_demo.py` is a single-process, Python standard-library version of the same Phase 1 chain. It is useful when `npm`, Docker, or PostgreSQL are not available.

It starts:

- Telemetry API on `:8000`
- ARDUN adapter on `:8001`
- Dashboard on `:3000`
- Background mock signal generator
- SQLite database under `db/`
- SPDX-style SBOM evidence under `evidence/`

The Python demo is not the production architecture. It is a combined local demo that preserves the same read-only adapter/API/storage/dashboard boundaries.
