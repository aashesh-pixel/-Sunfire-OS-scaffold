$ErrorActionPreference = "Stop"
. "$PSScriptRoot\resolve-node.ps1"

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
  throw "Docker was not found. Install/start Docker Desktop, then rerun this script."
}

$node = Resolve-SunfireNode

Write-Host "Starting PostgreSQL-backed Sunfire OS stack..."
docker compose up --build -d

Write-Host "Waiting for API health..."
$healthy = $false
for ($i = 0; $i -lt 30; $i++) {
  try {
    $health = Invoke-RestMethod "http://127.0.0.1:8080/health"
    if ($health.status -eq "ok") {
      $healthy = $true
      break
    }
  } catch {
    Start-Sleep -Seconds 2
  }
}

if (-not $healthy) {
  docker compose logs api
  throw "Sunfire API did not become healthy."
}

Write-Host "Publishing mock telemetry..."
& $node services/mock-feed/mock-feed.mjs

Write-Host "Checking latest telemetry..."
$latest = Invoke-RestMethod "http://127.0.0.1:8080/telemetry/latest"
if (-not $latest.events -or $latest.events.Count -lt 1) {
  throw "No telemetry returned from PostgreSQL-backed API."
}

Write-Host "Checking read-only AI agent endpoint..."
$summary = Invoke-RestMethod "http://127.0.0.1:8080/agents/telemetry-summary"
if ($summary.mode -ne "read-only") {
  throw "Agent endpoint did not report read-only mode."
}

Write-Host "PostgreSQL proof succeeded."
Write-Host "Dashboard: http://localhost:8080"
