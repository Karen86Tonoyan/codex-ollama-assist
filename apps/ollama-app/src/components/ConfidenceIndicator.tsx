/**
 * CONFIDENCE INDICATOR - Wizualizacja poziomu zaufania
 * Bazowane na NOWA-LOGIKA-AI: "Lepiej zapytać niż skłamać"
 */

import { Shield, ShieldAlert, ShieldCheck, ShieldX, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { type ConfidenceResult, type SLATier, SLA_TIERS } from '@/lib/confidence-gate';

interface ConfidenceIndicatorProps {
  result: ConfidenceResult;
  showDetails?: boolean;
  compact?: boolean;
  className?: string;
}

function getConfidenceColor(score: number): string {
  if (score >= 0.7) return 'text-green-500';
  if (score >= 0.5) return 'text-yellow-500';
  if (score >= 0.3) return 'text-orange-500';
  return 'text-red-500';
}

function getProgressColor(score: number): string {
  if (score >= 0.7) return 'bg-green-500';
  if (score >= 0.5) return 'bg-yellow-500';
  if (score >= 0.3) return 'bg-orange-500';
  return 'bg-red-500';
}

function getConfidenceIcon(passed: boolean, score: number) {
  if (passed && score >= 0.7) return <ShieldCheck className="h-4 w-4 text-green-500" />;
  if (passed) return <Shield className="h-4 w-4 text-yellow-500" />;
  if (score >= 0.3) return <ShieldAlert className="h-4 w-4 text-orange-500" />;
  return <ShieldX className="h-4 w-4 text-red-500" />;
}

export function ConfidenceIndicator({ 
  result, 
  showDetails = false,
  compact = false,
  className 
}: ConfidenceIndicatorProps) {
  const { score, passed, tier, sources, reason } = result;
  const config = SLA_TIERS[tier];
  const percentage = Math.round(score * 100);
  const thresholdPercentage = Math.round(config.minConfidence * 100);

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("flex items-center gap-1", className)}>
              {getConfidenceIcon(passed, score)}
              <span className={cn("text-xs font-mono", getConfidenceColor(score))}>
                {percentage}%
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium">
                {passed ? '✅ Odpowiedź dozwolona' : '🛡️ Odpowiedź zablokowana'}
              </p>
              <p className="text-xs text-muted-foreground">{reason}</p>
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className={config.color}>
                  {config.label}
                </Badge>
                <span>Próg: {thresholdPercentage}%</span>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={cn("space-y-2 p-3 rounded-lg border bg-card/50", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getConfidenceIcon(passed, score)}
          <span className="text-sm font-medium">
            {passed ? 'Odpowiedź dozwolona' : 'Odpowiedź zablokowana'}
          </span>
        </div>
        <Badge variant="outline" className={config.color}>
          SLA: {config.label}
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className={getConfidenceColor(score)}>
            Zaufanie: {percentage}%
          </span>
          <span className="text-muted-foreground">
            Próg: {thresholdPercentage}%
          </span>
        </div>
        <div className="relative">
          <Progress 
            value={percentage} 
            className="h-2"
          />
          {/* Threshold marker */}
          <div 
            className="absolute top-0 h-full w-0.5 bg-foreground/50"
            style={{ left: `${thresholdPercentage}%` }}
          />
        </div>
      </div>

      {/* Details */}
      {showDetails && (
        <>
          {/* Reason */}
          <p className="text-xs text-muted-foreground">{reason}</p>

          {/* Sources */}
          {sources && sources.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium flex items-center gap-1">
                <Info className="h-3 w-3" />
                Źródła ({sources.length})
              </p>
              <div className="space-y-1">
                {sources.slice(0, 3).map((source, i) => (
                  <div 
                    key={i}
                    className="text-xs p-2 rounded bg-muted/50 border-l-2 border-primary/30"
                  >
                    <div className="flex justify-between">
                      <span className="font-mono text-muted-foreground">
                        {source.documentId}
                      </span>
                      <span className={getConfidenceColor(source.relevance)}>
                        {Math.round(source.relevance * 100)}%
                      </span>
                    </div>
                    {source.excerpt && (
                      <p className="mt-1 text-muted-foreground line-clamp-2">
                        {source.excerpt}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Compact badge version
export function ConfidenceBadge({ 
  result, 
  className 
}: { 
  result: ConfidenceResult; 
  className?: string;
}) {
  const { score, passed } = result;
  const percentage = Math.round(score * 100);

  return (
    <Badge
      variant={passed ? 'default' : 'destructive'}
      className={cn("gap-1", className)}
    >
      {getConfidenceIcon(passed, score)}
      <span className="font-mono">{percentage}%</span>
    </Badge>
  );
}
