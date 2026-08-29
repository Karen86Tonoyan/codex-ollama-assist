import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Cloud, 
  HardDrive, 
  AlertTriangle, 
  Key,
  CheckCircle2,
  XCircle,
  Shield,
} from 'lucide-react';
import { useLLMRouter, getEngineLabel } from '@/hooks/useLLMRouter';
import { cn } from '@/lib/utils';

interface LLMEngineToggleProps {
  className?: string;
  showLabels?: boolean;
}

export function LLMEngineToggle({ className, showLabels = true }: LLMEngineToggleProps) {
  const {
    currentEngine,
    isOllamaAvailable,
    hasOpenAIKey,
    setEngine,
    setOpenAIKey,
    clearOpenAIKey,
  } = useLLMRouter();

  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const isCloudMode = currentEngine === 'openai';

  const handleToggle = (checked: boolean) => {
    if (checked) {
      // Switching to cloud
      if (!hasOpenAIKey) {
        setApiKeyDialogOpen(true);
        return;
      }
      setEngine('openai');
    } else {
      // Switching to local
      if (!isOllamaAvailable) {
        // Could show a warning, but we still allow the switch
        console.warn('Ollama not available, but switching anyway');
      }
      setEngine('ollama');
    }
  };

  const handleSaveApiKey = () => {
    if (apiKeyInput.trim()) {
      setOpenAIKey(apiKeyInput.trim());
      setEngine('openai');
      setApiKeyDialogOpen(false);
      setApiKeyInput('');
    }
  };

  const handleClearApiKey = () => {
    clearOpenAIKey();
  };

  return (
    <>
      <div className={cn("flex items-center gap-3", className)}>
        {/* Local indicator */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              "flex items-center gap-1.5 text-sm",
              !isCloudMode ? "text-primary font-medium" : "text-muted-foreground"
            )}>
              <HardDrive className="h-4 w-4" />
              {showLabels && <span>Lokalny</span>}
              {!isCloudMode && isOllamaAvailable && (
                <CheckCircle2 className="h-3 w-3 text-accent-foreground" />
              )}
              {!isCloudMode && !isOllamaAvailable && (
                <XCircle className="h-3 w-3 text-destructive" />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span>Prywatny, offline, zero vendor lock</span>
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Toggle */}
        <Switch
          checked={isCloudMode}
          onCheckedChange={handleToggle}
          aria-label="Toggle cloud mode"
        />

        {/* Cloud indicator */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              "flex items-center gap-1.5 text-sm",
              isCloudMode ? "text-primary font-medium" : "text-muted-foreground"
            )}>
              <Cloud className="h-4 w-4" />
              {showLabels && <span>Chmura</span>}
              {isCloudMode && hasOpenAIKey && (
                <CheckCircle2 className="h-3 w-3 text-accent-foreground" />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>Dane mogą opuścić urządzenie</span>
            </div>
          </TooltipContent>
        </Tooltip>

        {/* API Key management button */}
        {hasOpenAIKey && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleClearApiKey}
              >
                <Key className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Usuń klucz API</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Current engine badge */}
      {showLabels && (
        <Badge 
          variant={isCloudMode ? "secondary" : "default"}
          className="mt-2"
        >
          {getEngineLabel(currentEngine)}
        </Badge>
      )}

      {/* API Key Dialog */}
      <Dialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              Włącz tryb chmury (OpenAI)
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <div className="flex items-center gap-2 p-2 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="text-sm">
                  Uwaga: W trybie chmury Twoje dane mogą opuścić urządzenie i być przetwarzane przez OpenAI.
                </span>
              </div>
              <p className="text-sm">
                Podaj klucz API OpenAI, aby włączyć tryb chmury. Klucz jest przechowywany tylko w pamięci przeglądarki.
              </p>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">OpenAI API Key</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="sk-..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveApiKey();
                }}
              />
              <p className="text-xs text-muted-foreground">
                Znajdziesz go na: <a 
                  href="https://platform.openai.com/api-keys" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  platform.openai.com/api-keys
                </a>
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApiKeyDialogOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleSaveApiKey} disabled={!apiKeyInput.trim()}>
              Włącz chmurę
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Compact version for headers
export function LLMEngineIndicator({ className }: { className?: string }) {
  const { currentEngine, isOllamaAvailable, hasOpenAIKey } = useLLMRouter();
  const isCloudMode = currentEngine === 'openai';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs",
          isCloudMode 
            ? "bg-destructive/10 text-destructive" 
            : "bg-primary/10 text-primary",
          className
        )}>
          {isCloudMode ? (
            <>
              <Cloud className="h-3 w-3" />
              <span>Cloud</span>
            </>
          ) : (
            <>
              <HardDrive className="h-3 w-3" />
              <span>Local</span>
              {!isOllamaAvailable && <XCircle className="h-3 w-3 text-destructive" />}
            </>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {isCloudMode 
          ? "OpenAI - dane mogą opuścić urządzenie" 
          : isOllamaAvailable 
            ? "Ollama - prywatny, offline" 
            : "Ollama offline - uruchom: ollama serve"
        }
      </TooltipContent>
    </Tooltip>
  );
}
