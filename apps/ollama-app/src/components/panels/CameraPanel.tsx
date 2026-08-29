import { useState, useRef } from 'react';
import { Camera, CameraOff, Upload, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCamera } from '@/hooks/useCamera';
import { analyzeImage, type VisionAnalysis } from '@/lib/api';
import { cn } from '@/lib/utils';

interface CameraPanelProps {
  isConnected: boolean;
}

export function CameraPanel({ isConnected }: CameraPanelProps) {
  const { 
    isActive, 
    devices, 
    activeDeviceId, 
    error,
    videoRef, 
    canvasRef,
    startCamera, 
    stopCamera, 
    captureFrameAsync,
    switchCamera,
  } = useCamera();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<VisionAnalysis | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCameraToggle = () => {
    if (isActive) {
      stopCamera();
    } else {
      startCamera(activeDeviceId);
    }
  };

  const handleCapture = async () => {
    const blob = await captureFrameAsync();
    if (!blob) return;

    // Pokaż przechwycony obraz
    const url = URL.createObjectURL(blob);
    setCapturedImage(url);

    // Analizuj
    await analyzeBlob(blob);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setCapturedImage(url);

    await analyzeBlob(file);
  };

  const analyzeBlob = async (blob: Blob) => {
    if (!isConnected) return;

    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      const result = await analyzeImage(blob);
      setAnalysis(result);
    } catch (err) {
      console.error('Analysis failed:', err);
      setAnalysis({ description: 'Błąd analizy obrazu' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearCapture = () => {
    setCapturedImage(null);
    setAnalysis(null);
  };

  return (
    <div className="grid h-full gap-4 md:grid-cols-2">
      {/* Podgląd kamery */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Podgląd kamery
            </span>
            {devices.length > 1 && (
              <Select value={activeDeviceId} onValueChange={switchCamera}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((device, index) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label || `Kamera ${index + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                "h-full w-full object-cover",
                !isActive && "hidden"
              )}
            />
            {!isActive && (
              <div className="flex h-full items-center justify-center">
                <CameraOff className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Ukryty canvas do przechwytywania klatek */}
          <canvas ref={canvasRef} className="hidden" />

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex gap-2">
            <Button 
              variant={isActive ? 'destructive' : 'default'}
              onClick={handleCameraToggle}
            >
              {isActive ? (
                <>
                  <CameraOff className="mr-2 h-4 w-4" />
                  Wyłącz
                </>
              ) : (
                <>
                  <Camera className="mr-2 h-4 w-4" />
                  Włącz kamerę
                </>
              )}
            </Button>

            {isActive && (
              <Button onClick={handleCapture} disabled={isAnalyzing || !isConnected}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Przechwyć i analizuj
              </Button>
            )}

            <Button 
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzing || !isConnected}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        </CardContent>
      </Card>

      {/* Wyniki analizy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Wyniki analizy
            {capturedImage && (
              <Button variant="ghost" size="sm" onClick={clearCapture}>
                Wyczyść
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {capturedImage && (
            <div className="mb-4 overflow-hidden rounded-lg">
              <img 
                src={capturedImage} 
                alt="Przechwycony obraz" 
                className="w-full object-contain"
              />
            </div>
          )}

          {isAnalyzing ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="mr-2 h-6 w-6 animate-spin" />
              <span>Analizuję obraz...</span>
            </div>
          ) : analysis ? (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium">Opis:</h4>
                <p className="text-sm text-muted-foreground">{analysis.description}</p>
              </div>
              
              {analysis.objects && analysis.objects.length > 0 && (
                <div>
                  <h4 className="font-medium">Wykryte obiekty:</h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {analysis.objects.map((obj, index) => (
                      <span 
                        key={index}
                        className="rounded-full bg-primary/10 px-3 py-1 text-sm"
                      >
                        {obj}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {analysis.confidence !== undefined && (
                <p className="text-xs text-muted-foreground">
                  Pewność: {(analysis.confidence * 100).toFixed(1)}%
                </p>
              )}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              {!isConnected 
                ? 'Brak połączenia z ALFA CORE'
                : 'Przechwyć lub wgraj obraz do analizy'
              }
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
