import { useState } from 'react';
import { Mic, MicOff, Volume2, Loader2, Trash2, Zap, Settings2, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { transcribeAudio, sendChatMessage, synthesizeSpeech } from '@/lib/api';
import { useSupertonic } from '@/components/SupertonicProvider';
import { AudioVisualizer } from '@/components/AudioVisualizer';
import { cn } from '@/lib/utils';
import type { VoiceId, Language } from '@/lib/supertonic';

interface VoiceHistoryItem {
  id: string;
  type: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

interface VoicePanelProps {
  isConnected: boolean;
  activeModel: string;
}

export function VoicePanel({ isConnected, activeModel }: VoicePanelProps) {
  const { 
    isRecording, 
    audioLevel, 
    audioBlob, 
    error: recorderError, 
    startRecording, 
    stopRecording,
    clearRecording,
  } = useAudioRecorder();

  const {
    isReady: supertonicReady,
    isLoading: supertonicLoading,
    executionProvider,
    lastGenerationTime,
    voiceId,
    language,
    useLocalTTS,
    initialize: initializeSupertonic,
    synthesizeAndPlay,
    setVoice,
    setLanguage,
    setUseLocalTTS,
    voices,
    languages,
    error: supertonicError,
  } = useSupertonic();

  const [isProcessing, setIsProcessing] = useState(false);
  const [history, setHistory] = useState<VoiceHistoryItem[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [visualizerType, setVisualizerType] = useState<'circle' | 'bars' | 'wave'>('circle');

  const handleRecordToggle = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleSendVoice = async () => {
    if (!audioBlob) return;
    
    const needsBackend = !useLocalTTS || !supertonicReady;
    if (needsBackend && !isConnected) return;

    setIsProcessing(true);
    try {
      const transcription = await transcribeAudio(audioBlob);
      
      const userEntry: VoiceHistoryItem = {
        id: crypto.randomUUID(),
        type: 'user',
        text: transcription.text,
        timestamp: new Date(),
      };
      setHistory(prev => [...prev, userEntry]);

      const response = await sendChatMessage(transcription.text, activeModel);
      
      const assistantEntry: VoiceHistoryItem = {
        id: crypto.randomUUID(),
        type: 'assistant',
        text: response,
        timestamp: new Date(),
      };
      setHistory(prev => [...prev, assistantEntry]);

      if (useLocalTTS && supertonicReady) {
        await synthesizeAndPlay(response);
      } else {
        const speechBlob = await synthesizeSpeech(response);
        const audioUrl = URL.createObjectURL(speechBlob);
        const audio = new Audio(audioUrl);
        await audio.play();
      }

      clearRecording();
    } catch (err) {
      console.error('Voice processing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearHistory = () => {
    setHistory([]);
  };

  const handleInitializeSupertonic = async () => {
    await initializeSupertonic();
  };

  const error = recorderError || supertonicError;

  return (
    <div className="grid h-full gap-4 md:grid-cols-2">
      {/* Panel sterowania */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Radio className={cn(
                "h-5 w-5 transition-colors",
                isRecording && "text-destructive animate-pulse"
              )} />
              Sterowanie głosowe
              {isRecording && (
                <Badge variant="destructive" className="animate-pulse">
                  LIVE
                </Badge>
              )}
            </span>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          {/* Ustawienia TTS */}
          {showSettings && (
            <Card className="w-full bg-muted/50">
              <CardContent className="space-y-4 pt-4">
                {/* Wybór wizualizera */}
                <div className="space-y-2">
                  <Label>Wizualizacja audio</Label>
                  <Tabs value={visualizerType} onValueChange={(v) => setVisualizerType(v as typeof visualizerType)}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="circle">Koło</TabsTrigger>
                      <TabsTrigger value="bars">Słupki</TabsTrigger>
                      <TabsTrigger value="wave">Fala</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {/* Przełącznik Local/Backend TTS */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      Lokalny TTS (Kokoro)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      82M model, ultraszybki, offline
                    </p>
                  </div>
                  <Switch
                    checked={useLocalTTS}
                    onCheckedChange={setUseLocalTTS}
                  />
                </div>

                {useLocalTTS && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Status:</span>
                      {supertonicLoading ? (
                        <Badge variant="secondary" className="gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Ładowanie modelu...
                        </Badge>
                      ) : supertonicReady ? (
                        <Badge variant="default" className="gap-1">
                          Gotowy ({executionProvider?.toUpperCase()})
                        </Badge>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={handleInitializeSupertonic}
                        >
                          Inicjalizuj
                        </Button>
                      )}
                    </div>

                    {supertonicReady && (
                      <>
                        <div className="space-y-2">
                          <Label>Głos</Label>
                          <Select value={voiceId} onValueChange={(v) => setVoice(v as VoiceId)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(voices).map(([id, name]) => (
                                <SelectItem key={id} value={id}>
                                  {id} - {name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Język</Label>
                          <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(languages).map(([code, name]) => (
                                <SelectItem key={code} value={code}>
                                  {name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {lastGenerationTime !== null && (
                          <div className="text-xs text-muted-foreground">
                            Ostatni czas generowania: {lastGenerationTime.toFixed(1)}ms
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Wizualizacja audio - ulepszona */}
          <div className="relative flex flex-col items-center gap-4">
            {visualizerType === 'wave' ? (
              <div className="relative">
                <AudioVisualizer 
                  audioLevel={audioLevel} 
                  isActive={isRecording}
                  variant="wave"
                  className="mb-4"
                />
                <Button
                  size="lg"
                  variant={isRecording ? 'destructive' : 'default'}
                  className="h-16 w-16 rounded-full"
                  onClick={handleRecordToggle}
                  disabled={(!isConnected && (!useLocalTTS || !supertonicReady)) || isProcessing}
                >
                  {isRecording ? (
                    <MicOff className="h-8 w-8" />
                  ) : (
                    <Mic className="h-8 w-8" />
                  )}
                </Button>
              </div>
            ) : (
              <div className="relative flex items-center justify-center">
                <AudioVisualizer 
                  audioLevel={audioLevel} 
                  isActive={isRecording}
                  variant={visualizerType}
                  size="lg"
                />
                <Button
                  size="lg"
                  variant={isRecording ? 'destructive' : 'default'}
                  className="absolute z-10 h-20 w-20 rounded-full shadow-lg"
                  onClick={handleRecordToggle}
                  disabled={(!isConnected && (!useLocalTTS || !supertonicReady)) || isProcessing}
                >
                  {isRecording ? (
                    <MicOff className="h-10 w-10" />
                  ) : (
                    <Mic className="h-10 w-10" />
                  )}
                </Button>
              </div>
            )}

            {/* Audio level indicator */}
            {isRecording && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex gap-0.5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "w-1 h-3 rounded-full transition-all duration-75",
                        i < audioLevel * 10 
                          ? i < 3 ? "bg-primary" 
                            : i < 7 ? "bg-primary/70" 
                            : "bg-destructive"
                          : "bg-muted"
                      )}
                    />
                  ))}
                </div>
                <span>{Math.round(audioLevel * 100)}%</span>
              </div>
            )}
          </div>

          <p className="text-center text-sm text-muted-foreground">
            {!isConnected && (!useLocalTTS || !supertonicReady)
              ? 'Brak połączenia z ALFA CORE'
              : isRecording 
                ? 'Nagrywanie... Kliknij aby zatrzymać'
                : 'Kliknij aby nagrać polecenie'
            }
          </p>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {audioBlob && !isRecording && (
            <div className="flex gap-2">
              <Button 
                onClick={handleSendVoice} 
                disabled={isProcessing}
                className="gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Przetwarzanie...
                  </>
                ) : (
                  <>
                    <Volume2 className="h-4 w-4" />
                    Wyślij i odtwórz
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={clearRecording}>
                Anuluj
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historia */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Historia poleceń
            {history.length > 0 && (
              <Badge variant="secondary">{history.length}</Badge>
            )}
          </CardTitle>
          {history.length > 0 && (
            <Button variant="ghost" size="icon" onClick={clearHistory}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[350px]">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground">
                <Mic className="h-12 w-12 opacity-30 mb-4" />
                <p className="text-sm">Brak historii</p>
                <p className="text-xs">Nagraj polecenie głosowe</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <div 
                    key={item.id}
                    className={cn(
                      "rounded-lg p-3 transition-colors",
                      item.type === 'user' 
                        ? "bg-primary text-primary-foreground ml-8"
                        : "bg-muted mr-8"
                    )}
                  >
                    <p className="text-sm">{item.text}</p>
                    <p className={cn(
                      "mt-1 text-xs",
                      item.type === 'user' ? "opacity-70" : "text-muted-foreground"
                    )}>
                      {item.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
