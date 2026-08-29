/**
 * LLM Router - Unified interface for Ollama (primary) and Cloud fallbacks
 * 
 * ARCHITECTURE:
 * 🥇 OLLAMA = default, local, private, offline-capable
 * 🥈 OPENROUTER = universal cloud, access to Qwen/Claude/GPT/Llama via one API
 * 🥉 OPENAI = direct OpenAI, requires separate API key
 * 
 * CERBER GATE: All requests pass through 3-judge security assessment before LLM execution
 */

import { ollama } from './ollama';
import { cerberGate, type CerberResult, type CerberDecision } from './cerber';
import { cerberHistory } from './cerber-history';
import { applyConfidenceGate, type ConfidenceResult } from './confidence-gate';
import { turbo } from './turbo-log';
import { checkGuardian, type GuardianResponse, type GuardianDecision } from './guardian';
import { noiseShield, type NoiseShieldResult } from './cerber-noise-shield';

// ============= CONFIG =============

export interface LLMConfig {
  default: 'ollama' | 'openrouter' | 'openai' | 'llamacpp';
  engines: {
    ollama: {
      baseUrl: string;
      model: string;
    };
    llamacpp: {
      baseUrl: string;
      model: string;
    };
    openrouter: {
      enabled: boolean;
      model: string;
      apiKey?: string;
    };
    openai: {
      enabled: boolean;
      model: string;
      apiKey?: string;
    };
  };
}

// OpenRouter popular models
export const OPENROUTER_MODELS = {
  // Qwen
  'qwen/qwen-2.5-72b-instruct': 'Qwen 2.5 72B',
  'qwen/qwen-2.5-coder-32b-instruct': 'Qwen 2.5 Coder 32B',
  // Claude
  'anthropic/claude-3.5-sonnet': 'Claude 3.5 Sonnet',
  'anthropic/claude-3-opus': 'Claude 3 Opus',
  // GPT
  'openai/gpt-4o': 'GPT-4o',
  'openai/gpt-4o-mini': 'GPT-4o Mini',
  // Llama
  'meta-llama/llama-3.1-405b-instruct': 'Llama 3.1 405B',
  'meta-llama/llama-3.1-70b-instruct': 'Llama 3.1 70B',
  // DeepSeek
  'deepseek/deepseek-chat': 'DeepSeek Chat',
  'deepseek/deepseek-r1': 'DeepSeek R1',
  // Mistral
  'mistralai/mistral-large': 'Mistral Large',
} as const;

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  default: 'ollama',
  engines: {
    ollama: {
      baseUrl: 'http://localhost:11434',
      model: 'qwen3:latest',
    },
    llamacpp: {
      baseUrl: 'http://localhost:8001',
      model: 'local',
    },
    openrouter: {
      enabled: false,
      model: 'qwen/qwen-2.5-72b-instruct',
    },
    openai: {
      enabled: false,
      model: 'gpt-4o-mini',
    },
  },
};

// ============= TYPES =============

export type LLMEngine = 'ollama' | 'openrouter' | 'openai' | 'cloud' | 'llamacpp';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  images?: string[];
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, {
        type: string;
        description: string;
        enum?: string[];
      }>;
      required: string[];
    };
  };
}

export interface LLMRequest {
  messages: LLMMessage[];
  model?: string;
  tools?: LLMTool[];
  temperature?: number;
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  model: string;
  engine: LLMEngine;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cerber?: CerberResult;
  confidence?: import('./confidence-gate').ConfidenceResult;
  guardian?: GuardianResponse;
  noiseShield?: NoiseShieldResult;
}

export { type CerberResult, type CerberDecision } from './cerber';
export { type ConfidenceResult, type SLATier } from './confidence-gate';
export { type GuardianResponse, type GuardianDecision } from './guardian';
export { type NoiseShieldResult, type NoiseShieldState, type WhitelistEntry } from './cerber-noise-shield';
export { noiseShield } from './cerber-noise-shield';

export interface StreamCallback {
  (chunk: string): void;
}

// ============= OPENAI-COMPATIBLE CLIENT =============

class OpenAICompatibleClient {
  private apiKey: string | null = null;
  private baseUrl: string;
  private defaultModel: string;
  private engineName: 'openai' | 'openrouter';
  private extraHeaders: Record<string, string>;

  constructor(config: {
    baseUrl: string;
    defaultModel: string;
    engineName: 'openai' | 'openrouter';
    extraHeaders?: Record<string, string>;
  }) {
    this.baseUrl = config.baseUrl;
    this.defaultModel = config.defaultModel;
    this.engineName = config.engineName;
    this.extraHeaders = config.extraHeaders || {};
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  clearApiKey() {
    this.apiKey = null;
  }

  hasApiKey(): boolean {
    return !!this.apiKey;
  }

  async chat(
    request: LLMRequest,
    onStream?: StreamCallback
  ): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error(`${this.engineName} API key not configured.`);
    }

    const body: Record<string, unknown> = {
      model: request.model || this.defaultModel,
      messages: request.messages.map(m => ({
        role: m.role,
        content: m.content,
        ...(m.tool_calls && { tool_calls: m.tool_calls }),
        ...(m.tool_call_id && { tool_call_id: m.tool_call_id }),
      })),
      temperature: request.temperature ?? 0.7,
      stream: request.stream ?? !!onStream,
    };

    if (request.tools?.length) {
      body.tools = request.tools;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...this.extraHeaders,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${this.engineName} API error: ${response.status} - ${error}`);
    }

    if (request.stream && onStream && response.body) {
      return this.handleStream(response.body, request.model || this.defaultModel, onStream);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    return {
      content: choice?.message?.content || '',
      toolCalls: choice?.message?.tool_calls,
      model: data.model,
      engine: this.engineName,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    };
  }

  private async handleStream(
    body: ReadableStream<Uint8Array>,
    model: string,
    onStream: StreamCallback
  ): Promise<LLMResponse> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let toolCalls: ToolCall[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

      for (const line of lines) {
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta;
          
          if (delta?.content) {
            fullContent += delta.content;
            onStream(delta.content);
          }
          
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.index !== undefined) {
                if (!toolCalls[tc.index]) {
                  toolCalls[tc.index] = {
                    id: tc.id || '',
                    type: 'function',
                    function: { name: '', arguments: '' },
                  };
                }
                if (tc.id) toolCalls[tc.index].id = tc.id;
                if (tc.function?.name) toolCalls[tc.index].function.name = tc.function.name;
                if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
              }
            }
          }
        } catch {
          // Ignore parse errors for partial chunks
        }
      }
    }

    return {
      content: fullContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      model,
      engine: this.engineName,
    };
  }
}

// ============= LLM ROUTER =============

class LLMRouter {
  private config: LLMConfig = DEFAULT_LLM_CONFIG;
  
  private openrouter = new OpenAICompatibleClient({
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: DEFAULT_LLM_CONFIG.engines.openrouter.model,
    engineName: 'openrouter',
    extraHeaders: {
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
      'X-Title': 'ALFA Overlay',
    },
  });

  private openai = new OpenAICompatibleClient({
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: DEFAULT_LLM_CONFIG.engines.openai.model,
    engineName: 'openai',
  });

  private currentEngine: LLMEngine = 'ollama';
  private listeners: Set<(engine: LLMEngine) => void> = new Set();

  getConfig(): LLMConfig {
    return { ...this.config };
  }

  getCurrentEngine(): LLMEngine {
    return this.currentEngine;
  }

  setEngine(engine: LLMEngine) {
    if (engine === 'openai' && !this.openai.hasApiKey()) {
      throw new Error('Cannot switch to OpenAI without API key');
    }
    if (engine === 'openrouter' && !this.openrouter.hasApiKey()) {
      throw new Error('Cannot switch to OpenRouter without API key');
    }
    this.currentEngine = engine;
    this.notifyListeners();
  }

  // OpenRouter
  setOpenRouterKey(key: string) {
    this.openrouter.setApiKey(key);
  }

  clearOpenRouterKey() {
    this.openrouter.clearApiKey();
    if (this.currentEngine === 'openrouter') {
      this.currentEngine = 'ollama';
      this.notifyListeners();
    }
  }

  hasOpenRouterKey(): boolean {
    return this.openrouter.hasApiKey();
  }

  // OpenAI
  setOpenAIKey(key: string) {
    this.openai.setApiKey(key);
  }

  clearOpenAIKey() {
    this.openai.clearApiKey();
    if (this.currentEngine === 'openai') {
      this.currentEngine = 'ollama';
      this.notifyListeners();
    }
  }

  hasOpenAIKey(): boolean {
    return this.openai.hasApiKey();
  }

  isOllamaAvailable(): Promise<boolean> {
    return ollama.isAvailable();
  }

  subscribe(listener: (engine: LLMEngine) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      listener(this.currentEngine);
    }
  }

  /**
   * Main chat method - routes to appropriate engine with Cerber gate + Confidence gate
   */
  async chat(
    request: LLMRequest,
    options?: {
      engine?: LLMEngine;
      onStream?: StreamCallback;
      skipCerber?: boolean;
      skipConfidence?: boolean;
       skipGuardian?: boolean;
      slaTier?: 'gold' | 'silver' | 'bronze';
       tenantId?: string;
    }
  ): Promise<LLMResponse> {
    const engine = options?.engine || this.currentEngine;

     // 🛡️ GUARDIAN GATE (backend) + 🐕 CERBER GATE (local) - dual security layer
    let cerberResult: CerberResult | undefined;
    let confidenceResult: ConfidenceResult | undefined;
     let guardianResult: GuardianResponse | undefined;
    
     // Get user message for security checks
     const userMessage = [...request.messages].reverse().find(m => m.role === 'user');
     
     // 🛡️ GUARDIAN GATE - backend policy engine + DLP (primary security layer)
     if (!options?.skipGuardian && userMessage) {
       try {
         guardianResult = await checkGuardian({
           message: userMessage.content,
           tenant_id: options?.tenantId,
           confidence_score: undefined, // Will be computed by Guardian
           model: request.model || this.config.engines[engine].model,
         });
         
         turbo.cerber({
           verdict: guardianResult.decision === 'ALLOW' ? 'PASS' : 'FAIL',
           score: guardianResult.confidence_check?.score,
         });
         
         // BLOCK - Guardian detected policy violation or DLP pattern
         if (guardianResult.decision === 'BLOCK') {
           return {
             content: `🛡️ Guardian: ${guardianResult.reason || 'Request blocked by security policy'}`,
             model: 'guardian-gate',
             engine,
             guardian: guardianResult,
           };
         }
         
         // RATE_LIMIT - tenant exceeded rate limit
         if (guardianResult.decision === 'RATE_LIMIT') {
           return {
             content: '⏱️ Guardian: Rate limit exceeded. Please try again later.',
             model: 'guardian-gate',
             engine,
             guardian: guardianResult,
           };
         }
         
         // Use confidence from Guardian if available
         if (guardianResult.confidence_check && !options?.skipConfidence) {
           if (!guardianResult.confidence_check.passed) {
             return {
               content: '🤔 Nie mam wystarczającej pewności, aby odpowiedzieć. Lepiej zapytać niż skłamać.',
               model: 'guardian-gate',
               engine,
               guardian: guardianResult,
             };
           }
         }
       } catch (error) {
         // Guardian unavailable - fall back to local Cerber
         console.warn('Guardian Gate unavailable, falling back to local Cerber:', error);
         turbo.api({ method: 'POST', path: '/guardian-gate', status: 503 });
       }
     }
     
     // 🐕 CERBER GATE (local) - secondary security layer (always runs as backup)
    if (!options?.skipCerber) {
      if (userMessage) {
        cerberResult = cerberGate(userMessage.content);
        
        // Log to Cerber History
        cerberHistory.log({
          prompt: userMessage.content.slice(0, 200),
          decision: cerberResult.decision,
          intent: cerberResult.intent.intent,
          risk: cerberResult.motive.risk,
          flags: cerberResult.motive.flags,
          engine,
        });
        
         // Turbo log Cerber decision
         turbo.cerber({ 
           verdict: cerberResult.decision === 'PASS' ? 'PASS' : 'FAIL', 
           score: cerberResult.intent.confidence 
         });
 
        // BLOCK - refuse to execute
        if (cerberResult.decision === 'BLOCK') {
          return {
            content: '🚫 Zablokowane przez Cerbera. Twoje zapytanie zostało ocenione jako potencjalnie niebezpieczne.',
            model: 'cerber',
            engine,
            cerber: cerberResult,
          };
        }
        
        // REQUIRE_CONFIRM - warn but continue (UI should handle confirmation)
        if (cerberResult.decision === 'REQUIRE_CONFIRM') {
           turbo.cerber({ verdict: 'FAIL', score: cerberResult.intent.confidence });
        }

         // 🛡️ CONFIDENCE GATE - only if Guardian didn't already check
         if (!options?.skipConfidence && !guardianResult?.confidence_check) {
          const confidenceCheck = applyConfidenceGate(userMessage.content, options?.slaTier || 'silver');
          confidenceResult = confidenceCheck.result;
          
           turbo.confidence({ 
             score: confidenceResult.score, 
             tier: confidenceResult.tier as 'bronze' | 'silver' | 'gold',
             strict: options?.slaTier === 'gold'
           });
          
          if (!confidenceCheck.allowed && confidenceCheck.refusalMessage) {
            return {
              content: confidenceCheck.refusalMessage,
              model: 'confidence-gate',
              engine,
              cerber: cerberResult,
              confidence: confidenceResult,
            };
          }
        }
      }
    }

    const model = request.model || (
      engine === 'ollama' ? this.config.engines.ollama.model : 
      engine === 'llamacpp' ? this.config.engines.llamacpp.model :
      engine === 'openrouter' ? this.config.engines.openrouter.model : 
      this.config.engines.openai.model
    );
     turbo.router({ engine });
    const startTime = Date.now();

    let response: LLMResponse;

    if (engine === 'cloud') {
      response = await this.callCloud(request);
    } else if (engine === 'llamacpp') {
      response = await this.callLlamaCpp(request);
    } else if (engine === 'openrouter') {
      response = await this.openrouter.chat(request, options?.onStream);
    } else if (engine === 'openai') {
      response = await this.openai.chat(request, options?.onStream);
    } else {
      // Default: Ollama — try cloud fallback if offline
      try {
        response = await this.callOllama(request, options?.onStream);
      } catch (ollamaError) {
        console.warn('Ollama offline, falling back to cloud:', ollamaError);
        turbo.router({ engine: 'cloud' });
        response = await this.callCloud(request);
      }
    }

    const latency = Date.now() - startTime;
     turbo.api({ method: 'POST', path: `/llm/${engine}`, status: 200 });

    // Attach Cerber result to response
    if (cerberResult) {
      response.cerber = cerberResult;
    }

    // Attach Confidence result to response
    if (confidenceResult) {
      response.confidence = confidenceResult;
    }

    // Attach Guardian result to response
    if (guardianResult) {
      response.guardian = guardianResult;
    }

    // 🔒 NOISE SHIELD — filter output through Cerber noise gate
    const shieldResult = noiseShield.filterOutput(response.content, {
      inputPrompt: userMessage?.content,
      engine,
    });
    
    if (shieldResult.filtered) {
      response.content = shieldResult.output;
      turbo.cerber({ verdict: 'FAIL', score: 0 });
    }
    response.noiseShield = shieldResult;

    return response;
  }

  private async callCloud(request: LLMRequest): Promise<LLMResponse> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) throw new Error('Cloud not configured');

    const { supabase } = await import('@/integrations/supabase/client');
    const { data: { session } } = await supabase.auth.getSession();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (session) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const cloudModel = request.model || 'google/gemini-3-flash-preview';
    
    const response = await fetch(`${supabaseUrl}/functions/v1/alfa-chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: request.messages.map(m => ({ role: m.role, content: m.content })),
        model: cloudModel,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(errData.error || `Cloud error: ${response.status}`);
    }

    // Handle SSE stream from alfa-chat
    if (response.headers.get('content-type')?.includes('text/event-stream') && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) fullContent += delta;
          } catch { /* ignore partial */ }
        }
      }

      return {
        content: fullContent,
        model: cloudModel,
        engine: 'cloud' as LLMEngine,
      };
    }

    const data = await response.json();
    return {
      content: data.choices?.[0]?.message?.content || data.content || JSON.stringify(data),
      model: cloudModel,
      engine: 'cloud' as LLMEngine,
    };
  }

  /**
   * llama.cpp server (susi_chat compatible) - OpenAI-compatible /v1/chat/completions
   */
  private async callLlamaCpp(request: LLMRequest): Promise<LLMResponse> {
    const baseUrl = this.config.engines.llamacpp.baseUrl;
    
    // llama.cpp server supports OpenAI-compatible API
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: request.messages.map(m => ({ role: m.role, content: m.content })),
        temperature: request.temperature ?? 0.7,
        stream: false,
      }),
    });

    if (!response.ok) {
      // Fallback to llama.cpp native /completion endpoint
      const nativeResponse = await fetch(`${baseUrl}/completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: request.messages.map(m => `${m.role}: ${m.content}`).join('\n') + '\nassistant:',
          temperature: request.temperature ?? 0.7,
          n_predict: 512,
          stop: ['user:', '\nuser:'],
        }),
      });

      if (!nativeResponse.ok) {
        throw new Error(`llama.cpp error: ${nativeResponse.status}`);
      }

      const nativeData = await nativeResponse.json();
      return {
        content: nativeData.content || nativeData.response || '',
        model: 'llama.cpp-local',
        engine: 'llamacpp' as LLMEngine,
      };
    }

    const data = await response.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      model: data.model || 'llama.cpp-local',
      engine: 'llamacpp' as LLMEngine,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens || 0,
        completionTokens: data.usage.completion_tokens || 0,
        totalTokens: data.usage.total_tokens || 0,
      } : undefined,
    };
  }

  private async callOllama(
    request: LLMRequest,
    onStream?: StreamCallback
  ): Promise<LLMResponse> {
    const model = request.model || this.config.engines.ollama.model;

    const ollamaRequest = {
      model,
      messages: request.messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant' | 'tool',
        content: m.content,
        images: m.images,
        tool_calls: m.tool_calls,
        tool_call_id: m.tool_call_id,
      })),
      options: {
        temperature: request.temperature,
      },
      tools: request.tools,
      stream: !!onStream,
    };

    if (onStream) {
      // Streaming mode
      let fullContent = '';
      let lastResponse: import('./ollama').ChatResponse | null = null;

      for await (const chunk of ollama.chatStream(ollamaRequest)) {
        if (chunk.message?.content) {
          fullContent += chunk.message.content;
          onStream(chunk.message.content);
        }
        lastResponse = chunk;
      }

      return {
        content: fullContent,
        toolCalls: lastResponse?.message?.tool_calls,
        model: lastResponse?.model || model,
        engine: 'ollama',
        usage: lastResponse?.eval_count ? {
          promptTokens: lastResponse.prompt_eval_count || 0,
          completionTokens: lastResponse.eval_count,
          totalTokens: (lastResponse.prompt_eval_count || 0) + lastResponse.eval_count,
        } : undefined,
      };
    }

    // Non-streaming mode
    const response = await ollama.chat(ollamaRequest);

    return {
      content: response.message.content,
      toolCalls: response.message.tool_calls,
      model: response.model,
      engine: 'ollama',
      usage: response.eval_count ? {
        promptTokens: response.prompt_eval_count || 0,
        completionTokens: response.eval_count,
        totalTokens: (response.prompt_eval_count || 0) + response.eval_count,
      } : undefined,
    };
  }
}

// ============= SINGLETON EXPORT =============

export const llmRouter = new LLMRouter();

// ============= CONVENIENCE FUNCTIONS =============

export async function callLLM(
  prompt: string,
  options?: {
    engine?: LLMEngine;
    systemPrompt?: string;
    model?: string;
    onStream?: StreamCallback;
  }
): Promise<string> {
  const messages: LLMMessage[] = [];
  
  if (options?.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  
  messages.push({ role: 'user', content: prompt });

  const response = await llmRouter.chat(
    { messages, model: options?.model },
    { engine: options?.engine, onStream: options?.onStream }
  );

  return response.content;
}

/**
 * Check which engines are available
 */
export async function getAvailableEngines(): Promise<{
  ollama: boolean;
  openrouter: boolean;
  openai: boolean;
  cloud: boolean;
  llamacpp: boolean;
}> {
  const ollamaAvailable = await llmRouter.isOllamaAvailable();
  const openrouterAvailable = llmRouter.hasOpenRouterKey();
  const openaiAvailable = llmRouter.hasOpenAIKey();

  // Check llama.cpp availability
  let llamacppAvailable = false;
  try {
    const r = await fetch(`${DEFAULT_LLM_CONFIG.engines.llamacpp.baseUrl}/health`, { signal: AbortSignal.timeout(2000) });
    llamacppAvailable = r.ok;
  } catch { /* offline */ }

  return {
    ollama: ollamaAvailable,
    openrouter: openrouterAvailable,
    openai: openaiAvailable,
    cloud: true,
    llamacpp: llamacppAvailable,
  };
}
