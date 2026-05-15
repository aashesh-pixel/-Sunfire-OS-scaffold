# Security and Safety Boundaries

Phase 1 treats all ARDUN-style signal input as untrusted data. The adapter validates signal name, value type, accepted range, and timestamp before storage.

## Read-Only Rule

The repository must remain read-only from a vehicle perspective. It can ingest and display telemetry. It must not control or command a vehicle.

Forbidden surfaces:

- Vehicle control
- CAN writes
- Ignition disable
- Door lock actuation
- Steering
- Brake
- Throttle
- Production OTA
- Firmware flashing

## Evidence

`npm run evidence` writes:

- `evidence/sbom.json` with a CycloneDX-style component list.
- `evidence/security-scan.json` with a Phase 1 forbidden-pattern scan.

The scan is a guardrail, not a replacement for human review.

## AI Agent Boundary

Milestone 2 agents are read-only:

- They may summarize telemetry.
- They may classify anomaly risk.
- They may review generated evidence status.
- They may produce demo talking points.

They must not mutate vehicle state, invoke vehicle-side output, or perform firmware/update activity.

## Reviewer Checklist

- Confirm adapter mappings are explicit and bounded.
- Confirm unsupported signals fail closed.
- Confirm API routes do not expose command endpoints.
- Confirm dashboard is display-only.
- Confirm generated evidence is reproducible.
- Confirm AGL files are preparation artifacts only.
