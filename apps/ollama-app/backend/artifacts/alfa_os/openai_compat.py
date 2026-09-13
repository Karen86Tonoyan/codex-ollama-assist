import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import requests
import yaml
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

compat_router = APIRouter(prefix="/v1", tags=["OpenAI compatible"])

def _load_config() -> Dict[str, Any]:
    config_path = Path(__file__).resolve().parents[2] / "config.yaml"
    with config_path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}

def _ollama_cfg() -> Dict[str, Any]:
    cfg = _load_config()
    return cfg.get("ollama", {})

def _input_to_prompt(value: Union[str, List[Any]]) -> str:
    if isinstance(value, str):
        return value
    if not isinstance(value, list):
        raise HTTPException(status_code=400, detail="'input' must be a string or list")
    parts: List[str] = []
    for item in value:
        if isinstance(item, str):
            parts.append(item)
        elif isinstance(item, dict):
            content = item.get("content", item.get("text", ""))
            if isinstance(content, str):
                parts.append(content)
            elif isinstance(content, list):
                for block in content:
                    if isinstance(block, dict):
                        text = block.get("text")
                        if isinstance(text, str):
                            parts.append(text)
        else:
            parts.append(str(item))
    return "\n".join(part for part in parts if part)

class ResponseRequest(BaseModel):
    model: Optional[str] = Field(None, description="Ollama model name")
    input: Union[str, List[Any]]
    instructions: Optional[str] = None  # system message
    temperature: Optional[float] = None
    max_output_tokens: Optional[int] = None

@compat_router.get("/models")
def list_models():
    cfg = _ollama_cfg()
    base_url = cfg.get("base_url", "http://localhost:11434")
    try:
        response = requests.get(f"{base_url}/api/tags", timeout=5)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Ollama unavailable: {exc}") from exc
    models = response.json().get("models", [])
    return {
        "object": "list",
        "data": [
            {"id": model.get("name"), "object": "model",
             "created": int(time.time()), "owned_by": "ollama"}
            for model in models if model.get("name")
        ],
    }

@compat_router.post("/responses")
def create_response(payload: ResponseRequest):
    cfg = _ollama_cfg()
    base_url = cfg.get("base_url", "http://localhost:11434")
    model = payload.model or cfg.get("model")
    if not model:
        raise HTTPException(status_code=400, detail="No model provided and no default configured")

    messages: List[Dict[str, str]] = []
    if payload.instructions:
        messages.append({"role": "system", "content": payload.instructions})

    user_text = _input_to_prompt(payload.input)
    messages.append({"role": "user", "content": user_text})

    request: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "stream": False,
    }
    options: Dict[str, Any] = {}
    if payload.temperature is not None:
        options["temperature"] = payload.temperature
    if payload.max_output_tokens is not None:
        options["num_predict"] = payload.max_output_tokens
    if options:
        request["options"] = options

    try:
        response = requests.post(f"{base_url}/api/chat", json=request, timeout=120)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Ollama generation failed: {exc}") from exc

    text = response.json().get("message", {}).get("content", "")
    response_id = f"resp_{uuid.uuid4().hex}"
    created_at = int(time.time())
    return {
        "id": response_id,
        "object": "response",
        "created_at": created_at,
        "status": "completed",
        "model": model,
        "output": [
            {
                "id": f"msg_{uuid.uuid4().hex}",
                "type": "message",
                "status": "completed",
                "role": "assistant",
                "content": [{"type": "output_text", "text": text}],
            }
        ],
    }
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import requests
import yaml
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

compat_router = APIRouter(prefix="/v1", tags=["OpenAI compatible"])

def _load_config() -> Dict[str, Any]:
      config_path = Path(__file__).resolve().parents[2] / "config.yaml"
      with config_path.open("r", encoding="utf-8") as f:
                return yaml.safe_load(f) or {}

  def _ollama_cfg() -> Dict[str, Any]:
        cfg = _load_config()
        return cfg.get("ollama", {})

def _input_to_prompt(value: Union[str, List[Any]]) -> str:
      if isinstance(value, str):
                return value
            if not isinstance(value, list):
                      raise HTTPException(status_code=400, detail="'input' must be a string or list")
                  parts: List[str] = []
    for item in value:
              if isinstance(item, str):
                            parts.append(item)
elif isinstance(item, dict):
            content = item.get("content", item.get("text", ""))
            if isinstance(content, str):
                              parts.append(content)
elif isinstance(content, list):
                for block in content:
                                      if isinstance(block, dict):
                                                                text = block.get("text")
                                                                if isinstance(text, str):
                                                                                              parts.append(text)
                                      else:
                                                    parts.append(str(item))
                                            return "\n".join(part for part in parts if part)

class ResponseRequest(BaseModel):
      model: Optional[str] = Field(None, description="Ollama model name")
    input: Union[str, List[Any]]
    instructions: Optional[str] = None  # system message
    temperature: Optional[float] = None
    max_output_tokens: Optional[int] = None

@compat_router.get("/models")
def list_models():
      cfg = _ollama_cfg()
    base_url = cfg.get("base_url", "http://localhost:11434")
    try:
              response = requests.get(f"{base_url}/api/tags", timeout=5)
        response.raise_for_status()
except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Ollama unavailable: {exc}") from exc
    models = response.json().get("models", [])
    return {
              "object": "list",
              "data": [
                            {"id": model.get("name"), "object": "model",
                                          "created": int(time.time()), "owned_by": "ollama"}
                            for model in models if model.get("name")
              ],
    }

@compat_router.post("/responses")
def create_response(payload: ResponseRequest):
      cfg = _ollama_cfg()
    base_url = cfg.get("base_url", "http://localhost:11434")
    model = payload.model or cfg.get("model")
    if not model:
              raise HTTPException(status_code=400, detail="No model provided and no default configured")
    prompt = _input_to_prompt(payload.input)
    if payload.instructions:
              prompt = payload.instructions + "\n\n" + prompt
    request: Dict[str, Any] = {
              "model": model,
              "prompt": prompt,
              "stream": False,
    }
    options: Dict[str, Any] = {}
    if payload.temperature is not None:
              options["temperature"] = payload.temperature
    if payload.max_output_tokens is not None:
              options["num_predict"] = payload.max_output_tokens
    if options:
              request["options"] = options
    try:
              response = requests.post(f"{base_url}/api/generate", json=request, timeout=120)
        response.raise_for_status()
except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Ollama generation failed: {exc}") from exc
    text = response.json().get("response", "")
    response_id = f"resp_{uuid.uuid4().hex}"
    created_at = int(time.time())
    return {
              "id": response_id,
              "object": "response",
              "created_at": created_at,
              "status": "completed",
              "model": model,
              "output": [
                            {
                                              "id": f"msg_{uuid.uuid4().hex}",
                                              "type": "message",
                                              "status": "completed",
                                              "role": "assistant",
                                              "content": [{"type": "output_text", "text": text}],
                            }
              ],
    }
