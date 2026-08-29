import { useState } from 'react';
import { Play, Loader2, Plus, Trash2, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface PluginParamSchema {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'text' | 'select';
  required?: boolean;
  default?: string | number | boolean;
  placeholder?: string;
  options?: string[]; // for select type
  description?: string;
}

// Known param schemas per plugin
const PLUGIN_PARAM_SCHEMAS: Record<string, PluginParamSchema[]> = {
  'code-generator': [
    { key: 'description', label: 'Opis funkcji', type: 'text', required: true, placeholder: 'Opisz co ma robić kod...', description: 'Opis generowanego kodu' },
    { key: 'language', label: 'Język', type: 'select', required: true, default: 'python', options: ['python', 'javascript', 'typescript', 'csharp', 'go', 'rust', 'java'] },
    { key: 'include_tests', label: 'Dołącz testy', type: 'boolean', default: false },
  ],
  'code-reviewer': [
    { key: 'code', label: 'Kod do przeglądu', type: 'text', required: true, placeholder: 'Wklej kod...' },
    { key: 'language', label: 'Język', type: 'select', default: 'python', options: ['python', 'javascript', 'typescript', 'csharp', 'go'] },
    { key: 'check_security', label: 'Sprawdź bezpieczeństwo', type: 'boolean', default: true },
  ],
  'pdf-generator': [
    { key: 'content', label: 'Treść (Markdown)', type: 'text', required: true, placeholder: '# Tytuł\n\nTreść dokumentu...' },
    { key: 'filename', label: 'Nazwa pliku', type: 'string', placeholder: 'dokument.pdf' },
  ],
  'doc-converter': [
    { key: 'input_path', label: 'Plik źródłowy', type: 'string', required: true, placeholder: '/path/to/file.docx' },
    { key: 'output_format', label: 'Format wyjściowy', type: 'select', required: true, options: ['pdf', 'docx', 'txt', 'md'] },
  ],
  'batch-rename': [
    { key: 'directory', label: 'Katalog', type: 'string', required: true, placeholder: '/path/to/files' },
    { key: 'pattern', label: 'Wzorzec (regex)', type: 'string', required: true, placeholder: '(.+)\\.txt' },
    { key: 'replacement', label: 'Zamiana', type: 'string', required: true, placeholder: '$1.md' },
    { key: 'dry_run', label: 'Tryb testowy', type: 'boolean', default: true, description: 'Pokaż zmiany bez wykonania' },
  ],
  'git-auto': [
    { key: 'action', label: 'Akcja', type: 'select', required: true, default: 'commit', options: ['commit', 'push', 'pull', 'status'] },
    { key: 'message', label: 'Wiadomość (opcja)', type: 'string', placeholder: 'Zostaw puste dla AI' },
  ],
  'docker-builder': [
    { key: 'description', label: 'Opis aplikacji', type: 'text', required: true, placeholder: 'Aplikacja Python Flask z PostgreSQL...' },
    { key: 'base_image', label: 'Obraz bazowy', type: 'select', default: 'python:3.11-slim', options: ['python:3.11-slim', 'node:20-alpine', 'golang:1.21', 'rust:1.74', 'ubuntu:22.04'] },
  ],
  'api-tester': [
    { key: 'url', label: 'URL', type: 'string', required: true, placeholder: 'https://api.example.com/endpoint' },
    { key: 'method', label: 'Metoda', type: 'select', required: true, default: 'GET', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
    { key: 'body', label: 'Body (JSON)', type: 'text', placeholder: '{"key": "value"}' },
    { key: 'headers', label: 'Headers (JSON)', type: 'text', placeholder: '{"Authorization": "Bearer ..."}' },
  ],
  'csv-processor': [
    { key: 'file_path', label: 'Plik CSV', type: 'string', required: true, placeholder: '/path/to/data.csv' },
    { key: 'operation', label: 'Operacja', type: 'select', required: true, default: 'filter', options: ['filter', 'sort', 'aggregate', 'transform', 'deduplicate'] },
    { key: 'query', label: 'Zapytanie/Filtr', type: 'string', placeholder: 'column > 100' },
  ],
  'json-transformer': [
    { key: 'input', label: 'JSON wejściowy', type: 'text', required: true, placeholder: '{"data": [...]}' },
    { key: 'mapping', label: 'Mapowanie', type: 'text', placeholder: '{"newKey": "$.oldKey"}' },
  ],
  'data-scraper': [
    { key: 'url', label: 'URL strony', type: 'string', required: true, placeholder: 'https://example.com' },
    { key: 'selector', label: 'CSS Selector', type: 'string', placeholder: '.product-price' },
    { key: 'output_format', label: 'Format', type: 'select', default: 'json', options: ['json', 'csv', 'txt'] },
  ],
  'web-monitor': [
    { key: 'url', label: 'URL do monitorowania', type: 'string', required: true, placeholder: 'https://example.com' },
    { key: 'interval_minutes', label: 'Interwał (min)', type: 'number', default: 30 },
    { key: 'check_content', label: 'Sprawdź zmiany treści', type: 'boolean', default: true },
  ],
  'webhook-sender': [
    { key: 'url', label: 'Webhook URL', type: 'string', required: true, placeholder: 'https://hooks.example.com/...' },
    { key: 'payload', label: 'Payload (JSON)', type: 'text', required: true, placeholder: '{"event": "test"}' },
    { key: 'method', label: 'Metoda', type: 'select', default: 'POST', options: ['POST', 'PUT'] },
  ],
  'email-sender': [
    { key: 'to', label: 'Odbiorca', type: 'string', required: true, placeholder: 'user@example.com' },
    { key: 'subject', label: 'Temat', type: 'string', required: true, placeholder: 'Temat wiadomości' },
    { key: 'body', label: 'Treść', type: 'text', required: true, placeholder: 'Treść wiadomości...' },
  ],
  'telegram-bot': [
    { key: 'message', label: 'Wiadomość', type: 'text', required: true, placeholder: 'Treść wiadomości...' },
    { key: 'chat_id', label: 'Chat ID', type: 'string', placeholder: 'ID czatu lub @username' },
  ],
  'discord-bot': [
    { key: 'message', label: 'Wiadomość', type: 'text', required: true, placeholder: 'Treść wiadomości...' },
    { key: 'channel_id', label: 'Channel ID', type: 'string', placeholder: 'ID kanału Discord' },
  ],
  'report-generator': [
    { key: 'data_source', label: 'Źródło danych', type: 'string', required: true, placeholder: '/path/to/data.csv' },
    { key: 'report_type', label: 'Typ raportu', type: 'select', default: 'summary', options: ['summary', 'detailed', 'chart', 'comparison'] },
    { key: 'title', label: 'Tytuł raportu', type: 'string', placeholder: 'Raport miesięczny' },
  ],
  'price-tracker': [
    { key: 'url', label: 'URL produktu', type: 'string', required: true, placeholder: 'https://shop.example.com/product' },
    { key: 'selector', label: 'CSS selector ceny', type: 'string', placeholder: '.price' },
    { key: 'alert_below', label: 'Alert poniżej (PLN)', type: 'number', placeholder: '100' },
  ],
};

// Default schema for plugins without specific params
const DEFAULT_PARAM_SCHEMA: PluginParamSchema[] = [
  { key: 'input', label: 'Dane wejściowe', type: 'text', placeholder: 'Wprowadź dane...' },
];

interface PluginParamsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pluginName: string;
  isExecuting: boolean;
  onExecute: (params: Record<string, unknown>) => void;
}

export function PluginParamsDialog({
  open,
  onOpenChange,
  pluginName,
  isExecuting,
  onExecute,
}: PluginParamsDialogProps) {
  const schema = PLUGIN_PARAM_SCHEMAS[pluginName] || DEFAULT_PARAM_SCHEMA;
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    schema.forEach(p => {
      if (p.default !== undefined) initial[p.key] = p.default;
    });
    return initial;
  });
  const [customParams, setCustomParams] = useState<{ key: string; value: string }[]>([]);

  const setValue = (key: string, value: unknown) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const handleExecute = () => {
    const params = { ...values };
    customParams.forEach(cp => {
      if (cp.key.trim()) params[cp.key.trim()] = cp.value;
    });
    // Remove empty optional values
    Object.keys(params).forEach(k => {
      if (params[k] === '' || params[k] === undefined) delete params[k];
    });
    onExecute(params);
  };

  const hasRequiredFields = schema
    .filter(p => p.required)
    .every(p => values[p.key] !== undefined && values[p.key] !== '');

  const addCustomParam = () => {
    setCustomParams(prev => [...prev, { key: '', value: '' }]);
  };

  const updateCustomParam = (index: number, field: 'key' | 'value', val: string) => {
    setCustomParams(prev => prev.map((p, i) => i === index ? { ...p, [field]: val } : p));
  };

  const removeCustomParam = (index: number) => {
    setCustomParams(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            <span className="font-mono">{pluginName}</span>
          </DialogTitle>
          <DialogDescription>
            Skonfiguruj parametry przed uruchomieniem wtyczki
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-2">
          <div className="space-y-4 py-2">
            {schema.map(param => (
              <div key={param.key} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-medium">{param.label}</Label>
                  {param.required && (
                    <Badge variant="destructive" className="text-[9px] h-4 px-1">wymagane</Badge>
                  )}
                </div>
                {param.description && (
                  <p className="text-[10px] text-muted-foreground">{param.description}</p>
                )}

                {param.type === 'string' && (
                  <Input
                    className="h-8 text-sm"
                    placeholder={param.placeholder}
                    value={(values[param.key] as string) || ''}
                    onChange={e => setValue(param.key, e.target.value)}
                    maxLength={500}
                  />
                )}

                {param.type === 'number' && (
                  <Input
                    className="h-8 text-sm"
                    type="number"
                    placeholder={param.placeholder}
                    value={(values[param.key] as number) ?? ''}
                    onChange={e => setValue(param.key, e.target.value ? Number(e.target.value) : undefined)}
                  />
                )}

                {param.type === 'text' && (
                  <Textarea
                    className="text-xs min-h-[70px] resize-none"
                    placeholder={param.placeholder}
                    value={(values[param.key] as string) || ''}
                    onChange={e => setValue(param.key, e.target.value)}
                    maxLength={5000}
                  />
                )}

                {param.type === 'boolean' && (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!!values[param.key]}
                      onCheckedChange={checked => setValue(param.key, checked)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {values[param.key] ? 'Tak' : 'Nie'}
                    </span>
                  </div>
                )}

                {param.type === 'select' && param.options && (
                  <Select
                    value={(values[param.key] as string) || ''}
                    onValueChange={val => setValue(param.key, val)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Wybierz..." />
                    </SelectTrigger>
                    <SelectContent>
                      {param.options.map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ))}

            {/* Custom params */}
            {customParams.length > 0 && (
              <div className="border-t pt-3 space-y-2">
                <Label className="text-xs text-muted-foreground">Dodatkowe parametry</Label>
                {customParams.map((cp, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      className="h-7 text-xs flex-1"
                      placeholder="klucz"
                      value={cp.key}
                      onChange={e => updateCustomParam(i, 'key', e.target.value)}
                      maxLength={50}
                    />
                    <Input
                      className="h-7 text-xs flex-1"
                      placeholder="wartość"
                      value={cp.value}
                      onChange={e => updateCustomParam(i, 'value', e.target.value)}
                      maxLength={500}
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => removeCustomParam(i)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Button size="sm" variant="ghost" className="text-xs w-full" onClick={addCustomParam}>
              <Plus className="h-3 w-3 mr-1" />
              Dodaj parametr
            </Button>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button size="sm" onClick={handleExecute} disabled={!hasRequiredFields || isExecuting}>
            {isExecuting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Play className="h-4 w-4 mr-1" />
            )}
            Uruchom
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
