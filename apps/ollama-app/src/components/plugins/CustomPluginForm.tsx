import { useState } from 'react';
import { Plus, Copy, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface CustomPlugin {
  name: string;
  category: string;
  description: string;
  version: string;
  promptTemplate: string;
}

const PLUGIN_TEMPLATE = `#!/usr/bin/env python3
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from plugin_system import BasePlugin, PluginMetadata
from typing import Dict, Any

class {{CLASS_NAME}}(BasePlugin):
    """{{DESCRIPTION}}"""

    def __init__(self):
        metadata = PluginMetadata(
            name="{{NAME}}",
            category="custom",
            description="{{DESCRIPTION}}",
            version="{{VERSION}}"
        )
        super().__init__(metadata)

    def execute(self, **kwargs) -> Dict[str, Any]:
        """Główna logika pluginu"""
        # TODO: Twoja implementacja
        return {
            "success": True,
            "result": "Plugin wykonany pomyślnie"
        }

    def get_prompt_template(self) -> str:
        return """{{PROMPT_TEMPLATE}}"""

# Instancja dla auto-loadingu
plugin = {{CLASS_NAME}}()`;

interface CustomPluginFormProps {
  onPluginCreated: (plugin: { name: string; category: string; description: string; version: string }) => void;
}

export function CustomPluginForm({ onPluginCreated }: CustomPluginFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [category, setCategory] = useState('custom');
  const [promptTemplate, setPromptTemplate] = useState('Opisz jak używać tego pluginu...');
  const [savedPlugins, setSavedPlugins] = useState<CustomPlugin[]>([]);
  const [showCode, setShowCode] = useState(false);

  const toClassName = (pluginName: string) =>
    pluginName
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join('') + 'Plugin';

  const generateCode = () => {
    if (!name) return '';
    return PLUGIN_TEMPLATE
      .split('{{CLASS_NAME}}').join(toClassName(name))
      .split('{{NAME}}').join(name)
      .split('{{DESCRIPTION}}').join(description)
      .split('{{VERSION}}').join(version)
      .split('{{PROMPT_TEMPLATE}}').join(promptTemplate);
  };

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error('Podaj nazwę pluginu');
      return;
    }
    if (savedPlugins.some(p => p.name === name)) {
      toast.error('Plugin o tej nazwie już istnieje');
      return;
    }

    const newPlugin: CustomPlugin = { name, category, description, version, promptTemplate };
    setSavedPlugins(prev => [...prev, newPlugin]);
    onPluginCreated({ name, category: 'custom', description, version });
    toast.success(`Plugin "${name}" utworzony!`);
    setName('');
    setDescription('');
    setPromptTemplate('Opisz jak używać tego pluginu...');
    setShowCode(false);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generateCode());
    toast.success('Kod skopiowany do schowka');
  };

  const handleDownload = () => {
    const code = generateCode();
    const blob = new Blob([code], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name || 'my_plugin'}.py`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Plik pobrany');
  };

  const handleDelete = (pluginName: string) => {
    setSavedPlugins(prev => prev.filter(p => p.name !== pluginName));
    toast.info(`Plugin "${pluginName}" usunięty`);
  };

  return (
    <div className="space-y-4">
      {/* Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nowy Plugin
          </CardTitle>
          <CardDescription className="text-xs">
            Stwórz własną wtyczkę ALFA kompatybilną z systemem pluginów
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nazwa (kebab-case)</Label>
              <Input
                placeholder="my-plugin"
                value={name}
                onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Wersja</Label>
              <Input
                placeholder="1.0.0"
                value={version}
                onChange={e => setVersion(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Kategoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Własne</SelectItem>
                <SelectItem value="files">Zarządzanie Plikami</SelectItem>
                <SelectItem value="coding">Kodowanie</SelectItem>
                <SelectItem value="data">Dane i Analiza</SelectItem>
                <SelectItem value="web">Web API</SelectItem>
                <SelectItem value="communication">Komunikacja</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Opis</Label>
            <Input
              placeholder="Co robi ten plugin..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Prompt Template (dla AI)</Label>
            <Textarea
              placeholder="Opisz jak AI ma używać tego pluginu..."
              value={promptTemplate}
              onChange={e => setPromptTemplate(e.target.value)}
              className="text-xs min-h-[60px] resize-none"
            />
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={!name.trim()} className="flex-1">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Utwórz
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCode(!showCode)} disabled={!name.trim()}>
              Podgląd kodu
            </Button>
          </div>

          {/* Code preview */}
          {showCode && name && (
            <div className="relative">
              <div className="absolute top-2 right-2 flex gap-1 z-10">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCopyCode}>
                  <Copy className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleDownload}>
                  <Download className="h-3 w-3" />
                </Button>
              </div>
              <ScrollArea className="h-[200px]">
                <pre className="text-[10px] leading-relaxed bg-muted p-3 rounded-lg overflow-x-auto font-mono">
                  {generateCode()}
                </pre>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saved custom plugins */}
      {savedPlugins.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Moje Pluginy
              <Badge variant="secondary" className="ml-2">{savedPlugins.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {savedPlugins.map(p => (
              <div key={p.name} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-xs font-medium">{p.name}</span>
                  <p className="text-[10px] text-muted-foreground truncate">{p.description}</p>
                </div>
                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => handleDelete(p.name)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
