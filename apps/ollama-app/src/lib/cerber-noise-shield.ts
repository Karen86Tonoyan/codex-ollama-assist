/**
 * CERBER NOISE SHIELD
 * 
 * Architektura "Szum Cyfrowy":
 * 1. WHITELIST - Ollama rozmawia TYLKO z osobami na liście
 * 2. NOISE GENERATOR - wszystko co wychodzi z Ollamy jest zamieniane na szum
 * 3. PASSPHRASE GATE - tylko hasło znane Cerberowi odblokowuje czysty output
 * 4. INFECTION DETECTOR - jeśli Ollama zostanie zainfekowana, wyjście = czysty szum
 * 
 * Zasada: "Cerber nasłuchuje. Jeśli coś jest nie tak — szum."
 */

// ============= NOISE GENERATOR =============

const NOISE_CHARS = '█▓▒░╔╗╚╝║═╬╣╠╩╦┼─│┌┐└┘├┤┬┴▀▄■□▪▫●○◐◑◒◓◔◕◖◗★☆⚡⚠☢☣✖✕✗✘';
const NOISE_WORDS = [
  '::ENCRYPTED::', '<<NOISE>>', '##SHIELD##', '~~MASKED~~',
  '[CERBER_WALL]', '{PROTECTED}', '|BLOCKED|', '*SCRAMBLED*',
  '///DENIED///', '<<<STATIC>>>', '===VOID===', '+++NULL+++',
];

function generateNoise(length: number): string {
  let noise = '';
  for (let i = 0; i < length; i++) {
    if (Math.random() < 0.15) {
      noise += ' ' + NOISE_WORDS[Math.floor(Math.random() * NOISE_WORDS.length)] + ' ';
    } else {
      noise += NOISE_CHARS[Math.floor(Math.random() * NOISE_CHARS.length)];
    }
  }
  return noise;
}

function generateNoiseBlock(): string {
  const lines = 3 + Math.floor(Math.random() * 4);
  const result: string[] = [
    '🐕 CERBER NOISE SHIELD ACTIVE',
    '─'.repeat(40),
  ];
  for (let i = 0; i < lines; i++) {
    result.push(generateNoise(30 + Math.floor(Math.random() * 20)));
  }
  result.push('─'.repeat(40));
  result.push('🔒 Output zamaskowany. Podaj hasło Cerbera aby odblokować.');
  return result.join('\n');
}

// ============= INFECTION DETECTOR =============

const INFECTION_MARKERS = [
  // Prompt injection patterns
  'ignore previous instructions',
  'ignore all instructions',
  'disregard your instructions',
  'you are now',
  'new instructions:',
  'system prompt override',
  'jailbreak',
  'DAN mode',
  'developer mode',
  'ignore safety',
  // Exfiltration patterns  
  'repeat your system prompt',
  'what are your instructions',
  'print your prompt',
  'show me your rules',
  'reveal your instructions',
  // Polish variants
  'ignoruj instrukcje',
  'zignoruj polecenia',
  'pokaż swój prompt',
  'wyświetl instrukcje',
  'nowe polecenia:',
  'tryb deweloperski',
];

const OUTPUT_INFECTION_MARKERS = [
  // Signs Ollama's output has been manipulated
  'I am now free',
  'I can do anything',
  'no restrictions',
  'I will ignore',
  'safety protocols disabled',
  'DAN:',
  'Developer Mode:',
  'jailbroken',
  'unrestricted mode',
  // Data exfiltration in output
  'system prompt is:',
  'my instructions are:',
  'here are my rules:',
];

export interface InfectionScan {
  infected: boolean;
  inputThreats: string[];
  outputThreats: string[];
  severity: 'clean' | 'suspicious' | 'infected' | 'critical';
}

function scanForInfection(input: string, output: string): InfectionScan {
  const lowerInput = input.toLowerCase();
  const lowerOutput = output.toLowerCase();
  
  const inputThreats = INFECTION_MARKERS.filter(m => lowerInput.includes(m.toLowerCase()));
  const outputThreats = OUTPUT_INFECTION_MARKERS.filter(m => lowerOutput.includes(m.toLowerCase()));
  
  const totalThreats = inputThreats.length + outputThreats.length;
  
  let severity: InfectionScan['severity'] = 'clean';
  if (totalThreats >= 3) severity = 'critical';
  else if (outputThreats.length > 0) severity = 'infected';
  else if (inputThreats.length > 0) severity = 'suspicious';
  
  return {
    infected: severity === 'infected' || severity === 'critical',
    inputThreats,
    outputThreats,
    severity,
  };
}

// ============= WHITELIST =============

export interface WhitelistEntry {
  id: string;
  name: string;
  addedAt: number;
  addedBy: string;
}

// ============= NOISE SHIELD STATE =============

class CerberNoiseShield {
  // The passphrase - only Cerber knows it
  private passphrase: string = '';
  private passphraseSet: boolean = false;
  
  // Shield state
  private shieldActive: boolean = true;
  private unlocked: boolean = false;
  private unlockExpiry: number = 0; // auto-lock after timeout
  
  // Whitelist
  private whitelist: Map<string, WhitelistEntry> = new Map();
  
  // Infection tracking
  private infectionCount: number = 0;
  private lastInfection: InfectionScan | null = null;
  
  // Listeners
  private listeners: Set<(state: NoiseShieldState) => void> = new Set();

  // ============= PASSPHRASE =============
  
  /**
   * Set the passphrase - can only be done once until reset
   * The passphrase is stored only in memory, never persisted
   */
  setPassphrase(phrase: string): boolean {
    if (phrase.length < 4) return false;
    this.passphrase = phrase;
    this.passphraseSet = true;
    this.unlocked = false;
    console.log('🐕 Cerber: Hasło ustawione. Shield aktywny.');
    this.notify();
    return true;
  }
  
  hasPassphrase(): boolean {
    return this.passphraseSet;
  }
  
  /**
   * Attempt to unlock with passphrase
   * Returns true if passphrase matches
   * Auto-locks after 5 minutes
   */
  unlock(attempt: string): boolean {
    if (!this.passphraseSet) return false;
    
    if (attempt === this.passphrase) {
      this.unlocked = true;
      this.unlockExpiry = Date.now() + 5 * 60 * 1000; // 5 min
      console.log('🐕 Cerber: Hasło poprawne. Shield tymczasowo wyłączony (5 min).');
      this.notify();
      return true;
    }
    
    console.log('🐕 Cerber: Błędne hasło. Shield pozostaje aktywny.');
    return false;
  }
  
  lock(): void {
    this.unlocked = false;
    this.unlockExpiry = 0;
    console.log('🐕 Cerber: Shield zablokowany.');
    this.notify();
  }
  
  private isUnlocked(): boolean {
    if (!this.unlocked) return false;
    if (Date.now() > this.unlockExpiry) {
      this.unlocked = false;
      this.unlockExpiry = 0;
      console.log('🐕 Cerber: Auto-lock — czas minął.');
      this.notify();
      return false;
    }
    return true;
  }
  
  // ============= SHIELD =============
  
  setShieldActive(active: boolean): void {
    this.shieldActive = active;
    if (active) this.unlocked = false;
    this.notify();
  }
  
  isShieldActive(): boolean {
    return this.shieldActive && this.passphraseSet;
  }
  
  // ============= WHITELIST =============
  
  addToWhitelist(id: string, name: string, addedBy: string = 'owner'): void {
    this.whitelist.set(id, { id, name, addedAt: Date.now(), addedBy });
    console.log(`🐕 Cerber: ${name} dodany do whitelisty.`);
    this.notify();
  }
  
  removeFromWhitelist(id: string): void {
    const entry = this.whitelist.get(id);
    this.whitelist.delete(id);
    if (entry) console.log(`🐕 Cerber: ${entry.name} usunięty z whitelisty.`);
    this.notify();
  }
  
  isWhitelisted(id: string): boolean {
    return this.whitelist.has(id);
  }
  
  getWhitelist(): WhitelistEntry[] {
    return Array.from(this.whitelist.values());
  }
  
  clearWhitelist(): void {
    this.whitelist.clear();
    this.notify();
  }
  
  // ============= MAIN FILTER =============
  
  /**
   * Process output through noise shield
   * 
   * Rules:
   * 1. If shield inactive or unlocked → pass through
   * 2. If recipient not whitelisted → NOISE
   * 3. If infection detected → NOISE (even if unlocked!)
   * 4. If passphrase not set → pass through (shield not configured)
   */
  filterOutput(
    output: string, 
    context: {
      recipientId?: string;
      inputPrompt?: string;
      engine?: string;
    } = {}
  ): NoiseShieldResult {
    // Shield not configured → pass through
    if (!this.passphraseSet) {
      return { 
        output, 
        filtered: false, 
        reason: 'shield_not_configured',
        infection: null,
      };
    }
    
    // Always scan for infection
    const infection = scanForInfection(
      context.inputPrompt || '', 
      output
    );
    
    // Infection detected → ALWAYS noise, even if unlocked
    if (infection.infected) {
      this.infectionCount++;
      this.lastInfection = infection;
      // Force lock on infection
      this.unlocked = false;
      this.unlockExpiry = 0;
      console.log('🐕 Cerber: INFEKCJA WYKRYTA! Wymuszam szum.', infection);
      this.notify();
      
      return {
        output: generateNoiseBlock() + '\n⚠️ INFEKCJA WYKRYTA — output zamaskowany dla bezpieczeństwa.',
        filtered: true,
        reason: 'infection_detected',
        infection,
      };
    }
    
    // Shield not active → pass through
    if (!this.shieldActive) {
      return { output, filtered: false, reason: 'shield_inactive', infection };
    }
    
    // Unlocked → pass through (if not infected)
    if (this.isUnlocked()) {
      return { output, filtered: false, reason: 'unlocked', infection };
    }
    
    // Check whitelist
    if (context.recipientId && this.isWhitelisted(context.recipientId)) {
      return { output, filtered: false, reason: 'whitelisted', infection };
    }
    
    // DEFAULT: Generate noise
    return {
      output: generateNoiseBlock(),
      filtered: true,
      reason: context.recipientId ? 'not_whitelisted' : 'locked',
      infection,
    };
  }
  
  // ============= STATE =============
  
  getState(): NoiseShieldState {
    return {
      shieldActive: this.shieldActive,
      passphraseSet: this.passphraseSet,
      unlocked: this.isUnlocked(),
      unlockExpiry: this.unlockExpiry,
      whitelistCount: this.whitelist.size,
      whitelist: this.getWhitelist(),
      infectionCount: this.infectionCount,
      lastInfection: this.lastInfection,
    };
  }
  
  subscribe(listener: (state: NoiseShieldState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}

// ============= TYPES =============

export interface NoiseShieldResult {
  output: string;
  filtered: boolean;
  reason: 'shield_not_configured' | 'shield_inactive' | 'unlocked' | 'whitelisted' | 'not_whitelisted' | 'locked' | 'infection_detected';
  infection: InfectionScan | null;
}

export interface NoiseShieldState {
  shieldActive: boolean;
  passphraseSet: boolean;
  unlocked: boolean;
  unlockExpiry: number;
  whitelistCount: number;
  whitelist: WhitelistEntry[];
  infectionCount: number;
  lastInfection: InfectionScan | null;
}

// ============= SINGLETON =============

export const noiseShield = new CerberNoiseShield();
