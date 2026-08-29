"""
Layer 3: Executor (UI-TARS Vision Model)
Sends screenshots + prompts to UI-TARS inference server and parses actions.
"""
import requests
import json
import time
import base64
import re

# UI-TARS action types
ACTION_TYPES = [
    "click", "left_click", "right_click", "double_click",
    "type", "key", "scroll", "drag", "wait", "screenshot",
    "hotkey", "move",
]


def parse_ui_tars_output(raw_output: str) -> dict:
    """
    Parse UI-TARS structured output.
    Expected format:
        Thought: <reasoning>
        Action: <action_type>(param1, param2)
    or
        Thought: <reasoning>
        Action: click(x=500, y=300)
    """
    thought = ""
    action_type = ""
    coordinates = None
    value = ""
    
    lines = raw_output.strip().split("\n")
    for line in lines:
        line = line.strip()
        if line.lower().startswith("thought:"):
            thought = line[len("thought:"):].strip()
        elif line.lower().startswith("action:"):
            action_str = line[len("action:"):].strip()
            # Parse action_type(params)
            match = re.match(r'(\w+)\((.+)\)', action_str)
            if match:
                action_type = match.group(1)
                params_str = match.group(2)
                
                # Try to extract coordinates
                coord_match = re.findall(r'(?:x\s*=\s*)?(\d+)\s*,\s*(?:y\s*=\s*)?(\d+)', params_str)
                if coord_match:
                    coordinates = {"x": int(coord_match[0][0]), "y": int(coord_match[0][1])}
                
                # Extract text value if present
                text_match = re.search(r'"([^"]+)"', params_str)
                if text_match:
                    value = text_match.group(1)
            else:
                action_type = action_str
    
    return {
        "thought": thought,
        "action_type": action_type,
        "coordinates": coordinates,
        "value": value,
        "raw": raw_output,
    }


def call_ui_tars(prompt: str, screenshot_b64: str = None,
                 endpoint: str = "http://localhost:8000/v1",
                 model: str = "UI-TARS-1.5-7B") -> dict:
    """
    Call UI-TARS inference server (vLLM/SGLang compatible).
    Uses OpenAI-compatible chat/completions API.
    """
    start = time.time()
    
    messages = []
    
    # Build message with optional screenshot
    content = []
    if screenshot_b64:
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/png;base64,{screenshot_b64}"}
        })
    content.append({"type": "text", "text": prompt})
    
    messages.append({"role": "user", "content": content})
    
    try:
        resp = requests.post(
            f"{endpoint}/chat/completions",
            json={
                "model": model,
                "messages": messages,
                "max_tokens": 512,
                "temperature": 0.1,
            },
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        
        raw_output = data["choices"][0]["message"]["content"]
        parsed = parse_ui_tars_output(raw_output)
        
        latency = int((time.time() - start) * 1000)
        return {
            "ok": True,
            **parsed,
            "model": model,
            "latency_ms": latency,
        }
    except Exception as e:
        return {
            "ok": False,
            "error": str(e),
            "thought": "",
            "action_type": "",
            "coordinates": None,
            "value": "",
            "raw": "",
            "model": model,
            "latency_ms": int((time.time() - start) * 1000),
        }


def execute_action_locally(action_type: str, coordinates: dict = None,
                           value: str = "") -> dict:
    """
    Execute parsed action using pyautogui (if available).
    This runs on the local machine where the backend is hosted.
    """
    try:
        import pyautogui
        pyautogui.FAILSAFE = True
        pyautogui.PAUSE = 0.3
        
        if action_type in ("click", "left_click"):
            if coordinates:
                pyautogui.click(coordinates["x"], coordinates["y"])
            return {"ok": True, "executed": f"click({coordinates})"}
        
        elif action_type == "right_click":
            if coordinates:
                pyautogui.rightClick(coordinates["x"], coordinates["y"])
            return {"ok": True, "executed": f"right_click({coordinates})"}
        
        elif action_type == "double_click":
            if coordinates:
                pyautogui.doubleClick(coordinates["x"], coordinates["y"])
            return {"ok": True, "executed": f"double_click({coordinates})"}
        
        elif action_type == "type":
            pyautogui.typewrite(value, interval=0.02)
            return {"ok": True, "executed": f"type('{value[:50]}...')"}
        
        elif action_type == "key":
            pyautogui.press(value)
            return {"ok": True, "executed": f"key('{value}')"}
        
        elif action_type == "hotkey":
            keys = [k.strip() for k in value.split("+")]
            pyautogui.hotkey(*keys)
            return {"ok": True, "executed": f"hotkey('{value}')"}
        
        elif action_type == "scroll":
            amount = int(value) if value else -3
            pyautogui.scroll(amount)
            return {"ok": True, "executed": f"scroll({amount})"}
        
        elif action_type == "move":
            if coordinates:
                pyautogui.moveTo(coordinates["x"], coordinates["y"])
            return {"ok": True, "executed": f"move({coordinates})"}
        
        elif action_type == "screenshot":
            import io
            img = pyautogui.screenshot()
            buffer = io.BytesIO()
            img.save(buffer, format="PNG")
            b64 = base64.b64encode(buffer.getvalue()).decode()
            return {"ok": True, "executed": "screenshot", "screenshot_b64": b64}
        
        elif action_type == "wait":
            import time as t
            wait_s = float(value) if value else 1.0
            t.sleep(min(wait_s, 10))
            return {"ok": True, "executed": f"wait({wait_s}s)"}
        
        else:
            return {"ok": False, "error": f"Unknown action type: {action_type}"}
    
    except ImportError:
        return {"ok": False, "error": "pyautogui not installed. Run: pip install pyautogui"}
    except Exception as e:
        return {"ok": False, "error": str(e)}
