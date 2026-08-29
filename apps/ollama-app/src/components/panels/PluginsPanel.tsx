import { useState, useEffect, useCallback } from 'react';
import { Puzzle, Play, Loader2, CheckCircle, XCircle, Search, RefreshCw, Code, FileText, Globe, Database, MessageSquare, Wrench, Plus } from 'lucide-react';
import { CustomPluginForm } from '@/components/plugins/CustomPluginForm';
import { PluginParamsDialog } from '@/components/plugins/PluginParamsDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// API Base URL for ALFA Plugin System
const PLUGIN_API_URL = 'http://127.0.0.1:8765';

interface Plugin {
  name: string;
  category: string;
  description: string;
  version: string;
}

interface PluginResult {
  success: boolean;
  plugin: string;
  result: Record<string, unknown>;
  error?: string;
}

interface PluginsPanelProps {
  isConnected: boolean;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  files: FileText,
  coding: Code,
  data: Database,
  web: Globe,
  communication: MessageSquare,
  automation: Wrench,
  ai: Wrench,
  media: Wrench,
  security: Wrench,
  custom: Wrench,
};

const CATEGORY_NAMES: Record<string, string> = {
  files: 'Zarządzanie Plikami',
  coding: 'Kodowanie',
  data: 'Dane i Analiza',
  web: 'Web API',
  communication: 'Komunikacja',
  automation: 'Automatyzacja',
  ai: 'AI / ML',
  media: 'Media',
  security: 'Bezpieczeństwo',
  custom: 'Własne',
};

export function PluginsPanel({ isConnected }: PluginsPanelProps) {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [executingPlugin, setExecutingPlugin] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<PluginResult | null>(null);
  const [rightTab, setRightTab] = useState<'result' | 'create'>('create');
  const [paramsDialogPlugin, setParamsDialogPlugin] = useState<string | null>(null);

  // Fetch plugins from ALFA server
  const fetchPlugins = async () => {
    if (!isConnected) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${PLUGIN_API_URL}/api/plugins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_plugins' }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setPlugins(data.plugins || []);
      }
    } catch (error) {
      console.error('Error fetching plugins:', error);
      // Fallback demo plugins
      setPlugins([
        // === Zarządzanie Plikami (8) ===
        { name: 'pdf-generator', category: 'files', description: 'Generuje PDF z tekstu/markdown', version: '1.0.0' },
        { name: 'doc-converter', category: 'files', description: 'Konwertuje formaty (docx↔pdf↔txt↔md)', version: '1.0.0' },
        { name: 'batch-rename', category: 'files', description: 'Masowa zmiana nazw plików', version: '1.0.0' },
        { name: 'file-organizer', category: 'files', description: 'Sortuje pliki do folderów po typie', version: '1.0.0' },
        { name: 'backup-auto', category: 'files', description: 'Automatyczny backup do folderu/chmury', version: '1.0.0' },
        { name: 'zip-manager', category: 'files', description: 'Pakuje/rozpakowuje archiwa', version: '1.0.0' },
        { name: 'file-watcher', category: 'files', description: 'Monitoruje zmiany w folderach', version: '1.0.0' },
        { name: 'file-sync', category: 'files', description: 'Synchronizacja plików między folderami', version: '1.0.0' },
        // === Kodowanie (8) ===
        { name: 'code-generator', category: 'coding', description: 'Generuje kod z opisu (Python/JS/C#)', version: '1.0.0' },
        { name: 'code-reviewer', category: 'coding', description: 'Sprawdza kod, znajduje błędy i problemy bezpieczeństwa', version: '1.0.0' },
        { name: 'git-auto', category: 'coding', description: 'Auto commit/push/pull z AI wiadomościami', version: '1.0.0' },
        { name: 'docker-builder', category: 'coding', description: 'Generuje Dockerfile z opisu', version: '1.0.0' },
        { name: 'api-tester', category: 'coding', description: 'Testuje endpointy REST', version: '1.0.0' },
        { name: 'env-manager', category: 'coding', description: 'Zarządza zmiennymi środowiskowymi', version: '1.0.0' },
        { name: 'regex-builder', category: 'coding', description: 'Generuje i testuje wyrażenia regularne', version: '1.0.0' },
        { name: 'sql-generator', category: 'coding', description: 'Generuje zapytania SQL z opisu', version: '1.0.0' },
        // === Dane i Analiza (8) ===
        { name: 'csv-processor', category: 'data', description: 'Przetwarza i filtruje CSV', version: '1.0.0' },
        { name: 'excel-auto', category: 'data', description: 'Automatyzacja Excel (makra)', version: '1.0.0' },
        { name: 'json-transformer', category: 'data', description: 'Konwertuje i mapuje JSON', version: '1.0.0' },
        { name: 'data-scraper', category: 'data', description: 'Scrapuje dane ze stron', version: '1.0.0' },
        { name: 'report-generator', category: 'data', description: 'Generuje raporty z danych', version: '1.0.0' },
        { name: 'chart-creator', category: 'data', description: 'Tworzy wykresy z danych', version: '1.0.0' },
        { name: 'data-cleaner', category: 'data', description: 'Czyści i normalizuje dane', version: '1.0.0' },
        { name: 'db-migrator', category: 'data', description: 'Migracja danych między bazami', version: '1.0.0' },
        // === Web i API (8) ===
        { name: 'web-monitor', category: 'web', description: 'Monitoruje strony (zmiany, dostępność)', version: '1.0.0' },
        { name: 'price-tracker', category: 'web', description: 'Śledzi ceny produktów', version: '1.0.0' },
        { name: 'rss-reader', category: 'web', description: 'Agreguje RSS/Atom', version: '1.0.0' },
        { name: 'webhook-sender', category: 'web', description: 'Wysyła webhooks', version: '1.0.0' },
        { name: 'api-bridge', category: 'web', description: 'Łączy różne API', version: '1.0.0' },
        { name: 'sitemap-gen', category: 'web', description: 'Generuje sitemapy XML', version: '1.0.0' },
        { name: 'url-shortener', category: 'web', description: 'Skraca URL-e z trackingiem', version: '1.0.0' },
        { name: 'cors-proxy', category: 'web', description: 'Proxy CORS dla zapytań cross-origin', version: '1.0.0' },
        // === Komunikacja (6) ===
        { name: 'email-sender', category: 'communication', description: 'Wysyła maile (SMTP)', version: '1.0.0' },
        { name: 'email-parser', category: 'communication', description: 'Parsuje i filtruje maile', version: '1.0.0' },
        { name: 'telegram-bot', category: 'communication', description: 'Bot Telegram', version: '1.0.0' },
        { name: 'discord-bot', category: 'communication', description: 'Bot Discord', version: '1.0.0' },
        { name: 'sms-sender', category: 'communication', description: 'Wysyła SMS (API)', version: '1.0.0' },
        { name: 'notification-hub', category: 'communication', description: 'Centralne powiadomienia', version: '1.0.0' },
        // === Automatyzacja (6) ===
        { name: 'task-scheduler', category: 'automation', description: 'Planowanie zadań cron', version: '1.0.0' },
        { name: 'screen-capture', category: 'automation', description: 'Zrzuty ekranu i nagrywanie', version: '1.0.0' },
        { name: 'keyboard-macro', category: 'automation', description: 'Makra klawiszowe i mouse', version: '1.0.0' },
        { name: 'process-killer', category: 'automation', description: 'Zarządzanie procesami systemu', version: '1.0.0' },
        { name: 'clipboard-manager', category: 'automation', description: 'Historia schowka z wyszukiwaniem', version: '1.0.0' },
        { name: 'auto-typer', category: 'automation', description: 'Automatyczne wpisywanie tekstu', version: '1.0.0' },
        // === AI / ML (4) ===
        { name: 'text-summarizer', category: 'ai', description: 'Streszcza długie teksty AI', version: '1.0.0' },
        { name: 'sentiment-analyzer', category: 'ai', description: 'Analiza sentymentu tekstu', version: '1.0.0' },
        { name: 'translator', category: 'ai', description: 'Tłumaczenie tekstu AI (50+ języków)', version: '1.0.0' },
        { name: 'ocr-reader', category: 'ai', description: 'Rozpoznaje tekst z obrazów (OCR)', version: '1.0.0' },
        // === Media (4) ===
        { name: 'image-resizer', category: 'media', description: 'Zmiana rozmiaru i kompresja obrazów', version: '1.0.0' },
        { name: 'watermark-add', category: 'media', description: 'Dodaje watermark do obrazów', version: '1.0.0' },
        { name: 'audio-converter', category: 'media', description: 'Konwersja formatów audio', version: '1.0.0' },
        { name: 'video-trimmer', category: 'media', description: 'Przycinanie i łączenie wideo', version: '1.0.0' },
        // === Bezpieczeństwo (4) ===
        { name: 'password-gen', category: 'security', description: 'Generator silnych haseł', version: '1.0.0' },
        { name: 'hash-checker', category: 'security', description: 'Oblicza i weryfikuje hashe plików', version: '1.0.0' },
        { name: 'port-scanner', category: 'security', description: 'Skanuje otwarte porty', version: '1.0.0' },
        { name: 'ssl-checker', category: 'security', description: 'Sprawdza certyfikaty SSL', version: '1.0.0' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlugins();
  }, [isConnected]);

  const executePlugin = async (pluginName: string, params: Record<string, unknown> = {}) => {
    setExecutingPlugin(pluginName);
    setLastResult(null);
    setParamsDialogPlugin(null);

    try {
      const response = await fetch(`${PLUGIN_API_URL}/api/plugins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'execute',
          plugin: pluginName,
          params,
        }),
      });
      
      const data = await response.json();
      setLastResult(data);
      setRightTab('result');
    } catch (error) {
      setLastResult({
        success: false,
        plugin: pluginName,
        result: {},
        error: error instanceof Error ? error.message : 'Błąd wykonania pluginu',
      });
      setRightTab('result');
    } finally {
      setExecutingPlugin(null);
    }
  };

  // Group plugins by category
  const categories = [...new Set(plugins.map(p => p.category))];
  
  const filteredPlugins = plugins.filter(plugin => {
    const matchesSearch = plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          plugin.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || plugin.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedPlugins = filteredPlugins.reduce((acc, plugin) => {
    if (!acc[plugin.category]) acc[plugin.category] = [];
    acc[plugin.category].push(plugin);
    return acc;
  }, {} as Record<string, Plugin[]>);

  return (
    <div className="grid h-full gap-4 lg:grid-cols-3">
      {/* Lista Pluginów */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Puzzle className="h-5 w-5" />
              Wtyczki ALFA
              <Badge variant="secondary">{plugins.length}</Badge>
            </CardTitle>
            <Button 
              variant="outline" 
              size="icon"
              onClick={fetchPlugins}
              disabled={isLoading || !isConnected}
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
          </div>
          <CardDescription>
            System wtyczek AI z integracją Ollama, Gemini, GPT i Claude
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search & Filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Szukaj wtyczek..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Category Tabs */}
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="all" className="text-xs">Wszystkie</TabsTrigger>
              {categories.map(cat => (
                <TabsTrigger key={cat} value={cat} className="text-xs gap-1">
                  {(() => {
                    const Icon = CATEGORY_ICONS[cat] || Puzzle;
                    return <Icon className="h-3 w-3" />;
                  })()}
                  {CATEGORY_NAMES[cat] || cat}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={selectedCategory} className="mt-4">
              <ScrollArea className="h-[400px] pr-4">
                {!isConnected ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <XCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Brak połączenia z serwerem ALFA</p>
                    <p className="text-xs mt-1">Uruchom serwer na porcie 8765</p>
                  </div>
                ) : Object.keys(groupedPlugins).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Puzzle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nie znaleziono wtyczek</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(groupedPlugins).map(([category, categoryPlugins]) => (
                      <div key={category}>
                        <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                          {(() => {
                            const Icon = CATEGORY_ICONS[category] || Puzzle;
                            return <Icon className="h-4 w-4" />;
                          })()}
                          {CATEGORY_NAMES[category] || category}
                        </h3>
                        <div className="grid gap-2">
                          {categoryPlugins.map((plugin) => (
                            <Card 
                              key={plugin.name}
                              className={cn(
                                "cursor-pointer transition-colors hover:bg-muted/50",
                                executingPlugin === plugin.name && "border-primary"
                              )}
                            >
                              <CardContent className="p-3 flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-sm font-medium truncate">
                                      {plugin.name}
                                    </span>
                                    <Badge variant="outline" className="text-xs">
                                      v{plugin.version}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                                    {plugin.description}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setParamsDialogPlugin(plugin.name)}
                                  disabled={executingPlugin === plugin.name || !isConnected}
                                >
                                  {executingPlugin === plugin.name ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Play className="h-4 w-4" />
                                  )}
                                </Button>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Right Panel */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={rightTab === 'create' ? 'default' : 'ghost'}
              onClick={() => setRightTab('create')}
              className="text-xs h-7"
            >
              <Plus className="h-3 w-3 mr-1" />
              Nowy Plugin
            </Button>
            <Button
              size="sm"
              variant={rightTab === 'result' ? 'default' : 'ghost'}
              onClick={() => setRightTab('result')}
              className="text-xs h-7"
            >
              Wynik
              {lastResult && <Badge variant="secondary" className="ml-1 h-4 text-[10px]">1</Badge>}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rightTab === 'create' ? (
            <CustomPluginForm
              onPluginCreated={(p) => {
                setPlugins(prev => [...prev, p]);
              }}
            />
          ) : lastResult ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {lastResult.success ? (
                  <CheckCircle className="h-5 w-5 text-primary" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <span className="font-mono text-sm">{lastResult.plugin}</span>
              </div>
              {lastResult.error && (
                <p className="text-sm text-destructive">{lastResult.error}</p>
              )}
              <ScrollArea className="h-[300px]">
                <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
                  {JSON.stringify(lastResult.result, null, 2)}
                </pre>
              </ScrollArea>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Play className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">Kliknij przycisk ▶ aby uruchomić wtyczkę</p>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Params Dialog */}
      {paramsDialogPlugin && (
        <PluginParamsDialog
          open={!!paramsDialogPlugin}
          onOpenChange={(open) => { if (!open) setParamsDialogPlugin(null); }}
          pluginName={paramsDialogPlugin}
          isExecuting={!!executingPlugin}
          onExecute={(params) => executePlugin(paramsDialogPlugin, params)}
        />
      )}
    </div>
  );
}
