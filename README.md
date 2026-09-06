# Codex + Ollama + Web Assistant

> **Local-development workspace for a Codex snapshot, an Ollama dashboard and a browser assistant**

This repository groups three independently installable projects around a local
Ollama endpoint. It is not a single package manager workspace and its
components should be installed in their own directories.

## Components

```text
apps/ollama-app/       Vite dashboard and FastAPI gateway
apps/web-assistant/    Page Assist browser extension / web UI
vendor/codex/          optional shallow Codex source checkout
scripts/               Windows PowerShell setup, diagnostics and launch helpers
docker-compose.yml     optional local Ollama container
```

The Ollama dashboard includes chat, model, MCP, plugin, workflow, browser,
media and Guard/Cerber-oriented panels. Its Python backend provides a FastAPI
gateway, model routing and UI-TARS-related modules. The web assistant includes
an isolated `extensions/page-action` project that exposes active-tab actions
through Chrome's debugger API.

## Requirements

- Windows PowerShell for the root helper scripts;
- Node.js/npm for `apps/ollama-app`;
- Bun for the Page Assist application and its page-action extension;
- Python for `apps/ollama-app/backend`;
- an Ollama service, normally reachable at `127.0.0.1:11434`.

## Start with diagnostics

The root package declares:

```powershell
npm run doctor
npm run start
```

`doctor` runs `scripts/doctor.ps1`; `start` runs `scripts/start-stack.ps1`.
Review those scripts and install the individual component dependencies before
expecting all services to start.

### Ollama dashboard

```bash
cd apps/ollama-app
npm ci
npm run dev
```

For the gateway:

```bash
cd apps/ollama-app/backend
python -m pip install -r requirements.txt
uvicorn main:app --reload
```

### Browser assistant

Follow `apps/web-assistant/README.md` for its separate Bun/WXT build process.
The root shortcut `npm run assist:build` builds the Chrome target only after
that project's dependencies are available.

## Configuration and privacy

This workspace is designed around a local Ollama address, but optional
providers, browser actions and plugins may have separate configuration.
Do not store model-provider tokens, browser session data or user content in
tracked files. Page-action commands can control the active tab; inspect its
consent and tool implementation before enabling it.

## Status

The repository is an integration workspace with multiple in-progress modules.
A panel being visible does not confirm that a corresponding external service is
installed or configured. Validate each component independently before relying
on it for automation.

## Licence and provenance

See `NOTICE`, the component-level documentation and the vendored-source notes
for applicable terms. No single root licence file is present.
