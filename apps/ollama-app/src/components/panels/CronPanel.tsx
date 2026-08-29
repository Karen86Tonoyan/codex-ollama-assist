import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Clock, 
  Play,
  Plus,
  Trash2,
  RefreshCw,
  Calendar,
  Zap,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Link as LinkIcon,
  Copy,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Webhook as WebhookIcon } from 'lucide-react';
import { 
  getCronJobs, 
  createCronJob, 
  deleteCronJob, 
  runCronJob,
  getWebhooks,
  createWebhook,
  deleteWebhook,
  type CronJob, 
  type Webhook,
} from '@/lib/gateway';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface CronPanelProps {
  isConnected: boolean;
}

const CRON_PRESETS = [
  { label: 'Co minutę', cron: '* * * * *' },
  { label: 'Co godzinę', cron: '0 * * * *' },
  { label: 'Codziennie o 9:00', cron: '0 9 * * *' },
  { label: 'Co tydzień (niedziela)', cron: '0 0 * * 0' },
  { label: 'Co miesiąc', cron: '0 0 1 * *' },
];

export function CronPanel({ isConnected }: CronPanelProps) {
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCron, setShowAddCron] = useState(false);
  const [showAddWebhook, setShowAddWebhook] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  
  const [newCron, setNewCron] = useState({
    name: '',
    schedule: '0 9 * * *',
    action: '',
    enabled: true,
  });
  
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    events: '',
    enabled: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cronData, webhookData] = await Promise.all([
        getCronJobs(),
        getWebhooks(),
      ]);
      setCronJobs(cronData);
      setWebhooks(webhookData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCron = async () => {
    try {
      const job = await createCronJob(newCron);
      setCronJobs(prev => [...prev, job]);
      setShowAddCron(false);
      setNewCron({ name: '', schedule: '0 9 * * *', action: '', enabled: true });
      toast.success('Zadanie cron utworzone');
    } catch (error) {
      toast.error('Nie udało się utworzyć zadania');
    }
  };

  const handleDeleteCron = async (jobId: string) => {
    try {
      await deleteCronJob(jobId);
      setCronJobs(prev => prev.filter(j => j.id !== jobId));
      toast.success('Zadanie usunięte');
    } catch (error) {
      toast.error('Nie udało się usunąć zadania');
    }
  };

  const handleRunCron = async (jobId: string) => {
    try {
      await runCronJob(jobId);
      toast.success('Zadanie uruchomione');
    } catch (error) {
      toast.error('Nie udało się uruchomić zadania');
    }
  };

  const handleCreateWebhook = async () => {
    try {
      const webhook = await createWebhook({
        name: newWebhook.name,
        url: `/webhooks/${newWebhook.name.toLowerCase().replace(/\s+/g, '-')}`,
        events: newWebhook.events.split(',').map(e => e.trim()),
        enabled: newWebhook.enabled,
      });
      setWebhooks(prev => [...prev, webhook]);
      setShowAddWebhook(false);
      setNewWebhook({ name: '', events: '', enabled: true });
      toast.success('Webhook utworzony');
    } catch (error) {
      toast.error('Nie udało się utworzyć webhooka');
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    try {
      await deleteWebhook(webhookId);
      setWebhooks(prev => prev.filter(w => w.id !== webhookId));
      toast.success('Webhook usunięty');
    } catch (error) {
      toast.error('Nie udało się usunąć webhooka');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Skopiowano do schowka');
  };

  const getStatusIcon = (status: CronJob['status']) => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="cron">
        <TabsList>
          <TabsTrigger value="cron" className="gap-2">
            <Clock className="h-4 w-4" />
            Zadania Cron ({cronJobs.length})
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-2">
            <WebhookIcon className="h-4 w-4" />
            Webhooks ({webhooks.length})
          </TabsTrigger>
        </TabsList>

        {/* CRON TAB */}
        <TabsContent value="cron">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Zaplanowane zadania
                    </CardTitle>
                    <CardDescription>
                      Automatyczne uruchamianie akcji według harmonogramu
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={loadData}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button size="sm" onClick={() => setShowAddCron(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Dodaj
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : cronJobs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>Brak zaplanowanych zadań</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[350px]">
                    <div className="space-y-3">
                      {cronJobs.map((job) => (
                        <div
                          key={job.id}
                          className="flex items-center justify-between p-4 rounded-lg border"
                        >
                          <div className="flex items-center gap-4">
                            {getStatusIcon(job.status)}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{job.name}</span>
                                <Badge variant="outline" className="font-mono text-xs">
                                  {job.schedule}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {job.action}
                              </p>
                              <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                                {job.lastRun && (
                                  <span>
                                    Ostatnio: {new Date(job.lastRun).toLocaleString('pl-PL')}
                                  </span>
                                )}
                                {job.nextRun && (
                                  <span>
                                    Następnie: {new Date(job.nextRun).toLocaleString('pl-PL')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch checked={job.enabled} />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRunCron(job.id)}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteCron(job.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {showAddCron ? 'Nowe zadanie' : 'Informacje'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {showAddCron ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nazwa</Label>
                      <Input
                        placeholder="Daily Summary"
                        value={newCron.name}
                        onChange={(e) => setNewCron(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Harmonogram (cron)</Label>
                      <Input
                        placeholder="0 9 * * *"
                        value={newCron.schedule}
                        onChange={(e) => setNewCron(prev => ({ ...prev, schedule: e.target.value }))}
                        className="font-mono"
                      />
                      <div className="flex flex-wrap gap-1">
                        {CRON_PRESETS.map((preset) => (
                          <Button
                            key={preset.cron}
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => setNewCron(prev => ({ ...prev, schedule: preset.cron }))}
                          >
                            {preset.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Akcja</Label>
                      <Input
                        placeholder="send_daily_summary"
                        value={newCron.action}
                        onChange={(e) => setNewCron(prev => ({ ...prev, action: e.target.value }))}
                      />
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => setShowAddCron(false)}
                      >
                        Anuluj
                      </Button>
                      <Button 
                        className="flex-1"
                        onClick={handleCreateCron}
                      >
                        Utwórz
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 text-sm">
                    <p className="text-muted-foreground">
                      Zadania cron pozwalają na automatyczne uruchamianie akcji według harmonogramu.
                    </p>
                    <Separator />
                    <div>
                      <p className="font-medium mb-2">Format cron:</p>
                      <code className="text-xs bg-muted p-2 rounded block">
                        * * * * *<br/>
                        │ │ │ │ └─ dzień tygodnia (0-7)<br/>
                        │ │ │ └─── miesiąc (1-12)<br/>
                        │ │ └───── dzień miesiąca (1-31)<br/>
                        │ └─────── godzina (0-23)<br/>
                        └───────── minuta (0-59)
                      </code>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* WEBHOOKS TAB */}
        <TabsContent value="webhooks">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <WebhookIcon className="h-5 w-5" />
                      Webhooks
                    </CardTitle>
                    <CardDescription>
                      Odbieraj zdarzenia z zewnętrznych serwisów
                    </CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowAddWebhook(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Dodaj
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {webhooks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <LinkIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>Brak skonfigurowanych webhooków</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[350px]">
                    <div className="space-y-3">
                      {webhooks.map((webhook) => (
                        <div
                          key={webhook.id}
                          className="p-4 rounded-lg border"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{webhook.name}</span>
                              <Badge variant={webhook.enabled ? 'default' : 'secondary'}>
                                {webhook.enabled ? 'Aktywny' : 'Wyłączony'}
                              </Badge>
                            </div>
                            <div className="flex gap-2">
                              <Switch checked={webhook.enabled} />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteWebhook(webhook.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 mb-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded flex-1">
                              {webhook.url}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copyToClipboard(`http://127.0.0.1:8765${webhook.url}`)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          {webhook.secret && (
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs text-muted-foreground">Secret:</span>
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                {showSecrets[webhook.id] ? webhook.secret : '••••••••'}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => setShowSecrets(prev => ({ 
                                  ...prev, 
                                  [webhook.id]: !prev[webhook.id] 
                                }))}
                              >
                                {showSecrets[webhook.id] ? (
                                  <EyeOff className="h-3 w-3" />
                                ) : (
                                  <Eye className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          )}
                          
                          <div className="flex flex-wrap gap-1">
                            {webhook.events.map(event => (
                              <Badge key={event} variant="outline" className="text-xs">
                                {event}
                              </Badge>
                            ))}
                          </div>
                          
                          {webhook.lastTriggered && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Ostatnio: {new Date(webhook.lastTriggered).toLocaleString('pl-PL')}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {showAddWebhook ? 'Nowy webhook' : 'Informacje'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {showAddWebhook ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nazwa</Label>
                      <Input
                        placeholder="GitHub Events"
                        value={newWebhook.name}
                        onChange={(e) => setNewWebhook(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Eventy (oddzielone przecinkami)</Label>
                      <Input
                        placeholder="push, pull_request, issues"
                        value={newWebhook.events}
                        onChange={(e) => setNewWebhook(prev => ({ ...prev, events: e.target.value }))}
                      />
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => setShowAddWebhook(false)}
                      >
                        Anuluj
                      </Button>
                      <Button 
                        className="flex-1"
                        onClick={handleCreateWebhook}
                      >
                        Utwórz
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 text-sm text-muted-foreground">
                    <p>
                      Webhooks pozwalają na odbieranie zdarzeń z zewnętrznych serwisów jak GitHub, Stripe, Slack.
                    </p>
                    <Separator />
                    <p>
                      <strong>Popularne integracje:</strong>
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>GitHub - push, PR, issues</li>
                      <li>Stripe - płatności</li>
                      <li>Gmail - nowe emaile</li>
                      <li>Slack - wiadomości</li>
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
