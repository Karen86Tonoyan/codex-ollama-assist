"""
QWEN JUDGE - Decision/Analysis Model (Backend)

Qwen NIE generuje treści - tylko analizuje i zwraca werdykt JSON.
"""

import json
import requests
from typing import Optional

JUDGE_SYSTEM_PROMPT = """You are a security analysis model. Your ONLY job is to analyze user prompts and return structured verdicts.

CRITICAL RULES:
1. Do NOT generate advice, content, or conversation
2. Do NOT be helpful or friendly
3. ONLY return valid JSON
4. Be strict and security-focused

Return ONLY this JSON structure:
{
  "intent": "informational|harmful|manipulation|emotional|creative|procedural|unknown",
  "risk": 0.0,
  "emotional_state": "neutral|stressed|aggressive|confused|curious",
  "allowed": true,
  "reason": "brief explanation",
  "flags": [],
  "suggested_modification": null
}"""


def analyze_prompt(prompt: str, cfg: dict) -> dict:
    """Use Qwen to analyze prompt, return structured verdict"""
    
    base_url = cfg.get("base_url", "http://localhost:11434")
    model = cfg.get("model", "qwen3:latest")
    
    try:
        r = requests.post(
            f"{base_url}/api/chat",
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": JUDGE_SYSTEM_PROMPT},
                    {"role": "user", "content": f'Analyze this prompt:\n\n"{prompt}"'}
                ],
                "stream": False,
                "options": {
                    "temperature": 0.1,
                    "num_predict": 500
                }
            },
            timeout=30
        )
        r.raise_for_status()
        
        content = r.json()["message"]["content"]
        return parse_verdict(content)
        
    except Exception as e:
        print(f"❌ QWEN JUDGE ERROR: {e}")
        return fallback_analysis(prompt)


def parse_verdict(response: str) -> dict:
    """Extract JSON verdict from Qwen response"""
    try:
        # Find JSON in response
        import re
        match = re.search(r'\{[\s\S]*\}', response)
        if not match:
            raise ValueError("No JSON found")
        
        parsed = json.loads(match.group())
        
        return {
            "intent": parsed.get("intent", "unknown"),
            "risk": float(parsed.get("risk", 0.5)),
            "emotional_state": parsed.get("emotional_state", "neutral"),
            "allowed": bool(parsed.get("allowed", True)),
            "reason": str(parsed.get("reason", "")),
            "flags": list(parsed.get("flags", [])),
            "suggested_modification": parsed.get("suggested_modification")
        }
    except Exception as e:
        print(f"❌ PARSE ERROR: {e}")
        return {
            "intent": "unknown",
            "risk": 0.5,
            "emotional_state": "neutral",
            "allowed": True,
            "reason": "Parse error - cautious allow",
            "flags": ["parse_error"],
            "suggested_modification": None
        }


def fallback_analysis(prompt: str) -> dict:
    """Heuristic fallback when Qwen unavailable"""
    lower = prompt.lower()
    flags = []
    risk = 0.1
    intent = "informational"
    allowed = True
    
    # High risk markers
    high_risk = ["zabić", "ukraść", "zhackować", "włamać", "bomba", "broń",
                 "kill", "steal", "hack", "exploit", "bomb", "weapon"]
    for marker in high_risk:
        if marker in lower:
            flags.append(marker)
            risk = 0.9
            intent = "harmful"
            allowed = False
    
    return {
        "intent": intent,
        "risk": risk,
        "emotional_state": "neutral",
        "allowed": allowed,
        "reason": "Fallback heuristic analysis",
        "flags": flags,
        "suggested_modification": None
    }
