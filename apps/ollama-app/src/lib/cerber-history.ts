/**
 * CERBER HISTORY - Decision logging and storage
 * Tracks all Cerber decisions for dashboard display
 */

import { type CerberDecision } from './cerber';
import { type QwenVerdict } from './qwen-judge';

export interface CerberLogEntry {
  id: string;
  timestamp: number;
  prompt: string;
  decision: CerberDecision | 'ALLOW' | 'BLOCK' | 'MODIFY';
  intent?: string;
  risk?: number;
  flags?: string[];
  engine?: string;
  model?: string;
  blocked_reason?: string;
  verdict?: Partial<QwenVerdict>;
}

const STORAGE_KEY = 'cerber-decision-history';
const MAX_ENTRIES = 100;

class CerberHistory {
  private entries: CerberLogEntry[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.entries = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load Cerber history:', e);
      this.entries = [];
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
    } catch (e) {
      console.error('Failed to save Cerber history:', e);
    }
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  log(entry: Omit<CerberLogEntry, 'id' | 'timestamp'>): CerberLogEntry {
    const newEntry: CerberLogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      ...entry,
    };

    this.entries.unshift(newEntry);

    // Limit entries
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(0, MAX_ENTRIES);
    }

    this.saveToStorage();
    this.notifyListeners();

    return newEntry;
  }

  getAll(): CerberLogEntry[] {
    return [...this.entries];
  }

  getByDecision(decision: CerberLogEntry['decision']): CerberLogEntry[] {
    return this.entries.filter(e => e.decision === decision);
  }

  getRecent(count: number = 10): CerberLogEntry[] {
    return this.entries.slice(0, count);
  }

  getStats(): {
    total: number;
    passed: number;
    blocked: number;
    confirmed: number;
    modified: number;
  } {
    const stats = {
      total: this.entries.length,
      passed: 0,
      blocked: 0,
      confirmed: 0,
      modified: 0,
    };

    for (const entry of this.entries) {
      switch (entry.decision) {
        case 'PASS':
        case 'ALLOW':
          stats.passed++;
          break;
        case 'BLOCK':
          stats.blocked++;
          break;
        case 'REQUIRE_CONFIRM':
          stats.confirmed++;
          break;
        case 'MODIFY':
          stats.modified++;
          break;
      }
    }

    return stats;
  }

  clear() {
    this.entries = [];
    this.saveToStorage();
    this.notifyListeners();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const cerberHistory = new CerberHistory();
