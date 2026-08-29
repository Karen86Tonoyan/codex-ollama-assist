import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Check, X, Loader2, Shield, AlertTriangle, Terminal, Zap,
  ChevronDown, ChevronRight, SkipForward
} from 'lucide-react';
import {
  type AgentAction, type AgentPlan, type AgentStepResult,
  executeSingleAction, formatStepResult, getRiskColor, getRiskLabel
} from '@/lib/agent-executor';
import { cn } from '@/lib/utils';

interface AgentApprovalPanelProps {
  plan: AgentPlan;
  onApprove: (actionId: string) => void;
  onReject: (actionId: string) => void;
  onApproveAll: () => void;
  onAbort: () => void;
  results: AgentStepResult[];
  isExecuting: boolean;
}

export function AgentApprovalPanel({
  plan,
  onApprove,
  onReject,
  onApproveAll,
  onAbort,
  results,
  isExecuting,
}: AgentApprovalPanelProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const hasLowRiskOnly = plan.actions.every(a => a.riskLevel === 'low' && a.cerberVerdict?.safe);

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="py-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">
              Agent Plan — {plan.actions.length} krok(ów)
            </span>
          </div>
          <div className="flex gap-2">
            {hasLowRiskOnly && plan.status === 'awaiting_approval' && (
              <Button size="sm" variant="outline" onClick={onApproveAll} className="gap-1 text-xs">
                <Zap className="h-3 w-3" />
                Zatwierdź wszystko
              </Button>
            )}
            <Button size="sm" variant="destructive" onClick={onAbort} className="gap-1 text-xs">
              <X className="h-3 w-3" />
              Przerwij
            </Button>
          </div>
        </div>

        {/* Steps */}
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-2">
            {plan.actions.map((action, index) => {
              const stepResult = results.find(r => r.action.id === action.id);
              const isCurrentStep = index === plan.currentStep && plan.status !== 'completed';
              const isExpanded = expandedStep === action.id;
              const isCerberBlocked = action.cerberVerdict && !action.cerberVerdict.safe;

              return (
                <div
                  key={action.id}
                  className={cn(
                    'rounded-lg border p-3 transition-all',
                    isCurrentStep && 'ring-2 ring-primary/50',
                    action.status === 'done' && 'opacity-70',
                    action.status === 'rejected' && 'opacity-50',
                    action.status === 'error' && 'border-destructive/50',
                    isCerberBlocked && 'border-red-500/50 bg-red-500/5'
                  )}
                >
                  {/* Step Header */}
                  <div className="flex items-start gap-3">
                    {/* Step Number */}
                    <div className={cn(
                      'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                      action.status === 'done' ? 'bg-green-500 text-white' :
                      action.status === 'error' ? 'bg-red-500 text-white' :
                      action.status === 'rejected' || action.status === 'skipped' ? 'bg-muted text-muted-foreground' :
                      action.status === 'executing' ? 'bg-primary text-primary-foreground' :
                      'bg-muted text-foreground'
                    )}>
                      {action.status === 'done' ? <Check className="h-3 w-3" /> :
                       action.status === 'executing' ? <Loader2 className="h-3 w-3 animate-spin" /> :
                       action.status === 'rejected' ? <X className="h-3 w-3" /> :
                       action.status === 'skipped' ? <SkipForward className="h-3 w-3" /> :
                       index + 1}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{action.description}</span>
                        <Badge className={cn('text-[10px]', getRiskColor(action.riskLevel))}>
                          {getRiskLabel(action.riskLevel)}
                        </Badge>
                        {isCerberBlocked && (
                          <Badge variant="destructive" className="text-[10px] gap-1">
                            <Shield className="h-2.5 w-2.5" />
                            CERBER BLOCK
                          </Badge>
                        )}
                      </div>

                      {/* Explanation */}
                      <p className="text-xs text-muted-foreground mt-1">
                        {action.explanation}
                      </p>

                      {/* Cerber Verdict */}
                      {action.cerberVerdict && (
                        <div className={cn(
                          'text-xs mt-1.5 p-1.5 rounded',
                          action.cerberVerdict.safe ? 'text-muted-foreground' : 'text-red-600 bg-red-500/10'
                        )}>
                          <Shield className="h-3 w-3 inline mr-1" />
                          {action.cerberVerdict.reason}
                        </div>
                      )}

                      {/* Command Preview */}
                      <button
                        onClick={() => setExpandedStep(isExpanded ? null : action.id)}
                        className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5 hover:text-foreground"
                      >
                        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        <Terminal className="h-3 w-3" />
                        {action.command}
                      </button>

                      {isExpanded && (
                        <pre className="text-xs font-mono bg-muted/30 rounded p-2 mt-1 whitespace-pre-wrap">
                          {action.command}
                        </pre>
                      )}

                      {/* Result */}
                      {stepResult && (
                        <div className={cn(
                          'mt-2 p-2 rounded text-xs font-mono',
                          stepResult.success ? 'bg-green-500/10 text-green-700' : 'bg-red-500/10 text-red-700'
                        )}>
                          <pre className="whitespace-pre-wrap max-h-[100px] overflow-auto">
                            {stepResult.output.slice(0, 500) || (stepResult.success ? 'OK' : 'Błąd')}
                          </pre>
                          {stepResult.result?.duration_ms && (
                            <span className="text-muted-foreground">{stepResult.result.duration_ms}ms</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Approve/Reject Buttons */}
                    {action.status === 'pending' && isCurrentStep && !isCerberBlocked && (
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          className="h-8 gap-1 bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => onApprove(action.id)}
                          disabled={isExecuting}
                        >
                          <Check className="h-3 w-3" />
                          TAK
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8 gap-1"
                          onClick={() => onReject(action.id)}
                          disabled={isExecuting}
                        >
                          <X className="h-3 w-3" />
                          NIE
                        </Button>
                      </div>
                    )}

                    {isCerberBlocked && action.status === 'pending' && (
                      <Badge variant="destructive" className="text-xs flex-shrink-0">
                        Zablokowane
                      </Badge>
                    )}

                    {action.status === 'executing' && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Summary */}
        {plan.status === 'completed' && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-500/10 rounded-lg p-2">
            <Check className="h-4 w-4" />
            Plan zakończony — {results.filter(r => r.success).length}/{results.length} kroków wykonanych pomyślnie
          </div>
        )}
      </CardContent>
    </Card>
  );
}
