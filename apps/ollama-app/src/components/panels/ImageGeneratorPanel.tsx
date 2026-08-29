import { useState } from 'react';
import { 
  ImageIcon, 
  Sparkles, 
  Loader2, 
  Download, 
  RefreshCw,
  Wand2,
  Settings2,
  Trash2,
  Copy,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { generateImage, type ImageGenerationParams, type GeneratedImage } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ImageGeneratorPanelProps {
  isConnected: boolean;
}

const MODELS = [
  { id: 'sdxl', name: 'SDXL', description: 'Najlepsza jakość (wolniejszy)' },
  { id: 'sd21', name: 'SD 2.1', description: 'Dobra jakość (średnia)' },
  { id: 'sd15', name: 'SD 1.5', description: 'Szybki (podstawowy)' },
];

const RESOLUTIONS = [
  { id: '512x512', name: '512×512', aspect: '1:1' },
  { id: '768x768', name: '768×768', aspect: '1:1' },
  { id: '1024x1024', name: '1024×1024', aspect: '1:1' },
  { id: '1024x768', name: '1024×768', aspect: '4:3' },
  { id: '768x1024', name: '768×1024', aspect: '3:4' },
  { id: '1280x720', name: '1280×720', aspect: '16:9' },
  { id: '720x1280', name: '720×1280', aspect: '9:16' },
];

const STYLE_PRESETS = [
  { id: 'none', name: 'Brak', suffix: '' },
  { id: 'photorealistic', name: 'Fotorealistyczny', suffix: ', photorealistic, 8k, highly detailed' },
  { id: 'digital-art', name: 'Digital Art', suffix: ', digital art, artstation, trending' },
  { id: 'oil-painting', name: 'Malarstwo', suffix: ', oil painting, masterpiece, classical art' },
  { id: 'anime', name: 'Anime', suffix: ', anime style, vibrant colors, detailed' },
  { id: 'watercolor', name: 'Akwarela', suffix: ', watercolor painting, soft colors, artistic' },
  { id: '3d-render', name: '3D Render', suffix: ', 3d render, octane render, cinema 4d' },
];

const STORAGE_KEY = 'alfa-image-history';

const loadHistory = (): GeneratedImage[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveHistory = (images: GeneratedImage[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(images.slice(0, 20)));
  } catch (e) {
    console.error('Error saving history:', e);
  }
};

export function ImageGeneratorPanel({ isConnected }: ImageGeneratorPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('ugly, blurry, low quality, distorted');
  const [model, setModel] = useState('sdxl');
  const [resolution, setResolution] = useState('1024x1024');
  const [stylePreset, setStylePreset] = useState('none');
  const [guidanceScale, setGuidanceScale] = useState([7.5]);
  const [steps, setSteps] = useState([30]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>(() => loadHistory());
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({ title: 'Błąd', description: 'Wprowadź opis obrazu', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    
    try {
      const style = STYLE_PRESETS.find(s => s.id === stylePreset);
      const fullPrompt = prompt + (style?.suffix || '');

      const params: ImageGenerationParams = {
        prompt: fullPrompt,
        negativePrompt,
        model,
        resolution,
        guidanceScale: guidanceScale[0],
        steps: steps[0],
      };

      const result = await generateImage(params);
      
      const newImages = [result, ...generatedImages];
      setGeneratedImages(newImages);
      saveHistory(newImages);
      setSelectedImage(result);
      
      toast({ title: 'Sukces', description: 'Obraz został wygenerowany!' });
    } catch (error) {
      console.error('Generation error:', error);
      toast({ 
        title: 'Błąd', 
        description: 'Nie udało się wygenerować obrazu. Sprawdź połączenie z ALFA CORE.', 
        variant: 'destructive' 
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (image: GeneratedImage) => {
    if (!image.url) return;
    
    const link = document.createElement('a');
    link.href = image.url;
    link.download = `alfa-studio-${image.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyPrompt = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = (id: string) => {
    const newImages = generatedImages.filter(img => img.id !== id);
    setGeneratedImages(newImages);
    saveHistory(newImages);
    if (selectedImage?.id === id) {
      setSelectedImage(null);
    }
  };

  const handleClearHistory = () => {
    setGeneratedImages([]);
    setSelectedImage(null);
    localStorage.removeItem(STORAGE_KEY);
    toast({ title: 'Historia wyczyszczona' });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Panel - Generator Form */}
      <div className="lg:col-span-1 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              Generator Obrazów AI
            </CardTitle>
            <CardDescription>
              ALFA Studio - Text to Image
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Prompt */}
            <div className="space-y-2">
              <Label>Opis obrazu (Prompt)</Label>
              <Textarea
                placeholder="np. beautiful mountain landscape at sunset, dramatic sky, 4k photography"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={!isConnected || isGenerating}
                className="min-h-[100px]"
              />
            </div>

            {/* Style Preset */}
            <div className="space-y-2">
              <Label>Styl</Label>
              <Select value={stylePreset} onValueChange={setStylePreset} disabled={isGenerating}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz styl..." />
                </SelectTrigger>
                <SelectContent>
                  {STYLE_PRESETS.map((style) => (
                    <SelectItem key={style.id} value={style.id}>
                      {style.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model & Resolution */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Model</Label>
                <Select value={model} onValueChange={setModel} disabled={isGenerating}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex flex-col">
                          <span>{m.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Rozdzielczość</Label>
                <Select value={resolution} onValueChange={setResolution} disabled={isGenerating}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESOLUTIONS.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Advanced Settings */}
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full gap-2">
                  <Settings2 className="h-4 w-4" />
                  Zaawansowane
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                {/* Negative Prompt */}
                <div className="space-y-2">
                  <Label>Negative Prompt</Label>
                  <Textarea
                    placeholder="Czego unikać w obrazie..."
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    disabled={isGenerating}
                    className="min-h-[60px]"
                  />
                </div>

                {/* Guidance Scale */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Guidance Scale</Label>
                    <span className="text-sm text-muted-foreground">{guidanceScale[0]}</span>
                  </div>
                  <Slider
                    value={guidanceScale}
                    onValueChange={setGuidanceScale}
                    min={1}
                    max={20}
                    step={0.5}
                    disabled={isGenerating}
                  />
                  <p className="text-xs text-muted-foreground">
                    Wyższa wartość = bardziej zgodny z promptem
                  </p>
                </div>

                {/* Steps */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Kroki</Label>
                    <span className="text-sm text-muted-foreground">{steps[0]}</span>
                  </div>
                  <Slider
                    value={steps}
                    onValueChange={setSteps}
                    min={10}
                    max={100}
                    step={5}
                    disabled={isGenerating}
                  />
                  <p className="text-xs text-muted-foreground">
                    Więcej kroków = lepsza jakość (wolniej)
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Generate Button */}
            <Button 
              className="w-full gap-2" 
              size="lg"
              onClick={handleGenerate}
              disabled={!isConnected || isGenerating || !prompt.trim()}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generowanie...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generuj Obraz
                </>
              )}
            </Button>

            {!isConnected && (
              <p className="text-xs text-center text-muted-foreground">
                Brak połączenia z ALFA CORE
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Panel - Preview & History */}
      <div className="lg:col-span-2 space-y-4">
        {/* Preview */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Podgląd
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedImage ? (
              <div className="space-y-4">
                <div className="relative aspect-square max-h-[400px] bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                  <img 
                    src={selectedImage.url} 
                    alt={selectedImage.prompt}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Badge variant="outline">{selectedImage.model}</Badge>
                    <Badge variant="outline">{selectedImage.resolution}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleCopyPrompt(selectedImage.prompt, selectedImage.id)}
                    >
                      {copiedId === selectedImage.id ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setPrompt(selectedImage.prompt);
                        toast({ title: 'Prompt załadowany' });
                      }}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => handleDownload(selectedImage)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Pobierz
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {selectedImage.prompt}
                </p>
              </div>
            ) : (
              <div className="aspect-video bg-muted/50 rounded-lg flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Wygeneruj obraz, aby zobaczyć podgląd</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Historia ({generatedImages.length})</CardTitle>
              {generatedImages.length > 0 && (
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={handleClearHistory}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {generatedImages.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                Brak wygenerowanych obrazów
              </p>
            ) : (
              <ScrollArea className="h-[200px]">
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {generatedImages.map((img) => (
                    <div 
                      key={img.id}
                      className={cn(
                        "relative aspect-square rounded-md overflow-hidden cursor-pointer border-2 transition-all",
                        selectedImage?.id === img.id 
                          ? "border-primary ring-2 ring-primary/20" 
                          : "border-transparent hover:border-muted-foreground/30"
                      )}
                      onClick={() => setSelectedImage(img)}
                    >
                      <img 
                        src={img.url} 
                        alt={img.prompt}
                        className="w-full h-full object-cover"
                      />
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(img.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
