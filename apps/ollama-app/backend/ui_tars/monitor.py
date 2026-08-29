"""
Layer 4: Monitor
Tracks session progress, logs events, handles retries and error recovery.
"""
import time
from typing import Optional

# In-memory session state (for backend process)
_sessions: dict = {}


class SessionMonitor:
    """Tracks a single UI-TARS session."""
    
    def __init__(self, session_id: str, goal: str, total_steps: int):
        self.session_id = session_id
        self.goal = goal
        self.total_steps = total_steps
        self.completed_steps = 0
        self.failed_steps = 0
        self.guardian_blocks = 0
        self.events: list = []
        self.start_time = time.time()
        self.status = "running"
    
    def log_event(self, event_type: str, severity: str, message: str,
                  action_id: str = None, metadata: dict = None):
        event = {
            "event_type": event_type,
            "severity": severity,
            "message": message,
            "action_id": action_id,
            "metadata": metadata or {},
            "timestamp": time.time(),
        }
        self.events.append(event)
        return event
    
    def step_completed(self, step: int, result: str):
        self.completed_steps += 1
        self.log_event("step_complete", "info", f"Step {step} completed: {result}")
    
    def step_failed(self, step: int, error: str, can_retry: bool):
        self.failed_steps += 1
        severity = "warn" if can_retry else "error"
        self.log_event("step_failed", severity, f"Step {step} failed: {error}",
                       metadata={"can_retry": can_retry})
    
    def guardian_blocked(self, step: int, reason: str):
        self.guardian_blocks += 1
        self.log_event("guardian_block", "warn", f"Step {step} blocked: {reason}")
    
    def should_retry(self, retry_count: int, max_retries: int) -> bool:
        return retry_count < max_retries
    
    def get_retry_delay(self, retry_count: int) -> float:
        """Exponential backoff: 1s, 2s, 4s, 8s..."""
        return min(2 ** retry_count, 30)
    
    def finish(self, status: str = "done"):
        self.status = status
        duration = time.time() - self.start_time
        self.log_event("session_end", "info",
                       f"Session finished: {status} in {duration:.1f}s",
                       metadata={
                           "duration_s": round(duration, 1),
                           "completed": self.completed_steps,
                           "failed": self.failed_steps,
                           "blocked": self.guardian_blocks,
                       })
    
    def get_summary(self) -> dict:
        return {
            "session_id": self.session_id,
            "goal": self.goal,
            "status": self.status,
            "total_steps": self.total_steps,
            "completed_steps": self.completed_steps,
            "failed_steps": self.failed_steps,
            "guardian_blocks": self.guardian_blocks,
            "duration_s": round(time.time() - self.start_time, 1),
            "events_count": len(self.events),
        }


def create_monitor(session_id: str, goal: str, total_steps: int) -> SessionMonitor:
    monitor = SessionMonitor(session_id, goal, total_steps)
    _sessions[session_id] = monitor
    return monitor


def get_monitor(session_id: str) -> Optional[SessionMonitor]:
    return _sessions.get(session_id)
