/**
 * CONFIDENCE GATE - Brama kontekstowa z NOWA-LOGIKA-AI
 * 
 * Filozofia: "Lepiej zapytać niż skłamać"
 * System odmawia odpowiedzi gdy poziom zaufania jest poniżej progu
 * zamiast generować niepewne odpowiedzi.
 * 
 * Bazowane na: https://github.com/Karen86Tonoyan/NOWA-LOGIKA-AI-BRAK-HALUCYNACJI
 */

// ============= TYPY =============

export interface ConfidenceResult {
  score: number;           // 0.0 - 1.0
  passed: boolean;         // czy przekroczono próg
  tier: SLATier;
  sources?: SourceCitation[];
  reason?: string;
}

export interface SourceCitation {
  documentId: string;
  chunkId: string;
  relevance: number;
  excerpt?: string;
}

export type SLATier = 'gold' | 'silver' | 'bronze';

export interface SLAConfig {
  tier: SLATier;
  minConfidence: number;
  maxTokens: number;
  allow70BModel: boolean;
  label: string;
  color: string;
}

// ============= KONFIGURACJA SLA =============

export const SLA_TIERS: Record<SLATier, SLAConfig> = {
  gold: {
    tier: 'gold',
    minConfidence: 0.55,
    maxTokens: 4000,
    allow70BModel: true,
    label: 'Złoty',
    color: 'text-yellow-500',
  },
  silver: {
    tier: 'silver',
    minConfidence: 0.48,
    maxTokens: 2000,
    allow70BModel: true,
    label: 'Srebrny',
    color: 'text-gray-400',
  },
  bronze: {
    tier: 'bronze',
    minConfidence: 0.40,
    maxTokens: 1000,
    allow70BModel: false,
    label: 'Brązowy',
    color: 'text-orange-600',
  },
};

// ============= SŁOWNIK WIEDZY (demo) =============

const KNOWLEDGE_BASE = [
  {
    id: 'policy-001',
    keywords: ['polityka', 'zasady', 'regulamin', 'policy'],
    content: 'Polityka firmy wymaga szyfrowania wszystkich danych.',
  },
  {
    id: 'security-001', 
    keywords: ['bezpieczeństwo', 'security', 'hasło', 'password'],
    content: 'Hasła muszą mieć minimum 12 znaków i zawierać znaki specjalne.',
  },
  {
    id: 'data-001',
    keywords: ['dane', 'data', 'gdpr', 'rodo'],
    content: 'Dane osobowe są przetwarzane zgodnie z RODO.',
  },
];

// ============= FUNKCJE =============

/**
 * Oblicza podobieństwo cosinusowe (uproszczone - bazowe na słowach kluczowych)
 */
function calculateCosineSimilarity(query: string, keywords: string[]): number {
  const queryWords = query.toLowerCase().split(/\s+/);
  const matchCount = keywords.filter(k => 
    queryWords.some(w => w.includes(k) || k.includes(w))
  ).length;
  
  return matchCount / Math.max(keywords.length, 1);
}

/**
 * Znajduje najbardziej pasujące źródła do zapytania
 */
export function findRelevantSources(query: string): SourceCitation[] {
  const sources: SourceCitation[] = [];
  
  for (const doc of KNOWLEDGE_BASE) {
    const relevance = calculateCosineSimilarity(query, doc.keywords);
    if (relevance > 0.1) {
      sources.push({
        documentId: doc.id,
        chunkId: `${doc.id}-chunk-1`,
        relevance,
        excerpt: doc.content,
      });
    }
  }
  
  return sources.sort((a, b) => b.relevance - a.relevance);
}

/**
 * Główna funkcja bramy kontekstowej
 * Ocenia zaufanie do odpowiedzi na podstawie dostępnych źródeł
 */
export function confidenceGate(
  query: string, 
  tier: SLATier = 'silver'
): ConfidenceResult {
  const config = SLA_TIERS[tier];
  const sources = findRelevantSources(query);
  
  // Oblicz ogólny wynik zaufania
  let score = 0;
  
  if (sources.length > 0) {
    // Średnia ważona relevance z top 3 źródeł
    const topSources = sources.slice(0, 3);
    const totalRelevance = topSources.reduce((sum, s) => sum + s.relevance, 0);
    score = totalRelevance / topSources.length;
    
    // Bonus za ilość źródeł
    score += Math.min(sources.length * 0.1, 0.3);
  }
  
  // Normalizuj do 0-1
  score = Math.min(score, 1.0);
  
  const passed = score >= config.minConfidence;
  
  return {
    score,
    passed,
    tier,
    sources: sources.slice(0, 5),
    reason: passed 
      ? `Znaleziono ${sources.length} pasujących źródeł`
      : `Zbyt niski poziom zaufania (${(score * 100).toFixed(0)}% < ${(config.minConfidence * 100).toFixed(0)}%). Lepiej zapytać niż skłamać.`,
  };
}

/**
 * Generuje odpowiedź odmowy gdy zaufanie jest zbyt niskie
 */
export function generateRefusalResponse(result: ConfidenceResult): string {
  return `🛡️ **System odmówił odpowiedzi**

> *"Lepiej zapytać niż skłamać"*

**Powód:** ${result.reason}

**Poziom zaufania:** ${(result.score * 100).toFixed(0)}%
**Wymagany próg (${result.tier}):** ${(SLA_TIERS[result.tier].minConfidence * 100).toFixed(0)}%

---

💡 **Co możesz zrobić:**
1. Przeformułuj pytanie bardziej szczegółowo
2. Dodaj kontekst do bazy wiedzy
3. Obniż poziom SLA (jeśli dopuszczalne)

*Ten system nie generuje niepewnych odpowiedzi - chroni przed halucynacjami AI.*`;
}

/**
 * Wrapper do integracji z LLM Router
 */
export function applyConfidenceGate(
  query: string,
  tier: SLATier = 'silver'
): { 
  allowed: boolean; 
  result: ConfidenceResult; 
  refusalMessage?: string;
} {
  const result = confidenceGate(query, tier);
  
  if (!result.passed) {
    return {
      allowed: false,
      result,
      refusalMessage: generateRefusalResponse(result),
    };
  }
  
  return {
    allowed: true,
    result,
  };
}
