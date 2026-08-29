import { useState, useCallback, useMemo } from 'react';
import { 
  liminalEngine, 
  type EpisodicMemory, 
  type UserProfile,
  type EmotionType 
} from '@/lib/liminal-engine';

export interface UseLiminalEngine {
  // Memory operations
  storeEpisode: (userInput: string, aiResponse: string) => EpisodicMemory;
  recallContext: (prompt: string, limit?: number) => EpisodicMemory[];
  formatMemoryContext: (memories: EpisodicMemory[]) => string;
  enhancePromptWithContext: (prompt: string) => string;
  
  // Repair/Rupture
  shouldIntroduceMinorError: () => boolean;
  generateRepairSequence: () => string;
  
  // Profile
  profile: UserProfile;
  refreshProfile: () => void;
  
  // Stats
  stats: {
    totalMemories: number;
    totalInteractions: number;
    relationshipStrength: number;
    topEmotions: Record<EmotionType, number>;
    topTags: string[];
  };
  refreshStats: () => void;
  
  // Clear
  clearAllData: () => void;
}

export function useLiminalEngine(): UseLiminalEngine {
  const [profile, setProfile] = useState<UserProfile>(() => liminalEngine.getProfile());
  const [stats, setStats] = useState(() => liminalEngine.getStats());

  const storeEpisode = useCallback((userInput: string, aiResponse: string) => {
    const episode = liminalEngine.storeEpisode(userInput, aiResponse);
    setProfile(liminalEngine.getProfile());
    setStats(liminalEngine.getStats());
    return episode;
  }, []);

  const recallContext = useCallback((prompt: string, limit = 5) => {
    return liminalEngine.recallContext(prompt, limit);
  }, []);

  const formatMemoryContext = useCallback((memories: EpisodicMemory[]) => {
    return liminalEngine.formatMemoryContext(memories);
  }, []);

  const enhancePromptWithContext = useCallback((prompt: string) => {
    return liminalEngine.enhancePromptWithContext(prompt);
  }, []);

  const shouldIntroduceMinorError = useCallback(() => {
    return liminalEngine.shouldIntroduceMinorError();
  }, []);

  const generateRepairSequence = useCallback(() => {
    const repair = liminalEngine.generateRepairSequence();
    setProfile(liminalEngine.getProfile()); // Update repair count
    return repair;
  }, []);

  const refreshProfile = useCallback(() => {
    setProfile(liminalEngine.getProfile());
  }, []);

  const refreshStats = useCallback(() => {
    setStats(liminalEngine.getStats());
  }, []);

  const clearAllData = useCallback(() => {
    liminalEngine.clearAllData();
    setProfile(liminalEngine.getProfile());
    setStats(liminalEngine.getStats());
  }, []);

  return useMemo(() => ({
    storeEpisode,
    recallContext,
    formatMemoryContext,
    enhancePromptWithContext,
    shouldIntroduceMinorError,
    generateRepairSequence,
    profile,
    refreshProfile,
    stats,
    refreshStats,
    clearAllData,
  }), [
    storeEpisode,
    recallContext,
    formatMemoryContext,
    enhancePromptWithContext,
    shouldIntroduceMinorError,
    generateRepairSequence,
    profile,
    refreshProfile,
    stats,
    refreshStats,
    clearAllData,
  ]);
}
