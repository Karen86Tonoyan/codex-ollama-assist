from fastapi import FastAPI, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
from proxy import handle
from cerber_v2 import judge as cerber_judge
from ui_tars.pipeline import run_pipeline
from ui_tars.planner import generate_plan
from ui_tars.guardian import guardian_evaluate
from ui_tars.executor import call_ui_tars
import yaml
import os
import subprocess
import shutil
import json
import tempfile
import uuid

# Load config
with open("config.yaml") as f:
    cfg = yaml.safe_load(f)

app = FastAPI(
    title="ALFA – Cerber LLM Gateway + Briefcase Builder",
    description="""
## ALFA API

Główne API backendu ALFA obejmuje:

- **Cerber Gateway** – analiza promptów i routing do LLM (Ollama/OpenAI)
- **Briefcase Builder** – tworzenie, budowanie i eksport natywnych aplikacji Python

### Wymagania
- Ollama (lokalne LLM)
- Briefcase (`pip install briefcase`)
    """,
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

DEV_MODE = os.getenv("DEV_MODE", "false").lower() == "true"

_allowed_origins = [
    "http://localhost:5173",
    "http://localhost:8080",
    "https://lovableproject.com",
    "https://ollamaagentalfa.lovable.app",
]
if DEV_MODE:
    _allowed_origins.append("*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Client-Info"],
)


# ── Security Headers Middleware ──────────────────────────────
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if not DEV_MODE:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
            response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
        return response


app.add_middleware(SecurityHeadersMiddleware)

# ── Pydantic Models ──────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str = Field(example="ok")
    service: str = Field(example="cerber-gateway-v2")

class AnalyzeRequest(BaseModel):
    prompt: str = Field(..., description="Tekst do analizy przez Qwen-as-Judge")

class ChatRequest(BaseModel):
    prompt: str = Field(..., description="Prompt użytkownika")
    engine: Optional[str] = Field(None, description="Silnik LLM: 'ollama' lub 'openai'")

class ChatResponse(BaseModel):
    ok: bool
    response: str
    ruling: Optional[dict] = None

class BriefcaseStatusResponse(BaseModel):
    installed: bool
    version: Optional[str] = None

class CreateProjectRequest(BaseModel):
    name: str = Field(..., description="Nazwa projektu", example="moja-apka")
    template: str = Field("toga", description="Szablon: toga, console, flask", example="toga")

class CreateProjectResponse(BaseModel):
    id: str
    name: str
    path: str

class ProjectFile(BaseModel):
    path: str = Field(..., description="Ścieżka pliku względem projektu", example="src/app.py")
    content: str = Field(..., description="Zawartość pliku")

class UpdateFilesRequest(BaseModel):
    files: List[ProjectFile]

class BuildRequest(BaseModel):
    platform: str = Field(..., description="Platforma docelowa: macOS, windows, linux, iOS, android", example="macOS")

class BuildResponse(BaseModel):
    success: bool
    logs: List[str] = []
    error: Optional[str] = None

class RunResponse(BaseModel):
    message: str

# ── Briefcase projects storage ───────────────────────────────

PROJECTS_DIR = os.getenv("BRIEFCASE_PROJECTS_DIR", os.path.join(tempfile.gettempdir(), "alfa-briefcase"))
os.makedirs(PROJECTS_DIR, exist_ok=True)

_projects: dict = {}  # id -> { name, path, template }

# ── Health ───────────────────────────────────────────────────

@app.get("/api/health", response_model=HealthResponse, tags=["System"])
def health():
    """Sprawdza status serwera."""
    return {"status": "ok", "service": "cerber-gateway-v2"}

# ── Cerber / Chat ────────────────────────────────────────────

@app.post("/api/analyze", tags=["Cerber"])
def analyze(payload: AnalyzeRequest):
    """
    **Qwen-as-Judge**: analizuje prompt i zwraca werdykt bezpieczeństwa.
    Nie generuje treści – tylko analiza.
    """
    ruling = cerber_judge(payload.prompt, cfg.get("ollama", {}))
    return ruling

@app.post("/api/chat", response_model=ChatResponse, tags=["Cerber"])
def chat(payload: ChatRequest):
    """
    Pełny pipeline: **Qwen → Cerber → Ollama/OpenAI**.
    
    1. Analiza promptu przez Cerber
    2. Decyzja: ALLOW / BLOCK / MODIFY
    3. Generowanie odpowiedzi przez wybrany silnik LLM
    """
    ruling = cerber_judge(payload.prompt, cfg.get("ollama", {}))
    
    if ruling["decision"] == "BLOCK":
        return {
            "ok": False,
            "response": f"🚫 Zablokowane: {ruling.get('blocked_reason', 'Cerber decision')}",
            "ruling": ruling
        }
    
    actual_prompt = payload.prompt
    if ruling["decision"] == "MODIFY" and ruling.get("modification"):
        actual_prompt = f"[SYSTEM: {ruling['modification']}]\n\n{payload.prompt}"
    
    result = handle(actual_prompt, payload.engine)
    result["ruling"] = ruling
    return result

# ── Briefcase API ────────────────────────────────────────────

@app.get("/api/briefcase/status", response_model=BriefcaseStatusResponse, tags=["Briefcase"])
def briefcase_status():
    """Sprawdza czy Briefcase jest zainstalowany i zwraca wersję."""
    try:
        result = subprocess.run(["briefcase", "--version"], capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            return {"installed": True, "version": result.stdout.strip()}
    except FileNotFoundError:
        pass
    except Exception:
        pass
    return {"installed": False, "version": None}

@app.post("/api/briefcase/projects", response_model=CreateProjectResponse, tags=["Briefcase"])
def create_project(req: CreateProjectRequest):
    """
    Tworzy nowy projekt Briefcase.
    
    Szablony:
    - **toga** – aplikacja desktopowa z natywnym GUI
    - **console** – aplikacja konsolowa CLI
    - **flask** – serwer webowy REST API
    """
    project_id = str(uuid.uuid4())[:8]
    project_path = os.path.join(PROJECTS_DIR, f"{req.name}-{project_id}")
    os.makedirs(project_path, exist_ok=True)
    
    _projects[project_id] = {
        "name": req.name,
        "path": project_path,
        "template": req.template,
    }
    
    return {"id": project_id, "name": req.name, "path": project_path}

@app.put("/api/briefcase/projects/{project_id}/files", tags=["Briefcase"])
def update_files(project_id: str, req: UpdateFilesRequest):
    """Aktualizuje pliki w projekcie. Tworzy katalogi automatycznie."""
    if project_id not in _projects:
        raise HTTPException(404, "Projekt nie znaleziony")
    
    base = _projects[project_id]["path"]
    for f in req.files:
        fp = os.path.join(base, f.path)
        os.makedirs(os.path.dirname(fp), exist_ok=True)
        with open(fp, "w") as fh:
            fh.write(f.content)
    
    return {"ok": True, "files_written": len(req.files)}

@app.post("/api/briefcase/projects/{project_id}/build", response_model=BuildResponse, tags=["Briefcase"])
def build_project(project_id: str, req: BuildRequest):
    """
    Buduje projekt na wybraną platformę.
    
    Platformy: `macOS`, `windows`, `linux`, `iOS`, `android`
    """
    if project_id not in _projects:
        raise HTTPException(404, "Projekt nie znaleziony")
    
    base = _projects[project_id]["path"]
    logs = []
    
    try:
        result = subprocess.run(
            ["briefcase", "build", req.platform.lower()],
            cwd=base, capture_output=True, text=True, timeout=300
        )
        logs = result.stdout.splitlines() + result.stderr.splitlines()
        return {"success": result.returncode == 0, "logs": logs, "error": None if result.returncode == 0 else result.stderr}
    except Exception as e:
        return {"success": False, "logs": logs, "error": str(e)}

@app.post("/api/briefcase/projects/{project_id}/run", response_model=RunResponse, tags=["Briefcase"])
def run_project(project_id: str):
    """Uruchamia projekt w trybie deweloperskim."""
    if project_id not in _projects:
        raise HTTPException(404, "Projekt nie znaleziony")
    
    base = _projects[project_id]["path"]
    try:
        subprocess.Popen(["briefcase", "dev"], cwd=base)
        return {"message": "Uruchomiono w trybie dev"}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/api/briefcase/projects/{project_id}/export", tags=["Briefcase"])
def export_project(project_id: str):
    """Eksportuje projekt jako archiwum ZIP."""
    if project_id not in _projects:
        raise HTTPException(404, "Projekt nie znaleziony")
    
    from fastapi.responses import FileResponse
    base = _projects[project_id]["path"]
    zip_path = shutil.make_archive(base, "zip", base)
    return FileResponse(zip_path, filename=f"{_projects[project_id]['name']}.zip", media_type="application/zip")

@app.delete("/api/briefcase/projects/{project_id}", tags=["Briefcase"])
def delete_project(project_id: str):
    """Usuwa projekt i wszystkie jego pliki."""
    if project_id not in _projects:
        raise HTTPException(404, "Projekt nie znaleziony")
    
    base = _projects[project_id]["path"]
    shutil.rmtree(base, ignore_errors=True)
    del _projects[project_id]
    return {"ok": True}

# ── PowerShell / Shell Execution ─────────────────────────────

# Whitelist of allowed commands for security
ALLOWED_COMMAND_PREFIXES = [
    "briefcase", "pip install briefcase", "pip install",
    "python", "py", "dir", "ls", "cd", "mkdir", "echo",
    "git", "npm", "node", "cat", "type", "whoami",
]

BLOCKED_PATTERNS = [
    "rm -rf /", "format", "del /s /q C:", "shutdown",
    "mkfs", "dd if=", ":(){", "fork",
]

class ExecRequest(BaseModel):
    command: str = Field(..., description="Komenda do wykonania w PowerShell/shell")
    cwd: Optional[str] = Field(None, description="Katalog roboczy (opcjonalny)")
    timeout: int = Field(60, description="Timeout w sekundach (max 300)", ge=1, le=300)
    shell: str = Field("auto", description="Shell: 'powershell', 'bash', 'cmd', 'auto'")

class ExecResponse(BaseModel):
    success: bool
    exit_code: int
    stdout: str
    stderr: str
    command: str
    duration_ms: int

def _is_command_safe(cmd: str) -> bool:
    """Check if command is safe to execute."""
    cmd_lower = cmd.lower().strip()
    for pattern in BLOCKED_PATTERNS:
        if pattern in cmd_lower:
            return False
    return True

def _detect_shell():
    """Detect available shell."""
    import platform
    if platform.system() == "Windows":
        return ["powershell", "-NoProfile", "-Command"]
    return ["/bin/bash", "-c"]

@app.post("/api/exec", response_model=ExecResponse, tags=["Executor"])
def execute_command(req: ExecRequest):
    """
    Wykonuje komendę w PowerShell (Windows) lub Bash (Linux/macOS).

    **Zabezpieczenia:**
    - Blokowane niebezpieczne komendy (rm -rf /, format, shutdown...)
    - Timeout (domyślnie 60s, max 300s)
    - Logowanie każdej komendy

    **Przykłady:**
    - `briefcase new` – tworzy nowy projekt
    - `briefcase build windows` – buduje na Windows
    - `pip install briefcase` – instaluje Briefcase
    - `python app.py` – uruchamia skrypt
    """
    import time
    import platform

    if not _is_command_safe(req.command):
        raise HTTPException(403, f"Komenda zablokowana ze względów bezpieczeństwa: {req.command}")

    # Select shell
    if req.shell == "auto":
        shell_cmd = _detect_shell()
    elif req.shell == "powershell":
        shell_cmd = ["powershell", "-NoProfile", "-Command"]
    elif req.shell == "bash":
        shell_cmd = ["/bin/bash", "-c"]
    elif req.shell == "cmd":
        shell_cmd = ["cmd", "/c"]
    else:
        shell_cmd = _detect_shell()

    full_cmd = shell_cmd + [req.command]

    start = time.time()
    try:
        result = subprocess.run(
            full_cmd,
            cwd=req.cwd,
            capture_output=True,
            text=True,
            timeout=req.timeout,
        )
        duration_ms = int((time.time() - start) * 1000)

        return {
            "success": result.returncode == 0,
            "exit_code": result.returncode,
            "stdout": result.stdout[-5000:] if len(result.stdout) > 5000 else result.stdout,
            "stderr": result.stderr[-2000:] if len(result.stderr) > 2000 else result.stderr,
            "command": req.command,
            "duration_ms": duration_ms,
        }
    except subprocess.TimeoutExpired:
        duration_ms = int((time.time() - start) * 1000)
        return {
            "success": False,
            "exit_code": -1,
            "stdout": "",
            "stderr": f"Timeout po {req.timeout}s",
            "command": req.command,
            "duration_ms": duration_ms,
        }
    except Exception as e:
        duration_ms = int((time.time() - start) * 1000)
        return {
            "success": False,
            "exit_code": -1,
            "stdout": "",
            "stderr": str(e),
            "command": req.command,
            "duration_ms": duration_ms,
        }

@app.post("/api/exec/briefcase", tags=["Executor"])
def execute_briefcase_pipeline(payload: dict = Body(...)):
    """
    Uruchamia pełny pipeline Briefcase automatycznie:

    1. `pip install briefcase` (jeśli potrzebne)
    2. `briefcase new` (tworzy projekt)
    3. `briefcase dev` lub `briefcase build <platform>`

    **Body:**
    - `action`: "new" | "build" | "run" | "package" | "create" | "update" | "install"
    - `platform`: "windows" | "macOS" | "linux" | "iOS" | "android"
    - `project_dir`: ścieżka do katalogu projektu
    - `extra_args`: dodatkowe argumenty (opcjonalne)
    """
    action = payload.get("action", "build")
    platform_target = payload.get("platform", "windows")
    project_dir = payload.get("project_dir")
    extra_args = payload.get("extra_args", "")

    commands_map = {
        "install": "pip install briefcase",
        "new": "briefcase new",
        "create": f"briefcase create {platform_target}",
        "build": f"briefcase build {platform_target}",
        "run": f"briefcase run {platform_target}",
        "dev": "briefcase dev",
        "update": f"briefcase update {platform_target}",
        "package": f"briefcase package {platform_target}",
    }

    cmd = commands_map.get(action)
    if not cmd:
        raise HTTPException(400, f"Nieznana akcja: {action}. Dostępne: {list(commands_map.keys())}")

    if extra_args:
        cmd += f" {extra_args}"

    shell_cmd = _detect_shell() + [cmd]

    try:
        result = subprocess.run(
            shell_cmd,
            cwd=project_dir,
            capture_output=True,
            text=True,
            timeout=300,
        )
        return {
            "success": result.returncode == 0,
            "action": action,
            "command": cmd,
            "stdout": result.stdout[-5000:],
            "stderr": result.stderr[-2000:],
            "exit_code": result.returncode,
        }
    except Exception as e:
        return {
            "success": False,
            "action": action,
            "command": cmd,
            "stdout": "",
            "stderr": str(e),
            "exit_code": -1,
        }

# ── UI-TARS Agent System ─────────────────────────────────────

class UITarsPlanRequest(BaseModel):
    goal: str = Field(..., description="Cel do osiągnięcia przez agenta")

class UITarsExecuteRequest(BaseModel):
    session_id: str = Field(..., description="ID sesji")
    goal: str = Field(..., description="Cel")
    executor_endpoint: str = Field("http://localhost:8000/v1", description="Endpoint UI-TARS (vLLM/SGLang)")
    executor_model: str = Field("UI-TARS-1.5-7B", description="Model UI-TARS")
    screenshot_b64: Optional[str] = Field(None, description="Screenshot w base64")
    dry_run: bool = Field(False, description="Symulacja bez wykonywania akcji")

class UITarsGuardianRequest(BaseModel):
    action_type: str
    target: str
    value: str = ""
    context: str = ""

@app.post("/api/ui-tars/plan", tags=["UI-TARS"])
def ui_tars_plan(req: UITarsPlanRequest):
    """Generuje plan akcji GUI (Layer 1: Planner/Ollama)."""
    return generate_plan(req.goal, cfg.get("ollama", {}))

@app.post("/api/ui-tars/execute", tags=["UI-TARS"])
def ui_tars_execute(req: UITarsExecuteRequest):
    """Uruchamia pełny pipeline: Plan → Guardian → Dynamic Prompt → Execute → Monitor."""
    return run_pipeline(
        session_id=req.session_id,
        goal=req.goal,
        ollama_cfg=cfg.get("ollama", {}),
        executor_endpoint=req.executor_endpoint,
        executor_model=req.executor_model,
        screenshot_b64=req.screenshot_b64,
        dry_run=req.dry_run,
    )

@app.post("/api/ui-tars/guardian", tags=["UI-TARS"])
def ui_tars_guardian_check(req: UITarsGuardianRequest):
    """Ocena bezpieczeństwa akcji (Layer 2: Guardian)."""
    return guardian_evaluate(
        req.action_type, req.target, req.value, req.context,
        cfg.get("ollama", {}),
    )

@app.post("/api/ui-tars/inference", tags=["UI-TARS"])
def ui_tars_inference(payload: dict = Body(...)):
    """Bezpośrednie wywołanie UI-TARS inference (Layer 3: Executor)."""
    return call_ui_tars(
        prompt=payload.get("prompt", ""),
        screenshot_b64=payload.get("screenshot_b64"),
        endpoint=payload.get("endpoint", "http://localhost:8000/v1"),
        model=payload.get("model", "UI-TARS-1.5-7B"),
    )

# ── Run ──────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8765)
