import { useState, useEffect, useCallback } from 'react';
import {
  Bot, Plus, Trash2, Play, Pause, RefreshCw, Heart, AlertTriangle,
  Loader2, Settings2, Zap, GitBranch, CheckCircle, XCircle, Clock,
  Activity, Wifi, WifiOff, RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { runPipeline, autoHealAgents, checkAgentHealth, type PipelineStep, type StepResult } from '@/lib/pipeline-engine';

// ── Types matching DB (use Record for type safety with dynamic tables) ──

interface Agent {
  id: string;
  name: string;
  type: string;
  model: string | null;
  endpoint: string | null;
  capabilities: string[];
  status: string;
  max_concurrent: number;
  current_tasks: number;
  last_heartbeat: string | null;
  last_error: string | null;
}

interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  steps: PipelineStep[];
  is_active: boolean;
  trigger_type: string;
  retry_policy: { max_retries: number; backoff_ms: number; backoff_multiplier: number };
}

interface PipelineRun {
  id: string;
  pipeline_id: string;
  status: string;
  current_step: number;
  total_steps: number;
  step_results: StepResult[];
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  retry_count: number;
}

// ── Status Helpers ──

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-muted text-muted-foreground',
  busy: 'bg-primary/20 text-primary',
  offline: 'bg-destructive/20 text-destructive',
  error: 'bg-destructive/20 text-destructive',
  pending: 'bg-muted text-muted-foreground',
  running: 'bg-primary/20 text-primary',
  completed: 'bg-primary/20 text-primary',
  failed: 'bg-destructive/20 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  idle: Wifi,
  busy: Activity,
  offline: WifiOff,
  error: AlertTriangle,
  pending: Clock,
  running: Loader2,
  completed: CheckCircle,
  failed: XCircle,
};

export function AgentPipelinePanel() {
  const [tab, setTab] = useState<'agents' | 'pipelines' | 'runs'>('agents');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isHealing, setIsHealing] = useState(false);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [showAddPipeline, setShowAddPipeline] = useState(false);

  // New agent form
  const [newAgent, setNewAgent] = useState({ name: '', type: 'ollama', model: '', endpoint: 'http://localhost:11434', capabilities: '' });
  // New pipeline form
  const [newPipeline, setNewPipeline] = useState({ name: '', description: '', stepsJson: '[\n  {\n    "name": "Krok 1",\n    "agent_type": "plugin",\n    "action": "text-summarizer",\n    "params": {"input": "Twój tekst..."}\n  }\n]' });

  // ── Data fetching ──

  const fetchAgents = useCallback(async () => {
    const { data } = await supabase.from('agents').select('*').order('created_at', { ascending: false });
    if (data) setAgents(data as unknown as Agent[]);
  }, []);

  const fetchPipelines = useCallback(async () => {
    const { data } = await supabase.from('task_pipelines').select('*').order('created_at', { ascending: false });
    if (data) setPipelines(data as unknown as Pipeline[]);
  }, []);

  const fetchRuns = useCallback(async () => {
    const { data } = await supabase.from('pipeline_runs').select('*').order('created_at', { ascending: false }).limit(20);
    if (data) setRuns(data as unknown as PipelineRun[]);
  }, []);

  useEffect(() => {
    fetchAgents();
    fetchPipelines();
    fetchRuns();
  }, [fetchAgents, fetchPipelines, fetchRuns]);

  // Realtime subscription for pipeline runs
  useEffect(() => {
    const channel = supabase
      .channel('pipeline-runs-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pipeline_runs' }, () => {
        fetchRuns();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchRuns]);

  // ── Agent CRUD ──

  const addAgent = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const caps = newAgent.capabilities.split(',').map(c => c.trim()).filter(Boolean);
    const { error } = await supabase.from('agents').insert({
      user_id: user.id,
      name: newAgent.name,
      type: newAgent.type,
      model: newAgent.model || null,
      endpoint: newAgent.endpoint || null,
      capabilities: caps,
    });

    if (error) {
      toast({ title: 'Błąd', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Agent dodany', description: newAgent.name });
      setShowAddAgent(false);
      setNewAgent({ name: '', type: 'ollama', model: '', endpoint: 'http://localhost:11434', capabilities: '' });
      fetchAgents();
    }
  };

  const deleteAgent = async (id: string) => {
    await supabase.from('agents').delete().eq('id', id);
    fetchAgents();
  };

  const healAgent = async (id: string) => {
    const ok = await checkAgentHealth(id);
    toast({ title: ok ? 'Agent zdrowy' : 'Agent offline', description: ok ? 'Połączenie OK' : 'Brak odpowiedzi' });
    fetchAgents();
  };

  // ── Auto-heal all ──

  const handleAutoHeal = async () => {
    setIsHealing(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsHealing(false); return; }

    const result = await autoHealAgents(user.id);
    toast({ title: 'Auto-healing zakończony', description: `${result.healed}/${result.total} agentów online` });
    fetchAgents();
    setIsHealing(false);
  };

  // ── Pipeline CRUD ──

  const addPipeline = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let steps: PipelineStep[];
    try {
      steps = JSON.parse(newPipeline.stepsJson);
    } catch {
      toast({ title: 'Błąd JSON', description: 'Nieprawidłowy format kroków', variant: 'destructive' });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from('task_pipelines').insert({
      user_id: user.id,
      name: newPipeline.name,
      description: newPipeline.description || null,
      steps: steps,
    } as any);

    if (error) {
      toast({ title: 'Błąd', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Pipeline dodany', description: newPipeline.name });
      setShowAddPipeline(false);
      setNewPipeline({ name: '', description: '', stepsJson: '[\n  {\n    "name": "Krok 1",\n    "agent_type": "plugin",\n    "action": "text-summarizer",\n    "params": {"input": "Twój tekst..."}\n  }\n]' });
      fetchPipelines();
    }
  };

  const deletePipeline = async (id: string) => {
    await supabase.from('task_pipelines').delete().eq('id', id);
    fetchPipelines();
  };

  // ── Run Pipeline ──

  const startPipeline = async (pipeline: Pipeline) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setIsLoading(true);

    // Create run record
    const { data: run, error } = await supabase.from('pipeline_runs').insert({
      pipeline_id: pipeline.id,
      user_id: user.id,
      total_steps: pipeline.steps.length,
      max_retries: pipeline.retry_policy.max_retries,
    }).select().single();

    if (error || !run) {
      toast({ title: 'Błąd startu', description: error?.message, variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    const runData = run as unknown as PipelineRun;
    toast({ title: 'Pipeline uruchomiony', description: pipeline.name });
    setTab('runs');
    fetchRuns();
    setIsLoading(false);

    // Execute in background
    runPipeline(pipeline.steps, pipeline.retry_policy, runData.id, user.id, {
      onStepStart: (idx) => console.log(`🔧 Step ${idx + 1} starting...`),
      onStepRetry: (idx, attempt, err) => console.log(`🔄 Step ${idx + 1} retry #${attempt}: ${err.message}`),
      onComplete: (results) => {
        const failed = results.filter(r => r.status === 'error').length;
        toast({
          title: failed > 0 ? 'Pipeline zakończony z błędami' : 'Pipeline zakończony',
          description: `${results.length - failed}/${results.length} kroków sukces`,
          variant: failed > 0 ? 'destructive' : 'default',
        });
        fetchRuns();
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Agenci & Pipeline'y
          </h2>
          <p className="text-sm text-muted-foreground">
            Zarządzaj agentami AI, twórz pipeline'y zadań, auto-healing
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoHeal}
            disabled={isHealing}
            className="gap-1"
          >
            {isHealing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4" />}
            Auto-Heal
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => { fetchAgents(); fetchPipelines(); fetchRuns(); }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="w-full">
          <TabsTrigger value="agents" className="flex-1 gap-1">
            <Bot className="h-4 w-4" />
            Agenci ({agents.length})
          </TabsTrigger>
          <TabsTrigger value="pipelines" className="flex-1 gap-1">
            <GitBranch className="h-4 w-4" />
            Pipeline'y ({pipelines.length})
          </TabsTrigger>
          <TabsTrigger value="runs" className="flex-1 gap-1">
            <Activity className="h-4 w-4" />
            Wykonania ({runs.length})
          </TabsTrigger>
        </TabsList>

        {/* ── AGENTS TAB ── */}
        <TabsContent value="agents" className="space-y-4">
          <Dialog open={showAddAgent} onOpenChange={setShowAddAgent}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                Dodaj agenta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nowy Agent AI</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Nazwa</Label>
                  <Input value={newAgent.name} onChange={(e) => setNewAgent(p => ({ ...p, name: e.target.value }))} placeholder="Mój Agent Ollama" />
                </div>
                <div>
                  <Label>Typ</Label>
                  <Select value={newAgent.type} onValueChange={(v) => setNewAgent(p => ({ ...p, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ollama">Ollama (lokalny)</SelectItem>
                      <SelectItem value="cloud">Cloud (Gemini/GPT)</SelectItem>
                      <SelectItem value="plugin">Plugin System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Model</Label>
                  <Input value={newAgent.model} onChange={(e) => setNewAgent(p => ({ ...p, model: e.target.value }))} placeholder="llama3, gemini-flash..." />
                </div>
                {newAgent.type === 'ollama' && (
                  <div>
                    <Label>Endpoint</Label>
                    <Input value={newAgent.endpoint} onChange={(e) => setNewAgent(p => ({ ...p, endpoint: e.target.value }))} placeholder="http://localhost:11434" />
                  </div>
                )}
                <div>
                  <Label>Zdolności (oddzielone przecinkami)</Label>
                  <Input value={newAgent.capabilities} onChange={(e) => setNewAgent(p => ({ ...p, capabilities: e.target.value }))} placeholder="chat, code, vision" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={addAgent} disabled={!newAgent.name}>Dodaj</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <ScrollArea className="h-[450px]">
            {agents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Brak agentów. Dodaj pierwszego!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {agents.map(agent => {
                  const StatusIcon = STATUS_ICONS[agent.status] || AlertTriangle;
                  return (
                    <Card key={agent.id}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn("p-2 rounded-md", STATUS_COLORS[agent.status])}>
                            <StatusIcon className={cn("h-4 w-4", agent.status === 'busy' && "animate-pulse")} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{agent.name}</span>
                              <Badge variant="outline" className="text-xs">{agent.type}</Badge>
                              {agent.model && <Badge variant="secondary" className="text-xs">{agent.model}</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                              {agent.endpoint && <span className="truncate max-w-[200px]">{agent.endpoint}</span>}
                              {agent.capabilities.length > 0 && (
                                <span>{agent.capabilities.join(', ')}</span>
                              )}
                            </div>
                            {agent.last_error && (
                              <p className="text-xs text-destructive mt-1">{agent.last_error}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => healAgent(agent.id)} title="Health check">
                            <Heart className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteAgent(agent.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* ── PIPELINES TAB ── */}
        <TabsContent value="pipelines" className="space-y-4">
          <Dialog open={showAddPipeline} onOpenChange={setShowAddPipeline}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                Nowy Pipeline
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nowy Pipeline</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Nazwa</Label>
                  <Input value={newPipeline.name} onChange={(e) => setNewPipeline(p => ({ ...p, name: e.target.value }))} placeholder="Mój pipeline" />
                </div>
                <div>
                  <Label>Opis</Label>
                  <Input value={newPipeline.description} onChange={(e) => setNewPipeline(p => ({ ...p, description: e.target.value }))} placeholder="Co robi ten pipeline..." />
                </div>
                <div>
                  <Label>Kroki (JSON)</Label>
                  <Textarea
                    value={newPipeline.stepsJson}
                    onChange={(e) => setNewPipeline(p => ({ ...p, stepsJson: e.target.value }))}
                    rows={8}
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Każdy krok: {'{'}"name", "agent_type" (plugin/ollama/cloud), "action", "params", "depends_on"?{'}'}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={addPipeline} disabled={!newPipeline.name}>Utwórz</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <ScrollArea className="h-[450px]">
            {pipelines.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Brak pipeline'ów. Utwórz pierwszy!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pipelines.map(pipeline => (
                  <Card key={pipeline.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{pipeline.name}</span>
                            <Badge variant="secondary" className="text-xs">{pipeline.steps.length} kroków</Badge>
                            <Badge variant="outline" className="text-xs">
                              retry: {pipeline.retry_policy.max_retries}x
                            </Badge>
                          </div>
                          {pipeline.description && (
                            <p className="text-xs text-muted-foreground mt-1">{pipeline.description}</p>
                          )}
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {pipeline.steps.map((step, i) => (
                              <Badge key={i} variant="outline" className="text-xs gap-1">
                                <Zap className="h-3 w-3" />
                                {step.name}: {step.action}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="default" onClick={() => startPipeline(pipeline)} disabled={isLoading} className="gap-1">
                            <Play className="h-4 w-4" />
                            Uruchom
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deletePipeline(pipeline.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* ── RUNS TAB ── */}
        <TabsContent value="runs" className="space-y-4">
          <ScrollArea className="h-[500px]">
            {runs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Brak wykonań. Uruchom pipeline!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {runs.map(run => {
                  const StatusIcon = STATUS_ICONS[run.status] || Clock;
                  const progress = run.total_steps > 0 ? (run.current_step / run.total_steps) * 100 : 0;

                  return (
                    <Card key={run.id}>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={cn("p-1.5 rounded", STATUS_COLORS[run.status])}>
                              <StatusIcon className={cn("h-4 w-4", run.status === 'running' && "animate-spin")} />
                            </div>
                            <span className="font-medium text-sm">{run.status.toUpperCase()}</span>
                            <span className="text-xs text-muted-foreground">
                              {run.current_step}/{run.total_steps} kroków
                            </span>
                            {run.retry_count > 0 && (
                              <Badge variant="outline" className="text-xs gap-1">
                                <RotateCcw className="h-3 w-3" />
                                {run.retry_count} retries
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {run.started_at ? new Date(run.started_at).toLocaleTimeString() : 'Oczekuje'}
                          </span>
                        </div>

                        {run.status === 'running' && <Progress value={progress} className="h-2" />}

                        {run.error && (
                          <p className="text-xs text-destructive bg-destructive/10 rounded p-2">{run.error}</p>
                        )}

                        {run.step_results && (run.step_results as StepResult[]).length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {(run.step_results as StepResult[]).map((sr, i) => (
                              <div
                                key={i}
                                className={cn(
                                  "w-6 h-6 rounded flex items-center justify-center text-xs font-mono",
                                  sr.status === 'success' ? 'bg-primary/20 text-primary' :
                                  sr.status === 'error' ? 'bg-destructive/20 text-destructive' :
                                  'bg-muted text-muted-foreground'
                                )}
                                title={sr.error || `${sr.duration_ms?.toFixed(0)}ms`}
                              >
                                {i + 1}
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
