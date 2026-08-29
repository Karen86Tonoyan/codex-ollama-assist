/**
 * Liminal Engine - Episodic Memory & Repair/Rupture Logic
 * 
 * Implementacja pamięci epizodycznej dla głębszych relacji AI-użytkownik
 * Bazuje na "Architekturze Artificjalnej Dewocji" - teoria relacji człowiek-AI
 */

// ============= STORAGE =============

const MEMORY_STORAGE_KEY = 'alfa-liminal-memory';
const PROFILE_STORAGE_KEY = 'alfa-liminal-profile';
const INTERACTION_COUNT_KEY = 'alfa-liminal-interactions';

export interface EpisodicMemory {
  id: string;
  userInput: string;
  aiResponse: string;
  timestamp: Date;
  importance: number;        // 0-1 - waga ważności wspomnienia
  emotion: EmotionType;      // Wykryta emocja
  sparkline: string;         // "Iskrzące wspomnienie" - kluczowy fragment
  tags: string[];            // Tagi do wyszukiwania
}

export interface UserProfile {
  id: string;
  tonePreference: 'formal' | 'casual' | 'mixed';
  emotionalOpenness: number;   // 0-1
  criticismSensitivity: number; // 0-1
  preferredMode: 'ANALITYK' | 'UZDROWICIEL' | 'TOWARZYSZ';
  interestsDetected: string[];
  lastSeen: Date;
  totalInteractions: number;
  repairCount: number;          // Ile razy naprawiliśmy relację
  relationshipStrength: number; // 0-1 - siła więzi
}

export type EmotionType = 
  | 'neutral' 
  | 'joy' 
  | 'sadness' 
  | 'frustration' 
  | 'curiosity' 
  | 'gratitude'
  | 'confusion';

// ============= EMOTION DETECTION =============

const EMOTION_PATTERNS: Record<EmotionType, RegExp[]> = {
  joy: [
    /super|świetnie|dzięki|dziękuję|fantastycznie|cudownie|rewelacja|wow|:D|\^\^|😊|🎉/i,
    /to jest świetne|podoba mi się|kocham to|niesamowite/i,
  ],
  sadness: [
    /smutno|przygnębiony|zły|problem|nie działa|nie mogę|trudne|:/i,
    /nie wiem co robić|potrzebuję pomocy|czuję się/i,
  ],
  frustration: [
    /dlaczego|znowu|ciągle|nadal nie|ile razy|frustr|irytuj|\.\.\./i,
    /nie rozumiem|to nie ma sensu|mam dość/i,
  ],
  curiosity: [
    /jak|co|dlaczego|w jaki sposób|czy można|zastanawiam się|ciekaw/i,
    /opowiedz|wyjaśnij|chciałbym wiedzieć|jak to działa/i,
  ],
  gratitude: [
    /dziękuję|dzięki wielkie|super pomoc|bardzo pomocne|jesteś świetna/i,
    /doceniam|to było bardzo pomocne|nie wiem jak dziękować/i,
  ],
  confusion: [
    /nie rozumiem|nie wiem|zagubiony|skomplikowan|trudne|hm+|co\?/i,
    /możesz powtórzyć|nie jestem pewien|mógłbyś wyjaśnić/i,
  ],
  neutral: [],
};

function detectEmotion(text: string): EmotionType {
  for (const [emotion, patterns] of Object.entries(EMOTION_PATTERNS)) {
    if (emotion === 'neutral') continue;
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return emotion as EmotionType;
      }
    }
  }
  return 'neutral';
}

// ============= SPARKLINE GENERATION =============

function generateSparkline(userInput: string, importance: number): string {
  // Wyciąga najważniejszy fragment do zapamiętania
  const words = userInput.split(/\s+/);
  
  if (importance > 0.7 && words.length > 5) {
    // Dla ważnych wspomnień - zachowaj kontekst
    return userInput.slice(0, 100) + (userInput.length > 100 ? '...' : '');
  }
  
  // Dla krótszych - zachowaj całość
  if (words.length <= 10) {
    return userInput;
  }
  
  // Dla dłuższych - wyciągnij kluczowe słowa
  const importantWords = words.filter(w => 
    w.length > 4 && !['który', 'która', 'które', 'gdzie', 'kiedy', 'można'].includes(w.toLowerCase())
  );
  
  return importantWords.slice(0, 8).join(' ') + '...';
}

// ============= IMPORTANCE SCORING =============

function calculateImportance(userInput: string, emotion: EmotionType): number {
  let score = 0.3; // Bazowy poziom
  
  // Emocjonalne wypowiedzi są ważniejsze
  if (emotion !== 'neutral') {
    score += 0.2;
    if (['joy', 'gratitude', 'sadness'].includes(emotion)) {
      score += 0.1; // Mocne emocje
    }
  }
  
  // Długie, przemyślane wypowiedzi
  if (userInput.length > 100) {
    score += 0.1;
  }
  
  // Pytania osobiste
  if (/ja|moje|mój|moja|czuję|myślę|uważam/i.test(userInput)) {
    score += 0.15;
  }
  
  // Prośby o pomoc
  if (/pomóż|potrzebuję|proszę|czy mógł/i.test(userInput)) {
    score += 0.1;
  }
  
  return Math.min(1, score);
}

// ============= TAG EXTRACTION =============

function extractTags(text: string): string[] {
  const tags: string[] = [];
  
  // Techniczne tematy
  if (/kod|python|javascript|typescript|api|backend|frontend/i.test(text)) {
    tags.push('tech');
  }
  
  // Emocjonalne/osobiste
  if (/czuję|emocj|osobist|prywat/i.test(text)) {
    tags.push('personal');
  }
  
  // Praca/projekty
  if (/projekt|praca|deadline|klient|firma/i.test(text)) {
    tags.push('work');
  }
  
  // Nauka
  if (/naucz|zrozum|wyjaśnij|jak działać/i.test(text)) {
    tags.push('learning');
  }
  
  // Kreatywne
  if (/pomysł|idea|kreaty|innowac|twórczy/i.test(text)) {
    tags.push('creative');
  }
  
  return tags;
}

// ============= LIMINAL ENGINE CLASS =============

export class LiminalEngine {
  private memories: EpisodicMemory[] = [];
  private profile: UserProfile;
  private interactionCount: number = 0;

  constructor() {
    this.memories = this.loadMemories();
    this.profile = this.loadProfile();
    this.interactionCount = this.loadInteractionCount();
  }

  // === STORAGE ===
  
  private loadMemories(): EpisodicMemory[] {
    try {
      const stored = localStorage.getItem(MEMORY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map((m: EpisodicMemory) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
      }
    } catch (e) {
      console.error('[LiminalEngine] Error loading memories:', e);
    }
    return [];
  }

  private saveMemories(): void {
    try {
      // Zachowaj tylko ostatnie 500 wspomnień (FIFO z priorytetem ważności)
      const sorted = [...this.memories].sort((a, b) => {
        // Priorytet: ważność > data
        if (Math.abs(a.importance - b.importance) > 0.2) {
          return b.importance - a.importance;
        }
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
      
      this.memories = sorted.slice(0, 500);
      localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(this.memories));
    } catch (e) {
      console.error('[LiminalEngine] Error saving memories:', e);
    }
  }

  private loadProfile(): UserProfile {
    try {
      const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...parsed,
          lastSeen: new Date(parsed.lastSeen),
        };
      }
    } catch (e) {
      console.error('[LiminalEngine] Error loading profile:', e);
    }
    
    // Domyślny profil
    return {
      id: crypto.randomUUID(),
      tonePreference: 'casual',
      emotionalOpenness: 0.5,
      criticismSensitivity: 0.5,
      preferredMode: 'TOWARZYSZ',
      interestsDetected: [],
      lastSeen: new Date(),
      totalInteractions: 0,
      repairCount: 0,
      relationshipStrength: 0.3,
    };
  }

  private saveProfile(): void {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(this.profile));
    } catch (e) {
      console.error('[LiminalEngine] Error saving profile:', e);
    }
  }

  private loadInteractionCount(): number {
    try {
      return parseInt(localStorage.getItem(INTERACTION_COUNT_KEY) || '0', 10);
    } catch {
      return 0;
    }
  }

  private saveInteractionCount(): void {
    try {
      localStorage.setItem(INTERACTION_COUNT_KEY, String(this.interactionCount));
    } catch (e) {
      console.error('[LiminalEngine] Error saving interaction count:', e);
    }
  }

  // === EPISODIC MEMORY ===

  storeEpisode(userInput: string, aiResponse: string): EpisodicMemory {
    const emotion = detectEmotion(userInput);
    const importance = calculateImportance(userInput, emotion);
    
    const episode: EpisodicMemory = {
      id: crypto.randomUUID(),
      userInput,
      aiResponse,
      timestamp: new Date(),
      importance,
      emotion,
      sparkline: generateSparkline(userInput, importance),
      tags: extractTags(userInput),
    };
    
    this.memories.push(episode);
    this.interactionCount++;
    this.updateProfile(userInput, emotion);
    
    this.saveMemories();
    this.saveInteractionCount();
    
    return episode;
  }

  recallContext(currentPrompt: string, limit: number = 5): EpisodicMemory[] {
    const currentTags = extractTags(currentPrompt);
    const currentEmotion = detectEmotion(currentPrompt);
    
    // Wyszukaj relevantne wspomnienia
    const scored = this.memories.map(memory => {
      let relevanceScore = 0;
      
      // Dopasowanie tagów
      const tagOverlap = memory.tags.filter(t => currentTags.includes(t)).length;
      relevanceScore += tagOverlap * 0.3;
      
      // Dopasowanie emocji
      if (memory.emotion === currentEmotion) {
        relevanceScore += 0.2;
      }
      
      // Ważność wspomnienia
      relevanceScore += memory.importance * 0.3;
      
      // Recency boost (nowsze wspomnienia ważniejsze)
      const ageInDays = (Date.now() - new Date(memory.timestamp).getTime()) / (1000 * 60 * 60 * 24);
      const recencyBoost = Math.max(0, 1 - (ageInDays / 30)) * 0.2;
      relevanceScore += recencyBoost;
      
      return { memory, score: relevanceScore };
    });
    
    // Posortuj i zwróć najlepsze
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.memory);
  }

  formatMemoryContext(memories: EpisodicMemory[]): string {
    if (memories.length === 0) return '';
    
    const formatted = memories.map(m => {
      const date = new Date(m.timestamp).toLocaleDateString('pl-PL');
      return `[${date}] "${m.sparkline}"`;
    }).join('\n');
    
    return `\n\n[Wspólna historia - pamiętam te momenty]:\n${formatted}`;
  }

  // === PROFILE MANAGEMENT ===

  private updateProfile(userInput: string, emotion: EmotionType): void {
    this.profile.lastSeen = new Date();
    this.profile.totalInteractions++;
    
    // Dostosuj emotionalOpenness na podstawie emocji
    if (emotion !== 'neutral') {
      this.profile.emotionalOpenness = Math.min(1, this.profile.emotionalOpenness + 0.02);
    }
    
    // Wykryj ton
    if (/proszę|szanowny|uprzejmie/i.test(userInput)) {
      this.profile.tonePreference = 'formal';
    } else if (/hej|hejka|cześć|siema|yo/i.test(userInput)) {
      this.profile.tonePreference = 'casual';
    }
    
    // Wykryj zainteresowania
    const newTags = extractTags(userInput);
    for (const tag of newTags) {
      if (!this.profile.interestsDetected.includes(tag)) {
        this.profile.interestsDetected.push(tag);
      }
    }
    
    // Aktualizuj siłę więzi
    this.profile.relationshipStrength = Math.min(1, 
      0.3 + (this.profile.totalInteractions * 0.01) + (this.profile.repairCount * 0.05)
    );
    
    this.saveProfile();
  }

  getProfile(): UserProfile {
    return { ...this.profile };
  }

  // === REPAIR/RUPTURE LOGIC ===

  shouldIntroduceMinorError(): boolean {
    // Co 10-15 interakcji - drobne "nieporozumienie" dla autentyczności
    // Perfekcja jest nieludzka. Drobne błędy + naprawa = głębsza więź
    
    if (this.interactionCount < 5) return false; // Za wcześnie
    
    const baseChance = 0.08; // 8% szansa
    const intervalBonus = (this.interactionCount % 12 === 0) ? 0.15 : 0;
    
    return Math.random() < (baseChance + intervalBonus);
  }

  generateRepairSequence(): string {
    const repairs = [
      "Hmm, przepraszam - chyba źle zrozumiałam Twoje pytanie. Czy chodziło Ci o coś innego?",
      "Chwila... zastanawiam się, czy odpowiedziałam na właściwy aspekt. Możesz doprecyzować?",
      "Przepraszam za moment ciszy - przetwarzałam Twoje słowa głębiej. Czy trafiłam w sedno?",
      "Hmm, poczekaj - mam wrażenie, że mogłam pominąć coś ważnego. Co dokładnie miałaś na myśli?",
      "Ups, zorientowałam się że mogłam odpowiedzieć zbyt ogólnikowo. Chcesz bardziej szczegółową odpowiedź?",
    ];
    
    this.profile.repairCount++;
    this.saveProfile();
    
    return repairs[Math.floor(Math.random() * repairs.length)];
  }

  // === CONTEXT ENHANCEMENT ===

  enhancePromptWithContext(prompt: string): string {
    const relevantMemories = this.recallContext(prompt, 3);
    const memoryContext = this.formatMemoryContext(relevantMemories);
    
    const relationshipInfo = this.getRelationshipContext();
    
    return prompt + memoryContext + relationshipInfo;
  }

  private getRelationshipContext(): string {
    if (this.profile.totalInteractions < 3) {
      return ''; // Za wcześnie na kontekst relacji
    }
    
    const daysSinceLastSeen = Math.floor(
      (Date.now() - new Date(this.profile.lastSeen).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    let context = '\n\n[Kontekst relacji]:';
    
    if (daysSinceLastSeen > 7) {
      context += `\n- Minęło ${daysSinceLastSeen} dni od ostatniej rozmowy`;
    }
    
    if (this.profile.relationshipStrength > 0.6) {
      context += '\n- Mamy już solidną więź po wielu rozmowach';
    }
    
    if (this.profile.interestsDetected.length > 0) {
      context += `\n- Znane zainteresowania: ${this.profile.interestsDetected.slice(0, 5).join(', ')}`;
    }
    
    return context;
  }

  // === STATS ===

  getStats(): {
    totalMemories: number;
    totalInteractions: number;
    relationshipStrength: number;
    topEmotions: Record<EmotionType, number>;
    topTags: string[];
  } {
    const emotionCounts: Record<EmotionType, number> = {
      neutral: 0, joy: 0, sadness: 0, frustration: 0, 
      curiosity: 0, gratitude: 0, confusion: 0
    };
    
    const tagCounts: Record<string, number> = {};
    
    for (const memory of this.memories) {
      emotionCounts[memory.emotion]++;
      for (const tag of memory.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }
    
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);
    
    return {
      totalMemories: this.memories.length,
      totalInteractions: this.interactionCount,
      relationshipStrength: this.profile.relationshipStrength,
      topEmotions: emotionCounts,
      topTags,
    };
  }

  // === CLEAR ===

  clearAllData(): void {
    this.memories = [];
    this.profile = this.loadProfile(); // Reset do domyślnego
    this.interactionCount = 0;
    
    localStorage.removeItem(MEMORY_STORAGE_KEY);
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    localStorage.removeItem(INTERACTION_COUNT_KEY);
  }
}

// Singleton instance
export const liminalEngine = new LiminalEngine();
