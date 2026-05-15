import assert from "node:assert/strict";
import test from "node:test";
import { buildDemoNarrative, buildEvidenceSummary, buildTelemetrySummary, detectTelemetryAnomalies } from "../services/agents/read-only-insights.mjs";

test("telemetry analyst summarizes normal read-only telemetry", () => {
  const summary = buildTelemetrySummary([
    event("Vehicle.Speed", 42, "km/h"),
    event("Powertrain.Engine.Speed", 2200, "rpm"),
    event("Powertrain.FuelSystem.Level", 70, "percent")
  ]);

  assert.equal(summary.agent, "telemetry-analyst");
  assert.equal(summary.mode, "read-only");
  assert.equal(summary.riskLevel, "normal");
  assert.equal(summary.signalCount, 3);
  assert.ok(summary.forbiddenActions.includes("vehicle_control"));
});

test("anomaly detector flags high rpm while speed is near zero", () => {
  const anomalies = detectTelemetryAnomalies([
    event("Vehicle.Speed", 0, "km/h"),
    event("Powertrain.Engine.Speed", 4200, "rpm")
  ]);

  assert.equal(anomalies.length, 1);
  assert.equal(anomalies[0].signalName, "Powertrain.Engine.Speed");
});

test("security evidence reviewer reports clean evidence", () => {
  const summary = buildEvidenceSummary({
    sbom: { exists: true },
    securityScan: { exists: true, passed: true, findingCount: 0 }
  });

  assert.equal(summary.agent, "security-evidence-reviewer");
  assert.equal(summary.riskLevel, "normal");
  assert.equal(summary.generatedArtifacts, 2);
});

test("demo narrator combines telemetry and evidence summaries", () => {
  const narrative = buildDemoNarrative(
    { riskLevel: "normal" },
    { riskLevel: "normal" }
  );

  assert.equal(narrative.agent, "demo-narrator");
  assert.ok(narrative.talkingPoints.length >= 3);
});

function event(signalName, value, unit) {
  return {
    source: "test",
    signalName,
    value,
    unit,
    observedAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    rawPayload: {}
  };
}
