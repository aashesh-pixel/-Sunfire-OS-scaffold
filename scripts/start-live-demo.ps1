$ErrorActionPreference = "Stop"
. "$PSScriptRoot\resolve-python.ps1"

$python = Resolve-SunfirePython
& $python demos/phase1_live_demo.py
