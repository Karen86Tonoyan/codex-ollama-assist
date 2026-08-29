import { useState, useEffect, useCallback } from 'react';
import { 
  supertonicEngine, 
  type VoiceId, 
  type Language, 
  type SynthesisResult,
  VOICE_NAMES,
  LANGUAGE_NAMES,
} from '@/lib/supertonic';

export interface UseSupertonic {
  // State
  isReady: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  isSynthesizing: boolean;
  error: string | null;
  executionProvider: 'webgpu' | 'wasm' | null;
  lastGenerationTime: number | null;
  
  // Config
  voiceId: VoiceId;
  language: Language;
  
  // Actions
  initialize: () => Promise<void>;
  synthesize: (text: string) => Promise<SynthesisResult | null>;
  synthesizeAndPlay: (text: string) => Promise<void>;
  setVoice: (voiceId: VoiceId) => void;
  setLanguage: (language: Language) => void;
  dispose: () => Promise<void>;
  
  // Constants
  voices: typeof VOICE_NAMES;
  languages: typeof LANGUAGE_NAMES;
}

export function useSupertonic(): UseSupertonic {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionProvider, setExecutionProvider] = useState<'webgpu' | 'wasm' | null>(null);
  const [lastGenerationTime, setLastGenerationTime] = useState<number | null>(null);
  const [voiceId, setVoiceId] = useState<VoiceId>('M1');
  const [language, setLanguageState] = useState<Language>('en');

  // Sync state with engine
  useEffect(() => {
    const checkStatus = () => {
      setIsReady(supertonicEngine.isReady());
      setIsLoading(supertonicEngine.isLoadingModel());
      if (supertonicEngine.isReady()) {
        setExecutionProvider(supertonicEngine.getExecutionProvider());
      }
    };
    
    checkStatus();
    const interval = setInterval(checkStatus, 500);
    return () => clearInterval(interval);
  }, []);

  const initialize = useCallback(async () => {
    if (isReady || isInitializing) return;
    
    setIsInitializing(true);
    setError(null);
    
    try {
      await supertonicEngine.initialize({
        voiceId,
        language,
        inferenceSteps: 2,
        useWebGPU: true,
      });
      setIsReady(true);
      setExecutionProvider(supertonicEngine.getExecutionProvider());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Błąd inicjalizacji Supertonic';
      setError(message);
      console.error('Supertonic initialization error:', err);
    } finally {
      setIsInitializing(false);
    }
  }, [isReady, isInitializing, voiceId, language]);

  const synthesize = useCallback(async (text: string): Promise<SynthesisResult | null> => {
    if (!isReady) {
      setError('Supertonic nie jest gotowy. Zainicjalizuj najpierw.');
      return null;
    }
    
    setIsSynthesizing(true);
    setError(null);
    
    try {
      const result = await supertonicEngine.synthesize(text, voiceId);
      setLastGenerationTime(result.generationTime);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Błąd syntezy mowy';
      setError(message);
      return null;
    } finally {
      setIsSynthesizing(false);
    }
  }, [isReady, voiceId]);

  const synthesizeAndPlay = useCallback(async (text: string): Promise<void> => {
    const result = await synthesize(text);
    if (result) {
      await supertonicEngine.playAudio(result);
    }
  }, [synthesize]);

  const setVoice = useCallback((newVoiceId: VoiceId) => {
    setVoiceId(newVoiceId);
    supertonicEngine.setConfig({ voiceId: newVoiceId });
  }, []);

  const setLanguage = useCallback((newLanguage: Language) => {
    setLanguageState(newLanguage);
    supertonicEngine.setConfig({ language: newLanguage });
  }, []);

  const dispose = useCallback(async () => {
    await supertonicEngine.dispose();
    setIsReady(false);
    setExecutionProvider(null);
    setLastGenerationTime(null);
  }, []);

  return {
    isReady,
    isLoading,
    isInitializing,
    isSynthesizing,
    error,
    executionProvider,
    lastGenerationTime,
    voiceId,
    language,
    initialize,
    synthesize,
    synthesizeAndPlay,
    setVoice,
    setLanguage,
    dispose,
    voices: VOICE_NAMES,
    languages: LANGUAGE_NAMES,
  };
}
