// browser-use AI Agent API
// Connects to a local browser-use Python server

const DEFAULT_API_URL = 'http://localhost:8000';

export interface BrowserUseTask {
  id: string;
  task: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  steps: BrowserUseStep[];
  model: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface BrowserUseStep {
  id: number;
  action: string;
  description: string;
  timestamp: string;
  screenshot?: string;
  success: boolean;
}

export interface BrowserUseConfig {
  apiUrl: string;
  model: string;
  headless: boolean;
  maxSteps: number;
  timeout: number;
}

const defaultConfig: BrowserUseConfig = {
  apiUrl: DEFAULT_API_URL,
  model: 'gpt-4o',
  headless: false,
  maxSteps: 50,
  timeout: 300,
};

let currentConfig = { ...defaultConfig };

export function setBrowserUseConfig(config: Partial<BrowserUseConfig>) {
  currentConfig = { ...currentConfig, ...config };
}

export function getBrowserUseConfig(): BrowserUseConfig {
  return { ...currentConfig };
}

export async function checkBrowserUseConnection(apiUrl?: string): Promise<boolean> {
  const url = apiUrl || currentConfig.apiUrl;
  try {
    const response = await fetch(`${url}/health`, { 
      signal: AbortSignal.timeout(3000) 
    });
    return response.ok;
  } catch {
    // Try alternate endpoint
    try {
      const response = await fetch(`${url}/`, { 
        signal: AbortSignal.timeout(3000) 
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export async function runBrowserUseTask(
  task: string,
  onStep?: (step: BrowserUseStep) => void
): Promise<BrowserUseTask> {
  const taskId = `bu_${Date.now()}`;
  const startedAt = new Date().toISOString();
  
  try {
    // Try SSE endpoint first for streaming steps
    const response = await fetch(`${currentConfig.apiUrl}/api/v1/agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task,
        model: currentConfig.model,
        headless: currentConfig.headless,
        max_steps: currentConfig.maxSteps,
        timeout: currentConfig.timeout,
      }),
      signal: AbortSignal.timeout(currentConfig.timeout * 1000),
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();

    return {
      id: data.id || taskId,
      task,
      status: data.status === 'error' ? 'failed' : 'completed',
      result: data.result || data.output || JSON.stringify(data),
      steps: (data.steps || []).map((s: any, i: number) => ({
        id: i,
        action: s.action || s.type || 'step',
        description: s.description || s.text || s.action || `Step ${i + 1}`,
        timestamp: s.timestamp || new Date().toISOString(),
        screenshot: s.screenshot,
        success: s.success !== false,
      })),
      model: currentConfig.model,
      startedAt,
      completedAt: new Date().toISOString(),
      error: data.error,
    };
  } catch (error) {
    return {
      id: taskId,
      task,
      status: 'failed',
      steps: [],
      model: currentConfig.model,
      startedAt,
      completedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Nieznany błąd',
    };
  }
}

export async function stopBrowserUseTask(taskId: string): Promise<boolean> {
  try {
    const response = await fetch(`${currentConfig.apiUrl}/api/v1/agent/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function getBrowserUseModels(): Promise<string[]> {
  try {
    const response = await fetch(`${currentConfig.apiUrl}/api/v1/models`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.models || [];
  } catch {
    return ['gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet', 'gemini-2.0-flash'];
  }
}
