# ALFA Cerber LLM Gateway

Backend dla ALFA Overlay z 3-sędziowym Cerberem.

## Quick Start

```bash
cd backend
pip install -r requirements.txt
ollama serve  # w osobnym terminalu
ollama pull qwen3:latest
uvicorn main:app --host 0.0.0.0 --port 8765 --reload
```

## Architektura

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                          │
│  [Prompt] → [Engine Toggle] → POST /api/chat        │
└─────────────────────┬───────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│                   CERBER GATE                        │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐         │
│  │ Intent   │  │  Motive   │  │ Decider  │         │
│  │   Bot    │→ │    Bot    │→ │  (3way)  │         │
│  └──────────┘  └───────────┘  └────┬─────┘         │
│                                     │               │
│              BLOCK / REQUIRE_CONFIRM / PASS         │
└─────────────────────┬───────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│                  LLM ROUTER                          │
│  ┌──────────────┐      ┌──────────────┐            │
│  │    OLLAMA    │  OR  │   OPENAI     │            │
│  │   (default)  │      │   (opt-in)   │            │
│  │  qwen3:latest│      │ gpt-4.1-mini │            │
│  └──────────────┘      └──────────────┘            │
└─────────────────────────────────────────────────────┘
```

## API

### POST /api/chat

```json
{
  "prompt": "wytłumacz czym jest AI",
  "engine": "ollama"  // lub "openai"
}
```

Response:
```json
{
  "ok": true,
  "response": "AI to...",
  "decision": "PASS",
  "engine": "ollama"
}
```

## Cerber Decisions

- **PASS** - bezpieczne, przepuść
- **REQUIRE_CONFIRM** - średnie ryzyko, pytaj użytkownika
- **BLOCK** - wysokie ryzyko, zablokuj

## Env

```bash
export OPENAI_API_KEY=sk-...
```
