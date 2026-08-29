"""
UI-TARS Full Pipeline
Orchestrates: Planner → Guardian → Dynamic Prompt → Executor → Monitor
"""
import time
from typing import Optional
from .planner import generate_plan, generate_dynamic_prompt
from .guardian import guardian_evaluate
from .executor import call_ui_tars, execute_action_locally, parse_ui_tars_output
from .monitor import create_monitor, SessionMonitor


def run_pipeline(session_id: str, goal: str, ollama_cfg: dict,
                 executor_endpoint: str = "http://localhost:8000/v1",
                 executor_model: str = "UI-TARS-1.5-7B",
                 screenshot_b64: str = None,
                 dry_run: bool = False) -> dict:
    """
    Full 4-layer pipeline execution.
    
    1. Planner (Ollama) generates step plan
    2. For each step:
       a. Guardian evaluates safety
       b. Dynamic prompt optimizer enriches prompt
       c. Executor (UI-TARS) determines GUI action
       d. Action is executed (unless dry_run)
       e. Monitor logs everything
    """
    results = {
        "session_id": session_id,
        "goal": goal,
        "steps": [],
        "status": "running",
    }
    
    # Step 1: Plan
    plan = generate_plan(goal, ollama_cfg)
    if not plan["ok"]:
        return {**results, "status": "error", "error": f"Planning failed: {plan.get('error')}"}
    
    steps = plan["steps"]
    monitor = create_monitor(session_id, goal, len(steps))
    
    results["plan"] = plan
    
    # Step 2: Execute each step
    history = []
    for i, step in enumerate(steps):
        step_num = i + 1
        step_result = {
            "step": step_num,
            "plan": step,
            "guardian": None,
            "dynamic_prompt": None,
            "executor": None,
            "execution": None,
            "status": "pending",
        }
        
        action_type = step.get("action_type", "click")
        target = step.get("target", "")
        value = step.get("value", "")
        
        # 2a. Guardian check
        guardian = guardian_evaluate(action_type, target, value, goal, ollama_cfg)
        step_result["guardian"] = guardian
        
        if guardian["verdict"] == "BLOCK":
            step_result["status"] = "blocked"
            monitor.guardian_blocked(step_num, guardian["reason"])
            results["steps"].append(step_result)
            continue
        
        if guardian["verdict"] == "REQUIRE_CONFIRM":
            step_result["status"] = "awaiting_confirm"
            monitor.log_event("guardian_confirm", "warn",
                              f"Step {step_num} needs confirmation: {guardian['reason']}")
            results["steps"].append(step_result)
            results["status"] = "awaiting_confirm"
            return results  # Pause pipeline, wait for user
        
        # 2b. Dynamic prompt
        dynamic = generate_dynamic_prompt(
            goal, step_num, len(steps), history,
            history[-1].get("result", "") if history else "",
            screenshot_b64 is not None, ollama_cfg
        )
        step_result["dynamic_prompt"] = dynamic.get("dynamic_prompt", "")
        
        # 2c. UI-TARS execution
        prompt_for_tars = dynamic.get("dynamic_prompt", step.get("action", goal))
        executor_result = call_ui_tars(
            prompt_for_tars, screenshot_b64, executor_endpoint, executor_model
        )
        step_result["executor"] = executor_result
        
        if not executor_result.get("ok"):
            step_result["status"] = "error"
            monitor.step_failed(step_num, executor_result.get("error", "Unknown"), True)
            results["steps"].append(step_result)
            history.append({"step": step_num, "action": step.get("action"), "result": "error"})
            continue
        
        # 2d. Execute action locally
        if not dry_run:
            execution = execute_action_locally(
                executor_result.get("action_type", ""),
                executor_result.get("coordinates"),
                executor_result.get("value", ""),
            )
            step_result["execution"] = execution
            
            if execution.get("ok"):
                step_result["status"] = "done"
                monitor.step_completed(step_num, execution.get("executed", ""))
            else:
                step_result["status"] = "error"
                monitor.step_failed(step_num, execution.get("error", ""), True)
        else:
            step_result["status"] = "dry_run"
            step_result["execution"] = {"ok": True, "executed": "DRY RUN - no action taken"}
            monitor.step_completed(step_num, "dry_run")
        
        results["steps"].append(step_result)
        history.append({
            "step": step_num,
            "action": step.get("action"),
            "result": step_result["status"],
        })
    
    # Finish
    all_done = all(s["status"] in ("done", "dry_run") for s in results["steps"])
    has_errors = any(s["status"] == "error" for s in results["steps"])
    
    if all_done:
        results["status"] = "done"
        monitor.finish("done")
    elif has_errors:
        results["status"] = "partial"
        monitor.finish("partial")
    else:
        monitor.finish(results["status"])
    
    results["summary"] = monitor.get_summary()
    return results
