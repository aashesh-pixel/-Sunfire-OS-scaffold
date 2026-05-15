$ErrorActionPreference = "Stop"
. "$PSScriptRoot\resolve-node.ps1"

$node = Resolve-SunfireNode
& $node --test tests/*.test.mjs
