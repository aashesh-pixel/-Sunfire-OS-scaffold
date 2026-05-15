import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const demoPath = "demos/phase1_live_demo.py";

test("Python live demo preserves Phase 1 service chain", async () => {
  const source = await readFile(demoPath, "utf8");

  assert.match(source, /class TelemetryAPIHandler/);
  assert.match(source, /class ArdunAdapterHandler/);
  assert.match(source, /class DashboardHandler/);
  assert.match(source, /class MockSignalGenerator/);
  assert.match(source, /generate_sbom/);
});

test("Python live demo maps ARDUN observations to VSS paths", async () => {
  const source = await readFile(demoPath, "utf8");

  assert.match(source, /"speed_kmh": \("Vehicle\.Speed"/);
  assert.match(source, /"rpm": \("Vehicle\.Powertrain\.CombustionEngine\.Speed"/);
  assert.match(source, /"fuel_pct": \("Vehicle\.Powertrain\.FuelSystem\.Level"/);
  assert.match(source, /"brake_pct": \("Vehicle\.Chassis\.Brake\.PedalPosition"/);
  assert.match(source, /"throttle_pct": \("Vehicle\.Chassis\.Accelerator\.PedalPosition"/);
});

test("Python live demo does not expose command endpoints", async () => {
  const source = await readFile(demoPath, "utf8");
  const forbiddenEndpointTerms = [
    "/control",
    "/command",
    "/actuate",
    "/ignition",
    "/firmware",
    "/ota"
  ];

  for (const term of forbiddenEndpointTerms) {
    assert.equal(source.includes(term), false, `unexpected endpoint-like term ${term}`);
  }
});
