import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ollama, 
  QwenAgent, 
  createAlfaAgent,
  type OllamaModel, 
  type ChatMessage,
  type QwenTool,
  QWEN_MODELS,
  type QwenModelId,
} from '@/lib/ollama';

export interface UseOllamaResult {
  isAvailable: boolean;
  isLoading: boolean;
  models: OllamaModel[];
  qwenModels: OllamaModel[];
  activeModel: string;
  setActiveModel: (model: string) => void;
  refreshModels: () => Promise<void>;
  pullModel: (name: string, onProgress?: (status: string, completed?: number, total?: number) => void) => Promise<void>;
  deleteModel: (name: string) => Promise<void>;
}

export function useOllama(): UseOllamaResult {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [qwenModels, setQwenModels] = useState<OllamaModel[]>([]);
  const [activeModel, setActiveModel] = useState<string>('');

  const refreshModels = useCallback(async () => {
    setIsLoading(true);
    try {
      const available = await ollama.isAvailable();
      setIsAvailable(available);

      if (available) {
        const allModels = await ollama.listModels();
        setModels(allModels);

        const qwen = allModels.filter(m => 
          m.name.toLowerCase().includes('qwen') || 
          m.name.toLowerCase().includes('qwq')
        );
        setQwenModels(qwen);

        // Auto-select first Qwen model if available
        if (!activeModel && qwen.length > 0) {
          setActiveModel(qwen[0].name);
        } else if (!activeModel && allModels.length > 0) {
          setActiveModel(allModels[0].name);
        }
      }
    } catch (error) {
      console.error('Failed to check Ollama:', error);
      setIsAvailable(false);
    } finally {
      setIsLoading(false);
    }
  }, [activeModel]);

  useEffect(() => {
    refreshModels();
    const interval = setInterval(refreshModels, 30000);
    return () => clearInterval(interval);
  }, [refreshModels]);

  const pullModel = useCallback(async (
    name: string,
    onProgress?: (status: string, completed?: number, total?: number) => void
  ) => {
    await ollama.pullModel(name, onProgress);
    await refreshModels();
  }, [refreshModels]);

  const deleteModel = useCallback(async (name: string) => {
    await ollama.deleteModel(name);
    await refreshModels();
  }, [refreshModels]);

  return {
    isAvailable,
    isLoading,
    models,
    qwenModels,
    activeModel,
    setActiveModel,
    refreshModels,
    pullModel,
    deleteModel,
  };
}

// ============= QWEN AGENT HOOK =============

export interface UseQwenAgentResult {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  sendMessage: (content: string, images?: string[]) => Promise<void>;
  reset: () => void;
  compact: () => Promise<void>;
  registerTool: (name: string, executor: (args: Record<string, unknown>) => Promise<string>) => void;
}

export interface UseQwenAgentOptions {
  model?: string;
  systemPrompt?: string;
  tools?: QwenTool[];
  onToolCall?: (name: string, args: Record<string, unknown>) => void;
  onError?: (error: Error) => void;
}

export function useQwenAgent(options: UseQwenAgentOptions = {}): UseQwenAgentResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  
  const agentRef = useRef<QwenAgent | null>(null);

  // Initialize agent
  useEffect(() => {
    if (options.model) {
      agentRef.current = new QwenAgent({
        model: options.model,
        systemPrompt: options.systemPrompt,
        tools: options.tools,
      });
    } else {
      agentRef.current = createAlfaAgent();
    }

    // Sync initial messages
    setMessages(agentRef.current.getHistory());
  }, [options.model, options.systemPrompt, options.tools]);

  const sendMessage = useCallback(async (content: string, images?: string[]) => {
    if (!agentRef.current) return;

    setIsStreaming(true);
    setStreamingContent('');

    try {
      const result = await agentRef.current.run(
        content,
        images,
        (chunk) => {
          setStreamingContent(prev => prev + chunk);
        }
      );

      // Log tool calls
      if (result.toolCalls && options.onToolCall) {
        for (const call of result.toolCalls) {
          try {
            const args = JSON.parse(call.function.arguments);
            options.onToolCall(call.function.name, args);
          } catch { /* ignore */ }
        }
      }

      // Update messages
      setMessages(agentRef.current.getHistory());
    } catch (error) {
      console.error('Agent run failed:', error);
      options.onError?.(error instanceof Error ? error : new Error('Unknown error'));
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
    }
  }, [options]);

  const reset = useCallback(() => {
    agentRef.current?.reset();
    setMessages(agentRef.current?.getHistory() || []);
  }, []);

  const compact = useCallback(async () => {
    await agentRef.current?.compact();
    setMessages(agentRef.current?.getHistory() || []);
  }, []);

  const registerTool = useCallback((
    name: string, 
    executor: (args: Record<string, unknown>) => Promise<string>
  ) => {
    agentRef.current?.registerTool(name, executor);
  }, []);

  return {
    messages,
    isStreaming,
    streamingContent,
    sendMessage,
    reset,
    compact,
    registerTool,
  };
}

// ============= QWEN MODELS INFO =============

export function getQwenModelInfo(modelId: string): { name: string; capabilities: readonly string[] } | null {
  // Check exact match
  if (modelId in QWEN_MODELS) {
    return QWEN_MODELS[modelId as QwenModelId];
  }

  // Check partial match
  for (const [key, value] of Object.entries(QWEN_MODELS)) {
    if (modelId.startsWith(key.split(':')[0])) {
      return value;
    }
  }

  return null;
}

export function isQwenModel(modelId: string): boolean {
  return modelId.toLowerCase().includes('qwen') || modelId.toLowerCase().includes('qwq');
}

export function supportsVision(modelId: string): boolean {
  const info = getQwenModelInfo(modelId);
  return info?.capabilities.includes('vision') ?? false;
}

export function supportsTools(modelId: string): boolean {
  const info = getQwenModelInfo(modelId);
  return info?.capabilities.includes('tools') ?? false;
}

export function supportsReasoning(modelId: string): boolean {
  const info = getQwenModelInfo(modelId);
  return info?.capabilities.includes('reasoning') ?? info?.capabilities.includes('thinking') ?? false;
}
