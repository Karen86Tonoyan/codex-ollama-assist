import { useState, useCallback } from 'react';
import {
  Globe,
  Play,
  Square,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Camera,
  MousePointer,
  Type,
  Pointer,
  MoveVertical,
  Keyboard,
  Code,
  Search,
  Monitor,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Download,
  Maximize2,
  Eye,
  Bot,
  Send,
  Settings2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  createBrowserSession,
  closeBrowserSession,
  navigateTo,
  goBack,
  goForward,
  refresh,
  clickElement,
  typeText,
  hoverElement,
  scrollTo,
  pressKey,
  takeScreenshot,
  findElements,
  evaluateScript,
  type BrowserSession,
  type BrowserAction,
  type ScreenshotResult,
  type ElementInfo,
} from '@/lib/browser-api';
import {
  runBrowserUseTask,
  checkBrowserUseConnection,
  setBrowserUseConfig,
  getBrowserUseConfig,
  type BrowserUseTask,
  type BrowserUseConfig,
} from '@/lib/browser-use-api';

interface BrowserPanelProps {
  isConnected: boolean;
}

export function BrowserPanel({ isConnected }: BrowserPanelProps) {
  const [session, setSession] = useState<BrowserSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('control');
  
  // Navigation state
  const [urlInput, setUrlInput] = useState('https://');
  
  // Action state
  const [actionType, setActionType] = useState<'click' | 'type' | 'hover' | 'scroll' | 'keypress'>('click');
  const [selector, setSelector] = useState('');
  const [textInput, setTextInput] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(500);
  
  // Script state
  const [scriptInput, setScriptInput] = useState('document.title');
  const [scriptResult, setScriptResult] = useState<string | null>(null);
  
  // Find state
  const [findSelector, setFindSelector] = useState('');
  const [foundElements, setFoundElements] = useState<ElementInfo[]>([]);
  
  // Screenshots & History
  const [screenshots, setScreenshots] = useState<ScreenshotResult[]>([]);
  const [actionHistory, setActionHistory] = useState<BrowserAction[]>([]);
  
  // Session options
  const [headless, setHeadless] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(1280);
  const [viewportHeight, setViewportHeight] = useState(720);

  // Browser-Use AI Agent state
  const [agentTask, setAgentTask] = useState('');
  const [agentTasks, setAgentTasks] = useState<BrowserUseTask[]>([]);
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentConnected, setAgentConnected] = useState(false);
  const [agentApiUrl, setAgentApiUrl] = useState('http://localhost:8000');
  const [agentModel, setAgentModel] = useState('gpt-4o');
  const [showAgentSettings, setShowAgentSettings] = useState(false);

  const addToHistory = useCallback((action: Omit<BrowserAction, 'id' | 'timestamp'>) => {
    const newAction: BrowserAction = {
      ...action,
      id: `action_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    setActionHistory(prev => [newAction, ...prev].slice(0, 50));
  }, []);

  // Browser-Use Agent handlers
  const handleCheckAgentConnection = useCallback(async () => {
    const connected = await checkBrowserUseConnection(agentApiUrl);
    setAgentConnected(connected);
    if (connected) {
      setBrowserUseConfig({ apiUrl: agentApiUrl, model: agentModel });
    }
    return connected;
  }, [agentApiUrl, agentModel]);

  const handleRunAgentTask = async () => {
    if (!agentTask.trim()) return;
    setAgentRunning(true);
    setBrowserUseConfig({ apiUrl: agentApiUrl, model: agentModel });
    
    const result = await runBrowserUseTask(agentTask);
    setAgentTasks(prev => [result, ...prev].slice(0, 20));
    setAgentRunning(false);
    
    if (result.status === 'completed') {
      toast.success('Zadanie AI agenta zakończone');
    } else {
      toast.error(result.error || 'Zadanie nie powiodło się');
    }
    setAgentTask('');
  };

  const handleStartSession = async () => {
    setIsLoading(true);
    try {
      const newSession = await createBrowserSession({
        headless,
        viewport: { width: viewportWidth, height: viewportHeight },
      });
      setSession(newSession);
      toast.success('Sesja przeglądarki uruchomiona');
      addToHistory({
        sessionId: newSession.id,
        type: 'session_start',
        success: true,
        duration: 0,
      });
    } catch (error) {
      toast.error('Nie udało się uruchomić sesji');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopSession = async () => {
    if (!session) return;
    setIsLoading(true);
    try {
      await closeBrowserSession(session.id);
      addToHistory({
        sessionId: session.id,
        type: 'session_stop',
        success: true,
        duration: 0,
      });
      setSession(null);
      toast.success('Sesja zakończona');
    } catch (error) {
      toast.error('Nie udało się zakończyć sesji');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigate = async () => {
    if (!session || !urlInput) return;
    setIsLoading(true);
    try {
      const result = await navigateTo(session.id, urlInput);
      addToHistory({
        sessionId: session.id,
        type: 'navigate',
        target: urlInput,
        success: result.success,
        duration: result.duration,
      });
      if (result.success) {
        toast.success(`Nawigacja do: ${urlInput}`);
        setSession(prev => prev ? { ...prev, url: urlInput } : null);
      } else {
        toast.error(result.error || 'Nawigacja nie powiodła się');
      }
    } catch (error) {
      toast.error('Błąd nawigacji');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavAction = async (action: 'back' | 'forward' | 'refresh') => {
    if (!session) return;
    setIsLoading(true);
    try {
      const result = action === 'back' 
        ? await goBack(session.id)
        : action === 'forward'
        ? await goForward(session.id)
        : await refresh(session.id);
      
      addToHistory({
        sessionId: session.id,
        type: action,
        success: result.success,
        duration: result.duration,
      });
      
      toast.success(`Akcja: ${action}`);
    } catch (error) {
      toast.error(`Błąd: ${action}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async () => {
    if (!session || !selector) return;
    setIsLoading(true);
    try {
      let result;
      switch (actionType) {
        case 'click':
          result = await clickElement(session.id, selector);
          break;
        case 'type':
          result = await typeText(session.id, selector, textInput);
          break;
        case 'hover':
          result = await hoverElement(session.id, selector);
          break;
        case 'scroll':
          result = await scrollTo(session.id, { x: scrollX, y: scrollY, selector: selector || undefined });
          break;
        case 'keypress':
          result = await pressKey(session.id, keyInput);
          break;
      }

      addToHistory({
        sessionId: session.id,
        type: actionType,
        target: selector,
        value: actionType === 'type' ? textInput : actionType === 'keypress' ? keyInput : undefined,
        success: result.success,
        duration: result.duration,
      });

      if (result.success) {
        toast.success(`${actionType}: ${selector}`);
      } else {
        toast.error(result.error || 'Akcja nie powiodła się');
      }
    } catch (error) {
      toast.error('Błąd wykonania akcji');
    } finally {
      setIsLoading(false);
    }
  };

  const handleScreenshot = async (fullPage = false) => {
    if (!session) return;
    setIsLoading(true);
    try {
      const result = await takeScreenshot(session.id, { fullPage });
      setScreenshots(prev => [result, ...prev].slice(0, 20));
      addToHistory({
        sessionId: session.id,
        type: 'screenshot',
        target: fullPage ? 'full_page' : 'viewport',
        success: true,
        duration: 500,
        screenshot: result.base64,
      });
      toast.success('Zrzut ekranu zapisany');
    } catch (error) {
      toast.error('Błąd zrzutu ekranu');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFind = async () => {
    if (!session || !findSelector) return;
    setIsLoading(true);
    try {
      const elements = await findElements(session.id, findSelector);
      setFoundElements(elements);
      addToHistory({
        sessionId: session.id,
        type: 'find',
        target: findSelector,
        value: `${elements.length} elementów`,
        success: true,
        duration: 100,
      });
      toast.success(`Znaleziono ${elements.length} elementów`);
    } catch (error) {
      toast.error('Błąd wyszukiwania');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEvaluate = async () => {
    if (!session || !scriptInput) return;
    setIsLoading(true);
    try {
      const result = await evaluateScript(session.id, scriptInput);
      setScriptResult(JSON.stringify(result.result, null, 2));
      addToHistory({
        sessionId: session.id,
        type: 'evaluate',
        target: scriptInput.slice(0, 50),
        success: !result.error,
        duration: 50,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Skrypt wykonany');
      }
    } catch (error) {
      toast.error('Błąd wykonania skryptu');
    } finally {
      setIsLoading(false);
    }
  };

  const actionIcons = {
    click: MousePointer,
    type: Type,
    hover: Pointer,
    scroll: MoveVertical,
    keypress: Keyboard,
  };

  return (
    <div className="space-y-4">
      {/* Session Header */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Globe className={cn("h-8 w-8", session?.isActive ? "text-primary" : "text-muted-foreground")} />
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  Browser Automation
                  <Badge variant={session?.isActive ? 'default' : 'secondary'}>
                    {session?.isActive ? 'AKTYWNA' : 'NIEAKTYWNA'}
                  </Badge>
                </h2>
                <p className="text-sm text-muted-foreground">
                  {session ? session.url : 'Brak aktywnej sesji'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!session ? (
                <Button onClick={handleStartSession} disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                  Uruchom sesję
                </Button>
              ) : (
                <Button variant="destructive" onClick={handleStopSession} disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Square className="h-4 w-4 mr-2" />}
                  Zakończ
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session Options (when no session) */}
      {!session && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              Opcje sesji
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-center gap-2">
                <Switch checked={headless} onCheckedChange={setHeadless} />
                <Label>Tryb Headless</Label>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Szerokość</Label>
                <Input
                  type="number"
                  value={viewportWidth}
                  onChange={(e) => setViewportWidth(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Wysokość</Label>
                <Input
                  type="number"
                  value={viewportHeight}
                  onChange={(e) => setViewportHeight(Number(e.target.value))}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Controls (when session active) */}
      {session && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="control" className="gap-1">
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline">Nawigacja</span>
            </TabsTrigger>
            <TabsTrigger value="actions" className="gap-1">
              <MousePointer className="h-4 w-4" />
              <span className="hidden sm:inline">Akcje</span>
            </TabsTrigger>
            <TabsTrigger value="inspect" className="gap-1">
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Inspekcja</span>
            </TabsTrigger>
            <TabsTrigger value="screenshots" className="gap-1">
              <Camera className="h-4 w-4" />
              <span className="hidden sm:inline">Zrzuty</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Historia</span>
            </TabsTrigger>
          </TabsList>

          {/* Navigation Tab */}
          <TabsContent value="control" className="space-y-4">
            <Card>
              <CardContent className="pt-4 space-y-4">
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => handleNavAction('back')} disabled={isLoading}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => handleNavAction('forward')} disabled={isLoading}>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => handleNavAction('refresh')} disabled={isLoading}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com"
                    className="flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && handleNavigate()}
                  />
                  <Button onClick={handleNavigate} disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Przejdź'}
                  </Button>
                </div>

                <div className="p-4 rounded-lg bg-muted/50 border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Podgląd strony</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleScreenshot(false)}>
                        <Camera className="h-3 w-3 mr-1" />
                        Screenshot
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleScreenshot(true)}>
                        <Maximize2 className="h-3 w-3 mr-1" />
                        Full Page
                      </Button>
                    </div>
                  </div>
                  <div className="aspect-video bg-background rounded border flex items-center justify-center">
                    {screenshots.length > 0 && screenshots[0].base64 ? (
                      <img
                        src={`data:image/png;base64,${screenshots[0].base64}`}
                        alt="Screenshot"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <div className="text-muted-foreground text-sm flex flex-col items-center gap-2">
                        <Eye className="h-8 w-8 opacity-50" />
                        <span>Brak zrzutu ekranu</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Actions Tab */}
          <TabsContent value="actions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Wykonaj akcję</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Typ akcji</Label>
                    <Select value={actionType} onValueChange={(v) => setActionType(v as typeof actionType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="click">
                          <div className="flex items-center gap-2">
                            <MousePointer className="h-4 w-4" /> Kliknij
                          </div>
                        </SelectItem>
                        <SelectItem value="type">
                          <div className="flex items-center gap-2">
                            <Type className="h-4 w-4" /> Wpisz tekst
                          </div>
                        </SelectItem>
                        <SelectItem value="hover">
                          <div className="flex items-center gap-2">
                            <Pointer className="h-4 w-4" /> Najedź
                          </div>
                        </SelectItem>
                        <SelectItem value="scroll">
                          <div className="flex items-center gap-2">
                            <MoveVertical className="h-4 w-4" /> Przewiń
                          </div>
                        </SelectItem>
                        <SelectItem value="keypress">
                          <div className="flex items-center gap-2">
                            <Keyboard className="h-4 w-4" /> Klawisz
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Selektor CSS</Label>
                    <Input
                      value={selector}
                      onChange={(e) => setSelector(e.target.value)}
                      placeholder="#submit-btn, .my-class, button[type='submit']"
                    />
                  </div>
                </div>

                {actionType === 'type' && (
                  <div className="space-y-2">
                    <Label>Tekst do wpisania</Label>
                    <Input
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder="Wpisz tekst..."
                    />
                  </div>
                )}

                {actionType === 'keypress' && (
                  <div className="space-y-2">
                    <Label>Klawisz (Enter, Tab, Escape, ArrowDown...)</Label>
                    <Input
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      placeholder="Enter"
                    />
                  </div>
                )}

                {actionType === 'scroll' && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Scroll X</Label>
                      <Input
                        type="number"
                        value={scrollX}
                        onChange={(e) => setScrollX(Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Scroll Y</Label>
                      <Input
                        type="number"
                        value={scrollY}
                        onChange={(e) => setScrollY(Number(e.target.value))}
                      />
                    </div>
                  </div>
                )}

                <Button className="w-full" onClick={handleAction} disabled={isLoading || !selector}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    (() => {
                      const Icon = actionIcons[actionType];
                      return <Icon className="h-4 w-4 mr-2" />;
                    })()
                  )}
                  Wykonaj: {actionType}
                </Button>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Szybkie akcje</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {['button', 'a', 'input', 'form', '[data-testid]', '.btn'].map((sel) => (
                    <Button
                      key={sel}
                      variant="outline"
                      size="sm"
                      onClick={() => setSelector(sel)}
                    >
                      {sel}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inspect Tab */}
          <TabsContent value="inspect" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Znajdź elementy
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={findSelector}
                      onChange={(e) => setFindSelector(e.target.value)}
                      placeholder="CSS selector..."
                      onKeyDown={(e) => e.key === 'Enter' && handleFind()}
                    />
                    <Button onClick={handleFind} disabled={isLoading}>
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>

                  <ScrollArea className="h-[200px] border rounded p-2">
                    {foundElements.length > 0 ? (
                      <div className="space-y-2">
                        {foundElements.map((el, i) => (
                          <div key={i} className="p-2 rounded bg-muted/50 text-xs">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline">{el.tagName}</Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelector(el.selector)}
                              >
                                Użyj
                              </Button>
                            </div>
                            {el.text && <p className="mt-1 truncate">{el.text}</p>}
                            <code className="text-muted-foreground">{el.selector}</code>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                        Wpisz selektor i wyszukaj
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    Wykonaj JavaScript
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={scriptInput}
                    onChange={(e) => setScriptInput(e.target.value)}
                    placeholder="document.querySelector('h1').textContent"
                    rows={4}
                    className="font-mono text-xs"
                  />
                  <Button className="w-full" onClick={handleEvaluate} disabled={isLoading}>
                    <Code className="h-4 w-4 mr-2" />
                    Wykonaj
                  </Button>
                  {scriptResult && (
                    <pre className="p-2 rounded bg-muted text-xs overflow-auto max-h-32">
                      {scriptResult}
                    </pre>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Screenshots Tab */}
          <TabsContent value="screenshots">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Zrzuty ekranu ({screenshots.length})
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleScreenshot(false)} disabled={isLoading}>
                      <Camera className="h-3 w-3 mr-1" />
                      Viewport
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleScreenshot(true)} disabled={isLoading}>
                      <Maximize2 className="h-3 w-3 mr-1" />
                      Full Page
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {screenshots.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {screenshots.map((ss) => (
                        <div key={ss.id} className="border rounded-lg overflow-hidden">
                          {ss.base64 && (
                            <img
                              src={`data:image/png;base64,${ss.base64}`}
                              alt="Screenshot"
                              className="w-full"
                            />
                          )}
                          <div className="p-2 bg-muted/50 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {new Date(ss.timestamp).toLocaleString('pl-PL')}
                            </span>
                            <Button size="sm" variant="ghost">
                              <Download className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                      <Camera className="h-8 w-8 mb-2 opacity-50" />
                      <span>Brak zrzutów ekranu</span>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Historia akcji ({actionHistory.length})
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setActionHistory([])}>
                    <Trash2 className="h-3 w-3 mr-1" />
                    Wyczyść
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {actionHistory.length > 0 ? (
                    <div className="space-y-2">
                      {actionHistory.map((action) => (
                        <div
                          key={action.id}
                          className={cn(
                            "p-3 rounded-lg border flex items-center justify-between",
                            action.success ? "bg-muted/30" : "bg-destructive/10 border-destructive/20"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {action.success ? (
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            ) : (
                              <XCircle className="h-4 w-4 text-destructive" />
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">{action.type}</Badge>
                                {action.target && (
                                  <code className="text-xs text-muted-foreground">{action.target}</code>
                                )}
                              </div>
                              {action.value && (
                                <p className="text-xs text-muted-foreground mt-1">→ {action.value}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">
                              {action.duration}ms
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(action.timestamp).toLocaleTimeString('pl-PL')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                      <Clock className="h-8 w-8 mb-2 opacity-50" />
                      <span>Brak historii akcji</span>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Browser-Use AI Agent Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Browser-Use AI Agent
              <Badge variant={agentConnected ? 'default' : 'secondary'}>
                {agentConnected ? 'Połączono' : 'Rozłączono'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowAgentSettings(!showAgentSettings)}>
                <Settings2 className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="outline" onClick={handleCheckAgentConnection}>
                Testuj połączenie
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAgentSettings && (
            <div className="grid gap-3 md:grid-cols-3 p-3 rounded-lg border bg-muted/30">
              <div className="space-y-1">
                <Label className="text-xs">API URL</Label>
                <Input
                  value={agentApiUrl}
                  onChange={(e) => setAgentApiUrl(e.target.value)}
                  placeholder="http://localhost:8000"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Model LLM</Label>
                <Select value={agentModel} onValueChange={setAgentModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    <SelectItem value="gpt-4o-mini">GPT-4o-mini</SelectItem>
                    <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</SelectItem>
                    <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Info</Label>
                <p className="text-xs text-muted-foreground pt-1">
                  Uruchom <code className="bg-muted px-1 rounded">pip install browser-use</code> i serwer API lokalnie.
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Textarea
              value={agentTask}
              onChange={(e) => setAgentTask(e.target.value)}
              placeholder="Opisz zadanie w języku naturalnym, np.: Wejdź na google.com, wyszukaj 'browser-use' i zwróć pierwszy wynik..."
              className="min-h-[60px] flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleRunAgentTask();
                }
              }}
            />
            <Button 
              onClick={handleRunAgentTask} 
              disabled={agentRunning || !agentTask.trim()}
              className="self-end"
            >
              {agentRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>

          {agentTasks.length > 0 && (
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {agentTasks.map((t) => (
                  <div
                    key={t.id}
                    className={cn(
                      "p-3 rounded-lg border",
                      t.status === 'completed' ? "bg-muted/30" : t.status === 'failed' ? "bg-destructive/10 border-destructive/20" : "bg-primary/5"
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {t.status === 'completed' ? (
                          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        ) : t.status === 'failed' ? (
                          <XCircle className="h-4 w-4 text-destructive shrink-0" />
                        ) : (
                          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                        )}
                        <span className="text-sm font-medium">{t.task}</span>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">{t.model}</Badge>
                    </div>
                    {t.result && (
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32 whitespace-pre-wrap">
                        {t.result}
                      </pre>
                    )}
                    {t.error && (
                      <p className="text-xs text-destructive mt-1">{t.error}</p>
                    )}
                    {t.steps.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {t.steps.map((step) => (
                          <div key={step.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                            {step.success ? (
                              <CheckCircle2 className="h-3 w-3 text-primary" />
                            ) : (
                              <XCircle className="h-3 w-3 text-destructive" />
                            )}
                            <span>{step.description}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(t.startedAt).toLocaleTimeString('pl-PL')}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
