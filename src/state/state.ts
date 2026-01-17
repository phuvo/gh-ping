import { existsSync, readFileSync, writeFileSync } from 'fs';
import { getStatePath } from '../utils/paths.js';

const MAX_SEEN_IDS = 1000;

interface StateData {
  seenIds: string[];
  lastPollAt: string | null;
}

/**
 * State manager for tracking seen notifications
 */
export class StateManager {
  private seenIds: Set<string>;
  private lastPollAt: Date | null;
  private statePath: string;

  constructor() {
    this.statePath = getStatePath();
    const data = this.load();
    this.seenIds = new Set(data.seenIds);
    this.lastPollAt = data.lastPollAt ? new Date(data.lastPollAt) : null;
  }

  /**
   * Check if notification ID has been seen
   */
  isNew(id: string): boolean {
    return !this.seenIds.has(id);
  }

  /**
   * Mark notification ID as seen
   */
  markSeen(id: string): void {
    this.seenIds.add(id);
    this.prune();
  }

  /**
   * Mark multiple IDs as seen
   */
  markSeenBatch(ids: string[]): void {
    for (const id of ids) {
      this.seenIds.add(id);
    }
    this.prune();
  }

  /**
   * Update last poll timestamp
   */
  updateLastPoll(): void {
    this.lastPollAt = new Date();
  }

  /**
   * Get last poll timestamp
   */
  getLastPoll(): Date | null {
    return this.lastPollAt;
  }

  /**
   * Get count of seen IDs
   */
  getSeenCount(): number {
    return this.seenIds.size;
  }

  /**
   * Save state to disk
   */
  save(): void {
    const data: StateData = {
      seenIds: Array.from(this.seenIds),
      lastPollAt: this.lastPollAt?.toISOString() ?? null,
    };
    writeFileSync(this.statePath, JSON.stringify(data, null, 2));
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.seenIds.clear();
    this.lastPollAt = null;
    this.save();
  }

  /**
   * Load state from disk
   */
  private load(): StateData {
    if (!existsSync(this.statePath)) {
      return { seenIds: [], lastPollAt: null };
    }

    try {
      const content = readFileSync(this.statePath, 'utf-8');
      const data = JSON.parse(content) as StateData;
      return {
        seenIds: Array.isArray(data.seenIds) ? data.seenIds : [],
        lastPollAt: data.lastPollAt ?? null,
      };
    } catch {
      // Corrupted state file - start fresh
      return { seenIds: [], lastPollAt: null };
    }
  }

  /**
   * Prune old IDs to prevent unbounded growth
   */
  private prune(): void {
    if (this.seenIds.size > MAX_SEEN_IDS) {
      const arr = Array.from(this.seenIds);
      // Keep the most recent IDs (at the end of the set)
      this.seenIds = new Set(arr.slice(-MAX_SEEN_IDS));
    }
  }
}
