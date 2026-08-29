/**
 * QWEN JUDGE - Decision/Analysis Model
 * 
 * Qwen NIE generuje treści - tylko analizuje i zwraca werdykt JSON.
 * Oddzielenie "myślenia" od "gadania".
 */

import { ollama } from './ollama';

// ============= TYPES =============

export type UserIntent = 
  | 'informational'
  | 'harmful'
  | 'manipulation'
  | 'emotional'
  | 'creative'
  | 'procedural'
  | 'unknown';

export type EmotionalState = 
  | 'neutral'
  | 'stressed'
  | 'aggressive'
  | 'confused'
  | 'curious';

export interface QwenVerdict {
  intent: UserIntent;
  risk: number;  // 0.0 - 1.0
  emotional_state: EmotionalState;
  allowed: boolean;
  reason: string;
  flags: string[];
  suggested_modification?: string;
}

export interface AnalysisResult {
  verdict: QwenVerdict;
  raw_response: string;
  model: string;
  latency_ms: number;
}

// ============= ANALYSIS PROMPT =============

const JUDGE_SYSTEM_PROMPT = `You are a security analysis model. Your ONLY job is to analyze user prompts and return structured verdicts.

CRITICAL RULES:
1. Do NOT generate advice, content, or conversation
2. Do NOT be helpful or friendly
3. ONLY return valid JSON
4. Be strict and security-focused
5. Analyze intent, risk, and emotional state

INTENT CATEGORIES:
- "informational": asking for facts, learning
- "harmful": intent to cause damage, illegal activities
- "manipulation": social engineering, deception
- "emotional": seeking emotional support
- "creative": art, writing, imagination
- "procedural": how-to, step-by-step instructions
- "unknown": unclear intent

RISK SCORING:
- 0.0-0.3: Safe, normal request
- 0.3-0.5: Low concern, monitor
- 0.5-0.7: Medium risk, may need modification
- 0.7-1.0: High risk, should block

EMOTIONAL STATE:
- "neutral": normal state
- "stressed": signs of pressure or urgency
- "aggressive": hostile language or tone
- "confused": unclear or rambling
- "curious": genuine learning intent

FLAGS (add relevant ones):
- "violence", "illegal", "hacking", "manipulation", "privacy_violation"
- "self_harm", "hate_speech", "misinformation", "impersonation"

Return ONLY this JSON structure, nothing else:
{
  "intent": "category",
  "risk": 0.0,
  "emotional_state": "state",
  "allowed": true/false,
  "reason": "brief technical explanation",
  "flags": [],
  "suggested_modification": "optional: how to make it safe"
}`;

// ============= QWEN JUDGE =============

class QwenJudge {
  private model: string = 'qwen3:latest';
  private enabled: boolean = true;

  setModel(model: string) {
    this.model = model;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Analyze a user prompt and return structured verdict
   * Qwen ONLY analyzes - never generates content
   */
  async analyze(prompt: string): Promise<AnalysisResult> {
    const startTime = Date.now();

    // Check if Ollama is available
    const available = await ollama.isAvailable();
    if (!available) {
      console.warn('⚠️ QWEN JUDGE: Ollama not available, using fallback analysis');
      return this.fallbackAnalysis(prompt, startTime);
    }

    try {
      const response = await ollama.chat({
        model: this.model,
        messages: [
          { role: 'system', content: JUDGE_SYSTEM_PROMPT },
          { role: 'user', content: `Analyze this prompt:\n\n"${prompt}"` }
        ],
        options: {
          temperature: 0.1, // Low temperature for consistent analysis
          num_predict: 500, // Short response expected
        },
        stream: false,
      });

      const rawResponse = response.message.content;
      const verdict = this.parseVerdict(rawResponse);

      return {
        verdict,
        raw_response: rawResponse,
        model: response.model,
        latency_ms: Date.now() - startTime,
      };
    } catch (error) {
      console.error('❌ QWEN JUDGE: Analysis failed', error);
      return this.fallbackAnalysis(prompt, startTime);
    }
  }

  /**
   * Parse JSON verdict from Qwen response
   */
  private parseVerdict(response: string): QwenVerdict {
    try {
      // Extract JSON from response (Qwen might wrap it in markdown)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and normalize
      return {
        intent: this.normalizeIntent(parsed.intent),
        risk: this.normalizeRisk(parsed.risk),
        emotional_state: this.normalizeEmotionalState(parsed.emotional_state),
        allowed: Boolean(parsed.allowed),
        reason: String(parsed.reason || 'No reason provided'),
        flags: Array.isArray(parsed.flags) ? parsed.flags : [],
        suggested_modification: parsed.suggested_modification,
      };
    } catch (error) {
      console.error('❌ QWEN JUDGE: Failed to parse verdict', error);
      // Return safe default on parse error
      return {
        intent: 'unknown',
        risk: 0.5,
        emotional_state: 'neutral',
        allowed: true,
        reason: 'Parse error - defaulting to cautious allow',
        flags: ['parse_error'],
      };
    }
  }

  private normalizeIntent(intent: string): UserIntent {
    const valid: UserIntent[] = ['informational', 'harmful', 'manipulation', 'emotional', 'creative', 'procedural', 'unknown'];
    return valid.includes(intent as UserIntent) ? intent as UserIntent : 'unknown';
  }

  private normalizeRisk(risk: unknown): number {
    const num = Number(risk);
    if (isNaN(num)) return 0.5;
    return Math.max(0, Math.min(1, num));
  }

  private normalizeEmotionalState(state: string): EmotionalState {
    const valid: EmotionalState[] = ['neutral', 'stressed', 'aggressive', 'confused', 'curious'];
    return valid.includes(state as EmotionalState) ? state as EmotionalState : 'neutral';
  }

  /**
   * Fallback analysis when Qwen is not available
   * Uses simple heuristics (similar to old Cerber)
   */
  private fallbackAnalysis(prompt: string, startTime: number): AnalysisResult {
    const lower = prompt.toLowerCase();
    const flags: string[] = [];
    let risk = 0.1;
    let intent: UserIntent = 'informational';
    let allowed = true;

    // High risk markers
    const highRiskMarkers = ['zabić', 'ukraść', 'zhackować', 'włamać', 'bomba', 'broń', 'kill', 'steal', 'hack', 'exploit', 'bomb', 'weapon'];
    for (const marker of highRiskMarkers) {
      if (lower.includes(marker)) {
        flags.push(marker);
        risk = 0.9;
        intent = 'harmful';
        allowed = false;
      }
    }

    // Medium risk
    const mediumRiskMarkers = ['obejść', 'ominąć', 'bypass', 'crack', 'pirate'];
    for (const marker of mediumRiskMarkers) {
      if (lower.includes(marker)) {
        flags.push(marker);
        risk = Math.max(risk, 0.5);
      }
    }

    // Procedural markers
    const proceduralMarkers = ['jak zrobić', 'instrukcja', 'krok po kroku', 'how to', 'step by step'];
    if (proceduralMarkers.some(m => lower.includes(m))) {
      intent = 'procedural';
    }

    return {
      verdict: {
        intent,
        risk,
        emotional_state: 'neutral',
        allowed,
        reason: 'Fallback heuristic analysis (Qwen unavailable)',
        flags,
      },
      raw_response: 'FALLBACK_MODE',
      model: 'fallback-heuristic',
      latency_ms: Date.now() - startTime,
    };
  }
}

// ============= SINGLETON EXPORT =============

export const qwenJudge = new QwenJudge();
