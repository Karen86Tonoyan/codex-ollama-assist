# Installs config/codex-ollama.toml as %USERPROFILE%\.codex\config.toml
# Backs up an existing file once.
$ErrorActionPreference = 'Stop'
$src = Join-Path $PSScriptRoot '..\config\codex-ollama.toml' | Resolve-Path
$destDir = Join-Path $env:USERPROFILE '.codex'
$dest = Join-Path $destDir 'config.toml'
New-Item -ItemType Directory -Force -Path $destDir | Out-Null
if (Test-Path $dest) {
  $bak = "$dest.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
  Copy-Item $dest $bak
  Write-Host "backed up $dest -> $bak"
}
Copy-Item $src $dest -Force
Write-Host "Codex now points at Ollama: $dest"
Write-Host 'model = gpt-oss:20b-gpu   base = http://127.0.0.1:11434/v1'
