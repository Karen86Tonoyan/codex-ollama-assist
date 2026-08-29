$ErrorActionPreference = 'Continue'
Write-Host '=== doctor: Codex + Ollama + web assistant ==='
Write-Host ('cwd  = ' + (Get-Location))
Write-Host ('time = ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))

function Ok($ok, $msg) {
  if ($ok) { Write-Host "[OK]  $msg" -ForegroundColor Green }
  else { Write-Host "[--]  $msg" -ForegroundColor Yellow }
}

$ollama = Get-Command ollama -ErrorAction SilentlyContinue
Ok $null -ne $ollama 'ollama on PATH'
if ($ollama) {
  try {
    $tags = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 3
    Ok $true ('Ollama API up, models=' + @($tags.models).Count)
    $names = @($tags.models | ForEach-Object { $_.name })
    Ok ($names -contains 'gpt-oss:20b-gpu') 'gpt-oss:20b-gpu present'
  } catch {
    Ok $false 'Ollama API not answering on 127.0.0.1:11434'
  }
}

Ok (Test-Path 'apps\web-assistant\package.json') 'apps/web-assistant (Page Assist)'
Ok (Test-Path 'apps\ollama-app\package.json') 'apps/ollama-app (Ollama dashboard)'
Ok (Test-Path 'vendor\codex\README.md') 'vendor/codex submodule checked out'
Ok (Test-Path 'config\codex-ollama.toml') 'config/codex-ollama.toml'

$bun = Get-Command bun -ErrorAction SilentlyContinue
$node = Get-Command node -ErrorAction SilentlyContinue
Ok $null -ne $bun 'bun on PATH (web-assistant)'
Ok $null -ne $node 'node on PATH (ollama-app)'

Write-Host ''
Write-Host 'Next:  .\scripts\start-stack.ps1'
