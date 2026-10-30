# scripts/fetch-animations.ps1
# Sets up packages/dream-player/public/animations/ for external Mixamo / RPM animation clips.

$ErrorActionPreference = "Stop"
$TargetDir = Join-Path $PSScriptRoot "..\packages\dream-player\public\animations"

if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

$GitKeep = Join-Path $TargetDir ".gitkeep"
if (-not (Test-Path $GitKeep)) {
    New-Item -ItemType File -Path $GitKeep -Force | Out-Null
}

Write-Host "Animation clips directory prepared: $TargetDir"
Write-Host "The player uses procedural walk bob and idle sway if external clips are absent."

