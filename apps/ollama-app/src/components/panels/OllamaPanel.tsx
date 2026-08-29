import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Bot, 
  Download, 
  Trash2, 
  RefreshCw, 
  Eye, 
  Code, 
  Brain,
  Wrench,
  MessageSquare,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useOllama, useQwenAgent, getQwenModelInfo, isQwenModel } from '@/hooks/useOllama';
import { QWEN_MODELS } from '@/lib/ollama';
import { cn } from '@/lib/utils';
import { LLMEngineIndicator } from '@/components/LLMEngineToggle';
import { LLMEngineSelector } from '@/components/LLMEngineSelector';
import { useLLMRouter } from '@/hooks/useLLMRouter';

interface OllamaPanelProps {
  isConnected: boolean;
}

export function OllamaPanel({ isConnected }: OllamaPanelProps) {
  const {
    isAvailable,
    isLoading,
    models,
    qwenModels,
    activeModel,
    setActiveModel,
    refreshModels,
    pullModel,
    deleteModel,
  } = useOllama();

  const [pullProgress, setPullProgress] = useState<{ model: string; status: string; percent: number } | null>(null);
  const [selectedModelToPull, setSelectedModelToPull] = useState('qwen3:latest');

  const handlePullModel = async (modelName: string) => {
    setPullProgress({ model: modelName, status: 'Starting...', percent: 0 });
    try {
      await pullModel(modelName, (status, completed, total) => {
        const percent = total ? (completed! / total) * 100 : 0;
        setPullProgress({ model: modelName, status, percent });
      });
      setPullProgress(null);
    } catch (error) {
      console.error('Pull failed:', error);
      setPullProgress(null);
    }
  };

  const handleDeleteModel = async (modelName: string) => {
    if (confirm(`Czy na pewno chcesz usunąć model ${modelName}?`)) {
      await deleteModel(modelName);
    }
  };

  const formatSize = (bytes: number) => {
    const gb = bytes / 1024 / 1024 / 1024;
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(0)} MB`;
  };

  const { currentEngine } = useLLMRouter();

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-xl flex items-center gap-2">
              <Bot className="h-5 w-5" />
              LLM Router
              <LLMEngineIndicator />
            </CardTitle>
            <CardDescription>
              Ollama (lokalny) + OpenAI (chmura) z przełącznikiem
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isAvailable ? 'default' : 'destructive'}>
              {isAvailable ? (
                <><CheckCircle2 className="h-3 w-3 mr-1" /> Ollama Online</>
              ) : (
                <><XCircle className="h-3 w-3 mr-1" /> Ollama Offline</>
              )}
            </Badge>
            <Button variant="outline" size="sm" onClick={refreshModels} disabled={isLoading}>
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Engine Selector */}
          <div className="py-2">
            <LLMEngineSelector />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 text-center border-t pt-4">
            <div>
              <div className="text-2xl font-bold">{models.length}</div>
              <div className="text-xs text-muted-foreground">Modeli</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">{qwenModels.length}</div>
              <div className="text-xs text-muted-foreground">Qwen</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {activeModel ? '✓' : '—'}
              </div>
              <div className="text-xs text-muted-foreground">Aktywny</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {currentEngine === 'ollama' ? '🏠' : '☁️'}
              </div>
              <div className="text-xs text-muted-foreground">Silnik</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="models" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="models">Modele</TabsTrigger>
          <TabsTrigger value="pull">Pobierz</TabsTrigger>
          <TabsTrigger value="chat">Testuj</TabsTrigger>
        </TabsList>

        {/* Models Tab */}
        <TabsContent value="models" className="space-y-4">
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {models.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    {isAvailable ? (
                      <>Brak zainstalowanych modeli. Przejdź do "Pobierz" aby pobrać Qwen.</>
                    ) : (
                      <>Ollama nie jest uruchomiona. Uruchom: <code className="bg-muted px-2 py-1 rounded">ollama serve</code></>
                    )}
                  </CardContent>
                </Card>
              ) : (
                models.map((model) => {
                  const info = getQwenModelInfo(model.name);
                  const isQwen = isQwenModel(model.name);
                  const isActive = model.name === activeModel;

                  return (
                    <Card 
                      key={model.name}
                      className={cn(
                        "cursor-pointer transition-colors",
                        isActive && "border-primary bg-primary/5",
                        isQwen && "border-l-4 border-l-primary"
                      )}
                      onClick={() => setActiveModel(model.name)}
                    >
                      <CardContent className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded-lg",
                            isQwen ? "bg-primary/10" : "bg-muted"
                          )}>
                            <Bot className={cn("h-5 w-5", isQwen && "text-primary")} />
                          </div>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {model.name}
                              {isActive && <Badge variant="secondary" className="text-xs">Aktywny</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                              <span>{formatSize(model.size)}</span>
                              <span>•</span>
                              <span>{model.details.parameter_size}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Capabilities badges */}
                          {info?.capabilities.includes('vision') && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Eye className="h-3 w-3" /> Vision
                            </Badge>
                          )}
                          {info?.capabilities.includes('code') && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Code className="h-3 w-3" /> Code
                            </Badge>
                          )}
                          {info?.capabilities.includes('tools') && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Wrench className="h-3 w-3" /> Tools
                            </Badge>
                          )}
                          {info?.capabilities.includes('reasoning') && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Brain className="h-3 w-3" /> Think
                            </Badge>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteModel(model.name);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Pull Tab */}
        <TabsContent value="pull" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pobierz model Qwen</CardTitle>
              <CardDescription>
                Wybierz model do pobrania z Ollama Hub
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(QWEN_MODELS).map(([id, info]) => (
                  <Button
                    key={id}
                    variant={selectedModelToPull === id ? 'default' : 'outline'}
                    className="justify-start h-auto py-2"
                    onClick={() => setSelectedModelToPull(id)}
                  >
                    <div className="text-left">
                      <div className="font-medium">{info.name}</div>
                      <div className="text-xs text-muted-foreground flex gap-1 flex-wrap">
                        {info.capabilities.map(cap => (
                          <span key={cap} className="bg-muted px-1 rounded">{cap}</span>
                        ))}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  value={selectedModelToPull}
                  onChange={(e) => setSelectedModelToPull(e.target.value)}
                  placeholder="lub wpisz nazwę modelu..."
                />
                <Button 
                  onClick={() => handlePullModel(selectedModelToPull)}
                  disabled={pullProgress !== null || !isAvailable}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Pobierz
                </Button>
              </div>

              {pullProgress && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{pullProgress.model}</span>
                    <span>{pullProgress.status}</span>
                  </div>
                  <Progress value={pullProgress.percent} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chat Test Tab */}
        <TabsContent value="chat">
          <QwenChatTest model={activeModel} isAvailable={isAvailable} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Cloud AI Chat Component — works without local Ollama
const CLOUD_MODELS = [
  { id: 'google/gemini-3-flash-preview', label: '⚡ Gemini Flash', desc: 'Szybki, domyślny' },
  { id: 'google/gemini-2.5-flash', label: '⚡ Gemini 2.5 Flash', desc: 'Zbalansowany' },
  { id: 'google/gemini-2.5-pro', label: '🧠 Gemini Pro', desc: 'Najsilniejszy reasoning' },
  { id: 'google/gemini-3-pro-preview', label: '🧠 Gemini 3 Pro', desc: 'Nowa generacja' },
  { id: 'openai/gpt-5', label: '🤖 GPT-5', desc: 'OpenAI, precyzyjny' },
  { id: 'openai/gpt-5-mini', label: '🤖 GPT-5 Mini', desc: 'OpenAI, szybszy' },
];

function QwenChatTest({ model, isAvailable }: { model: string; isAvailable: boolean }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [cloudModel, setCloudModel] = useState('google/gemini-3-flash-preview');

  const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/alfa-chat`;

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const userMsg = { role: 'user' as const, content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsStreaming(true);

    let assistantContent = '';

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: newMessages, model: cloudModel }),
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({ error: 'Błąd połączenia' }));
        setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${errData.error || 'Błąd'}` }]);
        setIsStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                }
                return [...prev, { role: 'assistant', content: assistantContent }];
              });
            }
          } catch { /* partial JSON, wait for more */ }
        }
      }
    } catch (e) {
      console.error('Chat error:', e);
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Błąd połączenia z AI' }]);
    } finally {
      setIsStreaming(false);
    }
  };

  const reset = () => setMessages([]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            ALFA AI Chat
          </CardTitle>
          <CardDescription>
            {CLOUD_MODELS.find(m => m.id === cloudModel)?.label || 'Cloud AI'}
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={reset}>
          Reset
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Model selector */}
        <div className="flex gap-1.5 flex-wrap">
          {CLOUD_MODELS.map(m => (
            <Button
              key={m.id}
              variant={cloudModel === m.id ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => setCloudModel(m.id)}
              title={m.desc}
            >
              {m.label}
            </Button>
          ))}
        </div>
        <ScrollArea className="h-[300px] border rounded-lg p-3">
          <div className="space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Napisz coś aby rozpocząć rozmowę z ALFA AI</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "p-3 rounded-lg max-w-[85%]",
                  msg.role === 'user'
                    ? "bg-primary text-primary-foreground ml-auto"
                    : "bg-muted"
                )}
              >
                <div className="text-xs opacity-70 mb-1">
                  {msg.role === 'user' ? 'Ty' : 'ALFA AI'}
                </div>
                <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
              </div>
            ))}
            {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="p-3 rounded-lg bg-muted max-w-[85%]">
                <div className="text-xs opacity-70 mb-1">ALFA AI</div>
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Napisz wiadomość do ALFA AI..."
            disabled={isStreaming}
            className="resize-none"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="self-end"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
