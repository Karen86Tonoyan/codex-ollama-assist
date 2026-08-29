import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Code, ExternalLink, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const DEFAULT_URL = 'http://localhost:8080';

export function CodeServerPanel() {
  const [url, setUrl] = useState(() => localStorage.getItem('codeserver-url') || DEFAULT_URL);
  const [inputUrl, setInputUrl] = useState(url);
  const [isConnected, setIsConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  const handleConnect = () => {
    const cleanUrl = inputUrl.replace(/\/+$/, '');
    setUrl(cleanUrl);
    localStorage.setItem('codeserver-url', cleanUrl);
    setIsConnected(true);
    setIframeKey(prev => prev + 1);
  };

  const handleRefresh = () => {
    setIframeKey(prev => prev + 1);
  };

  const handleOpenExternal = () => {
    window.open(url, '_blank');
  };

  if (isFullscreen && isConnected) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">VS Code Server</span>
            <Badge variant="secondary" className="text-xs">{url}</Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleOpenExternal}>
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setIsFullscreen(false)}>
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <iframe
          key={iframeKey}
          src={url}
          className="flex-1 w-full border-0"
          title="VS Code Server"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            VS Code Server
          </CardTitle>
          <CardDescription>
            Edycja kodu z poziomu przeglądarki — podłącz się do code-server lub VS Code Server
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="http://localhost:8080"
              onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
            />
            <Button onClick={handleConnect}>
              Połącz
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Uruchom <code className="bg-muted px-1 py-0.5 rounded text-[11px]">code-server</code> lokalnie: 
            {' '}<code className="bg-muted px-1 py-0.5 rounded text-[11px]">npx code-server --auth none --bind-addr 0.0.0.0:8080</code>
          </p>
        </CardContent>
      </Card>

      {isConnected && (
        <Card className="overflow-hidden">
          <CardHeader className="py-2 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="bg-green-500/10 text-green-500">Połączono</Badge>
                <span className="text-xs text-muted-foreground">{url}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={handleRefresh} title="Odśwież">
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleOpenExternal} title="Otwórz w nowej karcie">
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setIsFullscreen(true)} title="Pełny ekran">
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <iframe
              key={iframeKey}
              src={url}
              className={cn("w-full border-0", "h-[calc(100vh-320px)] min-h-[500px]")}
              title="VS Code Server"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
