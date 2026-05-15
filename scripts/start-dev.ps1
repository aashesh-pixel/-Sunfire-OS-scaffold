$ErrorActionPreference = "Stop"
. "$PSScriptRoot\resolve-node.ps1"

$env:PORT = if ($env:PORT) { $env:PORT } else { "8080" }
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
$node = Resolve-SunfireNode

Write-Host "Starting Sunfire OS telemetry API on http://localhost:$env:PORT"
Write-Host "Using in-memory storage because DATABASE_URL is not set."
& $node services/api/server.mjs
