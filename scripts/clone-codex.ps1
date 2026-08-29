# Shallow-clone Codex OSS into vendor/codex (the Bazel tree is too large to copy).
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$dest = Join-Path $root 'vendor\codex'
if (Test-Path (Join-Path $dest '.git')) {
  Write-Host "already cloned: $dest"
  exit 0
}
if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
git clone --depth 1 https://github.com/Karen86Tonoyan/codexOPENSOURCE.git $dest
Write-Host "Codex OSS -> $dest"
Write-Host 'Then: .\scripts\use-ollama-for-codex.ps1'
