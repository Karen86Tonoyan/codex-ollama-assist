/**
 * Ollama API Client with Qwen Integration
 * Full support for: streaming, tool calling, vision, code interpreter
 * Inspired by Qwen-Agent architecture
 */

const OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

// ============= TYPES =============

export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

export interface QwenTool {
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

export interface QwenToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  images?: string[];  // base64 encoded for vision
  tool_calls?: QwenToolCall[];
  tool_call_id?: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  format?: 'json';
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
    stop?: string[];
    seed?: number;
  };
  tools?: QwenTool[];
  keep_alive?: string;
}

export interface ChatResponse {
  model: string;
  created_at: string;
  message: ChatMessage;
  done: boolean;
  done_reason?: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface GenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  template?: string;
  context?: number[];
  stream?: boolean;
  raw?: boolean;
  format?: 'json';
  images?: string[];
  options?: ChatRequest['options'];
}

export interface GenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface EmbeddingRequest {
  model: string;
  input: string | string[];
  truncate?: boolean;
  options?: ChatRequest['options'];
  keep_alive?: string;
}

export interface EmbeddingResponse {
  model: string;
  embeddings: number[][];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
}

// ============= QWEN MODELS =============

export const QWEN_MODELS = {
  // Chat models
  'qwen3:latest': { name: 'Qwen3', capabilities: ['chat', 'tools', 'reasoning'] },
  'qwen3:32b': { name: 'Qwen3 32B', capabilities: ['chat', 'tools', 'reasoning', 'long-context'] },
  'qwen3:14b': { name: 'Qwen3 14B', capabilities: ['chat', 'tools', 'reasoning'] },
  'qwen3:8b': { name: 'Qwen3 8B', capabilities: ['chat', 'tools'] },
  'qwen3:4b': { name: 'Qwen3 4B', capabilities: ['chat'] },
  'qwen3:1.7b': { name: 'Qwen3 1.7B', capabilities: ['chat'] },
  'qwen3:0.6b': { name: 'Qwen3 0.6B', capabilities: ['chat'] },
  
  // Coder models
  'qwen3-coder:latest': { name: 'Qwen3 Coder', capabilities: ['chat', 'tools', 'code'] },
  'qwen2.5-coder:latest': { name: 'Qwen2.5 Coder', capabilities: ['chat', 'tools', 'code'] },
  'qwen2.5-coder:32b': { name: 'Qwen2.5 Coder 32B', capabilities: ['chat', 'tools', 'code', 'long-context'] },
  
  // Vision models
  'qwen3-vl:latest': { name: 'Qwen3 Vision', capabilities: ['chat', 'tools', 'vision'] },
  'qwen2.5-vl:latest': { name: 'Qwen2.5 Vision', capabilities: ['chat', 'tools', 'vision'] },
  
  // Reasoning models
  'qwq:latest': { name: 'QwQ (Reasoning)', capabilities: ['chat', 'tools', 'reasoning', 'thinking'] },
  'qwq:32b': { name: 'QwQ 32B', capabilities: ['chat', 'tools', 'reasoning', 'thinking'] },
} as const;

export type QwenModelId = keyof typeof QWEN_MODELS;

// ============= OLLAMA CLIENT =============

class OllamaClient {
  private baseUrl: string;

  constructor(baseUrl: string = OLLAMA_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // Check if Ollama is running
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // List all available models
  async listModels(): Promise<OllamaModel[]> {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    if (!response.ok) throw new Error('Failed to list models');
    const data = await response.json();
    return data.models || [];
  }

  // List only Qwen models
  async listQwenModels(): Promise<OllamaModel[]> {
    const models = await this.listModels();
    return models.filter(m => 
      m.name.toLowerCase().includes('qwen') || 
      m.name.toLowerCase().includes('qwq')
    );
  }

  // Pull a model
  async pullModel(
    name: string, 
    onProgress?: (status: string, completed?: number, total?: number) => void
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, stream: true }),
    });

    if (!response.ok) throw new Error('Failed to pull model');

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          onProgress?.(data.status, data.completed, data.total);
        } catch { /* ignore */ }
      }
    }
  }

  // Delete a model
  async deleteModel(name: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) throw new Error('Failed to delete model');
  }

  // Chat completion (non-streaming)
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...request, stream: false }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Chat failed: ${error}`);
    }

    return response.json();
  }

  // Chat completion (streaming)
  async *chatStream(request: ChatRequest): AsyncGenerator<ChatResponse, void, unknown> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...request, stream: true }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Chat stream failed: ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          yield JSON.parse(line);
        } catch { /* ignore */ }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      try {
        yield JSON.parse(buffer);
      } catch { /* ignore */ }
    }
  }

  // Generate completion (non-streaming)
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...request, stream: false }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Generate failed: ${error}`);
    }

    return response.json();
  }

  // Generate completion (streaming)
  async *generateStream(request: GenerateRequest): AsyncGenerator<GenerateResponse, void, unknown> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...request, stream: true }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Generate stream failed: ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          yield JSON.parse(line);
        } catch { /* ignore */ }
      }
    }
  }

  // Generate embeddings
  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const response = await fetch(`${this.baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Embedding failed: ${error}`);
    }

    return response.json();
  }

  // Show model info
  async showModel(name: string): Promise<{
    license: string;
    modelfile: string;
    parameters: string;
    template: string;
    details: OllamaModel['details'];
  }> {
    const response = await fetch(`${this.baseUrl}/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) throw new Error('Failed to show model');
    return response.json();
  }
}

// Singleton instance
export const ollama = new OllamaClient();

// ============= QWEN AGENT =============

export interface QwenAgentConfig {
  model: string;
  systemPrompt?: string;
  tools?: QwenTool[];
  temperature?: number;
  maxTokens?: number;
  thinkingMode?: 'off' | 'minimal' | 'low' | 'medium' | 'high';
}

export interface AgentRunResult {
  response: string;
  toolCalls?: QwenToolCall[];
  toolResults?: { toolCallId: string; result: string }[];
  thinkingContent?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Qwen Agent - wysokopoziomowy agent z obsługą narzędzi
 * Wzorowany na Qwen-Agent Python framework
 */
export class QwenAgent {
  private config: QwenAgentConfig;
  private messages: ChatMessage[] = [];
  private toolExecutors: Map<string, (args: Record<string, unknown>) => Promise<string>> = new Map();

  constructor(config: QwenAgentConfig) {
    this.config = {
      temperature: 0.7,
      maxTokens: 4096,
      thinkingMode: 'off',
      ...config,
    };

    if (config.systemPrompt) {
      this.messages.push({ role: 'system', content: config.systemPrompt });
    }
  }

  // Register a tool executor
  registerTool(name: string, executor: (args: Record<string, unknown>) => Promise<string>): void {
    this.toolExecutors.set(name, executor);
  }

  // Run agent with a message
  async run(
    userMessage: string,
    images?: string[],
    onStream?: (chunk: string) => void
  ): Promise<AgentRunResult> {
    // Add user message
    this.messages.push({
      role: 'user',
      content: userMessage,
      images,
    });

    let fullResponse = '';
    let thinkingContent = '';
    const toolCalls: QwenToolCall[] = [];
    const toolResults: { toolCallId: string; result: string }[] = [];

    // First pass: get response (possibly with tool calls)
    const request: ChatRequest = {
      model: this.config.model,
      messages: this.messages,
      stream: !!onStream,
      tools: this.config.tools,
      options: {
        temperature: this.config.temperature,
        num_predict: this.config.maxTokens,
      },
    };

    if (onStream) {
      for await (const chunk of ollama.chatStream(request)) {
        if (chunk.message?.content) {
          // Parse thinking content if present
          const content = chunk.message.content;
          if (content.includes('<think>')) {
            thinkingContent += content;
          } else {
            fullResponse += content;
            onStream(content);
          }
        }
        if (chunk.message?.tool_calls) {
          toolCalls.push(...chunk.message.tool_calls);
        }
      }
    } else {
      const response = await ollama.chat(request);
      fullResponse = response.message.content;
      if (response.message.tool_calls) {
        toolCalls.push(...response.message.tool_calls);
      }
    }

    // Execute tool calls if any
    if (toolCalls.length > 0) {
      this.messages.push({
        role: 'assistant',
        content: fullResponse,
        tool_calls: toolCalls,
      });

      for (const toolCall of toolCalls) {
        const executor = this.toolExecutors.get(toolCall.function.name);
        if (executor) {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            const result = await executor(args);
            toolResults.push({ toolCallId: toolCall.id, result });
            
            this.messages.push({
              role: 'tool',
              content: result,
              tool_call_id: toolCall.id,
            });
          } catch (error) {
            const errorResult = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
            toolResults.push({ toolCallId: toolCall.id, result: errorResult });
            
            this.messages.push({
              role: 'tool',
              content: errorResult,
              tool_call_id: toolCall.id,
            });
          }
        }
      }

      // Second pass: get final response after tool execution
      const finalRequest: ChatRequest = {
        model: this.config.model,
        messages: this.messages,
        stream: !!onStream,
        options: {
          temperature: this.config.temperature,
          num_predict: this.config.maxTokens,
        },
      };

      let finalResponse = '';
      if (onStream) {
        for await (const chunk of ollama.chatStream(finalRequest)) {
          if (chunk.message?.content) {
            finalResponse += chunk.message.content;
            onStream(chunk.message.content);
          }
        }
      } else {
        const response = await ollama.chat(finalRequest);
        finalResponse = response.message.content;
      }

      fullResponse = finalResponse;
    }

    // Add assistant response to history
    this.messages.push({ role: 'assistant', content: fullResponse });

    // Clean thinking tags from response
    const cleanedResponse = fullResponse
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .trim();

    return {
      response: cleanedResponse,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      toolResults: toolResults.length > 0 ? toolResults : undefined,
      thinkingContent: thinkingContent || undefined,
    };
  }

  // Reset conversation
  reset(): void {
    this.messages = [];
    if (this.config.systemPrompt) {
      this.messages.push({ role: 'system', content: this.config.systemPrompt });
    }
  }

  // Get conversation history
  getHistory(): ChatMessage[] {
    return [...this.messages];
  }

  // Compact history (summarize older messages)
  async compact(): Promise<void> {
    if (this.messages.length < 10) return;

    const systemMessage = this.messages.find(m => m.role === 'system');
    const recentMessages = this.messages.slice(-6);
    const olderMessages = this.messages.slice(
      systemMessage ? 1 : 0, 
      -6
    );

    if (olderMessages.length === 0) return;

    // Summarize older messages
    const summaryRequest: ChatRequest = {
      model: this.config.model,
      messages: [
        { role: 'system', content: 'Summarize the following conversation briefly, keeping key facts and context.' },
        { role: 'user', content: olderMessages.map(m => `${m.role}: ${m.content}`).join('\n') },
      ],
      stream: false,
    };

    const summary = await ollama.chat(summaryRequest);

    // Rebuild messages
    this.messages = [];
    if (systemMessage) {
      this.messages.push(systemMessage);
    }
    this.messages.push({
      role: 'system',
      content: `[Previous conversation summary: ${summary.message.content}]`,
    });
    this.messages.push(...recentMessages);
  }
}

// ============= BUILT-IN TOOLS =============

export const BUILTIN_TOOLS: QwenTool[] = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for information',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'code_interpreter',
      description: 'Execute Python code and return the result',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Python code to execute' },
        },
        required: ['code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'image_gen',
      description: 'Generate an image based on text description',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Description of the image to generate' },
        },
        required: ['prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'file_read',
      description: 'Read contents of a file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to read' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'file_write',
      description: 'Write contents to a file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to write' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['path', 'content'],
      },
    },
  },
];

// ============= HELPER FUNCTIONS =============

/**
 * Create a Qwen agent with default ALFA configuration
 */
export function createAlfaAgent(model: string = 'qwen3:latest'): QwenAgent {
  const agent = new QwenAgent({
    model,
    systemPrompt: `Jesteś ALFA - inteligentnym asystentem AI z pełnym dostępem do narzędzi.
Masz możliwość:
- Wyszukiwania w internecie
- Wykonywania kodu Python
- Generowania obrazów
- Operacji na plikach
- Analizy obrazów (jeśli model obsługuje vision)

Odpowiadaj po polsku, chyba że użytkownik pisze w innym języku.
Bądź pomocny, precyzyjny i kreatywny.`,
    tools: BUILTIN_TOOLS,
    temperature: 0.7,
    thinkingMode: 'medium',
  });

  return agent;
}

/**
 * Quick chat with Qwen (no tools, no history)
 */
export async function quickChat(
  message: string,
  model: string = 'qwen3:latest',
  systemPrompt?: string
): Promise<string> {
  const messages: ChatMessage[] = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: message });

  const response = await ollama.chat({
    model,
    messages,
    stream: false,
  });

  return response.message.content;
}

/**
 * Vision analysis with Qwen-VL
 */
export async function analyzeImageWithQwen(
  imageBase64: string,
  prompt: string = 'Opisz ten obraz szczegółowo.',
  model: string = 'qwen3-vl:latest'
): Promise<string> {
  const response = await ollama.chat({
    model,
    messages: [
      {
        role: 'user',
        content: prompt,
        images: [imageBase64],
      },
    ],
    stream: false,
  });

  return response.message.content;
}
