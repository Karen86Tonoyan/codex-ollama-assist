import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Users, 
  MessageSquare, 
  Clock, 
  Zap,
  Brain,
  Heart,
  Briefcase,
  RefreshCw,
  Send,
  X,
  MoreVertical,
  History,
  Route,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { 
  getSessions, 
  sendToSession, 
  closeSession, 
  setSessionMode,
  type Session,
} from '@/lib/gateway';
import { toast } from 'sonner';

interface SessionsPanelProps {
  isConnected: boolean;
}

const MODE_CONFIG = {
  ANALITYK: { icon: Brain, color: 'text-blue-500', label: 'Analityk', description: 'Logiczny, analityczny' },
  UZDROWICIEL: { icon: Heart, color: 'text-pink-500', label: 'Uzdrowiciel', description: 'Empatyczny, wspierający' },
  TOWARZYSZ: { icon: Briefcase, color: 'text-amber-500', label: 'Towarzysz', description: 'Przyjazny, codzienny' },
};

export function SessionsPanel({ isConnected }: SessionsPanelProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadSessions();
    // Auto-refresh every 10 seconds
    const interval = setInterval(loadSessions, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadSessions = async () => {
    try {
      const data = await getSessions();
      setSessions(data);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedSession || !messageText.trim()) return;
    
    setSending(true);
    try {
      await sendToSession(selectedSession.id, messageText);
      setMessageText('');
      toast.success('Wiadomość wysłana');
    } catch (error) {
      toast.error('Nie udało się wysłać wiadomości');
    } finally {
      setSending(false);
    }
  };

  const handleCloseSession = async (sessionId: string) => {
    try {
      await closeSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (selectedSession?.id === sessionId) {
        setSelectedSession(null);
      }
      toast.success('Sesja zamknięta');
    } catch (error) {
      toast.error('Nie udało się zamknąć sesji');
    }
  };

  const handleModeChange = async (sessionId: string, mode: Session['mode']) => {
    try {
      await setSessionMode(sessionId, mode);
      setSessions(prev => prev.map(s => 
        s.id === sessionId ? { ...s, mode } : s
      ));
      if (selectedSession?.id === sessionId) {
        setSelectedSession(prev => prev ? { ...prev, mode } : null);
      }
      toast.success(`Tryb zmieniony na ${MODE_CONFIG[mode].label}`);
    } catch (error) {
      toast.error('Nie udało się zmienić trybu');
    }
  };

  const getStatusBadge = (status: Session['status']) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-500">Aktywna</Badge>;
      case 'idle':
        return <Badge variant="secondary">Bezczynna</Badge>;
      default:
        return <Badge variant="outline">Zamknięta</Badge>;
    }
  };

  const formatDuration = (date: Date) => {
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    
    if (hours > 24) {
      return `${Math.floor(hours / 24)} dni`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const totalTokens = sessions.reduce((sum, s) => sum + (s.tokenUsage || 0), 0);
  const activeSessions = sessions.filter(s => s.status === 'active').length;

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Stats */}
      <div className="md:col-span-3 grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{sessions.length}</p>
                <p className="text-sm text-muted-foreground">Wszystkie sesje</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Zap className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{activeSessions}</p>
                <p className="text-sm text-muted-foreground">Aktywne teraz</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <MessageSquare className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">
                  {sessions.reduce((sum, s) => sum + s.messageCount, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Wiadomości</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* token stats card hidden */}
      </div>

      {/* Sessions List */}
      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Route className="h-5 w-5" />
                Aktywne sesje
              </CardTitle>
              <CardDescription>
                Multi-agent routing - zarządzaj sesjami i przypisuj tryby Trinity
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadSessions}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Brak aktywnych sesji</p>
              <p className="text-sm">Sesje pojawią się gdy użytkownicy napiszą do bota</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {sessions.map((session) => {
                  const ModeIcon = MODE_CONFIG[session.mode].icon;
                  const modeColor = MODE_CONFIG[session.mode].color;
                  
                  return (
                    <div
                      key={session.id}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedSession?.id === session.id ? 'border-primary bg-muted/30' : ''
                      }`}
                      onClick={() => setSelectedSession(session)}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg bg-muted ${modeColor}`}>
                            <ModeIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {session.peerName || session.peerId}
                              </span>
                              {getStatusBadge(session.status)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Kanał: {session.channelId} · {MODE_CONFIG[session.mode].label}
                            </p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCloseSession(session.id);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {session.messageCount} wiadomości
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(session.createdAt)}
                        </div>
                        {/* token usage hidden */}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Session Details */}
      <Card>
        <CardHeader>
          <CardTitle>
            {selectedSession ? 'Szczegóły sesji' : 'Wybierz sesję'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedSession ? (
            <div className="space-y-4">
              <div>
                <p className="text-lg font-semibold">
                  {selectedSession.peerName || selectedSession.peerId}
                </p>
                <p className="text-sm text-muted-foreground">
                  ID: {selectedSession.id}
                </p>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  {getStatusBadge(selectedSession.status)}
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Wiadomości</span>
                  <span>{selectedSession.messageCount}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Czas trwania</span>
                  <span>{formatDuration(selectedSession.createdAt)}</span>
                </div>
                
                {/* token usage hidden */}
              </div>

              <Separator />

              <div className="space-y-2">
                <label className="text-sm font-medium">Tryb Trinity</label>
                <Select 
                  value={selectedSession.mode}
                  onValueChange={(value) => handleModeChange(selectedSession.id, value as Session['mode'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MODE_CONFIG).map(([key, config]) => {
                      const Icon = config.icon;
                      return (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${config.color}`} />
                            <span>{config.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {MODE_CONFIG[selectedSession.mode].description}
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <label className="text-sm font-medium">Wyślij wiadomość</label>
                <Textarea
                  placeholder="Wpisz wiadomość do użytkownika..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={3}
                />
                <Button 
                  className="w-full" 
                  onClick={handleSendMessage}
                  disabled={!messageText.trim() || sending}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {sending ? 'Wysyłanie...' : 'Wyślij'}
                </Button>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1">
                  <History className="mr-2 h-4 w-4" />
                  Historia
                </Button>
                <Button 
                  variant="destructive" 
                  className="flex-1"
                  onClick={() => handleCloseSession(selectedSession.id)}
                >
                  <X className="mr-2 h-4 w-4" />
                  Zamknij
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MoreVertical className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Wybierz sesję z listy aby zobaczyć szczegóły</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
