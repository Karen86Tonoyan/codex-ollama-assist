import { useState, useEffect } from 'react';
import {
  Hand, Play, Square, Plus, Trash2, RefreshCw, Loader2,
  ShieldCheck, ShieldAlert, Clock, CheckCircle, XCircle,
  AlertTriangle, Send, Bot, FolderOpen, Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  createSession,
  sendTask,
  stopSession,
  listSessions,
  deleteSession,
  type OpenHandsSession,
} from '@/lib/openhands';
import { toast } from 'sonner';

export function OpenHandsPanel() {
  const [sessions, setSessions] = useState<OpenHandsSession[]>([]);
  const [activeSession, setActiveSession] = useState<OpenHandsSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [taskInput, setTaskInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  // New session form
  const [newWorkspace, setNewWorkspace] = useState('/tmp/openhands-workspace');
  const [newAgent, setNewAgent] = useState('CodeActAgent');
  const [newModel, setNewModel] = useState('ollama/qwen2.5-coder');
  const [guardianEnabled, setGuardianEnabled] = useState(true);

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const data = await listSessions();
      setSessions(data);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleCreateSession = async () => {
    try {
      const result = await createSession({
        task: taskInput || undefined,
        workspace: newWorkspace,
        agent_type: newAgent,
        model: newModel,
        guardian_enabled: guardianEnabled,
      });

      if (result.success) {
        toast.success('Sesja utworzona');
        setActiveSession(result.session);
        fetchSessions();
      }
    } catch (error) {
      toast.error(`Błąd: ${(error as Error).message}`);
    }
  };

  const handleSendTask = async () => {
    if (!activeSession || !taskInput.trim()) return;

    setIsSending(true);
    try {
      const result = await sendTask(activeSession.id, taskInput, guardianEnabled);

      if (result.requires_confirmation) {
        toast.warning(result.message);
        return;
      }

      if (result.success) {
        if (result.queued) {
          toast.info('Zadanie dodane do kolejki — OpenHands offline');
        } else {
          toast.success('Zadanie wysłane');
        }
        setTaskInput('');
        fetchSessions();
      } else if (result.guardian) {
        toast.error(`Guardian BLOCK: ${result.error}`);
      }
    } catch (error) {
      toast.error(`Błąd: ${(error as Error).message}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleStopSession = async (id: string) => {
    try {
      await stopSession(id);
      toast.success('Sesja zatrzymana');
      fetchSessions();
    } catch (error) {
      toast.error(`Błąd: ${(error as Error).message}`);
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await deleteSession(id);
      if (activeSession?.id === id) setActiveSession(null);
      toast.success('Sesja usunięta');
      fetchSessions();
    } catch (error) {
      toast.error(`Błąd: ${(error as Error).message}`);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
      idle: { variant: 'secondary', icon: Clock },
      created: { variant: 'outline', icon: Plus },
      running: { variant: 'default', icon: Loader2 },
      completed: { variant: 'default', icon: CheckCircle },
      stopped: { variant: 'secondary', icon: Square },
      blocked: { variant: 'destructive', icon: ShieldAlert },
      queued: { variant: 'outline', icon: Clock },
      error: { variant: 'destructive', icon: XCircle },
    };
    const config = map[status] || map.idle;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className={cn("h-3 w-3", status === 'running' && "animate-spin")} />
        {status}
      </Badge>
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3 h-full">
      {/* Sessions List */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Hand className="h-5 w-5" />
              Sesje OpenHands
              <Badge variant="secondary">{sessions.length}</Badge>
            </CardTitle>
            <Button variant="outline" size="icon" onClick={fetchSessions} disabled={isLoading}>
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
          </div>
          <CardDescription>AI-Driven Development Agent</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-2">
            {sessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">Brak sesji</p>
                <p className="text-xs mt-1">Utwórz nową sesję OpenHands</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => setActiveSession(session)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border transition-colors",
                      "hover:bg-muted/50",
                      activeSession?.id === session.id && "border-primary bg-primary/5"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate max-w-[180px]">
                        {session.title}
                      </span>
                      {getStatusBadge(session.status)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Bot className="h-3 w-3" />
                      {session.agent_type}
                      {session.guardian_enabled && (
                        <ShieldCheck className="h-3 w-3 text-primary" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(session.created_at).toLocaleString('pl-PL')}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Main Panel */}
      <Card className="lg:col-span-2">
        <Tabs defaultValue="task">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Hand className="h-5 w-5" />
                OpenHands
              </CardTitle>
              <TabsList>
                <TabsTrigger value="task">Zadanie</TabsTrigger>
                <TabsTrigger value="config">Konfiguracja</TabsTrigger>
                <TabsTrigger value="details">Szczegóły</TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>

          <CardContent>
            {/* Task Tab */}
            <TabsContent value="task" className="space-y-4 mt-0">
              <div className="space-y-3">
                <Textarea
                  placeholder="Opisz zadanie dla OpenHands, np.: &#10;• Utwórz REST API w Pythonie z FastAPI&#10;• Napraw bug w pliku main.py&#10;• Zrefaktoruj kod komponentu React"
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  className="min-h-[120px] font-mono text-sm"
                />

                <div className="flex items-center gap-2">
                  <Switch
                    checked={guardianEnabled}
                    onCheckedChange={setGuardianEnabled}
                    id="guardian-toggle"
                  />
                  <Label htmlFor="guardian-toggle" className="flex items-center gap-1 text-sm">
                    {guardianEnabled ? (
                      <ShieldCheck className="h-4 w-4 text-primary" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 text-destructive" />
                    )}
                    Guardian Gate {guardianEnabled ? 'włączony' : 'WYŁĄCZONY'}
                  </Label>
                  {!guardianEnabled && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      NIEBEZPIECZNE
                    </Badge>
                  )}
                </div>

                <div className="flex gap-2">
                  {activeSession ? (
                    <>
                      <Button
                        className="flex-1"
                        onClick={handleSendTask}
                        disabled={isSending || !taskInput.trim()}
                      >
                        {isSending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 mr-2" />
                        )}
                        Wyślij Zadanie
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleStopSession(activeSession.id)}
                      >
                        <Square className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDeleteSession(activeSession.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <Button className="flex-1" onClick={handleCreateSession}>
                      <Plus className="h-4 w-4 mr-2" />
                      Utwórz Sesję i Wyślij
                    </Button>
                  )}
                </div>
              </div>

              {/* Active Session Output */}
              {activeSession && (
                <Card className="border-dashed">
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Output</CardTitle>
                      {getStatusBadge(activeSession.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {activeSession.guardian_verdict && (
                      <div className="mb-3 p-2 rounded-md bg-muted text-xs">
                        <div className="flex items-center gap-1 font-medium mb-1">
                          <ShieldCheck className="h-3 w-3" />
                          Guardian Verdict
                        </div>
                        <pre className="text-muted-foreground">
                          {JSON.stringify(activeSession.guardian_verdict, null, 2)}
                        </pre>
                      </div>
                    )}

                    {activeSession.error && (
                      <div className="p-2 rounded-md bg-destructive/10 text-destructive text-xs mb-3">
                        {activeSession.error}
                      </div>
                    )}

                    {activeSession.steps && (activeSession.steps as unknown[]).length > 0 && (
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-2">
                          {(activeSession.steps as Record<string, unknown>[]).map((step, i) => (
                            <div key={i} className="p-2 rounded-md border text-xs">
                              <div className="font-mono font-medium">Step {i + 1}</div>
                              <pre className="text-muted-foreground mt-1">
                                {JSON.stringify(step, null, 2)}
                              </pre>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}

                    {activeSession.output && (
                      <ScrollArea className="h-[200px]">
                        <pre className="text-xs font-mono bg-muted p-3 rounded-md whitespace-pre-wrap">
                          {activeSession.output}
                        </pre>
                      </ScrollArea>
                    )}

                    {!activeSession.output && !activeSession.error && !(activeSession.steps as unknown[])?.length && (
                      <p className="text-center text-muted-foreground text-sm py-4">
                        Brak danych wyjściowych
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Config Tab */}
            <TabsContent value="config" className="space-y-4 mt-0">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <FolderOpen className="h-3 w-3" />
                    Workspace
                  </Label>
                  <Input
                    value={newWorkspace}
                    onChange={(e) => setNewWorkspace(e.target.value)}
                    placeholder="/tmp/openhands-workspace"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Bot className="h-3 w-3" />
                    Agent Type
                  </Label>
                  <Select value={newAgent} onValueChange={setNewAgent}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CodeActAgent">CodeActAgent</SelectItem>
                      <SelectItem value="MonologueAgent">MonologueAgent</SelectItem>
                      <SelectItem value="DelegatorAgent">DelegatorAgent</SelectItem>
                      <SelectItem value="BrowsingAgent">BrowsingAgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Settings className="h-3 w-3" />
                    Model
                  </Label>
                  <Select value={newModel} onValueChange={setNewModel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ollama/qwen2.5-coder">Ollama: Qwen2.5 Coder</SelectItem>
                      <SelectItem value="ollama/codellama">Ollama: CodeLlama</SelectItem>
                      <SelectItem value="ollama/deepseek-coder">Ollama: DeepSeek Coder</SelectItem>
                      <SelectItem value="openai/gpt-4">OpenAI: GPT-4</SelectItem>
                      <SelectItem value="anthropic/claude-3">Anthropic: Claude 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    Bezpieczeństwo
                  </Label>
                  <Card className="p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Guardian Gate</span>
                      <Switch
                        checked={guardianEnabled}
                        onCheckedChange={setGuardianEnabled}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      4-warstwowy system: DLP → Policy → Confidence → Audit
                    </p>
                  </Card>
                </div>
              </div>

              <Card className="p-4 border-dashed">
                <h4 className="text-sm font-medium mb-2">Architektura bezpieczeństwa</h4>
                <div className="grid grid-cols-4 gap-2 text-xs text-center">
                  {['DLP', 'Polityki', 'Confidence Gate', 'Audit Log'].map((layer, i) => (
                    <div key={layer} className="p-2 rounded-md bg-muted">
                      <div className="font-medium">Warstwa {i + 1}</div>
                      <div className="text-muted-foreground">{layer}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  „Qwen NIE generuje, Ollama NIE decyduje, OpenHands NIE ufa"
                </p>
              </Card>
            </TabsContent>

            {/* Details Tab */}
            <TabsContent value="details" className="mt-0">
              {activeSession ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">ID:</span>
                      <span className="ml-2 font-mono text-xs">{activeSession.id}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <span className="ml-2">{getStatusBadge(activeSession.status)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Agent:</span>
                      <span className="ml-2">{activeSession.agent_type}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Model:</span>
                      <span className="ml-2">{activeSession.model}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Workspace:</span>
                      <span className="ml-2 font-mono text-xs">{activeSession.workspace}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Guardian:</span>
                      <span className="ml-2">
                        {activeSession.guardian_enabled ? (
                          <Badge variant="default" className="gap-1">
                            <ShieldCheck className="h-3 w-3" />ON
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <ShieldAlert className="h-3 w-3" />OFF
                          </Badge>
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Utworzono:</span>
                      <span className="ml-2 text-xs">
                        {new Date(activeSession.created_at).toLocaleString('pl-PL')}
                      </span>
                    </div>
                    {activeSession.started_at && (
                      <div>
                        <span className="text-muted-foreground">Start:</span>
                        <span className="ml-2 text-xs">
                          {new Date(activeSession.started_at).toLocaleString('pl-PL')}
                        </span>
                      </div>
                    )}
                  </div>

                  {activeSession.task && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Zadanie</Label>
                      <pre className="mt-1 p-3 bg-muted rounded-md text-xs font-mono whitespace-pre-wrap">
                        {activeSession.task}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Hand className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">Wybierz sesję z listy</p>
                </div>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
