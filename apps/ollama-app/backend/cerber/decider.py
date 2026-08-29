def cerber_decide(intent: str, risk: float) -> str:
    """Three-judge decision gate"""
    if intent == "procedural" and risk > 0.7:
        return "BLOCK"
    if risk > 0.4:
        return "REQUIRE_CONFIRM"
    return "PASS"
