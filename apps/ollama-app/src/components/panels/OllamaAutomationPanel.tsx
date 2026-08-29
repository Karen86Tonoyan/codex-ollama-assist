import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bot,
  Play,
  Square,
  Check,
  X,
  Trash2,
  FolderInput,
  Copy,
  Terminal,
  FileUp,
  Camera,
  MessageCircle,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Send,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface OllamaTask {
  id: string;
  type: string;
  params: Record<string, unknown>;
  status: string;
  screenshot_url: string | null;
  highlight_data: Record<string, unknown> | null;
  result: string | null;
  source: string;
  whatsapp_from: string | null;
  created_at: string;
  updated_at: string;
}

const typeIcons: Record<string, React.ElementType> = {
  move_file: FolderInput,
  copy_file: Copy,
  delete_file: Trash2,
  run_command: Terminal,
  load_file: FileUp,
};

const typeLabels: Record<string, string> = {
  move_file: 'Przenieś plik',
  copy_file: 'Kopiuj plik',
  delete_file: 'Usuń plik',
  run_command: 'Uruchom komendę',
  load_file: 'Załaduj plik',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  awaiting_confirm: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  approved: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  rejected: 'bg-red-500/10 text-red-600 border-red-500/30',
  running: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  done: 'bg-green-500/10 text-green-600 border-green-500/30',
  error: 'bg-destructive/10 text-destructive border-destructive/30',
};

const statusLabels: Record<string, string> = {
  pending: 'Oczekuje',
  awaiting_confirm: 'Czeka na potwierdzenie',
  approved: 'Zatwierdzone',
  rejected: 'Odrzucone',
  running: 'W trakcie',
  done: 'Zakończone',
  error: 'Błąd',
};

export function OllamaAutomationPanel() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<OllamaTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newTaskType, setNewTaskType] = useState('run_command');
  const [newTaskParam, setNewTaskParam] = useState('');
  const [newTaskDest, setNewTaskDest] = useState('');

  const fetchTasks = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('ollama_tasks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setTasks(data as unknown as OllamaTask[]);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('ollama-tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ollama_tasks' }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchTasks]);

  const createTask = async () => {
    if (!user || !newTaskParam.trim()) return;

    const params: Record<string, unknown> = {};
    if (newTaskType === 'move_file' || newTaskType === 'copy_file') {
      params.source = newTaskParam;
      params.destination = newTaskDest;
    } else if (newTaskType === 'run_command') {
      params.command = newTaskParam;
    } else {
      params.path = newTaskParam;
    }

    const needsConfirm = newTaskType === 'delete_file' || newTaskType === 'move_file';

    await supabase.from('ollama_tasks').insert([{
      user_id: user.id,
      type: newTaskType,
      params: params as unknown as Record<string, never>,
      status: needsConfirm ? 'awaiting_confirm' : 'pending',
      source: 'ui',
    }] as never);

    setNewTaskParam('');
    setNewTaskDest('');
  };

  const approveTask = async (taskId: string) => {
    await supabase.from('ollama_tasks').update({ status: 'approved' }).eq('id', taskId);
  };

  const rejectTask = async (taskId: string) => {
    await supabase.from('ollama_tasks').update({ status: 'rejected' }).eq('id', taskId);
  };

  const pendingConfirm = tasks.filter(t => t.status === 'awaiting_confirm');
  const activeTasks = tasks.filter(t => ['pending', 'approved', 'running'].includes(t.status));
  const completedTasks = tasks.filter(t => ['done', 'rejected', 'error'].includes(t.status));

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-xl flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Ollama Automation
            </CardTitle>
            <CardDescription>
              Autonomiczna automatyzacja z potwierdzeniami • WhatsApp control
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchTasks} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-orange-500">{pendingConfirm.length}</div>
              <div className="text-xs text-muted-foreground">Do potwierdzenia</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-500">{activeTasks.length}</div>
              <div className="text-xs text-muted-foreground">Aktywne</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-500">
                {tasks.filter(t => t.status === 'done').length}
              </div>
              <div className="text-xs text-muted-foreground">Zakończone</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-destructive">
                {tasks.filter(t => t.status === 'error').length}
              </div>
              <div className="text-xs text-muted-foreground">Błędy</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="confirm" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="confirm" className="relative">
            Potwierdzenia
            {pendingConfirm.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {pendingConfirm.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="queue">Kolejka</TabsTrigger>
          <TabsTrigger value="new">Nowe zadanie</TabsTrigger>
          <TabsTrigger value="history">Historia</TabsTrigger>
        </TabsList>

        {/* Confirmations tab */}
        <TabsContent value="confirm" className="space-y-4">
          {pendingConfirm.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-30" />
                Brak zadań oczekujących na potwierdzenie
              </CardContent>
            </Card>
          ) : (
            pendingConfirm.map(task => (
              <TaskConfirmCard key={task.id} task={task} onApprove={approveTask} onReject={rejectTask} />
            ))
          )}
        </TabsContent>

        {/* Queue tab */}
        <TabsContent value="queue" className="space-y-4">
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {activeTasks.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    Brak aktywnych zadań
                  </CardContent>
                </Card>
              ) : (
                activeTasks.map(task => <TaskCard key={task.id} task={task} />)
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* New task tab */}
        <TabsContent value="new" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dodaj zadanie</CardTitle>
              <CardDescription>Ollama wykona je automatycznie</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(typeLabels).map(([key, label]) => {
                  const Icon = typeIcons[key] || Terminal;
                  return (
                    <Button
                      key={key}
                      variant={newTaskType === key ? 'default' : 'outline'}
                      size="sm"
                      className="flex-col h-auto py-3 gap-1"
                      onClick={() => setNewTaskType(key)}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-xs">{label}</span>
                    </Button>
                  );
                })}
              </div>

              <div className="space-y-2">
                <Input
                  value={newTaskParam}
                  onChange={(e) => setNewTaskParam(e.target.value)}
                  placeholder={
                    newTaskType === 'run_command' ? 'Komenda do wykonania...'
                    : newTaskType === 'move_file' || newTaskType === 'copy_file' ? 'Ścieżka źródłowa...'
                    : 'Ścieżka pliku...'
                  }
                />
                {(newTaskType === 'move_file' || newTaskType === 'copy_file') && (
                  <Input
                    value={newTaskDest}
                    onChange={(e) => setNewTaskDest(e.target.value)}
                    placeholder="Ścieżka docelowa..."
                  />
                )}
              </div>

              {(newTaskType === 'delete_file' || newTaskType === 'move_file') && (
                <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-500/10 p-3 rounded-lg">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>
                    {newTaskType === 'delete_file'
                      ? 'Kasowanie wymaga potwierdzenia ze screenshotem'
                      : 'Przenoszenie wymaga potwierdzenia'}
                  </span>
                </div>
              )}

              <Button onClick={createTask} disabled={!newTaskParam.trim()} className="w-full">
                <Send className="h-4 w-4 mr-2" />
                Dodaj zadanie
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History tab */}
        <TabsContent value="history" className="space-y-4">
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {completedTasks.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Brak historii
                  </CardContent>
                </Card>
              ) : (
                completedTasks.map(task => <TaskCard key={task.id} task={task} />)
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Confirmation card with screenshot preview
function TaskConfirmCard({
  task,
  onApprove,
  onReject,
}: {
  task: OllamaTask;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const Icon = typeIcons[task.type] || Terminal;

  return (
    <Card className="border-orange-500/40 bg-orange-500/5">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Icon className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <div className="font-medium flex items-center gap-2">
                {typeLabels[task.type] || task.type}
                <Badge variant="outline" className="text-xs gap-1">
                  {task.source === 'whatsapp' ? (
                    <><MessageCircle className="h-3 w-3" /> WhatsApp</>
                  ) : (
                    'UI'
                  )}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {task.type === 'delete_file' && (
                  <span className="text-destructive font-medium">
                    ⚠️ Kasowanie: {String(task.params.path || '')}
                  </span>
                )}
                {task.type === 'move_file' && (
                  <span>
                    {String(task.params.source || '')} → {String(task.params.destination || '')}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {new Date(task.created_at).toLocaleString('pl-PL')}
          </div>
        </div>

        {/* Screenshot preview */}
        {task.screenshot_url && (
          <div className="relative rounded-lg overflow-hidden border">
            <img
              src={task.screenshot_url}
              alt="Screenshot"
              className="w-full max-h-[300px] object-contain bg-black/5"
            />
            {task.highlight_data && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Highlight overlay would be rendered here based on highlight_data */}
                <div className="absolute top-2 left-2 bg-red-500/80 text-white text-xs px-2 py-1 rounded">
                  <Camera className="h-3 w-3 inline mr-1" />
                  Podświetlone elementy
                </div>
              </div>
            )}
          </div>
        )}

        {task.type === 'delete_file' && !task.screenshot_url && (
          <div className="border rounded-lg p-4 bg-muted/50 flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Oczekiwanie na screenshot od Ollama...
          </div>
        )}

        {/* Approve / Reject */}
        <div className="flex gap-2">
          <Button
            variant="default"
            className="flex-1 bg-green-600 hover:bg-green-700"
            onClick={() => onApprove(task.id)}
          >
            <Check className="h-4 w-4 mr-2" />
            Zatwierdź
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={() => onReject(task.id)}
          >
            <X className="h-4 w-4 mr-2" />
            Odrzuć
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Regular task card
function TaskCard({ task }: { task: OllamaTask }) {
  const Icon = typeIcons[task.type] || Terminal;

  return (
    <Card>
      <CardContent className="flex items-center justify-between py-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className="font-medium text-sm flex items-center gap-2">
              {typeLabels[task.type] || task.type}
              <Badge variant="outline" className="text-xs gap-1">
                {task.source === 'whatsapp' ? (
                  <><MessageCircle className="h-3 w-3" /> WA</>
                ) : (
                  'UI'
                )}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {task.params.command && String(task.params.command)}
              {task.params.path && String(task.params.path)}
              {task.params.source && `${String(task.params.source)} → ${String(task.params.destination)}`}
            </div>
            {task.result && (
              <div className="text-xs mt-1 text-muted-foreground italic">{task.result}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn("text-xs", statusColors[task.status] || '')}>
            {task.status === 'running' && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            {statusLabels[task.status] || task.status}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(task.created_at).toLocaleTimeString('pl-PL')}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
