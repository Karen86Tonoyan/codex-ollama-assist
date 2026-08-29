import { useState, useEffect } from 'react';
import { 
  Server, 
  Play, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Plus, 
  Trash2,
  RefreshCw,
  Wrench,
  Link,
  Unlink,
  ChevronDown,
  ChevronRight,
  Terminal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { 
  getMCPServers, 
  addMCPServer, 
  removeMCPServer, 
  connectMCPServer,
  executeMCPTool,
  type MCPServer, 
  type MCPTool,
  type MCPToolResult 
} from '@/lib/mcp';

interface MCPPanelProps {
  isConnected: boolean;
}

export function MCPPanel({ isConnected }: MCPPanelProps) {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());
  const [selectedTool, setSelectedTool] = useState<{ server: MCPServer; tool: MCPTool } | null>(null);
  const [toolParams, setToolParams] = useState<Record<string, string>>({});
  const [executingTool, setExecutingTool] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<MCPToolResult | null>(null);
  
  // Add server form
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [newServerUrl, setNewServerUrl] = useState('');

  const fetchServers = async () => {
    setIsLoading(true);
    try {
      const data = await getMCPServers();
      setServers(data);
    } catch (error) {
      console.error('Error fetching MCP servers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  const toggleServer = (serverId: string) => {
    setExpandedServers(prev => {
      const next = new Set(prev);
      if (next.has(serverId)) {
        next.delete(serverId);
      } else {
        next.add(serverId);
      }
      return next;
    });
  };

  const handleConnect = async (server: MCPServer) => {
    try {
      const updated = await connectMCPServer(server.id);
      setServers(prev => prev.map(s => s.id === server.id ? updated : s));
    } catch (error) {
      console.error('Connection failed:', error);
    }
  };

  const handleRemove = async (serverId: string) => {
    try {
      await removeMCPServer(serverId);
      setServers(prev => prev.filter(s => s.id !== serverId));
    } catch (error) {
      console.error('Remove failed:', error);
    }
  };

  const handleAddServer = async () => {
    if (!newServerName.trim() || !newServerUrl.trim()) return;
    
    try {
      const server = await addMCPServer(newServerName, newServerUrl);
      setServers(prev => [...prev, server]);
      setNewServerName('');
      setNewServerUrl('');
      setShowAddDialog(false);
    } catch (error) {
      console.error('Add server failed:', error);
    }
  };

  const handleExecuteTool = async () => {
    if (!selectedTool) return;

    setExecutingTool(selectedTool.tool.name);
    setLastResult(null);

    try {
      const result = await executeMCPTool(
        selectedTool.server.id,
        selectedTool.tool.name,
        toolParams
      );
      setLastResult(result);
    } catch (error) {
      setLastResult({
        success: false,
        content: [],
        error: error instanceof Error ? error.message : 'Błąd wykonania',
      });
    } finally {
      setExecutingTool(null);
    }
  };

  const selectTool = (server: MCPServer, tool: MCPTool) => {
    setSelectedTool({ server, tool });
    setToolParams({});
    setLastResult(null);
  };

  const getStatusBadge = (status: MCPServer['status']) => {
    switch (status) {
      case 'connected':
        return <Badge variant="default">Połączony</Badge>;
      case 'disconnected':
        return <Badge variant="secondary">Rozłączony</Badge>;
      case 'error':
        return <Badge variant="destructive">Błąd</Badge>;
    }
  };

  return (
    <div className="grid h-full gap-4 lg:grid-cols-3">
      {/* Lista Serwerów MCP */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Serwery MCP
              <Badge variant="secondary">{servers.length}</Badge>
            </CardTitle>
            <div className="flex gap-1">
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Dodaj Serwer MCP</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Nazwa</Label>
                      <Input
                        placeholder="np. File System"
                        value={newServerName}
                        onChange={(e) => setNewServerName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>URL</Label>
                      <Input
                        placeholder="http://localhost:3001"
                        value={newServerUrl}
                        onChange={(e) => setNewServerUrl(e.target.value)}
                      />
                    </div>
                    <Button className="w-full" onClick={handleAddServer}>
                      <Plus className="h-4 w-4 mr-2" />
                      Dodaj Serwer
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button 
                variant="outline" 
                size="icon"
                onClick={fetchServers}
                disabled={isLoading}
              >
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
            </div>
          </div>
          <CardDescription>
            Model Context Protocol - rozszerzanie możliwości AI poprzez narzędzia
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[450px] pr-4">
            {servers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Brak skonfigurowanych serwerów MCP</p>
                <p className="text-xs mt-1">Kliknij + aby dodać serwer</p>
              </div>
            ) : (
              <div className="space-y-3">
                {servers.map((server) => (
                  <Collapsible
                    key={server.id}
                    open={expandedServers.has(server.id)}
                    onOpenChange={() => toggleServer(server.id)}
                  >
                    <Card className="border">
                      <CardHeader className="p-3">
                        <div className="flex items-center justify-between">
                          <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-70">
                            {expandedServers.has(server.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <Server className="h-4 w-4" />
                            <span className="font-medium">{server.name}</span>
                            {getStatusBadge(server.status)}
                          </CollapsibleTrigger>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleConnect(server)}
                              title={server.status === 'connected' ? 'Rozłącz' : 'Połącz'}
                            >
                              {server.status === 'connected' ? (
                                <Unlink className="h-4 w-4" />
                              ) : (
                                <Link className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleRemove(server.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {server.description && (
                          <p className="text-xs text-muted-foreground pl-6">
                            {server.description}
                          </p>
                        )}
                      </CardHeader>
                      
                      <CollapsibleContent>
                        <CardContent className="pt-0 pb-3">
                          <div className="text-xs text-muted-foreground mb-2 pl-6">
                            URL: {server.url}
                          </div>
                          <div className="pl-6 space-y-2">
                            <div className="text-xs font-medium flex items-center gap-1">
                              <Wrench className="h-3 w-3" />
                              Narzędzia ({server.tools.length})
                            </div>
                            <div className="grid gap-1">
                              {server.tools.map((tool) => (
                                <button
                                  key={tool.name}
                                  onClick={() => selectTool(server, tool)}
                                  className={cn(
                                    "text-left p-2 rounded-md text-xs transition-colors",
                                    "hover:bg-muted/50 border",
                                    selectedTool?.tool.name === tool.name && 
                                    selectedTool?.server.id === server.id && 
                                    "border-primary bg-primary/5"
                                  )}
                                >
                                  <div className="font-mono font-medium">{tool.name}</div>
                                  <div className="text-muted-foreground">{tool.description}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Panel Wykonania Narzędzia */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            Wykonanie Narzędzia
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedTool ? (
            <div className="space-y-4">
              <div>
                <div className="font-mono text-sm font-medium">
                  {selectedTool.tool.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {selectedTool.tool.description}
                </div>
              </div>

              {/* Parameters */}
              <div className="space-y-3">
                {Object.entries(selectedTool.tool.inputSchema.properties).map(([key, prop]) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs">
                      {key}
                      {selectedTool.tool.inputSchema.required?.includes(key) && (
                        <span className="text-destructive ml-1">*</span>
                      )}
                    </Label>
                    <Input
                      placeholder={prop.description}
                      value={toolParams[key] || ''}
                      onChange={(e) => setToolParams(prev => ({ ...prev, [key]: e.target.value }))}
                      className="text-sm"
                    />
                  </div>
                ))}
              </div>

              <Button 
                className="w-full"
                onClick={handleExecuteTool}
                disabled={executingTool !== null || selectedTool.server.status !== 'connected'}
              >
                {executingTool ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Wykonaj
              </Button>

              {/* Result */}
              {lastResult && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {lastResult.success ? (
                      <CheckCircle className="h-4 w-4 text-primary" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span className="text-sm font-medium">
                      {lastResult.success ? 'Sukces' : 'Błąd'}
                    </span>
                  </div>
                  
                  {lastResult.error && (
                    <p className="text-xs text-destructive">{lastResult.error}</p>
                  )}
                  
                  <ScrollArea className="h-[200px]">
                    <pre className="text-xs bg-muted p-2 rounded-md overflow-x-auto">
                      {lastResult.content.map((c, i) => (
                        <div key={i}>{c.text || JSON.stringify(c, null, 2)}</div>
                      ))}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">Wybierz narzędzie z listy</p>
              <p className="text-xs mt-1">aby skonfigurować i wykonać</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
