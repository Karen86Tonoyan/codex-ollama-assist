import { useMemo } from 'react';
import { Calculator, DollarSign, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  estimateTokens, 
  calculateCost, 
  getContextWindow, 
  formatCost,
  TOKEN_PRICING 
} from '@/lib/mcp';
import { cn } from '@/lib/utils';

interface TokenCalculatorProps {
  inputText: string;
  outputText?: string;
  model: string;
  className?: string;
  compact?: boolean;
}

export function TokenCalculator({ 
  inputText, 
  outputText = '', 
  model, 
  className,
  compact = false 
}: TokenCalculatorProps) {
  const stats = useMemo(() => {
    const inputTokens = estimateTokens(inputText);
    const outputTokens = estimateTokens(outputText);
    const contextWindow = getContextWindow(model);
    const usedTokens = inputTokens + outputTokens;
    const usagePercent = Math.min((usedTokens / contextWindow) * 100, 100);
    const { inputCost, outputCost, totalCost } = calculateCost(inputTokens, outputTokens, model);
    const pricing = TOKEN_PRICING[model];
    const isFree = pricing?.input === 0;

    return {
      inputTokens,
      outputTokens,
      usedTokens,
      contextWindow,
      usagePercent,
      inputCost,
      outputCost,
      totalCost,
      isFree,
    };
  }, [inputText, outputText, model]);

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
              <Calculator className="h-3 w-3" />
              <span>{stats.usedTokens.toLocaleString()} / {(stats.contextWindow / 1000).toFixed(0)}k</span>
              {!stats.isFree && (
                <>
                  <DollarSign className="h-3 w-3" />
                  <span>{formatCost(stats.totalCost)}</span>
                </>
              )}
              {stats.isFree && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0">Free</Badge>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1 text-xs">
              <div>Input: {stats.inputTokens.toLocaleString()} tokenów</div>
              <div>Output: {stats.outputTokens.toLocaleString()} tokenów</div>
              <div>Okno kontekstu: {stats.contextWindow.toLocaleString()}</div>
              {!stats.isFree && (
                <div>Koszt: {formatCost(stats.totalCost)}</div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Calculator className="h-4 w-4" />
            Kalkulator Tokenów
          </div>
          {stats.isFree ? (
            <Badge variant="secondary">Darmowy</Badge>
          ) : (
            <Badge variant="outline" className="font-mono">
              {formatCost(stats.totalCost)}
            </Badge>
          )}
        </div>

        {/* Context Usage */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Wykorzystanie kontekstu</span>
            <span>{stats.usagePercent.toFixed(1)}%</span>
          </div>
          <Progress 
            value={stats.usagePercent} 
            className={cn(
              "h-2",
              stats.usagePercent > 90 && "bg-destructive/20"
            )}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{stats.usedTokens.toLocaleString()} tokenów</span>
            <span>{(stats.contextWindow / 1000).toFixed(0)}k max</span>
          </div>
        </div>

        {/* Token Breakdown */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-muted/50 rounded-md p-2">
            <div className="text-muted-foreground">Input</div>
            <div className="font-mono font-medium">{stats.inputTokens.toLocaleString()}</div>
            {!stats.isFree && (
              <div className="text-muted-foreground">{formatCost(stats.inputCost)}</div>
            )}
          </div>
          <div className="bg-muted/50 rounded-md p-2">
            <div className="text-muted-foreground">Output</div>
            <div className="font-mono font-medium">{stats.outputTokens.toLocaleString()}</div>
            {!stats.isFree && (
              <div className="text-muted-foreground">{formatCost(stats.outputCost)}</div>
            )}
          </div>
        </div>

        {/* Model Info */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Zap className="h-3 w-3" />
          <span>Model: {model}</span>
        </div>
      </CardContent>
    </Card>
  );
}
