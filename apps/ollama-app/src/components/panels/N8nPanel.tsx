import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Workflow,
  Play,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  Send,
  Link,
  Cog,
  Clock,
  Zap,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface N8nWorkflow {
  id: string;
  name: string;
  webhookUrl: string;
  description: string;
  method: 'GET' | 'POST';
  lastRun?: { status: 'success' | 'error'; timestamp: string; result?: string };
}

interface WorkflowRun {
  workflowId: string;
  workflowName: string;
  status: 'success' | 'error' | 'running';
  timestamp: string;
  result?: string;
  payload?: string;
}

const STORAGE_KEY = 'alfa-n8n-workflows';

function loadWorkflows(): N8nWorkflow[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveWorkflows(wf: N8nWorkflow[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wf));
}

export function N8nPanel() {
  const { user } = useAuth();
  const [workflows, setWorkflows] = useState<N8nWorkflow[]>(loadWorkflows);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);

  // New workflow form
  const [name, setName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [description, setDescription] = useState('');
  const [method, setMethod] = useState<'GET' | 'POST'>('POST');

  // Trigger form
  const [selectedWf, setSelectedWf] = useState<string | null>(null);
  const [payload, setPayload] = useState('{\n  \n}');
  const [isTriggering, setIsTriggering] = useState(false);

  const addWorkflow = () => {
    if (!name.trim() || !webhookUrl.trim()) return;
    const wf: N8nWorkflow = {
      id: crypto.randomUUID(),
      name: name.trim(),
      webhookUrl: webhookUrl.trim(),
      description: description.trim(),
      method,
    };
    const updated = [...workflows, wf];
    setWorkflows(updated);
    saveWorkflows(updated);
    setName('');
    setWebhookUrl('');
    setDescription('');
    toast.success(`Workflow "${wf.name}" dodany`);
  };

  const removeWorkflow = (id: string) => {
    const updated = workflows.filter(w => w.id !== id);
    setWorkflows(updated);
    saveWorkflows(updated);
    toast.info('Workflow usunięty');
  };

  const triggerWorkflow = async (wf: N8nWorkflow) => {
    setIsTriggering(true);
    const run: WorkflowRun = {
      workflowId: wf.id,
      workflowName: wf.name,
      status: 'running',
      timestamp: new Date().toISOString(),
      payload: wf.method === 'POST' ? payload : undefined,
    };
    setRuns(prev => [run, ...prev]);

    try {
      const opts: RequestInit = { method: wf.method };
      if (wf.method === 'POST') {
        opts.headers = { 'Content-Type': 'application/json' };
        opts.body = payload;
      }

      const resp = await fetch(wf.webhookUrl, opts);
      const text = await resp.text();

      const updatedRun: WorkflowRun = {
        ...run,
        status: resp.ok ? 'success' : 'error',
        result: text.slice(0, 500),
      };

      setRuns(prev => prev.map((r, i) => i === 0 ? updatedRun : r));

      // Update last run on workflow
      const updatedWf = workflows.map(w =>
        w.id === wf.id
          ? { ...w, lastRun: { status: updatedRun.status as 'success' | 'error', timestamp: updatedRun.timestamp, result: updatedRun.result } }
          : w
      );
      setWorkflows(updatedWf);
      saveWorkflows(updatedWf);

      if (resp.ok) toast.success(`✅ ${wf.name} — sukces`);
      else toast.error(`❌ ${wf.name} — błąd ${resp.status}`);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Network error';
      setRuns(prev => prev.map((r, i) => i === 0 ? { ...r, status: 'error' as const, result: errMsg } : r));
      toast.error(`❌ ${wf.name} — ${errMsg}`);
    } finally {
      setIsTriggering(false);
    }
  };

  const sendToOllamaQueue = async (wf: N8nWorkflow) => {
    if (!user) { toast.error('Zaloguj się aby dodać do kolejki'); return; }

    await supabase.from('ollama_tasks').insert([{
      user_id: user.id,
      type: 'run_command',
      params: { command: `n8n-webhook: ${wf.webhookUrl}`, workflow_name: wf.name } as unknown as Record<string, never>,
      status: 'pending',
      source: 'ui',
    }] as never);

    toast.success(`Dodano "${wf.name}" do kolejki Ollama Automation`);
  };

  const selectedWorkflow = workflows.find(w => w.id === selectedWf);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-xl flex items-center gap-2">
              <Workflow className="h-5 w-5" />
              n8n Integration
            </CardTitle>
            <CardDescription>
              Wyzwalaj workflow n8n przez webhook • Integracja z Ollama Automation
            </CardDescription>
          </div>
          <Badge variant="outline" className="gap-1">
            <Zap className="h-3 w-3" />
            {workflows.length} workflow{workflows.length !== 1 ? 's' : ''}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">{workflows.length}</div>
              <div className="text-xs text-muted-foreground">Workflow</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-500">
                {runs.filter(r => r.status === 'success').length}
              </div>
              <div className="text-xs text-muted-foreground">Sukces</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-destructive">
                {runs.filter(r => r.status === 'error').length}
              </div>
              <div className="text-xs text-muted-foreground">Błędy</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="workflows" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="workflows">Workflow</TabsTrigger>
          <TabsTrigger value="trigger">Wyzwól</TabsTrigger>
          <TabsTrigger value="add">Dodaj</TabsTrigger>
          <TabsTrigger value="history">Historia</TabsTrigger>
        </TabsList>

        {/* Workflows list */}
        <TabsContent value="workflows" className="space-y-3">
          {workflows.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Workflow className="h-12 w-12 mx-auto mb-2 opacity-30" />
                Brak workflow — dodaj pierwszy w zakładce "Dodaj"
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {workflows.map(wf => (
                  <Card key={wf.id} className="hover:border-primary/30 transition-colors">
                    <CardContent className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Workflow className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm flex items-center gap-2">
                            {wf.name}
                            <Badge variant="outline" className="text-xs">{wf.method}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{wf.webhookUrl}</div>
                          {wf.description && (
                            <div className="text-xs text-muted-foreground mt-0.5">{wf.description}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {wf.lastRun && (
                          <Badge className={cn("text-xs mr-2", wf.lastRun.status === 'success' ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive')}>
                            {wf.lastRun.status === 'success' ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                            {new Date(wf.lastRun.timestamp).toLocaleTimeString('pl-PL')}
                          </Badge>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedWf(wf.id); }}>
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => sendToOllamaQueue(wf)}>
                          <Cog className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeWorkflow(wf.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* Trigger workflow */}
        <TabsContent value="trigger" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Wyzwól workflow</CardTitle>
              <CardDescription>Wybierz workflow i wyślij dane</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {workflows.map(wf => (
                  <Button
                    key={wf.id}
                    variant={selectedWf === wf.id ? 'default' : 'outline'}
                    size="sm"
                    className="justify-start gap-2"
                    onClick={() => setSelectedWf(wf.id)}
                  >
                    <Workflow className="h-4 w-4" />
                    <span className="truncate">{wf.name}</span>
                  </Button>
                ))}
              </div>

              {selectedWorkflow && (
                <>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Link className="h-3 w-3" />
                    <span className="truncate">{selectedWorkflow.webhookUrl}</span>
                    <Badge variant="outline" className="text-xs">{selectedWorkflow.method}</Badge>
                  </div>

                  {selectedWorkflow.method === 'POST' && (
                    <Textarea
                      value={payload}
                      onChange={(e) => setPayload(e.target.value)}
                      placeholder="JSON payload..."
                      className="font-mono text-sm"
                      rows={5}
                    />
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={() => triggerWorkflow(selectedWorkflow)}
                      disabled={isTriggering}
                      className="flex-1"
                    >
                      {isTriggering ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Wyzwól
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => sendToOllamaQueue(selectedWorkflow)}
                    >
                      <Cog className="h-4 w-4 mr-2" />
                      Do kolejki Ollama
                    </Button>
                  </div>
                </>
              )}

              {workflows.length === 0 && (
                <div className="text-center text-muted-foreground py-4">
                  Najpierw dodaj workflow w zakładce "Dodaj"
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Add workflow */}
        <TabsContent value="add" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dodaj workflow n8n</CardTitle>
              <CardDescription>Podaj URL webhooka z n8n</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nazwa workflow (np. Backup plików)"
              />
              <Input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-n8n.app.n8n.cloud/webhook/..."
              />
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Opis (opcjonalny)"
              />
              <div className="flex gap-2">
                <Button
                  variant={method === 'POST' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMethod('POST')}
                >
                  POST
                </Button>
                <Button
                  variant={method === 'GET' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMethod('GET')}
                >
                  GET
                </Button>
              </div>
              <Button onClick={addWorkflow} disabled={!name.trim() || !webhookUrl.trim()} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Dodaj workflow
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="space-y-3">
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {runs.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    Brak historii uruchomień
                  </CardContent>
                </Card>
              ) : (
                runs.map((run, i) => (
                  <Card key={i}>
                    <CardContent className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-lg",
                          run.status === 'success' ? 'bg-green-500/10' : run.status === 'error' ? 'bg-destructive/10' : 'bg-primary/10'
                        )}>
                          {run.status === 'running' ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : run.status === 'success' ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{run.workflowName}</div>
                          {run.result && (
                            <div className="text-xs text-muted-foreground mt-0.5 max-w-[300px] truncate">
                              {run.result}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(run.timestamp).toLocaleTimeString('pl-PL')}
                      </span>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
