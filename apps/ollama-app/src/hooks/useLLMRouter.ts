import { useState, useEffect, useCallback } from 'react';
import { 
  llmRouter, 
  type LLMEngine, 
  type LLMConfig,
  type LLMRequest,
  type LLMResponse,
  type StreamCallback,
  type SLATier,
  getAvailableEngines,
} from '@/lib/llm-router';

export interface UseLLMRouterResult {
  currentEngine: LLMEngine;
  config: LLMConfig;
  isOllamaAvailable: boolean;
  hasOpenRouterKey: boolean;
  hasOpenAIKey: boolean;
  setEngine: (engine: LLMEngine) => void;
  setOpenRouterKey: (key: string) => void;
  clearOpenRouterKey: () => void;
  setOpenAIKey: (key: string) => void;
  clearOpenAIKey: () => void;
  refreshAvailability: () => Promise<void>;
  // Chat method - direct access to llmRouter.chat
   chat: (request: LLMRequest, options?: { engine?: LLMEngine; onStream?: StreamCallback; skipCerber?: boolean; skipConfidence?: boolean; skipGuardian?: boolean; slaTier?: SLATier; tenantId?: string }) => Promise<LLMResponse>;
}

export function useLLMRouter(): UseLLMRouterResult {
  const [currentEngine, setCurrentEngine] = useState<LLMEngine>(llmRouter.getCurrentEngine());
  const [config] = useState<LLMConfig>(llmRouter.getConfig());
  const [isOllamaAvailable, setIsOllamaAvailable] = useState(false);
  const [hasOpenRouterKey, setHasOpenRouterKey] = useState(llmRouter.hasOpenRouterKey());
  const [hasOpenAIKey, setHasOpenAIKey] = useState(llmRouter.hasOpenAIKey());

  // Subscribe to engine changes
  useEffect(() => {
    const unsubscribe = llmRouter.subscribe((engine) => {
      setCurrentEngine(engine);
    });
    return unsubscribe;
  }, []);

  // Check availability on mount
  const refreshAvailability = useCallback(async () => {
    const available = await getAvailableEngines();
    setIsOllamaAvailable(available.ollama);
    setHasOpenRouterKey(available.openrouter);
    setHasOpenAIKey(available.openai);
  }, []);

  useEffect(() => {
    refreshAvailability();
    const interval = setInterval(refreshAvailability, 30000);
    return () => clearInterval(interval);
  }, [refreshAvailability]);

  const setEngine = useCallback((engine: LLMEngine) => {
    try {
      llmRouter.setEngine(engine);
      setCurrentEngine(engine);
    } catch (error) {
      console.error('Failed to set engine:', error);
      throw error;
    }
  }, []);

  // OpenRouter
  const setOpenRouterKey = useCallback((key: string) => {
    llmRouter.setOpenRouterKey(key);
    setHasOpenRouterKey(true);
  }, []);

  const clearOpenRouterKey = useCallback(() => {
    llmRouter.clearOpenRouterKey();
    setHasOpenRouterKey(false);
    if (llmRouter.getCurrentEngine() === 'openrouter') {
      setCurrentEngine('ollama');
    }
  }, []);

  // OpenAI
  const setOpenAIKey = useCallback((key: string) => {
    llmRouter.setOpenAIKey(key);
    setHasOpenAIKey(true);
  }, []);

  const clearOpenAIKey = useCallback(() => {
    llmRouter.clearOpenAIKey();
    setHasOpenAIKey(false);
    if (llmRouter.getCurrentEngine() === 'openai') {
      setCurrentEngine('ollama');
    }
  }, []);

  // Chat method - proxy to llmRouter.chat
  const chat = useCallback(async (
    request: LLMRequest, 
     options?: { engine?: LLMEngine; onStream?: StreamCallback; skipCerber?: boolean; skipConfidence?: boolean; skipGuardian?: boolean; slaTier?: SLATier; tenantId?: string }
  ): Promise<LLMResponse> => {
    return llmRouter.chat(request, options);
  }, []);

  return {
    currentEngine,
    config,
    isOllamaAvailable,
    hasOpenRouterKey,
    hasOpenAIKey,
    setEngine,
    setOpenRouterKey,
    clearOpenRouterKey,
    setOpenAIKey,
    clearOpenAIKey,
    refreshAvailability,
    chat,
  };
}

// ============= ENGINE DISPLAY HELPERS =============

export function getEngineLabel(engine: LLMEngine): string {
  switch (engine) {
    case 'ollama': return 'Ollama (Lokalny)';
    case 'openrouter': return 'OpenRouter (Cloud)';
    case 'openai': return 'OpenAI (Cloud)';
    case 'cloud': return 'ALFA Cloud (Gemini)';
    case 'llamacpp': return 'llama.cpp (SUSI)';
  }
}

export function getEngineDescription(engine: LLMEngine): string {
  switch (engine) {
    case 'ollama': return 'Prywatny, offline, zero vendor lock';
    case 'openrouter': return 'Qwen, Claude, GPT, Llama przez jedno API';
    case 'openai': return 'Bezpośredni dostęp do GPT';
    case 'cloud': return 'Gemini Flash — zawsze dostępny';
    case 'llamacpp': return 'llama.cpp server — susi_chat kompatybilny';
  }
}

export function getEngineIcon(engine: LLMEngine): 'local' | 'cloud' {
  return (engine === 'ollama' || engine === 'llamacpp') ? 'local' : 'cloud';
}
