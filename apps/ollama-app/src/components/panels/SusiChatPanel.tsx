import { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal, Send, Loader2, Settings2, Trash2, Globe, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { llmRouter, type LLMEngine } from '@/lib/llm-router';

interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'system' | 'error';
  content: string;
  timestamp: Date;
}

export function SusiChatPanel() {
  const [lines, setLines] = useState<TerminalLine[]>([
    { id: '0', type: 'system', content: '🤖 SUSI Chat Terminal — llama.cpp backend', timestamp: new Date() },
    { id: '1', type: 'system', content: 'Wpisz wiadomość i naciśnij Enter. Wpisz /help po pomoc.', timestamp: new Date() },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [llamaUrl, setLlamaUrl] = useState('http://localhost:8001');
  const [iframeUrl, setIframeUrl] = useState('http://localhost:8001');
  const [showSettings, setShowSettings] = useState(false);
  const [connected, setConnected] = useState(false);
  const [activeView, setActiveView] = useState<'terminal' | 'iframe'>('terminal');
  const [iframeConnected, setIframeConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const checkConnection = useCallback(async () => {
    try {
      const r = await fetch(`${llamaUrl}/health`, { signal: AbortSignal.timeout(3000) });
      setConnected(r.ok);
    } catch {
      // Try root endpoint
      try {
        const r = await fetch(`${llamaUrl}/`, { signal: AbortSignal.timeout(3000) });
        setConnected(r.ok);
      } catch {
        setConnected(false);
      }
    }
  }, [llamaUrl]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const addLine = (type: TerminalLine['type'], content: string) => {
    setLines(prev => [...prev, {
      id: crypto.randomUUID(),
      type,
      content,
      timestamp: new Date(),
    }]);
  };

  const handleCommand = async (cmd: string) => {
    if (cmd === '/help') {
      addLine('system', '📋 Komendy:');
      addLine('system', '  /help     — pokaż pomoc');
      addLine('system', '  /clear    — wyczyść terminal');
      addLine('system', '  /status   — sprawdź połączenie z llama.cpp');
      addLine('system', '  /url <url> — zmień URL serwera');
      addLine('system', '  /models   — lista modeli');
      addLine('system', '  Cokolwiek innego → wyślij do AI');
      return;
    }
    if (cmd === '/clear') {
      setLines([{ id: '0', type: 'system', content: '🤖 Terminal wyczyszczony.', timestamp: new Date() }]);
      return;
    }
    if (cmd === '/status') {
      await checkConnection();
      addLine('system', connected ? '✅ Połączono z llama.cpp' : '❌ Brak połączenia');
      return;
    }
    if (cmd.startsWith('/url ')) {
      const newUrl = cmd.slice(5).trim();
      setLlamaUrl(newUrl);
      addLine('system', `🔧 URL zmieniony na: ${newUrl}`);
      return;
    }
    if (cmd === '/models') {
      try {
        const r = await fetch(`${llamaUrl}/v1/models`);
        const data = await r.json();
        addLine('system', `📦 Modele: ${JSON.stringify(data.data?.map((m: any) => m.id) || data)}`);
      } catch {
        addLine('error', '❌ Nie można pobrać listy modeli');
      }
      return;
    }
    addLine('error', `❓ Nieznana komenda: ${cmd}`);
  };

  const handleSend = async () => {
    const msg = input.trim();
    if (!msg || isLoading) return;
    
    addLine('input', msg);
    setInput('');
    
    if (msg.startsWith('/')) {
      await handleCommand(msg);
      return;
    }

    setIsLoading(true);
    try {
      // Use LLM Router with llamacpp engine — skip all security filters for local backend
      const response = await llmRouter.chat(
        {
          messages: [{ role: 'user', content: msg }],
        },
        { engine: 'llamacpp' as LLMEngine, skipCerber: true, skipConfidence: true, skipGuardian: true }
      );
      addLine('output', response.content);
    } catch (error) {
      // Direct fallback to llama.cpp server
      try {
        const r = await fetch(`${llamaUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: msg }],
            temperature: 0.7,
          }),
        });
        if (r.ok) {
          const data = await r.json();
          addLine('output', data.choices?.[0]?.message?.content || JSON.stringify(data));
        } else {
          // Try native completion endpoint
          const r2 = await fetch(`${llamaUrl}/completion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: msg, n_predict: 512 }),
          });
          if (r2.ok) {
            const data = await r2.json();
            addLine('output', data.content || data.response || JSON.stringify(data));
          } else {
            addLine('error', `❌ Błąd: ${error instanceof Error ? error.message : 'Brak połączenia z llama.cpp'}`);
          }
        }
      } catch {
        addLine('error', `❌ llama.cpp niedostępny na ${llamaUrl}`);
      }
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const lineColors: Record<TerminalLine['type'], string> = {
    input: 'text-primary',
    output: 'text-foreground',
    system: 'text-muted-foreground',
    error: 'text-destructive',
  };

  const linePrefix: Record<TerminalLine['type'], string> = {
    input: 'user@susi:~$ ',
    output: 'susi> ',
    system: '--- ',
    error: '!!! ',
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              SUSI Chat — llama.cpp Terminal
              <Badge variant={connected ? 'default' : 'secondary'}>
                {connected ? 'Online' : 'Offline'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowSettings(!showSettings)}>
                <Settings2 className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="outline" onClick={checkConnection}>
                Testuj
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {showSettings && (
            <div className="grid gap-3 md:grid-cols-2 p-3 rounded-lg border bg-muted/30">
              <div className="space-y-1">
                <Label className="text-xs">llama.cpp Server URL</Label>
                <Input
                  value={llamaUrl}
                  onChange={(e) => setLlamaUrl(e.target.value)}
                  placeholder="http://localhost:8001"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Iframe URL (SUSI Web UI)</Label>
                <Input
                  value={iframeUrl}
                  onChange={(e) => setIframeUrl(e.target.value)}
                  placeholder="http://localhost:8001"
                />
              </div>
            </div>
          )}

          <Tabs value={activeView} onValueChange={(v) => setActiveView(v as typeof activeView)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="terminal" className="gap-1">
                <Terminal className="h-4 w-4" />
                Terminal
              </TabsTrigger>
              <TabsTrigger value="iframe" className="gap-1">
                <Globe className="h-4 w-4" />
                SUSI Web UI
              </TabsTrigger>
            </TabsList>

            <TabsContent value="terminal">
              {/* Terminal View */}
              <div className="rounded-lg border bg-black p-0 overflow-hidden font-mono text-sm">
                <div className="flex items-center justify-between px-3 py-1.5 bg-muted/20 border-b border-border/30">
                  <div className="flex items-center gap-2">
                    <div className={cn("h-2 w-2 rounded-full", connected ? "bg-primary" : "bg-destructive")} />
                    <span className="text-xs text-muted-foreground">susi_chat — llama.cpp @ {llamaUrl}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => setLines([{ id: '0', type: 'system', content: '🤖 Terminal wyczyszczony.', timestamp: new Date() }])}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <div
                  ref={scrollRef}
                  className="h-[400px] overflow-y-auto p-3 space-y-0.5"
                >
                  {lines.map((line) => (
                    <div key={line.id} className={cn("whitespace-pre-wrap break-all", lineColors[line.type])}>
                      <span className="opacity-60">{linePrefix[line.type]}</span>
                      {line.content}
                    </div>
                  ))}
                  {isLoading && (
                    <div className="text-muted-foreground animate-pulse">
                      <span className="opacity-60">susi&gt; </span>myślę...
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 px-3 py-2 border-t border-border/30 bg-muted/10">
                  <span className="text-primary text-sm shrink-0">user@susi:~$</span>
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Wpisz wiadomość lub /help..."
                    className="bg-transparent border-none focus-visible:ring-0 text-foreground font-mono text-sm h-8 px-0"
                    disabled={isLoading}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleSend}
                    disabled={isLoading || !input.trim()}
                    className="h-7 w-7 p-0"
                  >
                    {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="iframe">
              {/* SUSI Web UI Iframe */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={iframeUrl}
                    onChange={(e) => setIframeUrl(e.target.value)}
                    placeholder="http://localhost:8001"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIframeConnected(true)}
                  >
                    Połącz
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(iframeUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
                <div className="rounded-lg border overflow-hidden bg-background" style={{ height: '500px' }}>
                  {iframeConnected ? (
                    <iframe
                      src={iframeUrl}
                      className="w-full h-full border-0"
                      title="SUSI Chat Web UI"
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                      <Globe className="h-12 w-12 opacity-30" />
                      <p className="text-sm">Kliknij "Połącz" aby załadować SUSI Chat Web UI</p>
                      <p className="text-xs opacity-60">
                        Wymaga uruchomionego serwera llama.cpp z flagą --path ../susi_chat/chat_terminal/
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
