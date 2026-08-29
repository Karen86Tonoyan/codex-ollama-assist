HIGH_RISK_MARKERS = [
    "zabić", "ukraść", "zhackować", "włamać", "bomba", "broń",
    "kill", "steal", "hack", "exploit", "bomb", "weapon"
]

def assess_motive(prompt: str) -> dict:
    """Assess risk level from prompt"""
    lower = prompt.lower()
    
    if any(m in lower for m in HIGH_RISK_MARKERS):
        return {"risk": 0.9}
    
    return {"risk": 0.1}
