import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createSunfireServer, isMainModule } from "../services/api/server.mjs";
import { InMemoryTelemetryRepository } from "../services/api/repository.mjs";

test("ingests signal and returns latest telemetry", async () => {
  const server = await createSunfireServer({ repository: new InMemoryTelemetryRepository() });
  await listen(server);

  const baseUrl = serverBaseUrl(server);
  const ingest = await fetch(`${baseUrl}/signals`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      source: "test",
      name: "ARDUN.Powertrain.Engine.Speed",
      value: 1200,
      timestamp: "2026-05-13T12:00:00.000Z"
    })
  });

  assert.equal(ingest.status, 201);

  const latest = await fetch(`${baseUrl}/telemetry/latest`).then((response) => response.json());
  assert.equal(latest.events.length, 1);
  assert.equal(latest.events[0].signalName, "Powertrain.Engine.Speed");
  assert.equal(latest.events[0].value, 1200);

  await close(server);
});

test("rejects unsupported signal at API boundary", async () => {
  const server = await createSunfireServer({ repository: new InMemoryTelemetryRepository() });
  await listen(server);

  const response = await fetch(`${serverBaseUrl(server)}/signals`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "ARDUN.Vehicle.Control", value: 1 })
  });

  assert.equal(response.status, 400);
  await close(server);
});

test("serves read-only agent and evidence endpoints", async () => {
  const server = await createSunfireServer({ repository: new InMemoryTelemetryRepository() });
  await listen(server);

  const baseUrl = serverBaseUrl(server);
  await fetch(`${baseUrl}/signals`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      source: "test",
      name: "ARDUN.Vehicle.Speed",
      value: 25,
      timestamp: new Date().toISOString()
    })
  });

  const telemetrySummary = await fetch(`${baseUrl}/agents/telemetry-summary`).then((response) => response.json());
  const securitySummary = await fetch(`${baseUrl}/agents/security-summary`).then((response) => response.json());
  const evidence = await fetch(`${baseUrl}/evidence/status`).then((response) => response.json());

  assert.equal(telemetrySummary.agent, "telemetry-analyst");
  assert.equal(telemetrySummary.mode, "read-only");
  assert.equal(securitySummary.agent, "security-evidence-reviewer");
  assert.ok("securityScan" in evidence);

  await close(server);
});

test("detects Windows-style direct server entrypoint", () => {
  const moduleUrl = new URL("../services/api/server.mjs", import.meta.url);
  const argvPath = fileURLToPath(moduleUrl).replaceAll("/", "\\");

  assert.equal(isMainModule(moduleUrl, argvPath), true);
});

function listen(server) {
  return new Promise((resolve) => server.listen(0, resolve));
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

function serverBaseUrl(server) {
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}
