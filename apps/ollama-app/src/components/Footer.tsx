import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import type { Model, SystemStatus } from '@/lib/api';

interface FooterProps {
  models: Model[];
  activeModel: string;
  onModelChange: (model: string) => void;
  systemStatus: SystemStatus;
}

export function Footer({ models, activeModel, onModelChange, systemStatus }: FooterProps) {
  const tokensPercent = systemStatus.tokensLimit 
    ? ((systemStatus.tokensUsed || 0) / systemStatus.tokensLimit) * 100 
    : 0;

  return (
    <footer className="flex items-center justify-between border-t border-border px-6 py-3">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Model:</span>
          <Select value={activeModel} onValueChange={onModelChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Wybierz model" />
            </SelectTrigger>
            <SelectContent>
              {models.length === 0 ? (
                <SelectItem value="none" disabled>Brak modeli</SelectItem>
              ) : (
                models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {systemStatus.cpu !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">CPU:</span>
            <span className="text-sm font-medium">{systemStatus.cpu}%</span>
          </div>
        )}
        
        {systemStatus.ram !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">RAM:</span>
            <span className="text-sm font-medium">{systemStatus.ram}%</span>
          </div>
        )}

        {/* Token usage removed */}
      </div>
    </footer>
  );
}
