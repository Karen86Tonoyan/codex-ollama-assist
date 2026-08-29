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
  MessageCircle, 
  Send, 
  Hash, 
  Slack,
  Phone,
  Smartphone,
  Users,
  Globe,
  Settings,
  RefreshCw,
  QrCode,
  Plus,
  Power,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { 
  getChannels, 
  connectChannel, 
  disconnectChannel, 
  type Channel, 
  type ChannelType 
} from '@/lib/gateway';
import { toast } from 'sonner';

interface ChannelsPanelProps {
  isConnected: boolean;
}

const CHANNEL_ICONS: Record<ChannelType, React.ElementType> = {
  whatsapp: MessageCircle,
  telegram: Send,
  discord: Hash,
  slack: Slack,
  signal: Phone,
  imessage: Smartphone,
  teams: Users,
  matrix: Globe,
  webchat: Globe,
};

const CHANNEL_COLORS: Record<ChannelType, string> = {
  whatsapp: 'bg-green-500',
  telegram: 'bg-blue-500',
  discord: 'bg-indigo-500',
  slack: 'bg-purple-500',
  signal: 'bg-blue-600',
  imessage: 'bg-sky-500',
  teams: 'bg-violet-500',
  matrix: 'bg-emerald-500',
  webchat: 'bg-gray-500',
};

const CHANNEL_NAMES: Record<ChannelType, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  discord: 'Discord',
  slack: 'Slack',
  signal: 'Signal',
  imessage: 'iMessage',
  teams: 'MS Teams',
  matrix: 'Matrix',
  webchat: 'WebChat',
};

export function ChannelsPanel({ isConnected }: ChannelsPanelProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelType, setNewChannelType] = useState<ChannelType>('telegram');
  const [newChannelConfig, setNewChannelConfig] = useState<Record<string, string>>({});

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    setLoading(true);
    try {
      const data = await getChannels();
      setChannels(data);
    } catch (error) {
      console.error('Failed to load channels:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (type: ChannelType, config: Record<string, string>) => {
    try {
      const channel = await connectChannel(type, config);
      setChannels(prev => [...prev, channel]);
      setShowAddChannel(false);
      setNewChannelConfig({});
      toast.success(`${CHANNEL_NAMES[type]} połączony!`);
    } catch (error) {
      toast.error('Nie udało się połączyć kanału');
    }
  };

  const handleDisconnect = async (channelId: string) => {
    try {
      await disconnectChannel(channelId);
      setChannels(prev => prev.map(c => 
        c.id === channelId ? { ...c, status: 'disconnected' as const } : c
      ));
      toast.success('Kanał rozłączony');
    } catch (error) {
      toast.error('Nie udało się rozłączyć kanału');
    }
  };

  const getStatusIcon = (status: Channel['status']) => {
    switch (status) {
      case 'connected':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'pairing':
        return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Power className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: Channel['status']) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">Online</Badge>;
      case 'pairing':
        return <Badge variant="outline" className="text-yellow-500 border-yellow-500">Parowanie...</Badge>;
      case 'error':
        return <Badge variant="destructive">Błąd</Badge>;
      default:
        return <Badge variant="secondary">Offline</Badge>;
    }
  };

  const renderConfigFields = (type: ChannelType) => {
    switch (type) {
      case 'telegram':
        return (
          <div className="space-y-2">
            <Label htmlFor="botToken">Bot Token</Label>
            <Input
              id="botToken"
              placeholder="123456:ABCDEF..."
              value={newChannelConfig.botToken || ''}
              onChange={(e) => setNewChannelConfig(prev => ({ ...prev, botToken: e.target.value }))}
            />
          </div>
        );
      case 'discord':
        return (
          <div className="space-y-2">
            <Label htmlFor="token">Bot Token</Label>
            <Input
              id="token"
              placeholder="Discord Bot Token"
              value={newChannelConfig.token || ''}
              onChange={(e) => setNewChannelConfig(prev => ({ ...prev, token: e.target.value }))}
            />
          </div>
        );
      case 'slack':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="botToken">Bot Token</Label>
              <Input
                id="botToken"
                placeholder="xoxb-..."
                value={newChannelConfig.botToken || ''}
                onChange={(e) => setNewChannelConfig(prev => ({ ...prev, botToken: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appToken">App Token</Label>
              <Input
                id="appToken"
                placeholder="xapp-..."
                value={newChannelConfig.appToken || ''}
                onChange={(e) => setNewChannelConfig(prev => ({ ...prev, appToken: e.target.value }))}
              />
            </div>
          </>
        );
      case 'whatsapp':
        return (
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">WhatsApp wymaga skanowania kodu QR.</p>
            <Button variant="outline" size="sm">
              <QrCode className="mr-2 h-4 w-4" />
              Pokaż kod QR
            </Button>
          </div>
        );
      default:
        return (
          <p className="text-sm text-muted-foreground">
            Konfiguracja dla {CHANNEL_NAMES[type]} wkrótce dostępna.
          </p>
        );
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Channels List */}
      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Kanały komunikacji
              </CardTitle>
              <CardDescription>
                Multi-channel inbox - WhatsApp, Telegram, Discord, Slack i więcej
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadChannels}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={() => setShowAddChannel(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Dodaj kanał
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : channels.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Brak skonfigurowanych kanałów</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setShowAddChannel(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Dodaj pierwszy kanał
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {channels.map((channel) => {
                  const Icon = CHANNEL_ICONS[channel.type];
                  const bgColor = CHANNEL_COLORS[channel.type];
                  
                  return (
                    <div
                      key={channel.id}
                      className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedChannel?.id === channel.id ? 'border-primary bg-muted/30' : ''
                      }`}
                      onClick={() => setSelectedChannel(channel)}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${bgColor}`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{channel.name}</span>
                            {getStatusIcon(channel.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {CHANNEL_NAMES[channel.type]}
                            {channel.lastActivity && (
                              <> · Ostatnia aktywność: {new Date(channel.lastActivity).toLocaleTimeString('pl-PL')}</>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(channel.status)}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedChannel(channel);
                          }}
                        >
                          <Settings className="h-4 w-4" />
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

      {/* Right Panel - Add Channel or Channel Details */}
      <Card>
        <CardHeader>
          <CardTitle>
            {showAddChannel ? 'Dodaj nowy kanał' : selectedChannel ? 'Szczegóły kanału' : 'Wybierz kanał'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {showAddChannel ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Typ kanału</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(CHANNEL_ICONS) as ChannelType[]).map((type) => {
                    const Icon = CHANNEL_ICONS[type];
                    const bgColor = CHANNEL_COLORS[type];
                    const isSelected = newChannelType === type;
                    
                    return (
                      <Button
                        key={type}
                        variant={isSelected ? 'default' : 'outline'}
                        className="flex-col h-16 gap-1"
                        onClick={() => setNewChannelType(type)}
                      >
                        <div className={`p-1 rounded ${isSelected ? '' : bgColor}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-xs">{CHANNEL_NAMES[type]}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {renderConfigFields(newChannelType)}

              <div className="flex gap-2 pt-4">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setShowAddChannel(false);
                    setNewChannelConfig({});
                  }}
                >
                  Anuluj
                </Button>
                <Button 
                  className="flex-1"
                  onClick={() => handleConnect(newChannelType, newChannelConfig)}
                >
                  Połącz
                </Button>
              </div>
            </div>
          ) : selectedChannel ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-lg ${CHANNEL_COLORS[selectedChannel.type]}`}>
                  {(() => {
                    const Icon = CHANNEL_ICONS[selectedChannel.type];
                    return <Icon className="h-6 w-6 text-white" />;
                  })()}
                </div>
                <div>
                  <h3 className="font-semibold">{selectedChannel.name}</h3>
                  <p className="text-sm text-muted-foreground">{CHANNEL_NAMES[selectedChannel.type]}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  {getStatusBadge(selectedChannel.status)}
                </div>
                
                {selectedChannel.lastActivity && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ostatnia aktywność</span>
                    <span className="text-sm">
                      {new Date(selectedChannel.lastActivity).toLocaleString('pl-PL')}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Aktywny</span>
                  <Switch 
                    checked={selectedChannel.status === 'connected'}
                    onCheckedChange={(checked) => {
                      if (!checked) {
                        handleDisconnect(selectedChannel.id);
                      }
                    }}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Dozwolone kontakty</Label>
                <Input 
                  placeholder="*, +48*, @admin" 
                  defaultValue={selectedChannel.allowFrom?.join(', ')}
                />
                <p className="text-xs text-muted-foreground">
                  Użyj * dla wszystkich, lub podaj wzorce numerów/ID
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  variant="destructive" 
                  className="flex-1"
                  onClick={() => handleDisconnect(selectedChannel.id)}
                >
                  Rozłącz
                </Button>
                <Button className="flex-1">
                  Zapisz
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Settings className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Wybierz kanał z listy aby zobaczyć szczegóły</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
