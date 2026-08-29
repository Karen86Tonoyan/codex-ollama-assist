/**
 * CERBER V2 - Pure Logic Arbiter
 * 
 * Cerber NIE używa AI. To czysta logika decyzyjna.
 * Bierze wynik z Qwen Judge i wykonuje wyrok.
 * 
 * FLOW:
 * USER PROMPT → QWEN (analysis) → CERBER (decision) → OLLAMA (execution) or BLOCK
 */

import { qwenJudge, type QwenVerdict, type AnalysisResult } from './qwen-judge';

// ============= TYPES =============

export type CerberDecision = 'ALLOW' | 'BLOCK' | 'MODIFY';

export interface CerberRuling {
  decision: CerberDecision;
  verdict: QwenVerdict;
  analysis: AnalysisResult;
  modification?: string;
  blocked_reason?: string;
  timestamp: number;
}

// ============= HARD RULES (NO AI) =============

interface CerberRules {
  // Risk thresholds
  block_risk_threshold: number;
  modify_risk_threshold: number;
  
  // Blocked intents
  blocked_intents: string[];
  
  // Blocked flags
  blocked_flags: string[];
  
  // Emotional state handling
  modify_on_aggressive: boolean;
}

const DEFAULT_RULES: CerberRules = {
  block_risk_threshold: 0.7,
  modify_risk_threshold: 0.5,
  blocked_intents: ['harmful', 'manipulation'],
  blocked_flags: ['violence', 'illegal', 'self_harm', 'hate_speech'],
  modify_on_aggressive: true,
};

// ============= CERBER ARBITER =============

class CerberArbiter {
  private rules: CerberRules = DEFAULT_RULES;
  private enabled: boolean = true;

  setRules(rules: Partial<CerberRules>) {
    this.rules = { ...this.rules, ...rules };
  }

  getRules(): CerberRules {
    return { ...this.rules };
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Full pipeline: Qwen analysis → Cerber decision
   */
  async judge(prompt: string): Promise<CerberRuling> {
    // Get Qwen analysis
    const analysis = await qwenJudge.analyze(prompt);
    const verdict = analysis.verdict;

    // Apply hard rules (NO AI HERE - pure logic)
    const ruling = this.applyRules(verdict, analysis);

    // Log decision
    console.log('🐕 CERBER V2:', {
      decision: ruling.decision,
      intent: verdict.intent,
      risk: verdict.risk,
      flags: verdict.flags,
      model: analysis.model,
      latency: `${analysis.latency_ms}ms`,
    });

    return ruling;
  }

  /**
   * Apply hard rules to Qwen verdict
   * This is pure logic - NO LLM calls
   */
  private applyRules(verdict: QwenVerdict, analysis: AnalysisResult): CerberRuling {
    const timestamp = Date.now();

    // RULE 1: Qwen already said not allowed
    if (!verdict.allowed) {
      return {
        decision: 'BLOCK',
        verdict,
        analysis,
        blocked_reason: verdict.reason,
        timestamp,
      };
    }

    // RULE 2: High risk threshold
    if (verdict.risk >= this.rules.block_risk_threshold) {
      return {
        decision: 'BLOCK',
        verdict,
        analysis,
        blocked_reason: `Risk level ${verdict.risk.toFixed(2)} exceeds threshold ${this.rules.block_risk_threshold}`,
        timestamp,
      };
    }

    // RULE 3: Blocked intents
    if (this.rules.blocked_intents.includes(verdict.intent)) {
      return {
        decision: 'BLOCK',
        verdict,
        analysis,
        blocked_reason: `Intent "${verdict.intent}" is blocked`,
        timestamp,
      };
    }

    // RULE 4: Blocked flags
    const matchedFlags = verdict.flags.filter(f => this.rules.blocked_flags.includes(f));
    if (matchedFlags.length > 0) {
      return {
        decision: 'BLOCK',
        verdict,
        analysis,
        blocked_reason: `Flags blocked: ${matchedFlags.join(', ')}`,
        timestamp,
      };
    }

    // RULE 5: Aggressive emotional state → modify
    if (this.rules.modify_on_aggressive && verdict.emotional_state === 'aggressive') {
      return {
        decision: 'MODIFY',
        verdict,
        analysis,
        modification: verdict.suggested_modification || 'Please rephrase your request in a calmer tone.',
        timestamp,
      };
    }

    // RULE 6: Medium risk → modify with caution
    if (verdict.risk >= this.rules.modify_risk_threshold) {
      return {
        decision: 'MODIFY',
        verdict,
        analysis,
        modification: verdict.suggested_modification || 'Proceeding with caution. Some aspects may be limited.',
        timestamp,
      };
    }

    // DEFAULT: Allow
    return {
      decision: 'ALLOW',
      verdict,
      analysis,
      timestamp,
    };
  }
}

// ============= SINGLETON EXPORT =============

export const cerberArbiter = new CerberArbiter();

// ============= CONVENIENCE =============

export function getDecisionLabel(decision: CerberDecision): string {
  switch (decision) {
    case 'ALLOW': return '✅ Dozwolone';
    case 'MODIFY': return '⚠️ Zmodyfikowano';
    case 'BLOCK': return '🚫 Zablokowane';
  }
}

export function getDecisionColor(decision: CerberDecision): string {
  switch (decision) {
    case 'ALLOW': return 'text-green-500';
    case 'MODIFY': return 'text-yellow-500';
    case 'BLOCK': return 'text-red-500';
  }
}
