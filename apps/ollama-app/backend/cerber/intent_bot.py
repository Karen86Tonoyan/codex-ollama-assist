PROCEDURAL_MARKERS = [
    "jak zrobić", "instrukcja", "krok po kroku", "tutorial",
    "how to", "step by step", "guide me", "pokaż jak"
]

def assess_intent(prompt: str) -> dict:
    """Assess user intent from prompt"""
    lower = prompt.lower()
    
    if any(m in lower for m in PROCEDURAL_MARKERS):
        return {"intent": "procedural", "confidence": 0.8}
    
    return {"intent": "educational", "confidence": 0.9}
