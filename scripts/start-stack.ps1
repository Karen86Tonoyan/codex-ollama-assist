# Start the local stack: Ollama (if down) + Ollama app (Vite) + print Page Assist / Codex hints.
$ErrorActionPreference = 'Continue'
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host '=== 1. Ollama ==='
$ollamaUp = $false
try {
  Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2 | Out-Null
  $ollamaUp = $true
} catch {}
if (-not $ollamaUp) {
  Write-Host 'starting ollama serve ...'
  Start-Process -FilePath 'ollama' -ArgumentList 'serve' -WindowStyle Minimized
  Start-Sleep -Seconds 3
}
Write-Host 'Ollama: http://127.0.0.1:11434'

Write-Host '=== 2. Codex config ==='
& (Join-Path $PSScriptRoot 'use-ollama-for-codex.ps1')

Write-Host '=== 3. Ollama web app (Vite) ==='
$app = Join-Path (Get-Location) 'apps\ollama-app'
if (-not (Test-Path (Join-Path $app 'node_modules'))) {
  Write-Host 'npm install in apps/ollama-app ...'
  Push-Location $app
  npm install
  Pop-Location
}
Start-Process -FilePath 'npm' -ArgumentList 'run','dev' -WorkingDirectory $app
Write-Host 'Ollama app: http://localhost:5173  (default Vite)'

Write-Host '=== 4. Web assistant (Page Assist) ==='
Write-Host 'Build once, then load unpacked in Chrome:'
Write-Host '  cd apps\web-assistant'
Write-Host '  bun install'
Write-Host '  bun run build:chrome'
Write-Host '  chrome://extensions -> Load unpacked -> apps\web-assistant\.output\chrome-mv3'
Write-Host 'Ollama URL inside the extension: http://127.0.0.1:11434'
Write-Host ''
Write-Host '=== 5. Codex CLI ==='
Write-Host '  cd vendor\codex   (or install the published CLI)'
Write-Host '  codex --model gpt-oss:20b-gpu'
Write-Host ''
Write-Host 'HOLD stays HOLD. Do not send tab HTML to Ollama in Secure Mode without the gateway.'
