/**
 * Pipeline Engine — orchestrates multi-step task pipelines
 * with auto-healing, retry logic, and agent assignment
 */

import { supabase } from '@/integrations/supabase/client';
import { executePlugin } from '@/lib/plugin-service';

// ── Types ──

export interface PipelineStep {
  name: string;
  agent_type: string;      // ollama, cloud, plugin
  action: string;           // plugin name or action identifier
  params: Record<string, unknown>;
  depends_on?: number[];    // step indices this depends on
  timeout_ms?: number;
}

export interface RetryPolicy {
  max_retries: number;
  backoff_ms: number;
  backoff_multiplier: number;
}

export interface StepResult {
  step_index: number;
  status: 'success' | 'error' | 'skipped';
  output: unknown;
  error?: string;
  duration_ms: number;
  retries: number;
}

// ── Retry wrapper with exponential backoff ──

export async function withRetry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy,
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> {
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt <= policy.max_retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < policy.max_retries) {
        const delay = policy.backoff_ms * Math.pow(policy.backoff_multiplier, attempt);
        onRetry?.(attempt + 1, lastError);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Step executor ──

async function executeStep(
  step: PipelineStep,
  prevResults: StepResult[]
): Promise<unknown> {
  // Inject outputs from dependency steps into params
  const resolvedParams = { ...step.params };
  if (step.depends_on) {
    for (const depIdx of step.depends_on) {
      const depResult = prevResults[depIdx];
      if (depResult?.status === 'success') {
        resolvedParams[`step_${depIdx}_output`] = depResult.output;
      }
    }
  }

  switch (step.agent_type) {
    case 'plugin': {
      const result = await executePlugin(step.action, resolvedParams);
      if (!result.success) throw new Error(result.error || 'Plugin failed');
      return result.result;
    }

    case 'ollama': {
      const response = await fetch('http://127.0.0.1:8765/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: resolvedParams.prompt || step.action,
          model: resolvedParams.model || 'llama3',
        }),
        signal: AbortSignal.timeout(step.timeout_ms || 60000),
      });
      if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
      return await response.json();
    }

    case 'cloud': {
      // Use edge function for cloud AI tasks
      const { data, error } = await supabase.functions.invoke('alfa-chat', {
        body: {
          message: resolvedParams.prompt || step.action,
          model: resolvedParams.model || 'gemini-2.5-flash',
        },
      });
      if (error) throw error;
      return data;
    }

    default:
      throw new Error(`Unknown agent type: ${step.agent_type}`);
  }
}

// ── Pipeline Runner ──

export interface PipelineRunCallbacks {
  onStepStart?: (stepIndex: number, step: PipelineStep) => void;
  onStepComplete?: (result: StepResult) => void;
  onStepRetry?: (stepIndex: number, attempt: number, error: Error) => void;
  onComplete?: (results: StepResult[]) => void;
  onError?: (error: Error, stepIndex: number) => void;
}

export async function runPipeline(
  steps: PipelineStep[],
  retryPolicy: RetryPolicy,
  runId: string,
  userId: string,
  callbacks?: PipelineRunCallbacks
): Promise<StepResult[]> {
  const results: StepResult[] = [];

  // Update run status to running
  await supabase
    .from('pipeline_runs')
    .update({ status: 'running', started_at: new Date().toISOString() } as Record<string, unknown>)
    .eq('id', runId);

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    // Check dependencies
    if (step.depends_on) {
      const depsOk = step.depends_on.every(
        depIdx => results[depIdx]?.status === 'success'
      );
      if (!depsOk) {
        const skipped: StepResult = {
          step_index: i,
          status: 'skipped',
          output: null,
          error: 'Dependency failed',
          duration_ms: 0,
          retries: 0,
        };
        results.push(skipped);
        callbacks?.onStepComplete?.(skipped);
        continue;
      }
    }

    callbacks?.onStepStart?.(i, step);
    const startTime = performance.now();
    let retries = 0;

    try {
      const output = await withRetry(
        () => executeStep(step, results),
        retryPolicy,
        (attempt, error) => {
          retries = attempt;
          callbacks?.onStepRetry?.(i, attempt, error);
        }
      );

      const result: StepResult = {
        step_index: i,
        status: 'success',
        output,
        duration_ms: performance.now() - startTime,
        retries,
      };
      results.push(result);
      callbacks?.onStepComplete?.(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const result: StepResult = {
        step_index: i,
        status: 'error',
        output: null,
        error: error.message,
        duration_ms: performance.now() - startTime,
        retries,
      };
      results.push(result);
      callbacks?.onStepComplete?.(result);
      callbacks?.onError?.(error, i);

      // Auto-healing: try to continue with remaining non-dependent steps
      // (steps that don't depend on the failed step)
      continue;
    }

    // Update progress in DB
    await supabase
      .from('pipeline_runs')
      .update({
        current_step: i + 1,
        step_results: results as unknown as Record<string, unknown>[],
      } as Record<string, unknown>)
      .eq('id', runId);
  }

  // Final status
  const hasErrors = results.some(r => r.status === 'error');
  const allSkipped = results.every(r => r.status === 'skipped');

  await supabase
    .from('pipeline_runs')
    .update({
      status: allSkipped ? 'failed' : hasErrors ? 'failed' : 'completed',
      completed_at: new Date().toISOString(),
      step_results: results as unknown as Record<string, unknown>[],
      error: hasErrors ? results.find(r => r.status === 'error')?.error : null,
    } as Record<string, unknown>)
    .eq('id', runId);

  callbacks?.onComplete?.(results);
  return results;
}

// ── Agent Health Check (auto-healing) ──

export async function checkAgentHealth(agentId: string): Promise<boolean> {
  const { data: agent } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single();

  if (!agent) return false;

  try {
    const endpoint = (agent as Record<string, unknown>).endpoint as string;
    const type = (agent as Record<string, unknown>).type as string;

    if (type === 'ollama' && endpoint) {
      const res = await fetch(`${endpoint}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      const isHealthy = res.ok;

      await supabase
        .from('agents')
        .update({
          status: isHealthy ? 'idle' : 'offline',
          last_heartbeat: new Date().toISOString(),
          last_error: isHealthy ? null : 'Health check failed',
        } as Record<string, unknown>)
        .eq('id', agentId);

      return isHealthy;
    }

    // Cloud agents are always available
    if (type === 'cloud') {
      await supabase
        .from('agents')
        .update({
          status: 'idle',
          last_heartbeat: new Date().toISOString(),
        } as Record<string, unknown>)
        .eq('id', agentId);
      return true;
    }

    return false;
  } catch {
    await supabase
      .from('agents')
      .update({
        status: 'error',
        last_error: 'Connection refused',
        last_heartbeat: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq('id', agentId);
    return false;
  }
}

// ── Auto-heal all agents ──

export async function autoHealAgents(userId: string): Promise<{ healed: number; total: number }> {
  const { data: agents } = await supabase
    .from('agents')
    .select('id')
    .eq('user_id', userId);

  if (!agents) return { healed: 0, total: 0 };

  let healed = 0;
  for (const agent of agents) {
    const ok = await checkAgentHealth(agent.id);
    if (ok) healed++;
  }

  return { healed, total: agents.length };
}
