"""
Layer 1: Planner (Ollama as Brain)
Generates step-by-step GUI action plans from user goals.
"""
import requests
import json
import time

SYSTEM_PROMPT = """You are a GUI automation planner. Given a user's goal, break it down into precise, sequential GUI actions.

For each step, output JSON:
{
  "step": 1,
  "thought": "Why this action is needed",
  "action": "Description of the GUI action",
  "action_type": "click|type|scroll|key|wait|screenshot",
  "target": "What element to interact with",
  "value": "Text to type or key to press (if applicable)"
}

Output a JSON array of steps. Be precise about element descriptions.
Consider error recovery - include verification steps after critical actions.
"""

DYNAMIC_PROMPT_TEMPLATE = """You are optimizing a GUI automation prompt for UI-TARS vision model.

Context:
- Goal: {goal}
- Current step: {step_number}/{total_steps}
- Previous actions: {history}
- Last result: {last_result}
- Screenshot available: {has_screenshot}

Generate an optimized prompt for UI-TARS that will:
1. Be specific about which element to interact with
2. Include spatial hints (top-left, center, etc.)
3. Reference visual cues (color, icon, text)
4. Account for previous failures if any

Output the optimized prompt as plain text, ready to send to UI-TARS.
"""


def generate_plan(goal: str, ollama_cfg: dict) -> dict:
    """Layer 1: Use Ollama to generate a step-by-step plan."""
    base_url = ollama_cfg.get("base_url", "http://localhost:11434")
    model = ollama_cfg.get("model", "qwen3:latest")
    
    start = time.time()
    try:
        resp = requests.post(
            f"{base_url}/api/generate",
            json={
                "model": model,
                "prompt": f"{SYSTEM_PROMPT}\n\nUser goal: {goal}",
                "stream": False,
                "format": "json",
            },
            timeout=120,
        )
        resp.raise_for_status()
        data = resp.json()
        raw = data.get("response", "")
        
        # Parse JSON from response
        try:
            steps = json.loads(raw)
            if isinstance(steps, dict):
                steps = [steps]
        except json.JSONDecodeError:
            # Try to extract JSON array from text
            import re
            match = re.search(r'\[.*\]', raw, re.DOTALL)
            if match:
                steps = json.loads(match.group())
            else:
                steps = [{"step": 1, "thought": "Direct execution", "action": goal, "action_type": "click", "target": goal}]
        
        latency = int((time.time() - start) * 1000)
        return {
            "ok": True,
            "steps": steps,
            "total_steps": len(steps),
            "model": model,
            "latency_ms": latency,
        }
    except Exception as e:
        return {
            "ok": False,
            "error": str(e),
            "steps": [],
            "total_steps": 0,
            "model": model,
            "latency_ms": int((time.time() - start) * 1000),
        }


def generate_dynamic_prompt(goal: str, step_number: int, total_steps: int,
                            history: list, last_result: str,
                            has_screenshot: bool, ollama_cfg: dict) -> dict:
    """Layer 3: Generate optimized prompt for UI-TARS based on context."""
    base_url = ollama_cfg.get("base_url", "http://localhost:11434")
    model = ollama_cfg.get("model", "qwen3:latest")
    
    history_text = "\n".join([
        f"  Step {h.get('step', '?')}: {h.get('action', '?')} -> {h.get('result', 'pending')}"
        for h in (history or [])[-5:]  # Last 5 actions
    ]) or "None"
    
    prompt = DYNAMIC_PROMPT_TEMPLATE.format(
        goal=goal,
        step_number=step_number,
        total_steps=total_steps,
        history=history_text,
        last_result=last_result or "N/A",
        has_screenshot=has_screenshot,
    )
    
    start = time.time()
    try:
        resp = requests.post(
            f"{base_url}/api/generate",
            json={"model": model, "prompt": prompt, "stream": False},
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        
        return {
            "ok": True,
            "dynamic_prompt": data.get("response", "").strip(),
            "latency_ms": int((time.time() - start) * 1000),
        }
    except Exception as e:
        return {
            "ok": False,
            "dynamic_prompt": f"Execute step {step_number}: {goal}",
            "error": str(e),
            "latency_ms": int((time.time() - start) * 1000),
        }
