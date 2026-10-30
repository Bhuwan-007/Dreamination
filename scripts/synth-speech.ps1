# Synthesizes spoken dream dialogue locally into packages/dream-player/public/audio/speech.wav
$ErrorActionPreference = "Stop"

$audioDir = Join-Path $PSScriptRoot "..\packages\dream-player\public\audio"
if (-not (Test-Path $audioDir)) {
    New-Item -ItemType Directory -Path $audioDir -Force | Out-Null
}

$outputPath = Join-Path $audioDir "speech_spike.wav"

Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = -1

# Select an English voice
$voices = $synth.GetInstalledVoices() | Where-Object { $_.Enabled }
if ($voices) {
    $synth.SelectVoice($voices[0].VoiceInfo.Name)
}

$synth.SetOutputToWaveFile($outputPath)
$synth.Speak("The tide is rising, but none of the clocks have hands.")
$synth.Dispose()

Write-Host "Generated speech audio: $outputPath ($((Get-Item $outputPath).Length) bytes)"

