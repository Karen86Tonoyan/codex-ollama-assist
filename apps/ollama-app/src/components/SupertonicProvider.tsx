import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { 
  supertonicEngine, 
  type VoiceId, 
  type Language, 
  type SynthesisResult,
  VOICE_NAMES,
  LANGUAGE_NAMES,
} from '@/lib/supertonic';

interface SupertonicContextValue {
  // State
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  executionProvider: 'webgpu' | 'wasm' | null;
  lastGenerationTime: number | null;
  
  // Config
  voiceId: VoiceId;
  language: Language;
  useLocalTTS: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  synthesize: (text: string) => Promise<SynthesisResult | null>;
  synthesizeAndPlay: (text: string) => Promise<void>;
  createAudioBlob: (result: SynthesisResult) => Blob;
  setVoice: (voiceId: VoiceId) => void;
  setLanguage: (language: Language) => void;
  setUseLocalTTS: (use: boolean) => void;
  
  // Constants
  voices: typeof VOICE_NAMES;
  languages: typeof LANGUAGE_NAMES;
}

const SupertonicContext = createContext<SupertonicContextValue | null>(null);

export function SupertonicProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionProvider, setExecutionProvider] = useState<'webgpu' | 'wasm' | null>(null);
  const [lastGenerationTime, setLastGenerationTime] = useState<number | null>(null);
  const [voiceId, setVoiceId] = useState<VoiceId>('M1');
  const [language, setLanguageState] = useState<Language>('en');
  const [useLocalTTS, setUseLocalTTS] = useState(true);

  // Check engine status periodically
  useEffect(() => {
    const checkStatus = () => {
      if (supertonicEngine.isReady() && !isReady) {
        setIsReady(true);
        setExecutionProvider(supertonicEngine.getExecutionProvider());
      }
      setIsLoading(supertonicEngine.isLoadingModel());
    };
    
    checkStatus();
    const interval = setInterval(checkStatus, 500);
    return () => clearInterval(interval);
  }, [isReady]);

  const initialize = useCallback(async () => {
    if (isReady || isLoading) return;
    
    setIsLoading(true);
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
      const message = err instanceof Error ? err.message : 'Błąd inicjalizacji';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [isReady, isLoading, voiceId, language]);

  const synthesize = useCallback(async (text: string): Promise<SynthesisResult | null> => {
    if (!isReady) {
      setError('Supertonic nie jest gotowy');
      return null;
    }
    
    try {
      const result = await supertonicEngine.synthesize(text, voiceId);
      setLastGenerationTime(result.generationTime);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Błąd syntezy';
      setError(message);
      return null;
    }
  }, [isReady, voiceId]);

  const synthesizeAndPlay = useCallback(async (text: string): Promise<void> => {
    const result = await synthesize(text);
    if (result) {
      await supertonicEngine.playAudio(result);
    }
  }, [synthesize]);

  const createAudioBlob = useCallback((result: SynthesisResult): Blob => {
    return supertonicEngine.createAudioBlob(result);
  }, []);

  const setVoice = useCallback((newVoiceId: VoiceId) => {
    setVoiceId(newVoiceId);
    supertonicEngine.setConfig({ voiceId: newVoiceId });
  }, []);

  const setLanguage = useCallback((newLanguage: Language) => {
    setLanguageState(newLanguage);
    supertonicEngine.setConfig({ language: newLanguage });
  }, []);

  const value: SupertonicContextValue = {
    isReady,
    isLoading,
    error,
    executionProvider,
    lastGenerationTime,
    voiceId,
    language,
    useLocalTTS,
    initialize,
    synthesize,
    synthesizeAndPlay,
    createAudioBlob,
    setVoice,
    setLanguage,
    setUseLocalTTS,
    voices: VOICE_NAMES,
    languages: LANGUAGE_NAMES,
  };

  return (
    <SupertonicContext.Provider value={value}>
      {children}
    </SupertonicContext.Provider>
  );
}

export function useSupertonic(): SupertonicContextValue {
  const context = useContext(SupertonicContext);
  if (!context) {
    throw new Error('useSupertonic must be used within a SupertonicProvider');
  }
  return context;
}
