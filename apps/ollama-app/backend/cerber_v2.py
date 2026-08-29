"""
CERBER V2 - Pure Logic Arbiter (Backend)

Cerber NIE używa AI. To czysta logika decyzyjna.
Bierze wynik z Qwen Judge i wykonuje wyrok.
"""

from qwen_judge import analyze_prompt

# Hard rules - NO AI
RULES = {
    "block_risk_threshold": 0.7,
    "modify_risk_threshold": 0.5,
    "blocked_intents": ["harmful", "manipulation"],
    "blocked_flags": ["violence", "illegal", "self_harm", "hate_speech"],
    "modify_on_aggressive": True
}


def judge(prompt: str, qwen_cfg: dict) -> dict:
    """
    Full pipeline: Qwen analysis → Cerber decision
    
    Returns:
        {
            "decision": "ALLOW" | "BLOCK" | "MODIFY",
            "verdict": {...},
            "blocked_reason": str | None,
            "modification": str | None
        }
    """
    # Step 1: Get Qwen analysis
    verdict = analyze_prompt(prompt, qwen_cfg)
    
    # Step 2: Apply hard rules (NO AI - pure logic)
    ruling = apply_rules(verdict)
    ruling["verdict"] = verdict
    
    # Log
    print(f"🐕 CERBER V2: {ruling['decision']} | intent={verdict['intent']} risk={verdict['risk']:.2f} flags={verdict['flags']}")
    
    return ruling


def apply_rules(verdict: dict) -> dict:
    """Apply hard rules to Qwen verdict - PURE LOGIC, NO LLM"""
    
    # RULE 1: Qwen said not allowed
    if not verdict.get("allowed", True):
        return {
            "decision": "BLOCK",
            "blocked_reason": verdict.get("reason", "Not allowed by analysis")
        }
    
    # RULE 2: High risk
    risk = verdict.get("risk", 0)
    if risk >= RULES["block_risk_threshold"]:
        return {
            "decision": "BLOCK",
            "blocked_reason": f"Risk {risk:.2f} exceeds threshold {RULES['block_risk_threshold']}"
        }
    
    # RULE 3: Blocked intents
    intent = verdict.get("intent", "")
    if intent in RULES["blocked_intents"]:
        return {
            "decision": "BLOCK",
            "blocked_reason": f"Intent '{intent}' is blocked"
        }
    
    # RULE 4: Blocked flags
    flags = verdict.get("flags", [])
    matched = [f for f in flags if f in RULES["blocked_flags"]]
    if matched:
        return {
            "decision": "BLOCK",
            "blocked_reason": f"Flags blocked: {', '.join(matched)}"
        }
    
    # RULE 5: Aggressive → modify
    if RULES["modify_on_aggressive"] and verdict.get("emotional_state") == "aggressive":
        return {
            "decision": "MODIFY",
            "modification": verdict.get("suggested_modification") or "Please rephrase calmly."
        }
    
    # RULE 6: Medium risk → modify
    if risk >= RULES["modify_risk_threshold"]:
        return {
            "decision": "MODIFY",
            "modification": verdict.get("suggested_modification") or "Proceeding with caution."
        }
    
    # DEFAULT: Allow
    return {"decision": "ALLOW"}
