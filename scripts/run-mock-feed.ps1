$ErrorActionPreference = "Stop"
. "$PSScriptRoot\resolve-node.ps1"

$node = Resolve-SunfireNode
& $node services/mock-feed/mock-feed.mjs
