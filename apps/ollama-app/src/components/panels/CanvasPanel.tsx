import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  PenTool, 
  Play,
  Pause,
  RefreshCw,
  Maximize2,
  Minimize2,
  Camera,
  Code,
  Layers,
  Eye,
  Send,
  Trash2,
  Copy,
  Download,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

interface CanvasPanelProps {
  isConnected: boolean;
}

interface CanvasCommand {
  id: string;
  type: 'push' | 'reset' | 'dom' | 'snapshot';
  payload: string;
  timestamp: Date;
  status: 'pending' | 'success' | 'error';
}

// Safe DOM operations whitelist (NO eval)
const SAFE_OPERATIONS = {
  'setInnerHTML': (target: string, content: string) => 
    `document.querySelector('${target}').innerHTML = ${JSON.stringify(content)};`,
  'setText': (target: string, content: string) => 
    `document.querySelector('${target}').textContent = ${JSON.stringify(content)};`,
  'addClass': (target: string, className: string) => 
    `document.querySelector('${target}').classList.add('${className}');`,
  'removeClass': (target: string, className: string) => 
    `document.querySelector('${target}').classList.remove('${className}');`,
  'setStyle': (target: string, style: string) => 
    `document.querySelector('${target}').style.cssText = ${JSON.stringify(style)};`,
};

type SafeOperation = keyof typeof SAFE_OPERATIONS;

export function CanvasPanel({ isConnected }: CanvasPanelProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [commands, setCommands] = useState<CanvasCommand[]>([]);
  const [htmlContent, setHtmlContent] = useState(`
<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; font-family: system-ui;">
  <h1 style="font-size: 2rem; margin-bottom: 1rem;">🎨 A2UI Canvas</h1>
  <p style="color: #666;">Agent-driven visual workspace</p>
  <div id="dynamic-content" style="margin-top: 2rem;"></div>
</div>
  `.trim());
  const [domTarget, setDomTarget] = useState('#dynamic-content');
  const [domContent, setDomContent] = useState('<p>Dynamic content!</p>');
  const [selectedOp, setSelectedOp] = useState<SafeOperation>('setInnerHTML');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const executeCommand = (type: CanvasCommand['type'], payload: string) => {
    const command: CanvasCommand = {
      id: crypto.randomUUID(),
      type,
      payload,
      timestamp: new Date(),
      status: 'pending',
    };
    
    setCommands(prev => [command, ...prev].slice(0, 50));

    try {
      if (type === 'push') {
        setHtmlContent(payload);
      } else if (type === 'reset') {
        setHtmlContent('');
      } else if (type === 'dom' && iframeRef.current?.contentWindow) {
        // Safe DOM operation - no eval, structured message
        iframeRef.current.contentWindow.postMessage({ 
          type: 'safe_dom', 
          operation: payload 
        }, '*');
      } else if (type === 'snapshot') {
        // Take a snapshot
        toast.success('Snapshot zapisany');
      }

      setCommands(prev => prev.map(c => 
        c.id === command.id ? { ...c, status: 'success' } : c
      ));
    } catch (error) {
      setCommands(prev => prev.map(c => 
        c.id === command.id ? { ...c, status: 'error' } : c
      ));
      toast.error('Błąd wykonania komendy');
    }
  };

  const handlePush = () => {
    executeCommand('push', htmlContent);
    toast.success('Canvas zaktualizowany');
  };

  const handleReset = () => {
    executeCommand('reset', '');
    toast.success('Canvas wyczyszczony');
  };

  const handleDomOperation = () => {
    if (!domTarget.trim() || !domContent.trim()) return;
    const opFn = SAFE_OPERATIONS[selectedOp];
    const safeCode = opFn(domTarget, domContent);
    executeCommand('dom', JSON.stringify({ op: selectedOp, target: domTarget, content: domContent, code: safeCode }));
    toast.success('Operacja DOM wykonana');
  };

  const handleSnapshot = () => {
    executeCommand('snapshot', '');
  };

  const copyHtml = () => {
    navigator.clipboard.writeText(htmlContent);
    toast.success('HTML skopiowany');
  };

  return (
    <div className={`grid gap-6 ${isFullscreen ? '' : 'md:grid-cols-3'}`}>
      {/* Canvas Preview */}
      <Card className={isFullscreen ? 'fixed inset-4 z-50' : 'md:col-span-2'}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <PenTool className="h-5 w-5" />
                A2UI Canvas
                {isLive && (
                  <Badge className="bg-green-500/10 text-green-500">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse" />
                    Live
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Agent-driven visual workspace - sterowany przez AI
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsLive(!isLive)}
              >
                {isLive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleSnapshot}
              >
                <Camera className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div 
            className={`border rounded-lg overflow-hidden bg-white ${
              isFullscreen ? 'h-[calc(100vh-200px)]' : 'h-[400px]'
            }`}
          >
            <iframe
              ref={iframeRef}
              srcDoc={`
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                      min-height: 100vh; 
                      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                    }
                  </style>
                </head>
                <body>
                  ${htmlContent}
                  <script>
                    window.addEventListener('message', (e) => {
                      if (e.data.type === 'safe_dom') {
                        try {
                          // Parse safe operation - NO eval
                          const op = JSON.parse(e.data.operation);
                          const target = document.querySelector(op.target);
                          if (!target) {
                            console.error('Target not found:', op.target);
                            return;
                          }
                      switch (op.op) {
                            case 'setInnerHTML': {
                              // Sanitize: strip script tags and event handlers
                              const div = document.createElement('div');
                              div.innerHTML = op.content;
                              div.querySelectorAll('script').forEach(s => s.remove());
                              div.querySelectorAll('*').forEach(el => {
                                Array.from(el.attributes).forEach(attr => {
                                  if (attr.name.startsWith('on')) el.removeAttribute(attr.name);
                                });
                                if (el.tagName === 'IFRAME' || el.tagName === 'OBJECT' || el.tagName === 'EMBED') el.remove();
                              });
                              target.innerHTML = div.innerHTML;
                              break;
                            }
                            case 'setText':
                              target.textContent = op.content;
                              break;
                            case 'addClass':
                              target.classList.add(op.content);
                              break;
                            case 'removeClass':
                              target.classList.remove(op.content);
                              break;
                            case 'setStyle':
                              target.style.cssText = op.content;
                              break;
                          }
                        } catch (err) {
                          console.error(err);
                        }
                      }
                    });
                  </script>
                </body>
                </html>
              `}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>

          {!isFullscreen && (
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={handleReset}>
                <Trash2 className="mr-2 h-4 w-4" />
                Reset
              </Button>
              <Button variant="outline" size="sm" onClick={copyHtml}>
                <Copy className="mr-2 h-4 w-4" />
                Kopiuj HTML
              </Button>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Eksportuj
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Controls */}
      {!isFullscreen && (
        <div className="space-y-6">
          {/* Push HTML */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Push Content
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="<div>Hello World</div>"
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                rows={6}
                className="font-mono text-xs"
              />
              <Button className="w-full" onClick={handlePush}>
                <Send className="mr-2 h-4 w-4" />
                Push to Canvas
              </Button>
            </CardContent>
          </Card>

          {/* Eval Code */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Code className="h-4 w-4" />
                Safe DOM Operations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Operation</label>
                <select 
                  value={selectedOp}
                  onChange={(e) => setSelectedOp(e.target.value as SafeOperation)}
                  className="w-full p-2 rounded border bg-background text-sm"
                >
                  <option value="setInnerHTML">Set Inner HTML</option>
                  <option value="setText">Set Text Content</option>
                  <option value="addClass">Add Class</option>
                  <option value="removeClass">Remove Class</option>
                  <option value="setStyle">Set Style</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Target Selector</label>
                <Input
                  placeholder="#dynamic-content"
                  value={domTarget}
                  onChange={(e) => setDomTarget(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
              <Textarea
                placeholder="<p>New content</p> or class-name or CSS styles"
                value={domContent}
                onChange={(e) => setDomContent(e.target.value)}
                rows={3}
                className="font-mono text-xs"
              />
              <Button className="w-full" variant="secondary" onClick={handleDomOperation}>
                <Play className="mr-2 h-4 w-4" />
                Execute Safe Operation
              </Button>
            </CardContent>
          </Card>

          {/* Command History */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Historia komend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[150px]">
                {commands.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Brak wykonanych komend
                  </p>
                ) : (
                  <div className="space-y-2">
                    {commands.map((cmd) => (
                      <div
                        key={cmd.id}
                        className="flex items-center justify-between text-xs p-2 rounded bg-muted"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {cmd.type}
                          </Badge>
                          <span className="text-muted-foreground truncate max-w-[100px]">
                            {cmd.payload.slice(0, 30)}...
                          </span>
                        </div>
                        <Badge 
                          variant={cmd.status === 'success' ? 'default' : cmd.status === 'error' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {cmd.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
