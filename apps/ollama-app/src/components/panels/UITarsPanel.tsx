import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Bot, Play, Square, Check, X, Eye, ShieldCheck, ShieldAlert,
  Zap, RefreshCw, AlertTriangle, CheckCircle2, Clock, Loader2,
  Send, Target, Brain, Monitor, Activity, Crosshair,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import {
  createSession, fetchSessions, fetchActions, fetchMonitorEvents,
  generatePlan, executePipeline,
  type UITarsSession, type UITarsAction, type UITarsMonitorEvent,
} from '@/lib/ui-tars';

const statusColors: Record<string, string> = {
  planning: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  running: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  awaiting_confirm: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  done: 'bg-green-500/10 text-green-600 border-green-500/30',
  partial: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  error: 'bg-destructive/10 text-destructive border-destructive/30',
  blocked: 'bg-red-500/10 text-red-600 border-red-500/30',
  pending: 'bg-muted text-muted-foreground border-border',
};

const verdictColors: Record<string, string> = {
  ALLOW: 'text-green-600',
  BLOCK: 'text-red-600',
  REQUIRE_CONFIRM: 'text-orange-600',
  PENDING: 'text-muted-foreground',
};

export function UITarsPanel() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<UITarsSession[]>([]);
  const [activeSession, setActiveSession] = useState<UITarsSession | null>(null);
  const [actions, setActions] = useState<UITarsAction[]>([]);
  const [events, setEvents] = useState<UITarsMonitorEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [executorEndpoint, setExecutorEndpoint] = useState('http://localhost:8000/v1');

  const loadSessions = useCallback(async () => {
    if (!user) return;
    const { data } = await fetchSessions(user.id);
    if (data) setSessions(data as unknown as UITarsSession[]);
  }, [user]);

  const loadSessionDetails = useCallback(async (sessionId: string) => {
    const [actionsRes, eventsRes] = await Promise.all([
      fetchActions(sessionId),
      fetchMonitorEvents(sessionId),
    ]);
    if (actionsRes.data) setActions(actionsRes.data as unknown as UITarsAction[]);
    if (eventsRes.data) setEvents(eventsRes.data as unknown as UITarsMonitorEvent[]);
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  useEffect(() => {
    if (!activeSession) return;
    loadSessionDetails(activeSession.id);
    const channel = supabase
      .channel(`ui-tars-${activeSession.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ui_tars_actions', filter: `session_id=eq.${activeSession.id}` }, () => loadSessionDetails(activeSession.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ui_tars_monitor', filter: `session_id=eq.${activeSession.id}` }, () => loadSessionDetails(activeSession.id))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeSession, loadSessionDetails]);

  const handleCreateSession = async () => {
    if (!user || !goalInput.trim()) return;
    setIsLoading(true);
    const { data } = await createSession(user.id, goalInput);
    if (data) {
      const session = data as unknown as UITarsSession;
      setActiveSession(session);
      setGoalInput('');
      await loadSessions();
    }
    setIsLoading(false);
  };

  const handleRunPipeline = async () => {
    if (!activeSession) return;
    setIsLoading(true);
    await executePipeline({
      sessionId: activeSession.id,
      goal: activeSession.goal || '',
      executorEndpoint,
      dryRun,
    });
    await loadSessionDetails(activeSession.id);
    await loadSessions();
    setIsLoading(false);
  };

  const handleGeneratePlan = async () => {
    if (!activeSession?.goal) return;
    setIsLoading(true);
    const plan = await generatePlan(activeSession.goal);
    if (plan.ok) {
      // Plan steps are logged — reload
      await loadSessionDetails(activeSession.id);
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-xl flex items-center gap-2">
              <Eye className="h-5 w-5" />
              UI-TARS Agent System
            </CardTitle>
            <CardDescription>
              Planner (Ollama) → Guardian → Dynamic Prompt → Executor (UI-TARS) → Monitor
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadSessions}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-500">{sessions.length}</div>
              <div className="text-xs text-muted-foreground">Sesje</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-500">
                {sessions.filter(s => s.status === 'running').length}
              </div>
              <div className="text-xs text-muted-foreground">Aktywne</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-500">
                {sessions.filter(s => s.status === 'done').length}
              </div>
              <div className="text-xs text-muted-foreground">Zakończone</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-500">
                {sessions.reduce((sum, s) => sum + (s.guardian_blocks || 0), 0)}
              </div>
              <div className="text-xs text-muted-foreground">Guardian bloki</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="new" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="new">Nowa sesja</TabsTrigger>
          <TabsTrigger value="session">Sesja aktywna</TabsTrigger>
          <TabsTrigger value="monitor">Monitor</TabsTrigger>
          <TabsTrigger value="config">Konfiguracja</TabsTrigger>
        </TabsList>

        {/* New Session */}
        <TabsContent value="new" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5" />
                Definiuj cel
              </CardTitle>
              <CardDescription>
                Opisz co agent ma zrobić na pulpicie. Ollama stworzy plan, Guardian oceni bezpieczeństwo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                placeholder="np. Otwórz przeglądarkę, wejdź na google.com, wyszukaj 'AI agent'"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
              />
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={dryRun} onCheckedChange={setDryRun} id="dry-run" />
                  <Label htmlFor="dry-run" className="text-sm">Dry Run (symulacja)</Label>
                </div>
              </div>
              <Button onClick={handleCreateSession} disabled={!goalInput.trim() || isLoading} className="w-full">
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Utwórz sesję i planuj
              </Button>

              {/* Sessions list */}
              <div className="space-y-2 mt-4">
                <h4 className="text-sm font-medium text-muted-foreground">Ostatnie sesje</h4>
                {sessions.map(session => (
                  <Card
                    key={session.id}
                    className={cn("cursor-pointer hover:border-primary/50 transition-colors",
                      activeSession?.id === session.id && "border-primary")}
                    onClick={() => setActiveSession(session)}
                  >
                    <CardContent className="py-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{session.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {session.completed_steps}/{session.total_steps} kroków •{' '}
                          {new Date(session.created_at).toLocaleString('pl-PL')}
                        </div>
                      </div>
                      <Badge className={cn("text-xs", statusColors[session.status] || '')}>
                        {session.status}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Active Session */}
        <TabsContent value="session" className="space-y-4">
          {!activeSession ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-2 opacity-30" />
                Wybierz sesję z listy lub utwórz nową
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Brain className="h-5 w-5" />
                      {activeSession.title}
                    </span>
                    <Badge className={cn("text-xs", statusColors[activeSession.status] || '')}>
                      {activeSession.status}
                    </Badge>
                  </CardTitle>
                  <CardDescription>{activeSession.goal}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleGeneratePlan} disabled={isLoading}>
                      <Brain className="h-4 w-4 mr-1" /> Plan
                    </Button>
                    <Button size="sm" onClick={handleRunPipeline} disabled={isLoading} variant="default">
                      {isLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                      {dryRun ? 'Dry Run' : 'Wykonaj'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Actions list */}
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {actions.length === 0 ? (
                    <Card>
                      <CardContent className="py-6 text-center text-muted-foreground">
                        <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        Brak kroków — uruchom planowanie
                      </CardContent>
                    </Card>
                  ) : (
                    actions.map(action => (
                      <ActionCard key={action.id} action={action} />
                    ))
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </TabsContent>

        {/* Monitor */}
        <TabsContent value="monitor" className="space-y-4">
          <ScrollArea className="h-[500px]">
            <div className="space-y-1">
              {events.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    Brak zdarzeń — wybierz sesję
                  </CardContent>
                </Card>
              ) : (
                events.map(event => (
                  <div key={event.id} className="flex items-start gap-2 p-2 rounded text-sm border-b border-border/50">
                    <Badge variant="outline" className={cn("text-xs shrink-0", {
                      'text-blue-500': event.severity === 'info',
                      'text-yellow-500': event.severity === 'warn',
                      'text-red-500': event.severity === 'error',
                    })}>
                      {event.severity}
                    </Badge>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(event.created_at).toLocaleTimeString('pl-PL')}
                    </span>
                    <span className="text-sm">{event.message}</span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Config */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Konfiguracja endpointów</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">UI-TARS Inference Endpoint (vLLM/SGLang)</Label>
                <Input
                  value={executorEndpoint}
                  onChange={(e) => setExecutorEndpoint(e.target.value)}
                  placeholder="http://localhost:8000/v1"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Ollama (Planner + Guardian)</Label>
                <Input value="http://localhost:11434" disabled />
                <p className="text-xs text-muted-foreground">Konfiguracja w backend/config.yaml</p>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Switch checked={dryRun} onCheckedChange={setDryRun} id="dry-run-config" />
                <Label htmlFor="dry-run-config">
                  Dry Run — symulacja bez wykonywania akcji na pulpicie
                </Label>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Wymagania:</strong></p>
                <p>• Ollama uruchomiona lokalnie z modelem qwen3</p>
                <p>• UI-TARS-1.5-7B na vLLM/SGLang (GPU)</p>
                <p>• pyautogui zainstalowany w backendzie</p>
                <p>• Backend ALFA na porcie 8765</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ActionCard({ action }: { action: UITarsAction }) {
  return (
    <Card>
      <CardContent className="py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
              {action.step_number}
            </div>
            <div>
              <div className="font-medium text-sm">{action.plan_action || action.phase}</div>
              {action.plan_thought && (
                <div className="text-xs text-muted-foreground italic">{action.plan_thought}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {action.guardian_verdict && (
              <Badge variant="outline" className={cn("text-xs gap-1", verdictColors[action.guardian_verdict] || '')}>
                <ShieldCheck className="h-3 w-3" />
                {action.guardian_verdict}
                {action.guardian_risk_score != null && ` (${(action.guardian_risk_score * 100).toFixed(0)}%)`}
              </Badge>
            )}
            <Badge className={cn("text-xs", statusColors[action.status] || '')}>
              {action.status === 'running' && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              {action.status}
            </Badge>
          </div>
        </div>
        {action.executor_action_type && (
          <div className="flex items-center gap-2 text-xs bg-muted/50 rounded p-2">
            <Crosshair className="h-3 w-3" />
            <span className="font-mono">{action.executor_action_type}</span>
            {action.executor_coordinates && (
              <span className="text-muted-foreground">
                ({(action.executor_coordinates as Record<string, number>).x}, {(action.executor_coordinates as Record<string, number>).y})
              </span>
            )}
          </div>
        )}
        {action.error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded p-2">
            {action.error}
          </div>
        )}
        {action.latency_ms != null && (
          <div className="text-xs text-muted-foreground">{action.latency_ms}ms</div>
        )}
      </CardContent>
    </Card>
  );
}
