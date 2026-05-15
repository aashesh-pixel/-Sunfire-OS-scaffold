import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDemoNarrative, buildEvidenceSummary, buildTelemetrySummary, detectTelemetryAnomalies } from "../agents/read-only-insights.mjs";
import { normalizeArdunSignal, AdapterValidationError, listSupportedSignals } from "../adapter/sunfire-adapter.mjs";
import { createTelemetryRepository } from "./repository.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const dashboardRoot = join(__dirname, "../../dashboard");
const repoRoot = resolve(__dirname, "../..");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8"
};

export async function createSunfireServer(options = {}) {
  const repository = options.repository || createTelemetryRepository(options);
  await repository.init();

  const server = createServer(async (request, response) => {
    try {
      await routeRequest(request, response, repository);
    } catch (error) {
      if (error instanceof AdapterValidationError) {
        return sendJson(response, 400, { error: error.message, details: error.details });
      }

      console.error(error);
      return sendJson(response, 500, { error: "Internal server error" });
    }
  });

  server.repository = repository;
  return server;
}

export function isMainModule(moduleUrl, argvPath) {
  return Boolean(argvPath) && fileURLToPath(moduleUrl) === resolve(argvPath);
}

async function routeRequest(request, response, repository) {
  const url = new URL(request.url, "http://localhost");

  if (request.method === "GET" && url.pathname === "/health") {
    return sendJson(response, 200, { status: "ok", service: "sunfire-telemetry-api" });
  }

  if (request.method === "GET" && url.pathname === "/signals/supported") {
    return sendJson(response, 200, { signals: listSupportedSignals() });
  }

  if (request.method === "POST" && url.pathname === "/signals") {
    const payload = await readJson(request);
    const event = normalizeArdunSignal(payload);
    const stored = await repository.insert(event);
    return sendJson(response, 201, { event: stored });
  }

  if (request.method === "GET" && url.pathname === "/telemetry/latest") {
    return sendJson(response, 200, { events: await repository.latest() });
  }

  if (request.method === "GET" && url.pathname === "/telemetry/history") {
    return sendJson(response, 200, {
      events: await repository.history(url.searchParams.get("signal"), url.searchParams.get("limit"))
    });
  }

  if (request.method === "GET" && url.pathname === "/evidence/status") {
    return sendJson(response, 200, await readEvidenceStatus());
  }

  if (request.method === "GET" && url.pathname === "/agents/telemetry-summary") {
    const events = await repository.latest();
    return sendJson(response, 200, buildTelemetrySummary(events, listSupportedSignals()));
  }

  if (request.method === "GET" && url.pathname === "/agents/anomalies") {
    const events = await repository.latest();
    return sendJson(response, 200, {
      agent: "anomaly-detector",
      mode: "read-only",
      anomalies: detectTelemetryAnomalies(events)
    });
  }

  if (request.method === "GET" && url.pathname === "/agents/security-summary") {
    return sendJson(response, 200, buildEvidenceSummary(await readEvidenceStatus()));
  }

  if (request.method === "GET" && url.pathname === "/agents/demo-narrative") {
    const telemetrySummary = buildTelemetrySummary(await repository.latest(), listSupportedSignals());
    const evidenceSummary = buildEvidenceSummary(await readEvidenceStatus());
    return sendJson(response, 200, buildDemoNarrative(telemetrySummary, evidenceSummary));
  }

  if (request.method === "GET") {
    return serveDashboard(url.pathname, response);
  }

  return sendJson(response, 404, { error: "Not found" });
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readEvidenceStatus() {
  const sbom = await readJsonArtifact(join(repoRoot, "evidence/sbom.json"));
  const securityScan = await readJsonArtifact(join(repoRoot, "evidence/security-scan.json"));
  const pythonLiveDemoSbom = await readJsonArtifact(join(repoRoot, "evidence/python-live-demo-sbom.json"));

  return {
    sbom: summarizeArtifact(sbom),
    securityScan: {
      ...summarizeArtifact(securityScan),
      passed: securityScan.data?.passed ?? null,
      findingCount: Array.isArray(securityScan.data?.findings) ? securityScan.data.findings.length : null
    },
    pythonLiveDemoSbom: summarizeArtifact(pythonLiveDemoSbom)
  };
}

async function readJsonArtifact(filePath) {
  try {
    return { exists: true, data: JSON.parse(await readFile(filePath, "utf8")) };
  } catch {
    return { exists: false, data: null };
  }
}

function summarizeArtifact(artifact) {
  return {
    exists: artifact.exists,
    name: artifact.data?.name || artifact.data?.metadata?.component?.name || null,
    generatedAt: artifact.data?.generatedAt || artifact.data?.creationInfo?.created || null
  };
}

async function serveDashboard(pathname, response) {
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  const filePath = join(dashboardRoot, relativePath);

  if (!filePath.startsWith(dashboardRoot)) {
    return sendJson(response, 403, { error: "Forbidden" });
  }

  try {
    await readFile(filePath);
    response.writeHead(200, { "content-type": contentTypes[extname(filePath)] || "application/octet-stream" });
    createReadStream(filePath).pipe(response);
  } catch {
    sendJson(response, 404, { error: "Not found" });
  }
}

if (typeof process !== "undefined" && isMainModule(import.meta.url, process.argv[1])) {
  const port = Number(process.env.PORT || 8080);
  const server = await createSunfireServer();
  server.listen(port, () => {
    console.log(`Sunfire telemetry API listening on http://localhost:${port}`);
  });

  process.on("SIGTERM", async () => {
    server.close();
    await server.repository.close();
  });
}
