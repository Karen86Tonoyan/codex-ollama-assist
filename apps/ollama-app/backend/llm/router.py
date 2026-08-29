import requests
from llm.ollama import call_ollama

# Cloud fallback via Lovable AI Gateway (edge function)
CLOUD_GATEWAY = None  # set dynamically from env or config

def _ollama_available(cfg: dict) -> bool:
    """Quick health check for local Ollama."""
    try:
        r = requests.get(f"{cfg['base_url']}/api/tags", timeout=3)
        return r.status_code == 200
    except Exception:
        return False


def _call_cloud(prompt: str, cfg: dict) -> str:
    """Fallback: call cloud via alfa-chat edge function."""
    import os
    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_key = os.getenv("SUPABASE_ANON_KEY", "")
    if not supabase_url:
        raise RuntimeError("Cloud fallback unavailable — no SUPABASE_URL configured")

    resp = requests.post(
        f"{supabase_url}/functions/v1/alfa-chat",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {supabase_key}",
        },
        json={
            "messages": [{"role": "user", "content": prompt}],
            "model": "google/gemini-3-flash-preview",
        },
        timeout=60,
    )
    resp.raise_for_status()
    # Non-streaming: collect full response
    text = ""
    for line in resp.text.strip().split("\n"):
        if line.startswith("data: "):
            payload = line[6:].strip()
            if payload == "[DONE]":
                break
            try:
                import json
                parsed = json.loads(payload)
                content = parsed.get("choices", [{}])[0].get("delta", {}).get("content", "")
                text += content
            except Exception:
                pass
    return text or resp.text


def call_llm(prompt: str, engine: str, cfg: dict) -> str:
    """
    Route to LLM: always try local Ollama first.
    Only fall back to cloud if Ollama is unavailable.
    """
    ollama_cfg = cfg.get("ollama", {})

    # 1. Always try Ollama first (regardless of engine param)
    if _ollama_available(ollama_cfg):
        try:
            return call_ollama(prompt, ollama_cfg)
        except Exception as e:
            print(f"[LLM Router] Ollama call failed: {e}, falling back to cloud")

    # 2. Ollama unavailable or failed → cloud fallback
    if cfg.get("llm", {}).get("allow_cloud", True):
        print("[LLM Router] Ollama offline → routing to cloud")
        return _call_cloud(prompt, cfg)

    raise RuntimeError("Ollama is offline and cloud fallback is disabled")
