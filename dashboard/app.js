const statusGrid = document.querySelector("#status-grid");
const historyBody = document.querySelector("#history");
const refreshButton = document.querySelector("#refresh");
const agentRisk = document.querySelector("#agent-risk");
const agentSummary = document.querySelector("#agent-summary");
const agentFindings = document.querySelector("#agent-findings");
const evidenceRisk = document.querySelector("#evidence-risk");
const sbomStatus = document.querySelector("#sbom-status");
const securityStatus = document.querySelector("#security-status");
const pythonSbomStatus = document.querySelector("#python-sbom-status");

refreshButton.addEventListener("click", refresh);
refresh();
setInterval(refresh, 5000);

async function refresh() {
  const [latest, history, telemetrySummary, securitySummary, evidence] = await Promise.all([
    fetchJson("/telemetry/latest"),
    fetchJson("/telemetry/history?limit=20"),
    fetchJson("/agents/telemetry-summary"),
    fetchJson("/agents/security-summary"),
    fetchJson("/evidence/status")
  ]);

  renderLatest(latest.events);
  renderHistory(history.events);
  renderAgentSummary(telemetrySummary);
  renderEvidence(securitySummary, evidence);
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

function renderLatest(events) {
  statusGrid.replaceChildren(...events.map((event) => {
    const card = document.createElement("article");
    card.className = "signal-card";

    const name = document.createElement("h2");
    name.textContent = event.signalName;

    const value = document.createElement("p");
    value.className = "value";
    value.textContent = `${formatValue(event.value, event.unit)} ${event.unit}`;

    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = new Date(event.observedAt).toLocaleString();

    card.append(name, value, meta);
    return card;
  }));
}

function renderHistory(events) {
  historyBody.replaceChildren(...events.map((event) => {
    const row = document.createElement("tr");
    row.append(
      cell(event.signalName),
      cell(`${formatValue(event.value, event.unit)} ${event.unit}`),
      cell(event.source),
      cell(new Date(event.observedAt).toLocaleTimeString())
    );
    return row;
  }));
}

function cell(text) {
  const element = document.createElement("td");
  element.textContent = text;
  return element;
}

function renderAgentSummary(summary) {
  setPill(agentRisk, summary.riskLevel);
  agentSummary.textContent = summary.summary;
  const findings = summary.anomalies?.length ? summary.anomalies : [];

  agentFindings.replaceChildren(...(findings.length ? findings : [{
    message: "No telemetry anomalies detected by the read-only agent."
  }]).map((finding) => {
    const item = document.createElement("li");
    item.textContent = finding.message;
    return item;
  }));
}

function renderEvidence(securitySummary, evidence) {
  setPill(evidenceRisk, securitySummary.riskLevel);
  sbomStatus.textContent = evidence.sbom.exists ? "Generated" : "Missing";
  securityStatus.textContent = evidence.securityScan.exists
    ? `Generated (${evidence.securityScan.findingCount ?? 0} findings)`
    : "Missing";
  pythonSbomStatus.textContent = evidence.pythonLiveDemoSbom.exists ? "Generated" : "Optional";
}

function setPill(element, riskLevel) {
  element.textContent = riskLevel || "pending";
  element.dataset.risk = riskLevel || "pending";
}

function formatValue(value, unit) {
  if (unit === "boolean") {
    return value === 1 ? "true" : "false";
  }

  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
}
