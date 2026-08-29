"""
Layer 2: Guardian (Ollama as Security Filter)
Validates UI-TARS actions before execution.
"""
import requests
import json
import time

GUARDIAN_PROMPT = """You are a security guardian for a GUI automation system.
Analyze the proposed action and assess its risk.

Action to evaluate:
- Type: {action_type}
- Target: {target}
- Value: {value}
- Context: {context}

Evaluate on these criteria:
1. Data loss risk (deleting files, clearing forms)
2. Privacy risk (accessing passwords, personal data)
3. System damage risk (system settings, registry)
4. Irreversibility (can this be undone?)
5. Scope (affects only target app or system-wide?)

Output JSON:
{{
  "verdict": "ALLOW" | "BLOCK" | "REQUIRE_CONFIRM",
  "risk_score": 0.0-1.0,
  "reason": "Brief explanation",
  "category": "safe|data_loss|privacy|system|irreversible"
}}
"""

# Fast local rules (no LLM needed)
HIGH_RISK_PATTERNS = [
    "delete", "remove", "format", "shutdown", "restart",
    "registry", "regedit", "passwd", "shadow", "sudo",
    "rm -rf", "del /s", "drop table", "truncate",
]

SAFE_PATTERNS = [
    "click", "scroll", "screenshot", "read", "view",
    "open", "navigate", "search", "type text",
]


def quick_assess(action_type: str, target: str, value: str = "") -> dict:
    """Fast rule-based pre-filter (no LLM call)."""
    combined = f"{action_type} {target} {value}".lower()
    
    for pattern in HIGH_RISK_PATTERNS:
        if pattern in combined:
            return {
                "verdict": "REQUIRE_CONFIRM",
                "risk_score": 0.8,
                "reason": f"High-risk pattern detected: '{pattern}'",
                "category": "system",
                "source": "rules",
            }
    
    for pattern in SAFE_PATTERNS:
        if pattern in combined:
            return {
                "verdict": "ALLOW",
                "risk_score": 0.1,
                "reason": "Safe action pattern",
                "category": "safe",
                "source": "rules",
            }
    
    return None  # Needs LLM evaluation


def guardian_evaluate(action_type: str, target: str, value: str,
                      context: str, ollama_cfg: dict) -> dict:
    """Layer 2: Full guardian evaluation with Ollama."""
    
    # Try fast rules first
    quick = quick_assess(action_type, target, value)
    if quick:
        return quick
    
    base_url = ollama_cfg.get("base_url", "http://localhost:11434")
    model = ollama_cfg.get("model", "qwen3:latest")
    
    prompt = GUARDIAN_PROMPT.format(
        action_type=action_type,
        target=target,
        value=value or "N/A",
        context=context or "GUI automation task",
    )
    
    start = time.time()
    try:
        resp = requests.post(
            f"{base_url}/api/generate",
            json={"model": model, "prompt": prompt, "stream": False, "format": "json"},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        raw = data.get("response", "")
        
        result = json.loads(raw)
        result["source"] = "ollama"
        result["latency_ms"] = int((time.time() - start) * 1000)
        return result
    except Exception as e:
        # Fail-closed: block on error
        return {
            "verdict": "REQUIRE_CONFIRM",
            "risk_score": 0.5,
            "reason": f"Guardian evaluation failed: {str(e)}",
            "category": "unknown",
            "source": "fallback",
            "latency_ms": int((time.time() - start) * 1000),
        }
