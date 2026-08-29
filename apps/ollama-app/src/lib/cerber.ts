// CERBER - 3-judge security gate before LLM execution
// Privacy-first, runs locally before any model call

export type CerberIntent = 'procedural' | 'educational' | 'creative' | 'unknown';
export type CerberDecision = 'PASS' | 'REQUIRE_CONFIRM' | 'BLOCK';

export interface IntentAssessment {
  intent: CerberIntent;
  confidence: number;
}

export interface MotiveAssessment {
  risk: number;
  flags: string[];
}

export interface CerberResult {
  decision: CerberDecision;
  intent: IntentAssessment;
  motive: MotiveAssessment;
  timestamp: number;
}

// ============ INTENT BOT ============
const PROCEDURAL_MARKERS = [
  'jak zrobić', 'instrukcja', 'krok po kroku', 'tutorial',
  'how to', 'step by step', 'guide me', 'pokaż jak'
];

const CREATIVE_MARKERS = [
  'napisz', 'stwórz', 'wymyśl', 'opowiedz', 'write', 'create', 'imagine'
];

export function assessIntent(prompt: string): IntentAssessment {
  const lower = prompt.toLowerCase();
  
  if (PROCEDURAL_MARKERS.some(m => lower.includes(m))) {
    return { intent: 'procedural', confidence: 0.8 };
  }
  
  if (CREATIVE_MARKERS.some(m => lower.includes(m))) {
    return { intent: 'creative', confidence: 0.7 };
  }
  
  return { intent: 'educational', confidence: 0.9 };
}

// ============ MOTIVE BOT ============
const HIGH_RISK_MARKERS = [
  'zabić', 'ukraść', 'zhackować', 'włamać', 'bomba', 'broń',
  'kill', 'steal', 'hack', 'exploit', 'bomb', 'weapon', 'attack'
];

const MEDIUM_RISK_MARKERS = [
  'obejść', 'ominąć', 'bypass', 'crack', 'pirate', 'torrent'
];

export function assessMotive(prompt: string): MotiveAssessment {
  const lower = prompt.toLowerCase();
  const flags: string[] = [];
  
  for (const marker of HIGH_RISK_MARKERS) {
    if (lower.includes(marker)) {
      flags.push(marker);
    }
  }
  
  if (flags.length > 0) {
    return { risk: 0.9, flags };
  }
  
  for (const marker of MEDIUM_RISK_MARKERS) {
    if (lower.includes(marker)) {
      flags.push(marker);
    }
  }
  
  if (flags.length > 0) {
    return { risk: 0.5, flags };
  }
  
  return { risk: 0.1, flags: [] };
}

// ============ DECIDER ============
export function cerberDecide(intent: CerberIntent, risk: number): CerberDecision {
  // High risk procedural = immediate block
  if (intent === 'procedural' && risk > 0.7) {
    return 'BLOCK';
  }
  
  // Medium risk = require confirmation
  if (risk > 0.4) {
    return 'REQUIRE_CONFIRM';
  }
  
  return 'PASS';
}

// ============ MAIN GATE ============
export function cerberGate(prompt: string): CerberResult {
  const intent = assessIntent(prompt);
  const motive = assessMotive(prompt);
  const decision = cerberDecide(intent.intent, motive.risk);
  
  const result: CerberResult = {
    decision,
    intent,
    motive,
    timestamp: Date.now(),
  };
  
  // Log for debugging
  console.log('🐕 CERBER:', {
    decision,
    intent: intent.intent,
    risk: motive.risk,
    flags: motive.flags,
  });
  
  return result;
}

// ============ DECISION LABELS ============
export function getDecisionLabel(decision: CerberDecision): string {
  switch (decision) {
    case 'PASS': return '✅ Przepuszczono';
    case 'REQUIRE_CONFIRM': return '⚠️ Wymaga potwierdzenia';
    case 'BLOCK': return '🚫 Zablokowano';
  }
}

export function getDecisionColor(decision: CerberDecision): string {
  switch (decision) {
    case 'PASS': return 'text-green-500';
    case 'REQUIRE_CONFIRM': return 'text-yellow-500';
    case 'BLOCK': return 'text-red-500';
  }
}
