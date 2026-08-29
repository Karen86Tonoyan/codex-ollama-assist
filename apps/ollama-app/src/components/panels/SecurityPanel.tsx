import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { 
  Shield, 
  Dog, 
  Eye, 
  Target, 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Zap,
  Bug,
  Lock,
  Unlock,
  Volume2,
  VolumeX,
  Brain,
  Activity,
  SkullIcon,
  Sparkles,
  TrendingUp,
  Radio,
  UserPlus,
  UserMinus,
  ShieldAlert,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  getCerberStatus,
  getOllamaConsciences,
  processWithCerber,
  punishOllama,
  getGuardianStatus,
  scanForThreats,
  triggerKillSwitch,
  reconnectWifi,
  getLasuchStatus,
  activateHoneypot,
  getSystemSecurityStatus,
  type CerberStatus,
  type GuardianStatus,
  type LasuchStatus,
  type OllamaConscience,
  type TrappedThreat,
} from '@/lib/security-api';
import { noiseShield, type NoiseShieldState } from '@/lib/cerber-noise-shield';

interface SecurityPanelProps {
  isConnected: boolean;
}

export function SecurityPanel({ isConnected }: SecurityPanelProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(false);
  
  // Status states
  const [cerberStatus, setCerberStatus] = useState<CerberStatus | null>(null);
  const [guardianStatus, setGuardianStatus] = useState<GuardianStatus | null>(null);
  const [lasuchStatus, setLasuchStatus] = useState<LasuchStatus | null>(null);
  const [consciences, setConsciences] = useState<OllamaConscience[]>([]);
  const [overallHealth, setOverallHealth] = useState<'secure' | 'warning' | 'critical' | 'isolated'>('secure');

  // Cerber test state
  const [testPrompt, setTestPrompt] = useState('');
  const [testMode, setTestMode] = useState<'safe_text' | 'audio' | 'video' | 'browser' | 'coding' | 'system'>('safe_text');
  const [testResult, setTestResult] = useState<string | null>(null);

  // Noise Shield state
  const [shieldState, setShieldState] = useState<NoiseShieldState>(noiseShield.getState());
  const [passphraseInput, setPassphraseInput] = useState('');
  const [unlockInput, setUnlockInput] = useState('');
  const [newWhitelistName, setNewWhitelistName] = useState('');
  const [newWhitelistId, setNewWhitelistId] = useState('');

  useEffect(() => {
    return noiseShield.subscribe(setShieldState);
  }, []);

  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const status = await getSystemSecurityStatus();
      setCerberStatus(status.cerber);
      setGuardianStatus(status.guardian);
      setLasuchStatus(status.lasuch);
      setOverallHealth(status.overallHealth);

      const cons = await getOllamaConsciences();
      setConsciences(cons);
    } catch (error) {
      console.error('Failed to refresh security status:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 10000);
    return () => clearInterval(interval);
  }, [refreshStatus]);

  const handleCerberTest = async () => {
    if (!testPrompt.trim()) return;
    
    setIsLoading(true);
    try {
      const result = await processWithCerber(testPrompt, testMode);
      if (result.keywordDetected) {
        setTestResult(`✅ SŁOWO-KLUCZ ROZPOZNANE\n\n${result.response}`);
        toast.success('Cerber przepuścił czysty sygnał');
      } else {
        setTestResult(`🔇 SZUM (brak słowa-klucza)\n\n${result.noise}`);
        toast.info('Cerber wygenerował szum - brak autoryzacji');
      }
    } catch (error) {
      toast.error('Błąd przetwarzania przez Cerbera');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePunish = async (modelId: string, severity: 1 | 2 | 3) => {
    const result = await punishOllama(modelId, severity);
    if (result.success) {
      toast.warning(`🐕 Cerber: ${result.message}`);
      refreshStatus();
    }
  };

  const handleKillSwitch = async () => {
    const result = await triggerKillSwitch();
    if (result.success) {
      toast.error(`🔴 GUARDIAN: ${result.message}`);
      refreshStatus();
    }
  };

  const handleReconnect = async () => {
    const result = await reconnectWifi();
    if (result.success) {
      toast.success('Guardian: WiFi ponownie połączone');
      refreshStatus();
    }
  };

  const handleScan = async () => {
    setIsLoading(true);
    try {
      const scan = await scanForThreats();
      if (scan.killSwitchTriggered) {
        toast.error('🔴 KILL-SWITCH AKTYWOWANY!');
      } else if (scan.threatsFound.length > 0) {
        toast.warning(`⚠️ Wykryto ${scan.threatsFound.length} zagrożeń`);
      } else {
        toast.success('✅ Skanowanie zakończone - brak zagrożeń');
      }
      refreshStatus();
    } catch (error) {
      toast.error('Błąd skanowania');
    } finally {
      setIsLoading(false);
    }
  };

  const handleHoneypotToggle = async (active: boolean) => {
    const result = await activateHoneypot(active);
    if (result.success) {
      toast.success(active ? '🎯 Łasuch: Pułapki aktywowane' : 'Łasuch: Pułapki wyłączone');
      refreshStatus();
    }
  };

  const healthColors = {
    secure: 'text-primary',
    warning: 'text-yellow-500',
    critical: 'text-destructive',
    isolated: 'text-purple-500',
  };

  const healthLabels = {
    secure: 'BEZPIECZNY',
    warning: 'OSTRZEŻENIE',
    critical: 'KRYTYCZNY',
    isolated: 'IZOLOWANY',
  };

  return (
    <div className="space-y-4">
      {/* Status Overview Header */}
      <Card className="border-2 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Shield className={cn("h-8 w-8", healthColors[overallHealth])} />
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  Bio-Cyfrowy System Bezpieczeństwa
                  <Badge variant={overallHealth === 'secure' ? 'default' : 'destructive'}>
                    {healthLabels[overallHealth]}
                  </Badge>
                </h2>
                <p className="text-sm text-muted-foreground">
                  Cerber • Guardian • Łasuch
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={refreshStatus} disabled={isLoading}>
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              Odśwież
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="gap-1 text-xs">
            <Activity className="h-3 w-3" />
            Przegląd
          </TabsTrigger>
          <TabsTrigger value="cerber" className="gap-1 text-xs">
            <Dog className="h-3 w-3" />
            Cerber
          </TabsTrigger>
          <TabsTrigger value="noise" className="gap-1 text-xs">
            <ShieldAlert className="h-3 w-3" />
            Szum
          </TabsTrigger>
          <TabsTrigger value="guardian" className="gap-1 text-xs">
            <Eye className="h-3 w-3" />
            Guardian
          </TabsTrigger>
          <TabsTrigger value="lasuch" className="gap-1 text-xs">
            <Target className="h-3 w-3" />
            Łasuch
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Cerber Mini Card */}
            <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setActiveTab('cerber')}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Dog className="h-4 w-4 text-primary" />
                  CERBER
                  {cerberStatus?.isListening && (
                    <Radio className="h-3 w-3 text-primary animate-pulse" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ewolucja</span>
                    <span className="font-mono">{cerberStatus?.evolutionStage.toFixed(2) || '1.00'}</span>
                  </div>
                  <Progress value={(cerberStatus?.evolutionStage || 1) * 50} className="h-2" />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Bug className="h-3 w-3" />
                    {cerberStatus?.learnedThreats.length || 0} wzorców
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Guardian Mini Card */}
            <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setActiveTab('guardian')}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  GUARDIAN
                  {guardianStatus?.wifiStatus === 'connected' ? (
                    <Wifi className="h-3 w-3 text-primary" />
                  ) : (
                    <WifiOff className="h-3 w-3 text-destructive" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={guardianStatus?.monitoring ? 'default' : 'secondary'} className="text-xs">
                      {guardianStatus?.monitoring ? 'AKTYWNY' : 'NIEAKTYWNY'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {guardianStatus?.physicalTokenDetected ? (
                      <>
                        <AlertTriangle className="h-3 w-3 text-destructive" />
                        Token wykryty!
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-primary" />
                        Środowisko czyste
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lasuch Mini Card */}
            <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setActiveTab('lasuch')}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  ŁASUCH
                  {lasuchStatus?.honeypotActive && (
                    <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Neutralizacja</span>
                    <span className="font-mono">{((lasuchStatus?.neutralizationRate || 0) * 100).toFixed(0)}%</span>
                  </div>
                  <Progress value={(lasuchStatus?.neutralizationRate || 0) * 100} className="h-2" />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <SkullIcon className="h-3 w-3" />
                    {lasuchStatus?.totalNeutralized || 0} zneutralizowanych
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Ollama Consciences */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Sumienie Modeli AI
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {consciences.map((conscience) => (
                  <div key={conscience.modelId} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-3 h-3 rounded-full",
                        conscience.conscienceScore > 0.8 ? "bg-primary" :
                        conscience.conscienceScore > 0.5 ? "bg-primary/60" :
                        "bg-destructive"
                      )} />
                      <div>
                        <p className="font-medium text-sm">{conscience.modelId}</p>
                        {conscience.warnings.length > 0 && (
                          <p className="text-xs text-destructive">{conscience.warnings[0]}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-mono text-sm">{(conscience.conscienceScore * 100).toFixed(0)}%</p>
                        <Progress value={conscience.conscienceScore * 100} className="h-1 w-20" />
                      </div>
                      {conscience.conscienceScore < 0.7 && (
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handlePunish(conscience.modelId, 2)}
                        >
                          <Zap className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cerber Tab */}
        <TabsContent value="cerber" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Cerber Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Dog className="h-5 w-5" />
                  Status Cerbera
                  {cerberStatus?.punishmentActive && (
                    <Badge variant="destructive" className="animate-pulse">KARA AKTYWNA</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Etap Ewolucji</Label>
                    <p className="text-2xl font-bold font-mono">{cerberStatus?.evolutionStage.toFixed(2) || '1.00'}</p>
                    <div className="flex items-center gap-1 text-xs text-primary">
                      <TrendingUp className="h-3 w-3" />
                      Ciągła nauka
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Intensywność Szumu</Label>
                    <p className="text-2xl font-bold font-mono">{cerberStatus?.noiseIntensity || 5}/10</p>
                    <Progress value={(cerberStatus?.noiseIntensity || 5) * 10} className="h-2" />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Nauczone Wzorce Zagrożeń</Label>
                  <div className="flex flex-wrap gap-1">
                    {cerberStatus?.learnedThreats.map((threat, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {threat}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {cerberStatus?.isListening ? (
                      <Volume2 className="h-4 w-4 text-primary animate-pulse" />
                    ) : (
                      <VolumeX className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">Nasłuchiwanie słowa-klucza</span>
                  </div>
                  <Badge variant={cerberStatus?.isListening ? 'default' : 'secondary'}>
                    {cerberStatus?.isListening ? 'AKTYWNE' : 'WYŁĄCZONE'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Cerber Test Console */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Konsola Testowa Cerbera
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Tryb Agenta</Label>
                  <Select value={testMode} onValueChange={(v) => setTestMode(v as typeof testMode)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="safe_text">Bezpieczny Tekst</SelectItem>
                      <SelectItem value="audio">Audio</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="browser">Przeglądarka</SelectItem>
                      <SelectItem value="coding">Kodowanie</SelectItem>
                      <SelectItem value="system">System (⚠️)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Prompt (użyj "karentonoyan" aby uzyskać czysty sygnał)</Label>
                  <Textarea
                    value={testPrompt}
                    onChange={(e) => setTestPrompt(e.target.value)}
                    placeholder="Wpisz prompt do przetestowania przez Cerbera..."
                    rows={3}
                  />
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleCerberTest}
                  disabled={isLoading || !testPrompt.trim()}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Dog className="h-4 w-4 mr-2" />
                  )}
                  Przetwórz przez Cerbera
                </Button>

                {testResult && (
                  <ScrollArea className="h-32 rounded-md border p-3 bg-muted/50">
                    <pre className="text-xs font-mono whitespace-pre-wrap">{testResult}</pre>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Guardian Tab */}
        <TabsContent value="guardian" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Guardian Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Status Guardiana
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Status WiFi</Label>
                    <div className="flex items-center gap-2">
                      {guardianStatus?.wifiStatus === 'connected' ? (
                        <Wifi className="h-6 w-6 text-primary" />
                      ) : guardianStatus?.wifiStatus === 'isolated' ? (
                        <Lock className="h-6 w-6 text-primary" />
                      ) : (
                        <WifiOff className="h-6 w-6 text-destructive" />
                      )}
                      <span className="font-medium uppercase">{guardianStatus?.wifiStatus || 'unknown'}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Połączenia sieciowe</Label>
                    <p className="text-2xl font-bold font-mono">{guardianStatus?.networkConnections || 0}</p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      {guardianStatus?.physicalTokenDetected ? (
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      )}
                      <span>Fizyczny Token</span>
                    </div>
                    <Badge variant={guardianStatus?.physicalTokenDetected ? 'destructive' : 'outline'}>
                      {guardianStatus?.physicalTokenDetected ? 'WYKRYTY!' : 'Brak'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      <span>Monitorowanie</span>
                    </div>
                    <Badge variant={guardianStatus?.monitoring ? 'default' : 'secondary'}>
                      {guardianStatus?.monitoring ? 'AKTYWNE' : 'WYŁĄCZONE'}
                    </Badge>
                  </div>
                </div>

                {guardianStatus?.activeThreats && guardianStatus.activeThreats.length > 0 && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <Label className="text-destructive text-sm">Aktywne Zagrożenia:</Label>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {guardianStatus.activeThreats.map((threat, i) => (
                        <Badge key={i} variant="destructive">{threat}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Guardian Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Kontrola Guardiana
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={handleScan}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Skanuj Środowisko
                </Button>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-destructive font-bold">⚠️ KILL-SWITCH</Label>
                  <p className="text-xs text-muted-foreground">
                    Natychmiast odłącza WiFi i izoluje system. Użyj tylko w sytuacji zagrożenia!
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      variant="destructive" 
                      className="flex-1"
                      onClick={handleKillSwitch}
                    >
                      <WifiOff className="h-4 w-4 mr-2" />
                      ODŁĄCZ WIFI
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={handleReconnect}
                    >
                      <Wifi className="h-4 w-4 mr-2" />
                      Połącz ponownie
                    </Button>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  <p>Ostatnie skanowanie:</p>
                  <p className="font-mono">
                    {guardianStatus?.lastScan 
                      ? new Date(guardianStatus.lastScan).toLocaleString('pl-PL')
                      : 'Brak danych'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Lasuch Tab */}
        <TabsContent value="lasuch" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Lasuch Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Status Łasuch
                  {lasuchStatus?.honeypotActive && (
                    <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Wskaźnik Neutralizacji</Label>
                    <p className="text-2xl font-bold font-mono text-primary">
                      {((lasuchStatus?.neutralizationRate || 0) * 100).toFixed(1)}%
                    </p>
                    <Progress value={(lasuchStatus?.neutralizationRate || 0) * 100} className="h-2" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Łącznie Zneutralizowanych</Label>
                    <p className="text-2xl font-bold font-mono">{lasuchStatus?.totalNeutralized || 0}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <SkullIcon className="h-3 w-3" />
                      zagrożeń wyeliminowanych
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    <span>Pułapki (Honeypot)</span>
                  </div>
                  <Switch 
                    checked={lasuchStatus?.honeypotActive || false}
                    onCheckedChange={handleHoneypotToggle}
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  Łasuch działa na odwrotnej logice - przyciąga zagrożenia zamiast je blokować,
                  a następnie neutralizuje je w izolowanym środowisku.
                </p>
              </CardContent>
            </Card>

            {/* Trapped Threats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bug className="h-5 w-5" />
                  Schwytane Zagrożenia
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {lasuchStatus?.trappedThreats && lasuchStatus.trappedThreats.length > 0 ? (
                    <div className="space-y-2">
                      {lasuchStatus.trappedThreats.map((threat) => (
                        <div 
                          key={threat.id}
                          className={cn(
                            "p-3 rounded-lg border",
                            threat.neutralized ? "bg-muted/50" : "bg-destructive/10 border-destructive/20"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {threat.neutralized ? (
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                              )}
                              <span className="font-mono text-sm">{threat.id}</span>
                            </div>
                            <Badge variant={
                              threat.severity === 'critical' ? 'destructive' :
                              threat.severity === 'high' ? 'destructive' :
                              threat.severity === 'medium' ? 'secondary' : 'outline'
                            }>
                              {threat.severity}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{threat.signature}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(threat.capturedAt).toLocaleString('pl-PL')}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <Target className="h-8 w-8 mb-2 opacity-50" />
                      <p className="text-sm">Brak schwytanych zagrożeń</p>
                      <p className="text-xs">Łasuch czeka na ofiary...</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Noise Shield Tab */}
        <TabsContent value="noise" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Shield Control */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5" />
                  Noise Shield
                  <Badge variant={shieldState.shieldActive && shieldState.passphraseSet ? 'destructive' : 'secondary'}>
                    {shieldState.passphraseSet
                      ? shieldState.unlocked ? '🔓 ODBLOKOWANY' : '🔒 ZABLOKOWANY'
                      : 'NIESKONFIGUROWANY'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Set passphrase */}
                {!shieldState.passphraseSet ? (
                  <div className="space-y-2">
                    <Label>Ustaw hasło Cerbera</Label>
                    <p className="text-xs text-muted-foreground">
                      Tylko to hasło odblokuje czysty output. Cerber nasłuchuje.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        placeholder="Min. 4 znaki..."
                        value={passphraseInput}
                        onChange={e => setPassphraseInput(e.target.value)}
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          if (noiseShield.setPassphrase(passphraseInput)) {
                            toast.success('🐕 Cerber: Hasło ustawione. Shield aktywny.');
                            setPassphraseInput('');
                          } else {
                            toast.error('Hasło musi mieć min. 4 znaki');
                          }
                        }}
                      >
                        <Lock className="h-4 w-4 mr-1" /> Ustaw
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Unlock */}
                    <div className="space-y-2">
                      <Label>{shieldState.unlocked ? 'Shield odblokowany' : 'Odblokuj shield'}</Label>
                      {!shieldState.unlocked ? (
                        <div className="flex gap-2">
                          <Input
                            type="password"
                            placeholder="Podaj hasło Cerbera..."
                            value={unlockInput}
                            onChange={e => setUnlockInput(e.target.value)}
                          />
                          <Button
                            size="sm"
                            onClick={() => {
                              if (noiseShield.unlock(unlockInput)) {
                                toast.success('🔓 Shield odblokowany na 5 minut');
                                setUnlockInput('');
                              } else {
                                toast.error('🐕 Błędne hasło!');
                              }
                            }}
                          >
                            <Unlock className="h-4 w-4 mr-1" /> Odblokuj
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-primary">
                            Czyste wyjście aktywne (auto-lock za {Math.max(0, Math.round((shieldState.unlockExpiry - Date.now()) / 1000))}s)
                          </p>
                          <Button variant="destructive" size="sm" onClick={() => { noiseShield.lock(); toast.info('🔒 Shield zablokowany'); }}>
                            <Lock className="h-4 w-4 mr-1" /> Zablokuj
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Shield toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4" />
                        <span className="text-sm">Shield aktywny</span>
                      </div>
                      <Switch
                        checked={shieldState.shieldActive}
                        onCheckedChange={v => noiseShield.setShieldActive(v)}
                      />
                    </div>
                  </>
                )}

                <Separator />

                {/* Infection stats */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Wykryte Infekcje</Label>
                  <div className="flex items-center gap-4">
                    <p className="text-2xl font-bold font-mono text-destructive">{shieldState.infectionCount}</p>
                    {shieldState.lastInfection && (
                      <div className="text-xs text-muted-foreground">
                        <p>Ostatnia: {shieldState.lastInfection.severity}</p>
                        <p>Zagrożenia: {[...shieldState.lastInfection.inputThreats, ...shieldState.lastInfection.outputThreats].join(', ')}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Whitelist */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Whitelist Kontaktów
                  <Badge variant="outline">{shieldState.whitelistCount}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Ollama rozmawia TYLKO z osobami na tej liście. Reszta dostaje szum.
                </p>
                {/* Add to whitelist */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="ID kontaktu"
                      value={newWhitelistId}
                      onChange={e => setNewWhitelistId(e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Nazwa"
                      value={newWhitelistName}
                      onChange={e => setNewWhitelistName(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      disabled={!newWhitelistId || !newWhitelistName}
                      onClick={() => {
                        noiseShield.addToWhitelist(newWhitelistId, newWhitelistName);
                        toast.success(`✅ ${newWhitelistName} dodany do whitelisty`);
                        setNewWhitelistId('');
                        setNewWhitelistName('');
                      }}
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Whitelist entries */}
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {shieldState.whitelist.map(entry => (
                      <div key={entry.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                        <div>
                          <p className="text-sm font-medium">{entry.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{entry.id}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            noiseShield.removeFromWhitelist(entry.id);
                            toast.info(`${entry.name} usunięty z whitelisty`);
                          }}
                        >
                          <UserMinus className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    {shieldState.whitelist.length === 0 && (
                      <div className="text-center text-muted-foreground text-sm py-8">
                        <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Brak kontaktów na whiteliście</p>
                        <p className="text-xs">Wszyscy dostaną szum</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
