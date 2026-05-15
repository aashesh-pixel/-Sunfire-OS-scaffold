#!/usr/bin/env python3
"""
Sunfire OS Phase 1 live demo.

This is the stdlib-only demo path for quick stakeholder walkthroughs:

  Mock ARDUN signal generator -> ARDUN adapter -> Telemetry API
  -> SQLite telemetry store -> Dashboard -> SBOM evidence

Phase 1 invariant: read-only signal ingestion. This file observes vehicle-like
signals only. It does not implement vehicle-side output or actuator behavior.
"""

from __future__ import annotations

import json
import logging
import math
import random
import sqlite3
import sys
import threading
import time
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen


BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "db" / "sunfire_telemetry.db"
SBOM_PATH = BASE_DIR / "evidence" / "python-live-demo-sbom.json"
TELEMETRY_PORT = 8000
ADAPTER_PORT = 8001
DASHBOARD_PORT = 3000
VEHICLE_ID = "SUNFIRETEST00001"
MOCK_HZ = 1
MOCK_DURATION = 999999

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)-16s] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
LOG = logging.getLogger("sunfire")
DB_LOCK = threading.Lock()


ARDUN_TO_VSS = {
    "speed_kmh": ("Vehicle.Speed", "km/h", 0, 260),
    "rpm": ("Vehicle.Powertrain.CombustionEngine.Speed", "rpm", 0, 9000),
    "eng_temp_c": ("Vehicle.Powertrain.CombustionEngine.ECT", "degC", -40, 140),
    "fuel_pct": ("Vehicle.Powertrain.FuelSystem.Level", "percent", 0, 100),
    "odo_km": ("Vehicle.TravelledDistance", "km", 0, 2000000),
    "lat": ("Vehicle.CurrentLocation.Latitude", "deg", -90, 90),
    "lon": ("Vehicle.CurrentLocation.Longitude", "deg", -180, 180),
    "battery_v": ("Vehicle.Powertrain.ElectricMotor.Voltage", "V", 0, 60),
    "brake_pct": ("Vehicle.Chassis.Brake.PedalPosition", "percent", 0, 100),
    "throttle_pct": ("Vehicle.Chassis.Accelerator.PedalPosition", "percent", 0, 100),
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = get_db()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS vehicles (
            id TEXT PRIMARY KEY,
            vin TEXT UNIQUE NOT NULL,
            label TEXT,
            source TEXT DEFAULT 'ardun',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS signals (
            id TEXT NOT NULL,
            vehicle_id TEXT NOT NULL,
            path TEXT NOT NULL,
            value REAL,
            value_str TEXT,
            unit TEXT,
            quality TEXT DEFAULT 'good',
            source TEXT NOT NULL,
            raw TEXT,
            recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (id, recorded_at)
        );

        CREATE INDEX IF NOT EXISTS idx_signals_vehicle_path_time
            ON signals (vehicle_id, path, recorded_at);

        CREATE TABLE IF NOT EXISTS ingest_log (
            id TEXT PRIMARY KEY,
            vehicle_id TEXT,
            source_id TEXT,
            signal_count INTEGER DEFAULT 0,
            status TEXT DEFAULT 'ok',
            ingested_at TEXT DEFAULT (datetime('now'))
        );

        INSERT OR IGNORE INTO vehicles (id, vin, label, source)
        VALUES ('veh-001', 'SUNFIRETEST00001', 'Sunfire Mock Vehicle 01', 'ardun');
        """
    )
    conn.commit()
    conn.close()
    LOG.info("Database initialised: %s", DB_PATH)


def db_write(sql: str, params: tuple = ()) -> None:
    with DB_LOCK:
        conn = get_db()
        conn.execute(sql, params)
        conn.commit()
        conn.close()


def db_query(sql: str, params: tuple = ()) -> list[dict]:
    conn = get_db()
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def normalise(ardun_signals: list[dict], source_id: str) -> list[dict]:
    canonical = []
    for signal in ardun_signals:
        name = str(signal.get("name", "")).lower()
        if name not in ARDUN_TO_VSS:
            raise ValueError(f"unsupported ARDUN signal: {name}")

        path, unit, min_value, max_value = ARDUN_TO_VSS[name]
        raw_value = signal.get("value")
        timestamp = signal.get("timestamp_utc", utc_now())

        try:
            value = float(raw_value)
            value_str = None
        except (TypeError, ValueError):
            value = None
            value_str = str(raw_value)

        if value is not None and not min_value <= value <= max_value:
            raise ValueError(f"signal value outside range: {name}={value}")

        canonical.append(
            {
                "id": str(uuid.uuid4()),
                "path": path,
                "value": value,
                "value_str": value_str,
                "unit": unit,
                "quality": "good",
                "source": source_id,
                "timestamp_utc": timestamp,
                "raw": json.dumps(signal),
            }
        )
    return canonical


class JsonHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args: object) -> None:
        return

    def send_json(self, data: dict, status: int = 200) -> None:
        body = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def read_body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length))


class TelemetryAPIHandler(JsonHandler):
    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        qs = parse_qs(parsed.query)

        if path == "/health":
            self.send_json({"status": "ok", "service": "telemetry-api", "db": str(DB_PATH)})
            return

        if path == "/vehicles":
            rows = db_query("SELECT * FROM vehicles ORDER BY created_at")
            self.send_json({"vehicles": rows, "count": len(rows)})
            return

        if path.startswith("/vehicles/") and path.endswith("/signals"):
            vehicle_id = path.split("/")[2]
            limit = min(max(int(qs.get("limit", ["50"])[0]), 1), 500)
            rows = db_query(
                """
                SELECT path, value, value_str, unit, quality, source, recorded_at
                FROM signals
                WHERE vehicle_id=?
                ORDER BY recorded_at DESC
                LIMIT ?
                """,
                (vehicle_id, limit),
            )
            self.send_json({"vehicle_id": vehicle_id, "signals": rows, "count": len(rows)})
            return

        if path.startswith("/vehicles/") and path.endswith("/state"):
            vehicle_id = path.split("/")[2]
            rows = db_query(
                """
                SELECT s.path, s.value, s.value_str, s.unit, s.quality, s.recorded_at
                FROM signals s
                JOIN (
                    SELECT path, MAX(recorded_at) AS max_recorded_at
                    FROM signals
                    WHERE vehicle_id=?
                    GROUP BY path
                ) latest
                ON s.path = latest.path AND s.recorded_at = latest.max_recorded_at
                WHERE s.vehicle_id=?
                ORDER BY s.path
                """,
                (vehicle_id, vehicle_id),
            )
            self.send_json({"vehicle_id": vehicle_id, "state": {row["path"]: row for row in rows}, "signal_count": len(rows)})
            return

        if path == "/ingest/log":
            rows = db_query("SELECT * FROM ingest_log ORDER BY ingested_at DESC LIMIT 20")
            self.send_json({"log": rows})
            return

        if path == "/docs":
            self.send_json(
                {
                    "openapi": "3.0.0",
                    "info": {"title": "Sunfire Telemetry API", "version": "0.1.0"},
                    "paths": {
                        "/health": {"get": {"summary": "Health check"}},
                        "/vehicles": {"get": {"summary": "List vehicles"}},
                        "/vehicles/{id}/state": {"get": {"summary": "Latest vehicle state"}},
                        "/vehicles/{id}/signals": {"get": {"summary": "Signal history"}},
                        "/signals/batch": {"post": {"summary": "Batch ingest from adapter"}},
                    },
                }
            )
            return

        self.send_json({"error": "not found"}, 404)

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/signals/batch":
            self.send_json({"error": "not found"}, 404)
            return

        body = self.read_body()
        vehicle_id = body.get("vehicle_id")
        signals = body.get("signals", [])
        if not vehicle_id or not signals:
            self.send_json({"error": "vehicle_id and signals required"}, 400)
            return

        for signal in signals:
            db_write(
                """
                INSERT OR IGNORE INTO signals
                    (id, vehicle_id, path, value, value_str, unit, quality, source, raw, recorded_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    signal["id"],
                    vehicle_id,
                    signal["path"],
                    signal.get("value"),
                    signal.get("value_str"),
                    signal.get("unit"),
                    signal.get("quality", "good"),
                    signal.get("source", "ardun"),
                    signal.get("raw"),
                    utc_now(),
                ),
            )

        db_write(
            "INSERT INTO ingest_log (id, vehicle_id, source_id, signal_count) VALUES (?, ?, ?, ?)",
            (str(uuid.uuid4()), vehicle_id, body.get("source_id", "adapter"), len(signals)),
        )
        LOG.info("Telemetry: stored %d signals for %s", len(signals), vehicle_id)
        self.send_json({"stored": len(signals), "vehicle_id": vehicle_id})


class ArdunAdapterHandler(JsonHandler):
    SOURCE_ID = "ardun-v1"

    def do_GET(self) -> None:
        path = urlparse(self.path).path.rstrip("/")
        if path == "/health":
            self.send_json(
                {
                    "status": "ok",
                    "service": "ardun-adapter",
                    "source_id": self.SOURCE_ID,
                    "telemetry_api": f"http://localhost:{TELEMETRY_PORT}",
                }
            )
            return
        if path == "/schema":
            self.send_json(
                {
                    "description": "ARDUN signal packet schema",
                    "vss_mapping": {key: value[0] for key, value in ARDUN_TO_VSS.items()},
                }
            )
            return
        self.send_json({"error": "not found"}, 404)

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/ingest":
            self.send_json({"error": "not found"}, 404)
            return

        try:
            body = self.read_body()
            vehicle_id = body.get("vehicle_id")
            signals = body.get("signals", [])
            if not vehicle_id or not signals:
                self.send_json({"error": "vehicle_id and signals required"}, 422)
                return
            canonical = normalise(signals, self.SOURCE_ID)
        except (json.JSONDecodeError, ValueError) as exc:
            self.send_json({"error": str(exc)}, 400)
            return

        payload = json.dumps({"vehicle_id": vehicle_id, "source_id": self.SOURCE_ID, "signals": canonical}).encode("utf-8")
        try:
            req = Request(
                f"http://localhost:{TELEMETRY_PORT}/signals/batch",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urlopen(req, timeout=5):
                pass
            self.send_json({"accepted": len(canonical), "vehicle_id": vehicle_id, "status": "ok"})
        except Exception as exc:
            LOG.error("Adapter to API forward failed: %s", exc)
            self.send_json({"error": str(exc)}, 502)


DASHBOARD_HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sunfire OS Live Demo</title>
<style>
:root { color-scheme: dark; --bg:#080c10; --panel:#0d1520; --line:#1a2d44; --accent:#ff6b00; --cyan:#00d4ff; --good:#00ff88; --text:#c8ddf0; --muted:#6c8398; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font-family: Arial, sans-serif; padding: 18px; }
header { display:flex; justify-content:space-between; gap:16px; align-items:end; border-bottom:1px solid var(--line); padding-bottom:14px; margin-bottom:18px; }
h1 { margin:0; color:var(--accent); letter-spacing:0; font-size:2rem; }
.meta { color:var(--muted); font-size:.85rem; }
.grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:14px; }
.panel { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px; min-height:125px; }
.label { color:var(--muted); text-transform:uppercase; font-size:.72rem; margin-bottom:10px; }
.value { color:var(--cyan); font-size:2rem; font-weight:800; }
.bar { height:6px; background:#111e2c; border-radius:4px; overflow:hidden; margin-top:14px; }
.fill { height:100%; width:0%; background:var(--accent); }
table { border-collapse:collapse; width:100%; min-width:720px; }
th, td { border-top:1px solid var(--line); padding:8px; text-align:left; font-size:.82rem; }
th { color:var(--muted); }
.wide { grid-column:1 / -1; overflow-x:auto; }
footer { color:var(--muted); margin-top:16px; font-size:.78rem; }
</style>
</head>
<body>
<header>
  <div><h1>SUNFIRE OS</h1><div class="meta">Phase 1 live demo | Ardun-style read-only telemetry</div></div>
  <div class="meta"><div id="vehicle-id"></div><div id="last-update"></div></div>
</header>
<section class="grid">
  <article class="panel"><div class="label">Vehicle Speed</div><div class="value" id="speed">-</div><div class="meta">km/h | Vehicle.Speed</div><div class="bar"><div class="fill" id="speed-bar"></div></div></article>
  <article class="panel"><div class="label">Engine RPM</div><div class="value" id="rpm">-</div><div class="meta">rpm | CombustionEngine.Speed</div><div class="bar"><div class="fill" id="rpm-bar"></div></div></article>
  <article class="panel"><div class="label">Engine Temperature</div><div class="value" id="temp">-</div><div class="meta">degC | ECT</div><div class="bar"><div class="fill" id="temp-bar"></div></div></article>
  <article class="panel"><div class="label">Fuel Level</div><div class="value" id="fuel">-</div><div class="meta">percent | FuelSystem.Level</div><div class="bar"><div class="fill" id="fuel-bar"></div></div></article>
  <article class="panel"><div class="label">Odometer</div><div class="value" id="odo">-</div><div class="meta">km | TravelledDistance</div></article>
  <article class="panel"><div class="label">GPS Location</div><div class="value" id="lat" style="font-size:1.1rem">-</div><div class="value" id="lon" style="font-size:1.1rem">-</div></article>
  <article class="panel wide"><div class="label">Live Signal Feed</div><table><thead><tr><th>VSS Path</th><th>Value</th><th>Unit</th><th>Quality</th><th>Time</th></tr></thead><tbody id="feed"></tbody></table></article>
</section>
<footer>Sunfire OS Phase 1: read-only ingestion, validation, storage, dashboard, evidence.</footer>
<script>
const API = "http://localhost:8000";
const VID = "SUNFIRETEST00001";
const paths = {
  speed: "Vehicle.Speed",
  rpm: "Vehicle.Powertrain.CombustionEngine.Speed",
  temp: "Vehicle.Powertrain.CombustionEngine.ECT",
  fuel: "Vehicle.Powertrain.FuelSystem.Level",
  odo: "Vehicle.TravelledDistance",
  lat: "Vehicle.CurrentLocation.Latitude",
  lon: "Vehicle.CurrentLocation.Longitude"
};
function fmt(v, d = 1) { return v === null || v === undefined ? "-" : Number(v).toFixed(d); }
function bar(id, pct) { document.getElementById(id).style.width = Math.max(0, Math.min(100, pct)) + "%"; }
async function tick() {
  const stateRes = await fetch(`${API}/vehicles/${VID}/state`);
  const feedRes = await fetch(`${API}/vehicles/${VID}/signals?limit=16`);
  const state = (await stateRes.json()).state || {};
  const feed = (await feedRes.json()).signals || [];
  document.getElementById("vehicle-id").textContent = VID;
  document.getElementById("last-update").textContent = new Date().toLocaleTimeString();
  const speed = state[paths.speed]?.value; const rpm = state[paths.rpm]?.value; const temp = state[paths.temp]?.value; const fuel = state[paths.fuel]?.value;
  document.getElementById("speed").textContent = fmt(speed); bar("speed-bar", speed / 200 * 100);
  document.getElementById("rpm").textContent = fmt(rpm, 0); bar("rpm-bar", rpm / 7000 * 100);
  document.getElementById("temp").textContent = fmt(temp); bar("temp-bar", (temp - 60) / 60 * 100);
  document.getElementById("fuel").textContent = fmt(fuel); bar("fuel-bar", fuel);
  document.getElementById("odo").textContent = fmt(state[paths.odo]?.value, 1);
  document.getElementById("lat").textContent = "LAT " + fmt(state[paths.lat]?.value, 5);
  document.getElementById("lon").textContent = "LON " + fmt(state[paths.lon]?.value, 5);
  document.getElementById("feed").innerHTML = feed.map(s => `<tr><td>${s.path}</td><td>${s.value ?? s.value_str ?? "-"}</td><td>${s.unit ?? "-"}</td><td>${s.quality}</td><td>${(s.recorded_at || "").slice(11,19)}</td></tr>`).join("");
}
tick();
setInterval(tick, 1000);
</script>
</body>
</html>"""


class DashboardHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args: object) -> None:
        return

    def do_GET(self) -> None:
        body = DASHBOARD_HTML.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class MockSignalGenerator:
    def __init__(self) -> None:
        self.t = 0
        self.speed = 0.0
        self.rpm = 800.0
        self.fuel = 78.0
        self.odo = 42310.5
        self.lat = 45.4215
        self.lon = -75.6972
        self.engine_temp = 20.0

    def next_packet(self) -> dict:
        self.t += 1
        target_speed = 60 + 40 * math.sin(self.t * 0.05) + random.gauss(0, 3)
        self.speed = max(0, self.speed * 0.85 + target_speed * 0.15 + random.gauss(0, 0.5))
        self.rpm = max(700, 800 + self.speed * 28 + random.gauss(0, 50))
        self.fuel = max(0, self.fuel - 0.001)
        self.odo += self.speed / 3600
        self.lat += random.gauss(0, 0.00005)
        self.lon += self.speed * 0.000002
        warmup = min(1.0, self.t / 300)
        self.engine_temp = self.engine_temp * 0.998 + (88 + random.gauss(0, 1)) * 0.002 * warmup + 0.01
        throttle = max(0, min(100, self.speed / 2 + random.gauss(0, 5)))
        brake = max(0, min(100, -min(0, target_speed - self.speed) * 2))
        battery = 13.8 + random.gauss(0, 0.05)

        return {
            "vehicle_id": VEHICLE_ID,
            "source": "ardun",
            "packet_ts": utc_now(),
            "signals": [
                {"name": "speed_kmh", "value": round(self.speed, 2), "unit": "km/h"},
                {"name": "rpm", "value": round(self.rpm, 0), "unit": "rpm"},
                {"name": "eng_temp_c", "value": round(self.engine_temp, 1), "unit": "degC"},
                {"name": "fuel_pct", "value": round(self.fuel, 2), "unit": "percent"},
                {"name": "odo_km", "value": round(self.odo, 3), "unit": "km"},
                {"name": "lat", "value": round(self.lat, 6), "unit": "deg"},
                {"name": "lon", "value": round(self.lon, 6), "unit": "deg"},
                {"name": "battery_v", "value": round(battery, 2), "unit": "V"},
                {"name": "throttle_pct", "value": round(throttle, 1), "unit": "percent"},
                {"name": "brake_pct", "value": round(brake, 1), "unit": "percent"},
            ],
        }

    def run(self) -> None:
        LOG.info("Mock signal generator starting at %.1f Hz", MOCK_HZ)
        time.sleep(2)
        for index in range(MOCK_DURATION):
            packet = self.next_packet()
            payload = json.dumps(packet).encode("utf-8")
            try:
                req = Request(
                    f"http://localhost:{ADAPTER_PORT}/ingest",
                    data=payload,
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urlopen(req, timeout=5):
                    pass
                if index % 10 == 0:
                    LOG.info(
                        "Signal #%d | speed=%.1f rpm=%.0f fuel=%.1f",
                        index + 1,
                        packet["signals"][0]["value"],
                        packet["signals"][1]["value"],
                        packet["signals"][3]["value"],
                    )
            except Exception as exc:
                LOG.warning("Signal send failed: %s", exc)
            time.sleep(1.0 / MOCK_HZ)


def generate_sbom() -> None:
    SBOM_PATH.parent.mkdir(parents=True, exist_ok=True)
    sbom = {
        "spdxVersion": "SPDX-2.3",
        "dataLicense": "CC0-1.0",
        "SPDXID": "SPDXRef-DOCUMENT",
        "name": "sunfire-os-phase1-python-live-demo",
        "documentNamespace": f"https://sunfire-os.local/sbom/{uuid.uuid4()}",
        "creationInfo": {
            "created": utc_now(),
            "creators": ["Tool: sunfire-python-live-demo-0.1.0"],
            "comment": "Phase 1 stdlib-only live demo SBOM.",
        },
        "packages": [
            {
                "SPDXID": "SPDXRef-sunfire-os-python-live-demo",
                "name": "sunfire-os-python-live-demo",
                "versionInfo": "0.1.0",
                "downloadLocation": "NOASSERTION",
                "filesAnalyzed": False,
                "licenseConcluded": "NOASSERTION",
                "licenseDeclared": "NOASSERTION",
                "copyrightText": "NOASSERTION",
            },
            {
                "SPDXID": "SPDXRef-python-runtime",
                "name": "python",
                "versionInfo": sys.version.split()[0],
                "downloadLocation": "https://www.python.org",
                "filesAnalyzed": False,
                "licenseConcluded": "PSF-2.0",
                "licenseDeclared": "PSF-2.0",
                "copyrightText": "Copyright Python Software Foundation",
            },
        ],
        "sunfire_meta": {
            "phase": 1,
            "services": ["telemetry-api", "ardun-adapter", "dashboard", "mock-generator"],
            "runtime": "python-stdlib",
            "external_dependencies": [],
        },
    }
    SBOM_PATH.write_text(json.dumps(sbom, indent=2) + "\n", encoding="utf-8")
    LOG.info("SBOM written: %s", SBOM_PATH)


def start_server(handler_class: type[BaseHTTPRequestHandler], port: int, name: str) -> HTTPServer:
    server = HTTPServer(("0.0.0.0", port), handler_class)
    thread = threading.Thread(target=server.serve_forever, daemon=True, name=name)
    thread.start()
    LOG.info("%-16s -> http://localhost:%d", name, port)
    return server


def main() -> None:
    print("\nSunfire OS Phase 1 Live Demo")
    print("Partner: Ardun Technologies | read-only telemetry scaffold\n")
    init_db()
    generate_sbom()
    start_server(TelemetryAPIHandler, TELEMETRY_PORT, "telemetry-api")
    start_server(ArdunAdapterHandler, ADAPTER_PORT, "ardun-adapter")
    start_server(DashboardHandler, DASHBOARD_PORT, "dashboard")

    print(f"Dashboard : http://localhost:{DASHBOARD_PORT}")
    print(f"API docs  : http://localhost:{TELEMETRY_PORT}/docs")
    print(f"Adapter   : http://localhost:{ADAPTER_PORT}/schema")
    print(f"SBOM      : {SBOM_PATH}")
    print("Press Ctrl+C to stop\n")

    generator = MockSignalGenerator()
    threading.Thread(target=generator.run, daemon=True, name="mock-generator").start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nSunfire OS demo stopped.\n")


if __name__ == "__main__":
    main()
