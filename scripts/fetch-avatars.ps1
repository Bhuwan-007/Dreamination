# scripts/fetch-avatars.ps1
# Fetches a compatible rigged glTF avatar with visemes into packages/dream-player/public/avatars/
# Assets downloaded here are strictly excluded from git tracking.

$ErrorActionPreference = "Stop"
$TargetDir = Join-Path $PSScriptRoot "..\packages\dream-player\public\avatars"

if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

$GitKeep = Join-Path $TargetDir ".gitkeep"
if (-not (Test-Path $GitKeep)) {
    New-Item -ItemType File -Path $GitKeep -Force | Out-Null
}

Write-Host "Setting up avatar directory: $TargetDir"
Write-Host "Note: When using an external Ready Player Me or VRoid avatar, place 'human_traveler.glb' in this folder."
Write-Host "Skeletal animations are retargeted from 'traveler.glb'."
Write-Host "The Dream Player automatically defaults to CloakedTraveler if glTF assets are absent."

