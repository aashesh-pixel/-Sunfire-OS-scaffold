const NORMAL = "normal";
const WARNING = "warning";

export function buildTelemetrySummary(events, supportedSignals = []) {
  const latest = Array.isArray(events) ? events : [];
  const supported = Array.isArray(supportedSignals) ? supportedSignals : [];
  const anomalies = detectTelemetryAnomalies(latest);
  const staleSignals = findStaleSignals(latest);
  const missingSignals = supported
    .map((signal) => signal.signalName)
    .filter((signalName) => !latest.some((event) => event.signalName === signalName));

  const riskLevel = anomalies.length || staleSignals.length ? WARNING : NORMAL;

  return {
    agent: "telemetry-analyst",
    mode: "read-only",
    riskLevel,
    signalCount: latest.length,
    missingSignals,
    staleSignals,
    anomalies,
    summary: summarizeTelemetry(latest, anomalies, staleSignals, missingSignals),
    allowedActions: ["summarize", "classify", "recommend_human_review"],
    forbiddenActions: ["vehicle_control", "actuation", "firmware_update"]
  };
}

export function detectTelemetryAnomalies(events, now = new Date()) {
  const latest = new Map((Array.isArray(events) ? events : []).map((event) => [event.signalName, event]));
  const findings = [];
  const speed = latest.get("Vehicle.Speed");
  const rpm = latest.get("Powertrain.Engine.Speed");
  const fuel = latest.get("Powertrain.FuelSystem.Level");

  if (speed && speed.value > 180) {
    findings.push({
      severity: WARNING,
      signalName: "Vehicle.Speed",
      message: "Vehicle speed is above the Phase 1 review threshold."
    });
  }

  if (rpm && rpm.value > 6500) {
    findings.push({
      severity: WARNING,
      signalName: "Powertrain.Engine.Speed",
      message: "Engine speed is above the Phase 1 review threshold."
    });
  }

  if (speed && rpm && speed.value < 3 && rpm.value > 3500) {
    findings.push({
      severity: WARNING,
      signalName: "Powertrain.Engine.Speed",
      message: "RPM is high while vehicle speed is near zero; review the mock signal stream."
    });
  }

  if (fuel && fuel.value < 10) {
    findings.push({
      severity: WARNING,
      signalName: "Powertrain.FuelSystem.Level",
      message: "Fuel level is below the Phase 1 review threshold."
    });
  }

  for (const stale of findStaleSignals(events, now)) {
    findings.push({
      severity: WARNING,
      signalName: stale.signalName,
      message: `Signal has not updated for ${stale.ageSeconds} seconds.`
    });
  }

  return findings;
}

export function buildEvidenceSummary(evidenceStatus) {
  const security = evidenceStatus?.securityScan;
  const sbom = evidenceStatus?.sbom;
  const generated = [security, sbom].filter((item) => item?.exists).length;
  const findings = [];

  if (!sbom?.exists) {
    findings.push({ severity: WARNING, message: "SBOM evidence has not been generated." });
  }

  if (!security?.exists) {
    findings.push({ severity: WARNING, message: "Security scan evidence has not been generated." });
  } else if (security?.passed === false) {
    findings.push({ severity: WARNING, message: "Security scan reported findings." });
  }

  return {
    agent: "security-evidence-reviewer",
    mode: "read-only",
    riskLevel: findings.length ? WARNING : NORMAL,
    generatedArtifacts: generated,
    expectedArtifacts: 2,
    findings,
    summary: findings.length
      ? "Evidence package needs human review before PR."
      : "SBOM and security evidence are present and clean.",
    allowedActions: ["summarize", "classify", "recommend_human_review"],
    forbiddenActions: ["vehicle_control", "actuation", "firmware_update"]
  };
}

export function buildDemoNarrative(telemetrySummary, evidenceSummary) {
  return {
    agent: "demo-narrator",
    mode: "read-only",
    title: "Sunfire OS Phase 1 Demo",
    talkingPoints: [
      "Mock ARDUN-style signals are normalized by the Sunfire adapter.",
      "Telemetry is stored and displayed without any vehicle-side output path.",
      `Telemetry status is ${telemetrySummary.riskLevel}.`,
      `Evidence status is ${evidenceSummary.riskLevel}.`
    ],
    summary: "This demo shows read-only signal ingestion, telemetry display, and review evidence for Phase 1."
  };
}

function summarizeTelemetry(events, anomalies, staleSignals, missingSignals) {
  if (!events.length) {
    return "No telemetry has been ingested yet.";
  }

  if (anomalies.length) {
    return "Telemetry is available, with review findings detected.";
  }

  if (staleSignals.length) {
    return "Telemetry is available, but at least one signal is stale.";
  }

  if (missingSignals.length) {
    return "Telemetry is available; some supported mock signals have not appeared yet.";
  }

  return "Telemetry is available and within Phase 1 review thresholds.";
}

function findStaleSignals(events, now = new Date()) {
  const staleAfterSeconds = 30;
  return (Array.isArray(events) ? events : [])
    .map((event) => ({
      signalName: event.signalName,
      ageSeconds: Math.floor((now.getTime() - new Date(event.observedAt).getTime()) / 1000)
    }))
    .filter((event) => Number.isFinite(event.ageSeconds) && event.ageSeconds > staleAfterSeconds);
}
