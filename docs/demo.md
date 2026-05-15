# Mock Demo Runbook

## Local PostgreSQL Demo

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Start API and PostgreSQL:

   ```powershell
   docker compose up --build
   ```

3. Open the dashboard:

   ```text
   http://localhost:8080
   ```

4. Publish mock ARDUN/VSS signals:

   ```powershell
   npm run mock:feed
   ```

5. Refresh the dashboard and confirm latest telemetry plus event history.

## API Checks

```powershell
curl http://localhost:8080/health
curl http://localhost:8080/signals/supported
curl http://localhost:8080/telemetry/latest
```

## Evidence

Generate review evidence:

```powershell
npm run evidence
```

Expected outputs:

- `evidence/sbom.json`
- `evidence/security-scan.json`

## Python Stdlib Live Demo

The Python live demo combines the Phase 1 services into one process for quick stakeholder walkthroughs:

```text
Mock ARDUN generator -> ARDUN adapter :8001 -> Telemetry API :8000 -> SQLite -> Dashboard :3000
```

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-live-demo.ps1
```

Open:

```text
http://localhost:3000
```

It also writes:

- `db/sunfire_telemetry.db`
- `evidence/python-live-demo-sbom.json`

This demo is read-only from a vehicle perspective. Brake and throttle values are pedal-position observations only.
