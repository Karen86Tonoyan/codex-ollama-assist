/**
 * OpenHands Client - AI-Driven Development Agent
 * Routes through Guardian Gate for 4-layer security
 */

import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export interface OpenHandsSession {
  id: string;
  user_id: string;
  title: string;
  status: string;
  workspace?: string;
  agent_type: string;
  model?: string;
  guardian_enabled: boolean;
  guardian_verdict?: Record<string, unknown>;
  task?: string;
  output?: string;
  steps?: Record<string, unknown>[];
  error?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

async function callProxy(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Wymagane zalogowanie');

  const response = await fetch(`${SUPABASE_URL}/functions/v1/openhands-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  const result = await response.json();
  if (!response.ok && !result.requires_confirmation) {
    throw new Error(result.error || `HTTP ${response.status}`);
  }
  return result;
}

export async function createSession(params: {
  task?: string;
  workspace?: string;
  agent_type?: string;
  model?: string;
  guardian_enabled?: boolean;
}) {
  return callProxy({ action: 'create_session', ...params });
}

export async function sendTask(sessionId: string, task: string, guardianEnabled = true) {
  return callProxy({
    action: 'send_task',
    session_id: sessionId,
    task,
    guardian_enabled: guardianEnabled,
  });
}

export async function getSessionStatus(sessionId: string) {
  return callProxy({ action: 'get_status', session_id: sessionId });
}

export async function stopSession(sessionId: string) {
  return callProxy({ action: 'stop_session', session_id: sessionId });
}

export async function listSessions(): Promise<OpenHandsSession[]> {
  const result = await callProxy({ action: 'list_sessions' });
  return result.sessions || [];
}

export async function deleteSession(sessionId: string) {
  const { error } = await supabase
    .from('openhands_sessions')
    .delete()
    .eq('id', sessionId);
  if (error) throw error;
}
