import { useState, useRef } from 'react';
import { BookOpen, Upload, Play, Pause, Loader2, FileText, Download, Volume2, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { useSupertonic } from '@/components/SupertonicProvider';
import type { VoiceId } from '@/lib/supertonic';

const CHUNK_SIZE = 500;

function float32ToWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

interface AudioChunk {
  id: number;
  text: string;
  audioUrl?: string;
  status: 'pending' | 'generating' | 'ready' | 'error';
}

export function AudioBookPanel() {
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text');
  const [rawText, setRawText] = useState('');
  const [chunks, setChunks] = useState<AudioChunk[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState([1.0]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    isReady: supertonicReady,
    isLoading: supertonicLoading,
    voiceId,
    setVoice,
    voices,
    initialize: initializeSupertonic,
    synthesize,
  } = useSupertonic();

  // Extract text from uploaded file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      const text = await file.text();
      setRawText(text);
      toast({ title: 'Załadowano', description: `${file.name} (${text.length} znaków)` });
    } else if (file.type === 'application/pdf') {
      // For PDF we send to backend for extraction
      try {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch('http://127.0.0.1:8765/api/files/extract-text', {
          method: 'POST',
          body: formData,
        });
        if (response.ok) {
          const data = await response.json();
          setRawText(data.text || '');
          toast({ title: 'Załadowano PDF', description: `${file.name} — ${(data.text || '').length} znaków` });
        } else {
          throw new Error('Extract failed');
        }
      } catch {
        toast({ title: 'Błąd', description: 'Nie udało się wyciągnąć tekstu z PDF. Sprawdź połączenie z ALFA CORE.', variant: 'destructive' });
      }
    } else {
      toast({ title: 'Nieobsługiwany format', description: 'Obsługiwane: .txt, .md, .pdf', variant: 'destructive' });
    }
  };

  // Split text into chunks
  const splitIntoChunks = (text: string): AudioChunk[] => {
    const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text];
    const result: AudioChunk[] = [];
    let current = '';
    let id = 0;

    for (const sentence of sentences) {
      if ((current + sentence).length > CHUNK_SIZE && current.length > 0) {
        result.push({ id: id++, text: current.trim(), status: 'pending' });
        current = sentence;
      } else {
        current += sentence;
      }
    }
    if (current.trim()) {
      result.push({ id: id++, text: current.trim(), status: 'pending' });
    }

    return result;
  };

  // Generate all audio chunks
  const handleGenerate = async () => {
    if (!rawText.trim()) {
      toast({ title: 'Błąd', description: 'Wpisz lub załaduj tekst', variant: 'destructive' });
      return;
    }

    if (!supertonicReady) {
      toast({ title: 'TTS nie gotowy', description: 'Kliknij "Inicjalizuj Kokoro" aby załadować model', variant: 'destructive' });
      return;
    }

    const textChunks = splitIntoChunks(rawText);
    setChunks(textChunks);
    setIsGenerating(true);
    setProgress(0);

    for (let i = 0; i < textChunks.length; i++) {
      setChunks(prev => prev.map(c => c.id === i ? { ...c, status: 'generating' } : c));

      try {
        const result = await synthesize(textChunks[i].text);
        if (result) {
          // Convert Float32Array PCM to WAV blob
          const wavBlob = float32ToWav(result.audioData, result.sampleRate);
          const url = URL.createObjectURL(wavBlob);
          setChunks(prev => prev.map(c => c.id === i ? { ...c, status: 'ready', audioUrl: url } : c));
        } else {
          setChunks(prev => prev.map(c => c.id === i ? { ...c, status: 'error' } : c));
        }
      } catch {
        setChunks(prev => prev.map(c => c.id === i ? { ...c, status: 'error' } : c));
      }

      setProgress(((i + 1) / textChunks.length) * 100);
    }

    setIsGenerating(false);
    toast({ title: 'Gotowe!', description: `Wygenerowano ${textChunks.length} fragmentów audio` });
  };

  // Playback controls
  const playChunk = (index: number) => {
    const chunk = chunks[index];
    if (!chunk?.audioUrl) return;

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(chunk.audioUrl);
    audio.playbackRate = speed[0];
    audioRef.current = audio;
    setCurrentChunkIndex(index);
    setIsPlaying(true);

    audio.onended = () => {
      if (index < chunks.length - 1) {
        playChunk(index + 1);
      } else {
        setIsPlaying(false);
      }
    };

    audio.play();
  };

  const togglePlayback = () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      const readyChunks = chunks.filter(c => c.status === 'ready');
      if (readyChunks.length > 0) {
        playChunk(currentChunkIndex);
      }
    }
  };

  const skipForward = () => {
    if (currentChunkIndex < chunks.length - 1) {
      playChunk(currentChunkIndex + 1);
    }
  };

  const skipBack = () => {
    if (currentChunkIndex > 0) {
      playChunk(currentChunkIndex - 1);
    }
  };

  // Download all as single audio
  const handleDownloadAll = async () => {
    const readyChunks = chunks.filter(c => c.status === 'ready' && c.audioUrl);
    if (readyChunks.length === 0) return;

    try {
      const blobs: Blob[] = [];
      for (const chunk of readyChunks) {
        const resp = await fetch(chunk.audioUrl!);
        blobs.push(await resp.blob());
      }
      const combined = new Blob(blobs, { type: 'audio/wav' });
      const url = URL.createObjectURL(combined);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'audiobook.wav';
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Pobrano', description: 'audiobook.wav' });
    } catch {
      toast({ title: 'Błąd', description: 'Nie udało się pobrać', variant: 'destructive' });
    }
  };

  const readyCount = chunks.filter(c => c.status === 'ready').length;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            AudioBook Generator
          </CardTitle>
          <CardDescription>
            Wrzuć PDF lub tekst — zamienię go w audiobooka z Kokoro TTS
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Kokoro TTS status */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              <span className="text-sm font-medium">Kokoro TTS</span>
            </div>
            {supertonicLoading ? (
              <Badge variant="secondary" className="gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Ładowanie...
              </Badge>
            ) : supertonicReady ? (
              <Badge variant="default">Gotowy</Badge>
            ) : (
              <Button size="sm" variant="outline" onClick={initializeSupertonic}>
                Inicjalizuj Kokoro
              </Button>
            )}
          </div>

          {/* Voice selection */}
          {supertonicReady && (
            <div className="space-y-2">
              <Label>Głos narratora</Label>
              <Select value={voiceId} onValueChange={(v) => setVoice(v as VoiceId)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(voices).map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {id} — {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Input mode tabs */}
          <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'text' | 'file')}>
            <TabsList className="w-full">
              <TabsTrigger value="text" className="flex-1 gap-1">
                <FileText className="h-3 w-3" />
                Wklej tekst
              </TabsTrigger>
              <TabsTrigger value="file" className="flex-1 gap-1">
                <Upload className="h-3 w-3" />
                Załaduj plik
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text">
              <Textarea
                placeholder="Wklej tutaj tekst książki, artykułu lub dokumentu..."
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={10}
                disabled={isGenerating}
              />
            </TabsContent>

            <TabsContent value="file">
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium">Kliknij aby wybrać plik</p>
                <p className="text-xs text-muted-foreground mt-1">.txt, .md, .pdf</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </TabsContent>
          </Tabs>

          {rawText && (
            <p className="text-xs text-muted-foreground">
              {rawText.length} znaków • ~{Math.ceil(rawText.length / CHUNK_SIZE)} fragmentów
            </p>
          )}

          <Button
            className="w-full"
            onClick={handleGenerate}
            disabled={!rawText.trim() || isGenerating || !supertonicReady}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Generuję audio... ({Math.round(progress)}%)
              </>
            ) : (
              <>
                <BookOpen className="h-4 w-4 mr-2" />
                Generuj AudioBook
              </>
            )}
          </Button>

          {isGenerating && <Progress value={progress} />}
        </CardContent>
      </Card>

      {/* Player & Chunks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              Odtwarzacz
              {readyCount > 0 && (
                <Badge variant="secondary">{readyCount}/{chunks.length}</Badge>
              )}
            </span>
            {readyCount > 0 && (
              <Button size="sm" variant="outline" onClick={handleDownloadAll}>
                <Download className="h-4 w-4 mr-1" />
                Pobierz WAV
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {chunks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <BookOpen className="h-12 w-12 opacity-30 mb-4" />
              <p className="text-sm">Wklej tekst i kliknij "Generuj"</p>
            </div>
          ) : (
            <>
              {/* Playback controls */}
              <div className="flex items-center justify-center gap-4 p-4 rounded-lg bg-muted/50">
                <Button size="icon" variant="ghost" onClick={skipBack} disabled={currentChunkIndex === 0}>
                  <SkipBack className="h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  className="h-14 w-14 rounded-full"
                  onClick={togglePlayback}
                  disabled={readyCount === 0}
                >
                  {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={skipForward} disabled={currentChunkIndex >= chunks.length - 1}>
                  <SkipForward className="h-5 w-5" />
                </Button>
              </div>

              {/* Speed control */}
              <div className="flex items-center gap-3">
                <Label className="text-xs shrink-0">Prędkość: {speed[0]}x</Label>
                <Slider
                  value={speed}
                  onValueChange={(v) => {
                    setSpeed(v);
                    if (audioRef.current) audioRef.current.playbackRate = v[0];
                  }}
                  min={0.5}
                  max={2}
                  step={0.1}
                />
              </div>

              {/* Chunk list */}
              <ScrollArea className="h-[280px]">
                <div className="space-y-1">
                  {chunks.map((chunk, i) => (
                    <div
                      key={chunk.id}
                      className={`flex items-center gap-2 p-2 rounded-md text-xs cursor-pointer transition-colors ${
                        i === currentChunkIndex && isPlaying
                          ? 'bg-primary/10 border border-primary/30'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => chunk.status === 'ready' && playChunk(i)}
                    >
                      <div className="shrink-0 w-6 text-center text-muted-foreground">{i + 1}</div>
                      {chunk.status === 'generating' && <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />}
                      {chunk.status === 'ready' && <Play className="h-3 w-3 text-primary shrink-0" />}
                      {chunk.status === 'error' && <span className="text-destructive shrink-0">✗</span>}
                      {chunk.status === 'pending' && <span className="text-muted-foreground shrink-0">○</span>}
                      <span className="truncate">{chunk.text.substring(0, 80)}...</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
