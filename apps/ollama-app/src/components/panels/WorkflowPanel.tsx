import { useState, useEffect, useCallback } from 'react';
import { Plus, Play, Pause, Square, Trash2, Loader2, Zap, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type WorkflowStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';

interface WorkflowRow {
  id: string;
  name: string;
  description: string | null;
  steps: unknown;
  is_active: boolean;
  trigger_type: string | null;
  trigger_config: unknown;
  retry_policy: unknown;
  created_at: string;
  updated_at: string;
  user_id: string;
}

const statusColors: Record<WorkflowStatus, string> = {
  idle: 'bg-muted text-muted-foreground',
  running: 'bg-green-500/20 text-green-700 dark:text-green-400',
  paused: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  completed: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
  error: 'bg-destructive/20 text-destructive',
};

const statusLabels: Record<WorkflowStatus, string> = {
  idle: 'Bezczynny',
  running: 'W toku',
  paused: 'Wstrzymany',
  completed: 'Ukończony',
  error: 'Błąd',
};

function getWorkflowStatus(row: WorkflowRow): WorkflowStatus {
  if (!row.is_active) return 'idle';
  const steps = row.steps as any[];
  if (!steps || steps.length === 0) return 'idle';
  // Check trigger_config for status
  const config = row.trigger_config as Record<string, unknown> | null;
  return (config?.status as WorkflowStatus) || (row.is_active ? 'running' : 'idle');
}

export function WorkflowPanel() {
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newAction, setNewAction] = useState('');

  const loadWorkflows = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('task_pipelines')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setWorkflows(data || []);
    } catch (error) {
      console.error('Failed to load workflows:', error);
      toast.error('Nie udało się załadować workflow');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  const handleCreate = async () => {
    if (!newName.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Musisz być zalogowany');
        return;
      }

      const steps = [{ id: crypto.randomUUID(), action: newAction || 'custom_action', params: {} }];

      const { data, error } = await supabase
        .from('task_pipelines')
        .insert({
          name: newName,
          description: newDescription || null,
          steps,
          user_id: user.id,
          is_active: false,
          trigger_type: 'manual',
          trigger_config: { status: 'idle' },
        })
        .select()
        .single();

      if (error) throw error;
      setWorkflows(prev => [data, ...prev]);
      setNewName('');
      setNewDescription('');
      setNewAction('');
      setIsDialogOpen(false);
      toast.success('Workflow utworzony');
    } catch (error) {
      console.error('Failed to create workflow:', error);
      toast.error('Nie udało się utworzyć workflow');
    }
  };

  const handleStatusChange = async (id: string, newStatus: WorkflowStatus) => {
    try {
      const { error } = await supabase
        .from('task_pipelines')
        .update({
          is_active: newStatus === 'running',
          trigger_config: { status: newStatus },
        })
        .eq('id', id);

      if (error) throw error;

      setWorkflows(prev =>
        prev.map(wf => wf.id === id 
          ? { ...wf, is_active: newStatus === 'running', trigger_config: { status: newStatus } } 
          : wf
        )
      );
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Nie udało się zmienić statusu');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('task_pipelines')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setWorkflows(prev => prev.filter(wf => wf.id !== id));
      toast.success('Workflow usunięty');
    } catch (error) {
      console.error('Failed to delete workflow:', error);
      toast.error('Nie udało się usunąć workflow');
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Automatyzacja Workflow
          <Badge variant="secondary">{workflows.length}</Badge>
        </CardTitle>
        
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={loadWorkflows} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Nowy workflow
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Utwórz nowy workflow</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nazwa</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="np. Sprawdź maila co 5 minut"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Opis (opcjonalny)</Label>
                  <Textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Co robi ten workflow..."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Akcja</Label>
                  <Input
                    value={newAction}
                    onChange={(e) => setNewAction(e.target.value)}
                    placeholder="np. check_email, summarize, analyze_camera"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Anuluj
                </Button>
                <Button onClick={handleCreate} disabled={!newName.trim()}>
                  Utwórz
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : workflows.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            Brak workflow. Utwórz pierwszy!
          </p>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {workflows.map((workflow) => {
                const status = getWorkflowStatus(workflow);
                const steps = (workflow.steps as any[]) || [];
                return (
                  <div 
                    key={workflow.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium truncate">{workflow.name}</h4>
                        <Badge className={cn("text-xs shrink-0", statusColors[status])}>
                          {statusLabels[status]}
                        </Badge>
                      </div>
                      {workflow.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground truncate">
                          {workflow.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {steps.length} krok(ów) · {workflow.trigger_type || 'manual'}
                      </p>
                    </div>

                    <div className="flex gap-1 shrink-0">
                      {status === 'running' ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleStatusChange(workflow.id, 'paused')}
                        >
                          <Pause className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleStatusChange(workflow.id, 'running')}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleStatusChange(workflow.id, 'idle')}
                        disabled={status === 'idle'}
                      >
                        <Square className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(workflow.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
