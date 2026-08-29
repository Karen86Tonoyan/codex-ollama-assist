import requests

def call_ollama(prompt: str, cfg: dict) -> str:
    """Call local Ollama instance"""
    r = requests.post(
        f"{cfg['base_url']}/api/generate",
        json={"model": cfg["model"], "prompt": prompt, "stream": False},
        timeout=60
    )
    r.raise_for_status()
    return r.json()["response"]
