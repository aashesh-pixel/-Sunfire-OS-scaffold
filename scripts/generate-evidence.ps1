$ErrorActionPreference = "Stop"
. "$PSScriptRoot\resolve-node.ps1"

$node = Resolve-SunfireNode
& $node scripts/generate-sbom.mjs
& $node scripts/security-scan.mjs
