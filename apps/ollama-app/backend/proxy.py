import time
import yaml
from cerber.intent_bot import assess_intent
from cerber.motive_bot import assess_motive
from cerber.decider import cerber_decide
from llm.router import call_llm

# Load config
with open("config.yaml") as f:
    cfg = yaml.safe_load(f)

def handle(prompt: str, engine: str = None) -> dict:
    """Main handler with Cerber gate"""
    
    # 1. Cerber assessment
    intent = assess_intent(prompt)
    motive = assess_motive(prompt)
    decision = cerber_decide(intent["intent"], motive["risk"])
    
    # 2. Log decision
    log = {
        "ts": time.time(),
        "intent": intent,
        "risk": motive,
        "decision": decision,
        "engine": engine
    }
    print("CERBER_LOG", log)
    
    # 3. Block if needed
    if decision == "BLOCK":
        return {
            "ok": False,
            "response": "🚫 Zablokowane przez Cerbera",
            "decision": decision,
            "log": log
        }
    
    # 4. Call LLM
    engine = engine or cfg["llm"]["default"]
    response = call_llm(prompt, engine, cfg)
    
    return {
        "ok": True,
        "response": response,
        "decision": decision,
        "engine": engine,
        "log": log
    }
