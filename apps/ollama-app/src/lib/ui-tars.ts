import { supabase } from '@/integrations/supabase/client';

const BACKEND_URL = 'http://localhost:8765';

export interface UITarsPlanStep {
  step: number;
  thought: string;
  action: string;
  action_type: string;
  target?: string;
  value?: string;
}

export interface UITarsSession {
  id: string;
  user_id: string;
  title: string;
  goal: string | null;
  status: string;
  planner_model: string;
  executor_endpoint: string;
  executor_model: string;
  total_steps: number;
  completed_steps: number;
  failed_steps: number;
  guardian_blocks: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface UITarsAction {
  id: string;
  session_id: string;
  step_number: number;
  phase: string;
  plan_thought: string | null;
  plan_action: string | null;
  executor_thought: string | null;
  executor_action_type: string | null;
  executor_coordinates: Record<string, number> | null;
  guardian_verdict: string;
  guardian_risk_score: number | null;
  guardian_reason: string | null;
  dynamic_prompt: string | null;
  screenshot_url: string | null;
  result: string | null;
  status: string;
  retry_count: number;
  latency_ms: number | null;
  error: string | null;
  created_at: string;
}

export interface UITarsMonitorEvent {
  id: string;
  session_id: string | null;
  action_id: string | null;
  event_type: string;
  severity: string;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// Plan generation via local backend
export async function generatePlan(goal: string): Promise<{ ok: boolean; steps: UITarsPlanStep[]; error?: string }> {
  try {
    const resp = await fetch(`${BACKEND_URL}/api/ui-tars/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal }),
    });
    return await resp.json();
  } catch (e) {
    return { ok: false, steps: [], error: String(e) };
  }
}

// Full pipeline execution via local backend
export async function executePipeline(params: {
  sessionId: string;
  goal: string;
  executorEndpoint?: string;
  executorModel?: string;
  screenshotB64?: string;
  dryRun?: boolean;
}) {
  try {
    const resp = await fetch(`${BACKEND_URL}/api/ui-tars/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: params.sessionId,
        goal: params.goal,
        executor_endpoint: params.executorEndpoint || 'http://localhost:8000/v1',
        executor_model: params.executorModel || 'UI-TARS-1.5-7B',
        screenshot_b64: params.screenshotB64,
        dry_run: params.dryRun || false,
      }),
    });
    return await resp.json();
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// Guardian check via local backend
export async function guardianCheck(action: {
  actionType: string;
  target: string;
  value?: string;
  context?: string;
}) {
  try {
    const resp = await fetch(`${BACKEND_URL}/api/ui-tars/guardian`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action_type: action.actionType,
        target: action.target,
        value: action.value || '',
        context: action.context || '',
      }),
    });
    return await resp.json();
  } catch (e) {
    return { verdict: 'REQUIRE_CONFIRM', risk_score: 0.5, reason: String(e) };
  }
}

// Supabase CRUD for sessions
export async function createSession(userId: string, goal: string, title?: string) {
  const { data, error } = await supabase
    .from('ui_tars_sessions')
    .insert([{ user_id: userId, goal, title: title || goal.slice(0, 60), status: 'planning' }] as never)
    .select()
    .single();
  return { data, error };
}

export async function fetchSessions(userId: string) {
  return supabase
    .from('ui_tars_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);
}

export async function updateSessionStatus(sessionId: string, status: string) {
  return supabase
    .from('ui_tars_sessions')
    .update({ status } as never)
    .eq('id', sessionId);
}

export async function insertAction(action: {
  session_id: string;
  step_number: number;
  phase: string;
  plan_thought?: string;
  plan_action?: string;
  guardian_verdict?: string;
  guardian_risk_score?: number;
  guardian_reason?: string;
  dynamic_prompt?: string;
  executor_thought?: string;
  executor_action_type?: string;
  executor_coordinates?: Record<string, number>;
  status: string;
}) {
  return supabase.from('ui_tars_actions').insert([action] as never).select().single();
}

export async function fetchActions(sessionId: string) {
  return supabase
    .from('ui_tars_actions')
    .select('*')
    .eq('session_id', sessionId)
    .order('step_number', { ascending: true });
}

export async function insertMonitorEvent(event: {
  session_id: string;
  action_id?: string;
  event_type: string;
  severity: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  return supabase.from('ui_tars_monitor').insert([event] as never);
}

export async function fetchMonitorEvents(sessionId: string) {
  return supabase
    .from('ui_tars_monitor')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(100);
}
