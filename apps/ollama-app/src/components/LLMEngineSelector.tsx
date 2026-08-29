import { useState } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Cloud, 
  HardDrive, 
  AlertTriangle, 
  Key,
  CheckCircle2,
  XCircle,
  Shield,
  Zap,
  Globe,
} from 'lucide-react';
import { useLLMRouter, getEngineLabel, getEngineDescription } from '@/hooks/useLLMRouter';
import { OPENROUTER_MODELS, type LLMEngine } from '@/lib/llm-router';
import { cn } from '@/lib/utils';

interface LLMEngineSelectorProps {
  className?: string;
}

export function LLMEngineSelector({ className }: LLMEngineSelectorProps) {
  const {
    currentEngine,
    isOllamaAvailable,
    hasOpenRouterKey,
    hasOpenAIKey,
    setEngine,
    setOpenRouterKey,
    setOpenAIKey,
    clearOpenRouterKey,
    clearOpenAIKey,
  } = useLLMRouter();

  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [pendingEngine, setPendingEngine] = useState<'openrouter' | 'openai' | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const handleEngineChange = (engine: LLMEngine) => {
    if (engine === 'ollama' || engine === 'llamacpp') {
      setEngine(engine);
      return;
    }

    if (engine === 'openrouter') {
      if (!hasOpenRouterKey) {
        setPendingEngine('openrouter');
        setApiKeyDialogOpen(true);
        return;
      }
      setEngine('openrouter');
      return;
    }

    if (engine === 'openai') {
      if (!hasOpenAIKey) {
        setPendingEngine('openai');
        setApiKeyDialogOpen(true);
        return;
      }
      setEngine('openai');
    }
  };

  const handleSaveApiKey = () => {
    if (!apiKeyInput.trim() || !pendingEngine) return;

    if (pendingEngine === 'openrouter') {
      setOpenRouterKey(apiKeyInput.trim());
      setEngine('openrouter');
    } else if (pendingEngine === 'openai') {
      setOpenAIKey(apiKeyInput.trim());
      setEngine('openai');
    }

    setApiKeyDialogOpen(false);
    setApiKeyInput('');
    setPendingEngine(null);
  };

  const getEngineStatus = (engine: LLMEngine) => {
    switch (engine) {
      case 'ollama':
        return isOllamaAvailable;
      case 'llamacpp':
        return true; // assume available if configured
      case 'openrouter':
        return hasOpenRouterKey;
      case 'openai':
        return hasOpenAIKey;
    }
  };

  const engines: { id: LLMEngine; label: string; icon: React.ReactNode; color: string }[] = [
    { 
      id: 'ollama', 
      label: 'Ollama', 
      icon: <HardDrive className="h-4 w-4" />,
      color: 'text-primary',
    },
    { 
      id: 'llamacpp', 
      label: 'SUSI', 
      icon: <HardDrive className="h-4 w-4" />,
      color: 'text-primary',
    },
    { 
      id: 'openrouter', 
      label: 'OpenRouter', 
      icon: <Globe className="h-4 w-4" />,
      color: 'text-accent-foreground',
    },
    { 
      id: 'openai', 
      label: 'OpenAI', 
      icon: <Zap className="h-4 w-4" />,
      color: 'text-secondary-foreground',
    },
  ];

  return (
    <>
      <div className={cn("space-y-4", className)}>
        {/* Engine Buttons */}
        <div className="flex gap-2">
          {engines.map(({ id, label, icon, color }) => {
            const isActive = currentEngine === id;
            const isAvailable = getEngineStatus(id);

            return (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <Button
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleEngineChange(id)}
                    className={cn(
                      "flex items-center gap-2",
                      isActive && "ring-2 ring-offset-2 ring-primary"
                    )}
                  >
                    <span className={isActive ? "text-primary-foreground" : color}>
                      {icon}
                    </span>
                    <span>{label}</span>
                    {isAvailable ? (
                      <CheckCircle2 className="h-3 w-3 text-accent-foreground" />
                    ) : (
                      <XCircle className="h-3 w-3 text-muted-foreground" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <div className="flex items-center gap-2">
                    {(id === 'ollama' || id === 'llamacpp') ? (
                      <Shield className="h-4 w-4 text-primary" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    )}
                    <span>{getEngineDescription(id)}</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Current Engine Info */}
        <div className="flex items-center justify-between">
          <Badge variant={currentEngine === 'ollama' ? 'default' : 'secondary'}>
            {getEngineLabel(currentEngine)}
          </Badge>

          {/* Key Management */}
          <div className="flex gap-1">
            {hasOpenRouterKey && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={clearOpenRouterKey}
                  >
                    <Key className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Usuń klucz OpenRouter</TooltipContent>
              </Tooltip>
            )}
            {hasOpenAIKey && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={clearOpenAIKey}
                  >
                    <Key className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Usuń klucz OpenAI</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* OpenRouter Model Selector */}
        {currentEngine === 'openrouter' && (
          <div className="space-y-2">
            <Label className="text-xs">Model OpenRouter</Label>
            <Select defaultValue="qwen/qwen-2.5-72b-instruct">
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(OPENROUTER_MODELS).map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* API Key Dialog */}
      <Dialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {pendingEngine === 'openrouter' ? (
                <>
                  <Globe className="h-5 w-5" />
                  Włącz OpenRouter
                </>
              ) : (
                <>
                  <Cloud className="h-5 w-5" />
                  Włącz OpenAI
                </>
              )}
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <div className="flex items-center gap-2 p-2 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="text-sm">
                  Uwaga: W trybie chmury Twoje dane mogą opuścić urządzenie.
                </span>
              </div>
              {pendingEngine === 'openrouter' && (
                <p className="text-sm">
                  OpenRouter daje dostęp do Qwen, Claude, GPT, Llama i innych modeli przez jedno API.
                </p>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">
                {pendingEngine === 'openrouter' ? 'OpenRouter API Key' : 'OpenAI API Key'}
              </Label>
              <Input
                id="api-key"
                type="password"
                placeholder={pendingEngine === 'openrouter' ? 'sk-or-v1-...' : 'sk-...'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveApiKey();
                }}
              />
              <p className="text-xs text-muted-foreground">
                Znajdziesz go na:{' '}
                <a 
                  href={pendingEngine === 'openrouter' 
                    ? 'https://openrouter.ai/keys' 
                    : 'https://platform.openai.com/api-keys'
                  } 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {pendingEngine === 'openrouter' 
                    ? 'openrouter.ai/keys' 
                    : 'platform.openai.com/api-keys'
                  }
                </a>
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApiKeyDialogOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleSaveApiKey} disabled={!apiKeyInput.trim()}>
              Włącz {pendingEngine === 'openrouter' ? 'OpenRouter' : 'OpenAI'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
