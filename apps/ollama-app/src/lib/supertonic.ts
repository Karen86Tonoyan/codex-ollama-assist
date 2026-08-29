/**
 * Kokoro TTS - Ultra-fast on-device Text-to-Speech
 * Uses kokoro-js for ONNX inference with WebGPU/WASM support
 * 
 * This replaces Supertonic with Kokoro which has better browser support
 */

import { KokoroTTS } from 'kokoro-js';

// Model from ONNX Community
const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

// Map Supertonic voice IDs to Kokoro voices
export type VoiceId = 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'F1' | 'F2' | 'F3' | 'F4' | 'F5';
export type Language = 'en' | 'ko' | 'es' | 'pt' | 'fr';

export interface SupertonicConfig {
  voiceId: VoiceId;
  language: Language;
  inferenceSteps: number;
  useWebGPU: boolean;
}

export interface SynthesisResult {
  audioData: Float32Array;
  sampleRate: number;
  duration: number;
  generationTime: number;
}

// Kokoro voice IDs - must match exactly
type KokoroVoice = 'am_adam' | 'am_michael' | 'bm_george' | 'bm_lewis' | 'af_heart' | 'af_bella' | 'af_nicole' | 'bf_emma' | 'bf_isabella';

const KOKORO_VOICES: Record<VoiceId, KokoroVoice> = {
  M1: 'am_adam',
  M2: 'am_michael',
  M3: 'bm_george',
  M4: 'bm_lewis',
  M5: 'am_adam',
  F1: 'af_heart',
  F2: 'af_bella',
  F3: 'af_nicole',
  F4: 'bf_emma',
  F5: 'bf_isabella',
};

export const VOICE_NAMES: Record<VoiceId, string> = {
  M1: 'Adam (US)',
  M2: 'Michael (US)',
  M3: 'George (UK)',
  M4: 'Lewis (UK)',
  M5: 'James (US)',
  F1: 'Heart (US)',
  F2: 'Bella (US)',
  F3: 'Nicole (US)',
  F4: 'Emma (UK)',
  F5: 'Isabella (UK)',
};

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  ko: '한국어',
  es: 'Español',
  pt: 'Português',
  fr: 'Français',
};

class SupertonicEngine {
  private tts: KokoroTTS | null = null;
  private isInitialized = false;
  private isLoading = false;
  private config: SupertonicConfig = {
    voiceId: 'F1',
    language: 'en',
    inferenceSteps: 2,
    useWebGPU: true,
  };
  private executionProvider: 'webgpu' | 'wasm' = 'wasm';

  async initialize(config?: Partial<SupertonicConfig>): Promise<void> {
    if (this.isInitialized || this.isLoading) return;
    
    this.isLoading = true;
    
    if (config) {
      this.config = { ...this.config, ...config };
    }

    try {
      // Check WebGPU support
      let device: 'webgpu' | 'wasm' = 'wasm';
      
      if (this.config.useWebGPU && 'gpu' in navigator) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const adapter = await (navigator as any).gpu.requestAdapter();
          if (adapter) {
            device = 'webgpu';
            this.executionProvider = 'webgpu';
          }
        } catch {
          console.log('WebGPU not available, falling back to WASM');
        }
      }

      console.log(`Initializing Kokoro TTS with ${device}...`);
      
      // Create TTS instance using kokoro-js
      this.tts = await KokoroTTS.from_pretrained(MODEL_ID, {
        dtype: device === 'webgpu' ? 'fp32' : 'q8',
        device,
      });
      
      this.isInitialized = true;
      console.log('Kokoro TTS initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Kokoro TTS:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  async synthesize(text: string, voiceId?: VoiceId): Promise<SynthesisResult> {
    if (!this.isInitialized || !this.tts) {
      throw new Error('TTS not initialized. Call initialize() first.');
    }

    const voice = voiceId || this.config.voiceId;
    const kokoroVoice = KOKORO_VOICES[voice];
    const startTime = performance.now();

    try {
      // Generate audio using kokoro-js
      const audio = await this.tts.generate(text, { voice: kokoroVoice });
      
      const generationTime = performance.now() - startTime;
      
      // RawAudio has toWav() method, we need to extract the Float32Array
      // Convert to playable format
      const wavBlob = audio.toBlob();
      const arrayBuffer = await wavBlob.arrayBuffer();
      
      // Parse WAV to get raw audio data
      const dataView = new DataView(arrayBuffer);
      const sampleRate = dataView.getUint32(24, true);
      const dataOffset = 44; // Standard WAV header size
      const numSamples = (arrayBuffer.byteLength - dataOffset) / 2;
      const audioData = new Float32Array(numSamples);
      
      for (let i = 0; i < numSamples; i++) {
        const sample = dataView.getInt16(dataOffset + i * 2, true);
        audioData[i] = sample / 32768;
      }
      
      const duration = audioData.length / sampleRate;

      return {
        audioData,
        sampleRate,
        duration,
        generationTime,
      };
    } catch (error) {
      console.error('Synthesis error:', error);
      // Return silence on error
      return {
        audioData: new Float32Array(24000),
        sampleRate: 24000,
        duration: 1,
        generationTime: performance.now() - startTime,
      };
    }
  }

  async playAudio(result: SynthesisResult): Promise<void> {
    const audioContext = new AudioContext({ sampleRate: result.sampleRate });
    const audioBuffer = audioContext.createBuffer(1, result.audioData.length, result.sampleRate);
    audioBuffer.getChannelData(0).set(result.audioData);

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start();

    return new Promise((resolve) => {
      source.onended = () => {
        audioContext.close();
        resolve();
      };
    });
  }

  createAudioBlob(result: SynthesisResult): Blob {
    // Convert Float32Array to 16-bit PCM WAV
    const buffer = new ArrayBuffer(44 + result.audioData.length * 2);
    const view = new DataView(buffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + result.audioData.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, result.sampleRate, true);
    view.setUint32(28, result.sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, result.audioData.length * 2, true);

    // Audio data
    let offset = 44;
    for (let i = 0; i < result.audioData.length; i++) {
      const sample = Math.max(-1, Math.min(1, result.audioData[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  setConfig(config: Partial<SupertonicConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): SupertonicConfig {
    return { ...this.config };
  }

  getExecutionProvider(): 'webgpu' | 'wasm' {
    return this.executionProvider;
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  isLoadingModel(): boolean {
    return this.isLoading;
  }

  async dispose(): Promise<void> {
    this.tts = null;
    this.isInitialized = false;
  }
}

// Singleton instance
export const supertonicEngine = new SupertonicEngine();
