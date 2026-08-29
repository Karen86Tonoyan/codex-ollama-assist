import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Laptop, 
  Smartphone, 
  Tablet,
  Monitor,
  RefreshCw,
  QrCode,
  Camera,
  Video,
  MapPin,
  Bell,
  Terminal,
  Wifi,
  WifiOff,
  Clock,
  Loader2,
  Play,
} from 'lucide-react';
import { getNodes, invokeNode, pairNode, type DeviceNode } from '@/lib/gateway';
import { toast } from 'sonner';

interface NodesPanelProps {
  isConnected: boolean;
}

const DEVICE_ICONS: Record<DeviceNode['type'], React.ElementType> = {
  macos: Laptop,
  ios: Smartphone,
  android: Smartphone,
  windows: Monitor,
  linux: Terminal,
};

const DEVICE_COLORS: Record<DeviceNode['type'], string> = {
  macos: 'bg-gray-500',
  ios: 'bg-blue-500',
  android: 'bg-green-500',
  windows: 'bg-sky-500',
  linux: 'bg-orange-500',
};

const CAPABILITY_ICONS: Record<string, React.ElementType> = {
  'system.run': Terminal,
  'system.notify': Bell,
  'camera': Camera,
  'screen.record': Video,
  'location': MapPin,
  'canvas': Monitor,
  'notifications': Bell,
};

export function NodesPanel({ isConnected }: NodesPanelProps) {
  const [nodes, setNodes] = useState<DeviceNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<DeviceNode | null>(null);
  const [pairing, setPairing] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [invoking, setInvoking] = useState<string | null>(null);

  useEffect(() => {
    loadNodes();
    const interval = setInterval(loadNodes, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadNodes = async () => {
    try {
      const data = await getNodes();
      setNodes(data);
    } catch (error) {
      console.error('Failed to load nodes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePair = async () => {
    setPairing(true);
    try {
      const result = await pairNode();
      setPairingCode(result.code);
      toast.success('Kod parowania wygenerowany');
    } catch (error) {
      toast.error('Nie udało się wygenerować kodu');
    } finally {
      setPairing(false);
    }
  };

  const handleInvoke = async (nodeId: string, action: string) => {
    setInvoking(`${nodeId}-${action}`);
    try {
      const result = await invokeNode(nodeId, action);
      toast.success(`Akcja ${action} wykonana`);
      console.log('Node invoke result:', result);
    } catch (error) {
      toast.error(`Nie udało się wykonać akcji ${action}`);
    } finally {
      setInvoking(null);
    }
  };

  const getStatusBadge = (status: DeviceNode['status']) => {
    switch (status) {
      case 'online':
        return (
          <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">
            <Wifi className="h-3 w-3 mr-1" />
            Online
          </Badge>
        );
      case 'pairing':
        return (
          <Badge variant="outline" className="text-yellow-500 border-yellow-500">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Parowanie
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <WifiOff className="h-3 w-3 mr-1" />
            Offline
          </Badge>
        );
    }
  };

  const onlineNodes = nodes.filter(n => n.status === 'online');
  const offlineNodes = nodes.filter(n => n.status === 'offline');

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Nodes List */}
      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Laptop className="h-5 w-5" />
                Device Nodes
              </CardTitle>
              <CardDescription>
                Zarządzaj urządzeniami - macOS, iOS, Android, Windows
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadNodes}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={handlePair} disabled={pairing}>
                {pairing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <QrCode className="mr-2 h-4 w-4" />
                )}
                Sparuj urządzenie
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : nodes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Smartphone className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Brak sparowanych urządzeń</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={handlePair}
              >
                <QrCode className="mr-2 h-4 w-4" />
                Sparuj pierwsze urządzenie
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-6">
                {/* Online Nodes */}
                {onlineNodes.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-3 text-green-500 flex items-center gap-2">
                      <Wifi className="h-4 w-4" />
                      Online ({onlineNodes.length})
                    </h3>
                    <div className="space-y-3">
                      {onlineNodes.map((node) => {
                        const Icon = DEVICE_ICONS[node.type];
                        const bgColor = DEVICE_COLORS[node.type];
                        
                        return (
                          <div
                            key={node.id}
                            className={`p-4 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                              selectedNode?.id === node.id ? 'border-primary bg-muted/30' : ''
                            }`}
                            onClick={() => setSelectedNode(node)}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-lg ${bgColor}`}>
                                  <Icon className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{node.name}</span>
                                    {getStatusBadge(node.status)}
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {node.type.toUpperCase()}
                                    {node.ip && ` · ${node.ip}`}
                                  </p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-1">
                              {node.capabilities.map(cap => {
                                const CapIcon = CAPABILITY_ICONS[cap] || Terminal;
                                return (
                                  <Badge key={cap} variant="outline" className="text-xs gap-1">
                                    <CapIcon className="h-3 w-3" />
                                    {cap}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Offline Nodes */}
                {offlineNodes.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-3 text-muted-foreground flex items-center gap-2">
                      <WifiOff className="h-4 w-4" />
                      Offline ({offlineNodes.length})
                    </h3>
                    <div className="space-y-3">
                      {offlineNodes.map((node) => {
                        const Icon = DEVICE_ICONS[node.type];
                        
                        return (
                          <div
                            key={node.id}
                            className="p-4 rounded-lg border opacity-60"
                          >
                            <div className="flex items-center gap-4">
                              <div className="p-2 rounded-lg bg-muted">
                                <Icon className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{node.name}</span>
                                  {getStatusBadge(node.status)}
                                </div>
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Ostatnio: {node.lastSeen ? new Date(node.lastSeen).toLocaleString('pl-PL') : 'Nigdy'}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Node Details / Pairing */}
      <Card>
        <CardHeader>
          <CardTitle>
            {pairingCode ? 'Kod parowania' : selectedNode ? 'Akcje urządzenia' : 'Wybierz urządzenie'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pairingCode ? (
            <div className="space-y-4 text-center">
              <div className="p-8 bg-muted rounded-lg">
                <p className="text-4xl font-mono font-bold tracking-widest">
                  {pairingCode}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Wpisz ten kod w aplikacji na urządzeniu mobilnym
              </p>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setPairingCode(null)}
              >
                Zamknij
              </Button>
            </div>
          ) : selectedNode ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {(() => {
                  const Icon = DEVICE_ICONS[selectedNode.type];
                  return (
                    <div className={`p-3 rounded-lg ${DEVICE_COLORS[selectedNode.type]}`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                  );
                })()}
                <div>
                  <h3 className="font-semibold">{selectedNode.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedNode.type.toUpperCase()}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-sm font-medium">Dostępne akcje:</p>
                
                {selectedNode.capabilities.map(cap => {
                  const CapIcon = CAPABILITY_ICONS[cap] || Terminal;
                  const isInvoking = invoking === `${selectedNode.id}-${cap}`;
                  
                  return (
                    <Button
                      key={cap}
                      variant="outline"
                      className="w-full justify-start"
                      disabled={selectedNode.status !== 'online' || isInvoking}
                      onClick={() => handleInvoke(selectedNode.id, cap)}
                    >
                      {isInvoking ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CapIcon className="mr-2 h-4 w-4" />
                      )}
                      {cap}
                      <Play className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  );
                })}
              </div>

              {selectedNode.status !== 'online' && (
                <p className="text-sm text-muted-foreground text-center">
                  Urządzenie jest offline. Akcje będą dostępne po połączeniu.
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Tablet className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Wybierz urządzenie z listy aby zobaczyć dostępne akcje</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
