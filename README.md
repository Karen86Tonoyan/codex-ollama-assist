# Codex + Ollama + Web Assistant

Jedno repo: **Codex OSS**, **aplikacja Ollama** (dashboard) i **web asystent** (Page Assist). Wszystkie trzy mówią do lokalnego Ollama na `127.0.0.1:11434`.

To **nie** jest zlepka Page Assist + AlfaBrowserautomation + UI-TARS w jeden merge. Bramka HOLD/ALLOW zostaje osobno.

```
┌──────────────────────┐   ┌─────────────────────┐   ┌──────────────────┐
│ apps/web-assistant   │   │ apps/ollama-app     │   │ vendor/codex     │
│ Page Assist (WXT)    │   │ Vite dashboard      │   │ Codex OSS (CLI)  │
│ sidebar + chat strony│   │ panele Ollama/MCP   │   │ agent w terminalu│
└──────────┬───────────┘   └──────────┬──────────┘   └────────┬─────────┘
           │                          │                       │
           └──────────────┬───────────┴───────────────────────┘
                          ▼
                 http://127.0.0.1:11434
                    Ollama
                 gpt-oss:20b-gpu
```

## Layout

| Path | Source | Role |
|---|---|---|
| `vendor/codex/` | [Karen86Tonoyan/codexOPENSOURCE](https://github.com/Karen86Tonoyan/codexOPENSOURCE) (`scripts/clone-codex.ps1`) | Codex CLI / agent |
| `apps/ollama-app/` | lokalne `ollamaagentalfa-main` | web UI Ollama |
| `apps/web-assistant/` | lokalne `page-assistALFA` | rozszerzenie: sidebar + chat ze stroną |
| `config/codex-ollama.toml` | to repo | Codex → Ollama `/v1` |
| `scripts/` | to repo | `doctor`, `start-stack`, `use-ollama-for-codex` |

## Wymagania

- Ollama na `127.0.0.1:11434`
- model `gpt-oss:20b-gpu` (MXFP4). **Nie** `gpt-oss-20b-unblocked` (Qwen F16, 32k)
- Node 20+ (dashboard)
- Bun (Page Assist)
- Git (clone Codex do `vendor/codex`)

## Start

```powershell
cd C:\Users\PC\codex-ollama-assist
.\scripts\clone-codex.ps1          # vendor/codex  (płytki clone, bez kopiowania Bazela do tego repo)
.\scripts\doctor.ps1
.\scripts\start-stack.ps1
```

1. Ollama — `http://127.0.0.1:11434`
2. Dashboard — `http://localhost:5173`
3. Page Assist — `bun install` + `bun run build:chrome` w `apps/web-assistant`, potem Chrome → Load unpacked → `.output/chrome-mv3`
4. Codex — `.\scripts\use-ollama-for-codex.ps1`, potem `codex --model gpt-oss:20b-gpu`

## Zasady

- **HOLD zostaje HOLD.** W Secure Mode Page Assist nie wysyła treści karty do Ollama, dopóki bramka nie powie ALLOW/SANITIZE.
- Ollama tylko na localhost. Nie wystawiaj `11434` na WAN.
- `.env` nie wchodzi do gita.

## Licencje

- Codex OSS — Apache-2.0 (upstream OpenAI, fork Karen86Tonoyan)
- Page Assist — oryginalna licencja n4ze3m w `apps/web-assistant/LICENCE`
- Dashboard — jak w `apps/ollama-app`
