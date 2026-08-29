import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Trash2, 
  Settings2, 
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  Download,
  MessageSquare,
  Clock,
  Zap,
  Wifi,
  WifiOff,
  Brain,
  Heart,
  TrendingUp,
  Cloud,
  Terminal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { getModels, type Model } from '@/lib/api';
// TokenCalculator removed
import { useLiminalEngine } from '@/hooks/useLiminalEngine';
import { useLLMRouter } from '@/hooks/useLLMRouter';
import { LLMEngineSelector } from '@/components/LLMEngineSelector';
import { getDecisionLabel, getDecisionColor, type CerberDecision } from '@/lib/cerber';
import { type ConfidenceResult } from '@/lib/confidence-gate';
import { ConfidenceBadge } from '@/components/ConfidenceIndicator';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { parseAgentActions, hasExecutableContent, createAgentPlan, formatPlanMessage, executeSingleAction, formatAgentReport, type AgentPlan, type AgentStepResult, type AgentAction } from '@/lib/agent-executor';
import { AgentApprovalPanel } from '@/components/AgentApprovalPanel';
import { parsePluginCommand, executePlugin, formatPluginResult, formatPluginNotFound, formatPluginList, isPluginListRequest, fetchPlugins as fetchPluginRegistry } from '@/lib/plugin-service';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  model?: string;
  engine?: string;
  cerberDecision?: CerberDecision;
  confidence?: ConfidenceResult;
}

interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  model?: string;
}

interface ChatPanelProps {
  isConnected: boolean;
  activeModel: string;
}

// Demo responses - symulowane odpowiedzi AI
const DEMO_RESPONSES: Record<string, string[]> = {
  default: [
    "Rozumiem! To interesujące pytanie. Pozwól, że rozwinę ten temat...\n\n**Oto kilka kluczowych punktów:**\n\n1. Analiza kontekstu\n2. Możliwe rozwiązania\n3. Rekomendacje\n\nCzy chciałbyś, żebym rozwinął któryś z tych punktów?",
    "Świetne pytanie! Oto moja odpowiedź:\n\n```javascript\nconst example = {\n  key: 'value',\n  nested: { data: true }\n};\nconsole.log(example);\n```\n\nTen kod demonstruje podstawową strukturę. Mogę wyjaśnić więcej szczegółów.",
    "Oczywiście! Przeanalizowałem Twoje zapytanie.\n\n> **Podsumowanie:** To jest tryb demo, więc odpowiedzi są symulowane.\n\n- Punkt pierwszy\n- Punkt drugi\n- Punkt trzeci\n\n*Czy mogę w czymś jeszcze pomóc?*",
  ],
  code: [
    "Oto przykładowy kod:\n\n```typescript\ninterface User {\n  id: string;\n  name: string;\n  email: string;\n}\n\nconst fetchUser = async (id: string): Promise<User> => {\n  const response = await fetch(`/api/users/${id}`);\n  return response.json();\n};\n```\n\nTen kod definiuje interfejs i funkcję asynchroniczną.",
    "Rozwiązanie tego problemu:\n\n```python\ndef solve_problem(data: list) -> dict:\n    result = {}\n    for item in data:\n        if item not in result:\n            result[item] = 0\n        result[item] += 1\n    return result\n\n# Użycie\ndata = [1, 2, 2, 3, 3, 3]\nprint(solve_problem(data))  # {1: 1, 2: 2, 3: 3}\n```",
  ],
  explain: [
    "## Wyjaśnienie\n\nTo zagadnienie można podzielić na kilka części:\n\n### 1. Podstawy\nNa początek warto zrozumieć fundamenty...\n\n### 2. Zaawansowane koncepcje\nKiedy opanujesz podstawy, możesz przejść do bardziej złożonych tematów.\n\n### 3. Praktyczne zastosowanie\nNajlepszy sposób nauki to praktyka!\n\n---\n\n*Czy to odpowiada na Twoje pytanie?*",
  ],
  help: [
    "Chętnie pomogę! 🚀\n\n**Jak mogę Ci asystować:**\n\n1. 💻 Pisanie i analiza kodu\n2. 📝 Wyjaśnienia i dokumentacja\n3. 🔍 Rozwiązywanie problemów\n4. 💡 Pomysły i brainstorming\n\n> To jest tryb demo - odpowiedzi są symulowane lokalnie bez połączenia z backendem.\n\nNapisz co Cię interesuje!",
  ],
};

const STORAGE_KEY = 'alfa-chat-conversations';
const DEMO_MODE_KEY = 'alfa-chat-demo-mode';

// Funkcja generująca symulowaną odpowiedź
const generateDemoResponse = (input: string): Promise<string> => {
  return new Promise((resolve) => {
    const delay = 500 + Math.random() * 1500; // 0.5-2 sekundy opóźnienia
    
    setTimeout(() => {
      const lowerInput = input.toLowerCase();
      let responses: string[];
      
      if (lowerInput.includes('kod') || lowerInput.includes('code') || lowerInput.includes('napisz')) {
        responses = DEMO_RESPONSES.code;
      } else if (lowerInput.includes('wyjaśnij') || lowerInput.includes('explain') || lowerInput.includes('co to')) {
        responses = DEMO_RESPONSES.explain;
      } else if (lowerInput.includes('pomóż') || lowerInput.includes('help') || lowerInput.includes('pomoc')) {
        responses = DEMO_RESPONSES.help;
      } else {
        responses = DEMO_RESPONSES.default;
      }
      
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      resolve(randomResponse);
    }, delay);
  });
};

// Funkcje do zarządzania localStorage
const loadConversations = (): Conversation[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((c: Conversation) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
        messages: c.messages.map(m => ({
          ...m,
          timestamp: new Date(m.timestamp),
        })),
      }));
    }
  } catch (e) {
    console.error('Error loading conversations:', e);
  }
  return [];
};

const saveConversations = (conversations: Conversation[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (e) {
    console.error('Error saving conversations:', e);
  }
};

const loadDemoMode = (): boolean => {
  try {
    return localStorage.getItem(DEMO_MODE_KEY) === 'true';
  } catch {
    return false;
  }
};

const saveDemoMode = (enabled: boolean) => {
  try {
    localStorage.setItem(DEMO_MODE_KEY, String(enabled));
  } catch (e) {
    console.error('Error saving demo mode:', e);
  }
};

export function ChatPanel({ isConnected, activeModel }: ChatPanelProps) {
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations());
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState(activeModel);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showMemoryStats, setShowMemoryStats] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(() => loadDemoMode());
  const [liminalEnabled, setLiminalEnabled] = useState(true);
  const [autoExecEnabled, setAutoExecEnabled] = useState(true);
  const [isAutoExecuting, setIsAutoExecuting] = useState(false);
  const [activePlan, setActivePlan] = useState<AgentPlan | null>(null);
  const [planResults, setPlanResults] = useState<AgentStepResult[]>([]);
  const [activeConvForPlan, setActiveConvForPlan] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // LLM Router - unified engine management
  const llmRouter = useLLMRouter();

  // Liminal Engine - pamięć epizodyczna i repair/rupture
  const liminal = useLiminalEngine();

  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const messages = activeConversation?.messages || [];

  // Save conversations to localStorage whenever they change
  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  // Save demo mode preference
  useEffect(() => {
    saveDemoMode(demoMode);
  }, [demoMode]);

  // Fetch available models + plugin registry
  useEffect(() => {
    if (isConnected && !demoMode) {
      getModels().then(setModels);
    }
    // Always load plugin registry (works offline with fallback)
    fetchPluginRegistry();
  }, [isConnected, demoMode]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Create new conversation
  const createNewConversation = useCallback(() => {
    const newConv: Conversation = {
      id: crypto.randomUUID(),
      title: 'Nowa rozmowa',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      model: selectedModel,
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
    return newConv;
  }, [selectedModel]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!input.trim() || isLoading) return;

    let conv = activeConversation;
    if (!conv) {
      conv = createNewConversation();
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    // Update conversation with user message
    setConversations(prev => prev.map(c => 
      c.id === conv!.id 
        ? { 
            ...c, 
            messages: [...c.messages, userMessage],
            updatedAt: new Date(),
            title: c.messages.length === 0 ? input.slice(0, 50) : c.title,
          }
        : c
    ));
    
    setInput('');
    setIsLoading(true);

    try {
      // ── 🔌 PLUGIN COMMAND DETECTION ──
      // Check if user typed a plugin command (e.g., "uruchom pdf-generator")
      const pluginListRequested = isPluginListRequest(input.trim());
      const pluginCmd = !pluginListRequested ? parsePluginCommand(input.trim()) : null;

      if (pluginListRequested) {
        // Show plugin list
        const listMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: formatPluginList(),
          timestamp: new Date(),
          model: 'plugin-system',
          engine: 'local',
        };
        setConversations(prev => prev.map(c =>
          c.id === conv!.id
            ? { ...c, messages: [...c.messages, listMessage], updatedAt: new Date() }
            : c
        ));
        return; // skip LLM
      }

      if (pluginCmd) {
        // Execute plugin directly
        const statusMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `🔌 Uruchamiam plugin **\`${pluginCmd.pluginName}\`**...`,
          timestamp: new Date(),
          model: 'plugin-system',
          engine: 'local',
        };
        setConversations(prev => prev.map(c =>
          c.id === conv!.id
            ? { ...c, messages: [...c.messages, statusMsg], updatedAt: new Date() }
            : c
        ));

        if (!pluginCmd.plugin) {
          // Plugin not found
          const notFoundMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: formatPluginNotFound(pluginCmd.pluginName),
            timestamp: new Date(),
            model: 'plugin-system',
            engine: 'local',
          };
          setConversations(prev => prev.map(c =>
            c.id === conv!.id
              ? { ...c, messages: [...c.messages, notFoundMsg], updatedAt: new Date() }
              : c
          ));
          return;
        }

        // Execute the plugin
        const result = await executePlugin(pluginCmd.pluginName, pluginCmd.params);
        const resultMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: formatPluginResult(result),
          timestamp: new Date(),
          model: 'plugin-system',
          engine: 'local',
        };
        setConversations(prev => prev.map(c =>
          c.id === conv!.id
            ? { ...c, messages: [...c.messages, resultMsg], updatedAt: new Date() }
            : c
        ));
        return; // skip LLM
      }

      // ── STANDARD LLM FLOW ──
      let responseContent: string;
      let usedModel: string = 'demo-ai';
      let usedEngine: string = 'demo';
      let cerberDecision: CerberDecision | undefined;
      let confidenceData: ConfidenceResult | undefined;
      
      // Liminal Engine - wzbogacenie kontekstu o pamięć epizodyczną
      const enhancedContent = liminalEnabled 
        ? liminal.enhancePromptWithContext(userMessage.content)
        : userMessage.content;
      
      if (demoMode) {
        // Tryb demo - symulowane odpowiedzi
        if (liminalEnabled && liminal.shouldIntroduceMinorError()) {
          responseContent = liminal.generateRepairSequence();
        } else {
          responseContent = await generateDemoResponse(enhancedContent);
        }
      } else {
        // 🔧 UNIFIED LLM ROUTER - używaj routera zamiast bezpośredniego API
        const conversationHistory = messages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
        
        const response = await llmRouter.chat({
          messages: [
            ...conversationHistory,
            { role: 'user', content: enhancedContent }
          ],
          model: selectedModel,
        });
        
        responseContent = response.content;
        usedModel = response.model;
        usedEngine = response.engine;
        cerberDecision = response.cerber?.decision;
        confidenceData = response.confidence;
        
        // Log engine usage
        console.log(`💬 [ChatPanel] Response via ${usedEngine.toUpperCase()} | Model: ${usedModel} | Cerber: ${cerberDecision || 'N/A'} | Confidence: ${confidenceData ? `${(confidenceData.score * 100).toFixed(0)}%` : 'N/A'}`);
      }
      
      // Liminal Engine - zapisz epizod do pamięci
      if (liminalEnabled) {
        liminal.storeEpisode(userMessage.content, responseContent);
      }
      
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: responseContent,
        timestamp: new Date(),
        model: usedModel,
        engine: usedEngine,
        cerberDecision,
        confidence: confidenceData,
      };

      setConversations(prev => prev.map(c => 
        c.id === conv!.id 
          ? { ...c, messages: [...c.messages, assistantMessage], updatedAt: new Date() }
          : c
      ));

      // 🤖 AGENT PLAN: wykryj komendy → pokaż plan → czekaj na zatwierdzenie
      if (autoExecEnabled && !demoMode && hasExecutableContent(responseContent)) {
        const actions = parseAgentActions(responseContent);
        if (actions.length > 0) {
          // Auto-reject critical actions (Cerber blocked)
          const safeActions = actions.map(a => ({
            ...a,
            status: (a.cerberVerdict && !a.cerberVerdict.safe ? 'skipped' : 'pending') as AgentAction['status'],
          }));

          const plan = createAgentPlan(safeActions);
          setActivePlan(plan);
          setPlanResults([]);
          setActiveConvForPlan(conv!.id);

          // Add plan message to chat
          const planMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: formatPlanMessage(plan),
            timestamp: new Date(),
            model: 'agent-executor',
            engine: 'cerber',
          };

          setConversations(prev => prev.map(c => 
            c.id === conv!.id 
              ? { ...c, messages: [...c.messages, planMsg], updatedAt: new Date() }
              : c
          ));
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: demoMode 
          ? 'Wystąpił błąd w trybie demo. Spróbuj ponownie.'
          : `Przepraszam, wystąpił błąd: ${error instanceof Error ? error.message : 'Nieznany błąd'}. Sprawdź połączenie z silnikiem LLM.`,
        timestamp: new Date(),
      };
      setConversations(prev => prev.map(c => 
        c.id === conv!.id 
          ? { ...c, messages: [...c.messages, errorMessage], updatedAt: new Date() }
          : c
      ));
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  };

  const clearChat = () => {
    if (activeConversationId) {
      setConversations(prev => prev.filter(c => c.id !== activeConversationId));
      setActiveConversationId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // ── Agent Approval Handlers ───────────────────────────────

  const handleApproveStep = useCallback(async (actionId: string) => {
    if (!activePlan) return;

    const actionIndex = activePlan.actions.findIndex(a => a.id === actionId);
    if (actionIndex === -1) return;

    // Mark as executing
    const updatedActions = [...activePlan.actions];
    updatedActions[actionIndex] = { ...updatedActions[actionIndex], status: 'executing' };
    setActivePlan(prev => prev ? { ...prev, actions: updatedActions, status: 'in_progress' } : null);
    setIsAutoExecuting(true);

    // Execute
    const result = await executeSingleAction(updatedActions[actionIndex]);
    
    // Update action status
    updatedActions[actionIndex] = {
      ...updatedActions[actionIndex],
      status: result.success ? 'done' : 'error',
    };

    const newResults = [...planResults, result];
    setPlanResults(newResults);

    // Add result to chat
    if (activeConvForPlan) {
      const resultMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `${result.success ? '✅' : '❌'} **Krok ${actionIndex + 1}:** ${result.action.description}\n\`\`\`\n${result.output.slice(0, 500) || (result.success ? 'OK' : 'Błąd')}\n\`\`\``,
        timestamp: new Date(),
        model: 'agent-executor',
        engine: 'powershell',
      };
      setConversations(prev => prev.map(c =>
        c.id === activeConvForPlan
          ? { ...c, messages: [...c.messages, resultMsg], updatedAt: new Date() }
          : c
      ));
    }

    // Move to next step
    const nextPending = updatedActions.findIndex((a, i) => i > actionIndex && a.status === 'pending');
    const allDone = updatedActions.every(a => a.status !== 'pending');

    setActivePlan(prev => prev ? {
      ...prev,
      actions: updatedActions,
      currentStep: nextPending >= 0 ? nextPending : prev.actions.length,
      status: allDone ? 'completed' : 'awaiting_approval',
    } : null);

    setIsAutoExecuting(false);

    // Final report if all done
    if (allDone && activeConvForPlan) {
      const report = formatAgentReport(newResults);
      const reportMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: report,
        timestamp: new Date(),
        model: 'agent-executor',
        engine: 'cerber',
      };
      setConversations(prev => prev.map(c =>
        c.id === activeConvForPlan
          ? { ...c, messages: [...c.messages, reportMsg], updatedAt: new Date() }
          : c
      ));
      setTimeout(() => setActivePlan(null), 3000);
    }
  }, [activePlan, planResults, activeConvForPlan]);

  const handleRejectStep = useCallback((actionId: string) => {
    if (!activePlan) return;

    const actionIndex = activePlan.actions.findIndex(a => a.id === actionId);
    if (actionIndex === -1) return;

    const updatedActions = [...activePlan.actions];
    updatedActions[actionIndex] = { ...updatedActions[actionIndex], status: 'rejected' };

    const nextPending = updatedActions.findIndex((a, i) => i > actionIndex && a.status === 'pending');
    const allDone = updatedActions.every(a => a.status !== 'pending');

    setActivePlan(prev => prev ? {
      ...prev,
      actions: updatedActions,
      currentStep: nextPending >= 0 ? nextPending : prev.actions.length,
      status: allDone ? 'completed' : 'awaiting_approval',
    } : null);

    if (activeConvForPlan) {
      const rejectMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `⏭️ **Krok ${actionIndex + 1} odrzucony:** ${updatedActions[actionIndex].description}`,
        timestamp: new Date(),
        model: 'agent-executor',
        engine: 'cerber',
      };
      setConversations(prev => prev.map(c =>
        c.id === activeConvForPlan
          ? { ...c, messages: [...c.messages, rejectMsg], updatedAt: new Date() }
          : c
      ));
    }

    if (allDone) {
      const report = formatAgentReport(planResults);
      if (report && activeConvForPlan) {
        const reportMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: report,
          timestamp: new Date(),
          model: 'agent-executor',
          engine: 'cerber',
        };
        setConversations(prev => prev.map(c =>
          c.id === activeConvForPlan
            ? { ...c, messages: [...c.messages, reportMsg], updatedAt: new Date() }
            : c
        ));
      }
      setTimeout(() => setActivePlan(null), 3000);
    }
  }, [activePlan, planResults, activeConvForPlan]);

  const handleApproveAll = useCallback(async () => {
    if (!activePlan) return;
    const pendingActions = activePlan.actions.filter(a => a.status === 'pending');
    for (const action of pendingActions) {
      await handleApproveStep(action.id);
    }
  }, [activePlan, handleApproveStep]);

  const handleAbortPlan = useCallback(() => {
    if (activeConvForPlan) {
      const abortMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '🛑 **Plan przerwany przez użytkownika.**',
        timestamp: new Date(),
        model: 'agent-executor',
        engine: 'cerber',
      };
      setConversations(prev => prev.map(c =>
        c.id === activeConvForPlan
          ? { ...c, messages: [...c.messages, abortMsg], updatedAt: new Date() }
          : c
      ));
    }
    setActivePlan(null);
    setPlanResults([]);
    setIsAutoExecuting(false);
  }, [activeConvForPlan]);

  const copyMessage = async (id: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const regenerateResponse = async (messageId: string) => {
    const msgIndex = messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1 || messages[msgIndex].role !== 'assistant') return;

    // Find the previous user message
    const userMsg = messages.slice(0, msgIndex).reverse().find(m => m.role === 'user');
    if (!userMsg) return;

    // Remove messages from this point
    setConversations(prev => prev.map(c => 
      c.id === activeConversationId 
        ? { ...c, messages: c.messages.slice(0, msgIndex) }
        : c
    ));

    setIsLoading(true);
    try {
      let responseContent: string;
      let usedModel = 'demo-ai';
      let usedEngine = 'demo';
      
      if (demoMode) {
        responseContent = await generateDemoResponse(userMsg.content);
      } else {
        // Use LLM Router for regeneration
        const conversationHistory = messages.slice(0, msgIndex).map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
        
        const response = await llmRouter.chat({
          messages: conversationHistory,
          model: selectedModel,
        });
        
        responseContent = response.content;
        usedModel = response.model;
        usedEngine = response.engine;
      }
      
      const newAssistant: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: responseContent,
        timestamp: new Date(),
        model: usedModel,
        engine: usedEngine,
      };
      setConversations(prev => prev.map(c => 
        c.id === activeConversationId 
          ? { ...c, messages: [...c.messages, newAssistant], updatedAt: new Date() }
          : c
      ));
    } catch (error) {
      console.error('Regeneration error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const exportConversation = () => {
    if (!activeConversation) return;
    const content = messages
      .map(m => `[${m.role.toUpperCase()}] ${m.content}`)
      .join('\n\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${activeConversation.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculate total tokens for cost display
  const totalInput = messages.filter(m => m.role === 'user').map(m => m.content).join('');
  const totalOutput = messages.filter(m => m.role === 'assistant').map(m => m.content).join('');

  return (
    <div className="flex h-full gap-4">
      {/* Sidebar - Historia rozmów */}
      <Collapsible open={showHistory} onOpenChange={setShowHistory} className="hidden lg:block">
        <CollapsibleContent className="w-64">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Historia
                </CardTitle>
                <Button variant="outline" size="sm" onClick={createNewConversation}>
                  <MessageSquare className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-2">
              <ScrollArea className="h-[500px]">
                {conversations.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-4">
                    Brak rozmów
                  </p>
                ) : (
                  <div className="space-y-1">
                    {conversations.map(conv => (
                      <button
                        key={conv.id}
                        onClick={() => setActiveConversationId(conv.id)}
                        className={cn(
                          "w-full text-left p-2 rounded-md text-sm transition-colors",
                          activeConversationId === conv.id
                            ? "bg-primary/10 border border-primary/20"
                            : "hover:bg-muted/50"
                        )}
                      >
                        <p className="font-medium truncate">{conv.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {conv.messages.length} wiadomości
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Main Chat */}
      <Card className="flex-1 flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setShowHistory(!showHistory)}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            <Bot className="h-5 w-5" />
            Chat AI
            {demoMode ? (
              <Badge variant="outline" className="text-xs gap-1 border-primary/50 text-primary">
                <Zap className="h-3 w-3" />
                Demo
              </Badge>
            ) : (
              <Badge 
                variant={llmRouter.currentEngine === 'ollama' ? 'default' : 'secondary'} 
                className="text-xs gap-1"
              >
                {llmRouter.currentEngine === 'ollama' ? (
                  <Wifi className="h-3 w-3" />
                ) : (
                  <Cloud className="h-3 w-3" />
                )}
                {llmRouter.currentEngine === 'cloud' ? '☁️ CLOUD' : llmRouter.currentEngine.toUpperCase()}
              </Badge>
            )}
            {liminalEnabled && (
              <Badge variant="outline" className="text-xs gap-1 border-accent/50 text-accent">
                <Brain className="h-3 w-3" />
                Liminal
              </Badge>
            )}
            {autoExecEnabled && (
              <Badge variant="outline" className="text-xs gap-1 border-primary/50 text-primary">
                <Terminal className="h-3 w-3" />
                Auto-Exec
              </Badge>
            )}
            {isAutoExecuting && (
              <Badge variant="default" className="text-xs gap-1 animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" />
                Executing...
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant={showMemoryStats ? "default" : "ghost"}
                    size="icon"
                    onClick={() => setShowMemoryStats(!showMemoryStats)}
                    className={showMemoryStats ? "bg-accent hover:bg-accent/90" : ""}
                  >
                    <Brain className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Pamięć Liminal</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setShowSettings(!showSettings)}
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Ustawienia</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {messages.length > 0 && (
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={exportConversation}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Eksportuj</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={clearChat}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Usuń rozmowę</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}
          </div>
        </CardHeader>

        {/* Memory Stats Panel */}
        {showMemoryStats && (
          <div className="px-6 pb-4">
            <Card className="bg-muted/50 border-accent/30">
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-accent" />
                    <span className="font-medium">Liminal Engine</span>
                  </div>
                  <Switch
                    checked={liminalEnabled}
                    onCheckedChange={setLiminalEnabled}
                  />
                </div>
                
                {liminalEnabled && (
                  <>
                    {/* Relationship Strength */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1">
                          <Heart className="h-4 w-4 text-destructive" />
                          Siła więzi
                        </span>
                        <span className="text-muted-foreground">
                          {Math.round(liminal.stats.relationshipStrength * 100)}%
                        </span>
                      </div>
                      <Progress value={liminal.stats.relationshipStrength * 100} className="h-2" />
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded-md bg-background/50">
                        <p className="text-lg font-bold text-primary">{liminal.stats.totalMemories}</p>
                        <p className="text-xs text-muted-foreground">Wspomnienia</p>
                      </div>
                      <div className="p-2 rounded-md bg-background/50">
                        <p className="text-lg font-bold text-primary">{liminal.stats.totalInteractions}</p>
                        <p className="text-xs text-muted-foreground">Interakcje</p>
                      </div>
                      <div className="p-2 rounded-md bg-background/50">
                        <p className="text-lg font-bold text-primary">{liminal.profile.repairCount}</p>
                        <p className="text-xs text-muted-foreground">Naprawy</p>
                      </div>
                    </div>

                    {/* Top Emotions */}
                    {liminal.stats.totalMemories > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium flex items-center gap-1">
                          <TrendingUp className="h-4 w-4" />
                          Dominujące emocje
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(liminal.stats.topEmotions)
                            .filter(([, count]) => count > 0)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 4)
                            .map(([emotion, count]) => (
                              <Badge key={emotion} variant="secondary" className="text-xs">
                                {emotion}: {count}
                              </Badge>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Top Tags */}
                    {liminal.stats.topTags.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Zainteresowania</p>
                        <div className="flex flex-wrap gap-1">
                          {liminal.stats.topTags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              #{tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Clear Memory Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm('Czy na pewno chcesz wyczyścić całą pamięć Liminal Engine?')) {
                          liminal.clearAllData();
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3 mr-2" />
                      Wyczyść pamięć
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {showSettings && (
          <div className="px-6 pb-4">
            <Card className="bg-muted/50">
              <CardContent className="pt-4 space-y-4">
                {/* Tryb Demo Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      Tryb Demo
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Działa offline, symulowane odpowiedzi
                    </p>
                  </div>
                  <Switch
                    checked={demoMode}
                    onCheckedChange={setDemoMode}
                  />
                </div>

                {demoMode && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10 border border-primary/20">
                    <WifiOff className="h-4 w-4 text-primary" />
                    <span className="text-xs text-primary">
                      Tryb demo aktywny - odpowiedzi są symulowane lokalnie
                    </span>
                  </div>
                )}

                {/* Auto-Executor Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <Terminal className="h-4 w-4 text-primary" />
                      Agent Auto-Exec
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Automatycznie wykonuje komendy z odpowiedzi AI w PowerShell
                    </p>
                  </div>
                  <Switch
                    checked={autoExecEnabled}
                    onCheckedChange={setAutoExecEnabled}
                  />
                </div>

                {autoExecEnabled && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-accent/10 border border-accent/20">
                    <Zap className="h-4 w-4 text-accent" />
                    <span className="text-xs text-accent">
                      Agent sam wykona komendy PowerShell/Bash z odpowiedzi AI
                    </span>
                  </div>
                )}

                {!demoMode && (
                  <>
                    {/* LLM Engine Selector */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Silnik LLM
                      </Label>
                      <LLMEngineSelector />
                    </div>

                    {/* Model Selector - tylko dla Ollama */}
                    {llmRouter.currentEngine === 'ollama' && (
                      <div className="space-y-2">
                        <Label>Model Ollama</Label>
                        <Select value={selectedModel} onValueChange={setSelectedModel} disabled={!isConnected}>
                          <SelectTrigger>
                            <SelectValue placeholder="Wybierz model..." />
                          </SelectTrigger>
                          <SelectContent>
                            {models.length > 0 ? (
                              models.map((model) => (
                                <SelectItem key={model.id} value={model.id}>
                                  {model.name}
                                </SelectItem>
                              ))
                            ) : (
                              <>
                                <SelectItem value="qwen3:latest">Qwen 3 (domyślny)</SelectItem>
                                <SelectItem value="deepseek-r1:latest">DeepSeek R1</SelectItem>
                                <SelectItem value="llama3.1:latest">Llama 3.1</SelectItem>
                                <SelectItem value="gemma2:latest">Gemma 2</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                )}
                
                {/* Token calculator removed */}
              </CardContent>
            </Card>
          </div>
        )}

        <CardContent className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <Sparkles className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  Rozpocznij rozmowę z AI
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Obsługuje: DeepSeek, Gemini, GPT-4, Claude
                </p>
                <div className="flex flex-wrap gap-2 mt-4 max-w-md justify-center">
                  {['Wyjaśnij mi...', 'Napisz kod...', 'Pomóż mi z...', 'Przeanalizuj...'].map(prompt => (
                    <Button
                      key={prompt}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setInput(prompt)}
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4 pb-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "group flex gap-3",
                      message.role === 'user' ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === 'assistant' && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div className="relative max-w-[80%]">
                      <div
                        className={cn(
                          "rounded-lg px-4 py-3",
                          message.role === 'user'
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        {message.role === 'assistant' ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        )}
                        <div className="flex items-center gap-2 text-xs opacity-60 mt-2">
                          <span>{message.timestamp.toLocaleTimeString()}</span>
                          {message.model && <span>• {message.model}</span>}
                          {message.engine && message.role === 'assistant' && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1">
                              {message.engine}
                            </Badge>
                          )}
                          {message.confidence && (
                            <ConfidenceBadge result={message.confidence} className="h-4 text-[10px]" />
                          )}
                        </div>
                      </div>
                      
                      {/* Message actions */}
                      <div className={cn(
                        "absolute -bottom-6 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1",
                        message.role === 'user' ? "right-0" : "left-0"
                      )}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyMessage(message.id, message.content)}
                        >
                          {copiedId === message.id ? (
                            <Check className="h-3 w-3 text-primary" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                        {message.role === 'assistant' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => regenerateResponse(message.id)}
                            disabled={isLoading}
                          >
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {message.role === 'user' && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3 justify-start">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="rounded-lg px-4 py-3 bg-muted">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce opacity-60" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce opacity-60" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce opacity-60" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Agent Approval Panel */}
                {activePlan && activePlan.status !== 'completed' && (
                  <div className="px-2 pb-4">
                    <AgentApprovalPanel
                      plan={activePlan}
                      onApprove={handleApproveStep}
                      onReject={handleRejectStep}
                      onApproveAll={handleApproveAll}
                      onAbort={handleAbortPlan}
                      results={planResults}
                      isExecuting={isAutoExecuting}
                    />
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <form onSubmit={handleSubmit} className="flex gap-2 pt-4 border-t">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                demoMode 
                  ? "Tryb demo - napisz cokolwiek... (Enter = wyślij)" 
                  : "Napisz wiadomość... (Enter = wyślij, Shift+Enter = nowa linia)"
              }
              disabled={isLoading}
              className="flex-1 min-h-[44px] max-h-32 resize-none"
              rows={1}
            />
            <Button 
              type="submit" 
              disabled={isLoading || !input.trim()}
              size="icon"
              className="h-11 w-11"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
          
          {/* Token counter removed */}
        </CardContent>
      </Card>
    </div>
  );
}
