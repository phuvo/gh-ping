import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock the paths module before importing StateManager
const testDir = join(tmpdir(), `gh-ping-test-${Date.now()}`);
const testStatePath = join(testDir, 'state.json');

vi.mock('../utils/paths.js', () => ({
  getDataDir: () => testDir,
  getStatePath: () => testStatePath,
  getPidPath: () => join(testDir, 'daemon.pid'),
  getLogPath: () => join(testDir, 'daemon.log'),
}));

// Import after mocking
const { StateManager } = await import('./state.js');

describe('StateManager', () => {
  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should start with empty state if no file exists', () => {
    const state = new StateManager();
    expect(state.getSeenCount()).toBe(0);
    expect(state.getLastPoll()).toBeNull();
  });

  it('should mark notifications as seen', () => {
    const state = new StateManager();

    expect(state.isNew('123')).toBe(true);
    state.markSeen('123');
    expect(state.isNew('123')).toBe(false);
    expect(state.getSeenCount()).toBe(1);
  });

  it('should mark batch of notifications as seen', () => {
    const state = new StateManager();

    state.markSeenBatch(['1', '2', '3']);
    expect(state.isNew('1')).toBe(false);
    expect(state.isNew('2')).toBe(false);
    expect(state.isNew('3')).toBe(false);
    expect(state.getSeenCount()).toBe(3);
  });

  it('should update last poll timestamp', () => {
    const state = new StateManager();

    expect(state.getLastPoll()).toBeNull();
    state.updateLastPoll();
    expect(state.getLastPoll()).toBeInstanceOf(Date);
  });

  it('should persist state to disk', () => {
    const state = new StateManager();
    state.markSeen('abc');
    state.updateLastPoll();
    state.save();

    expect(existsSync(testStatePath)).toBe(true);

    const content = JSON.parse(readFileSync(testStatePath, 'utf-8'));
    expect(content.seenIds).toContain('abc');
    expect(content.lastPollAt).toBeTruthy();
  });

  it('should load state from disk', () => {
    // Create initial state
    const state1 = new StateManager();
    state1.markSeen('xyz');
    state1.updateLastPoll();
    state1.save();

    // Load in new instance
    const state2 = new StateManager();
    expect(state2.isNew('xyz')).toBe(false);
    expect(state2.getLastPoll()).toBeInstanceOf(Date);
  });

  it('should clear state', () => {
    const state = new StateManager();
    state.markSeen('123');
    state.updateLastPoll();
    state.save();

    state.clear();
    expect(state.getSeenCount()).toBe(0);
    expect(state.getLastPoll()).toBeNull();
  });

  it('should prune old IDs when exceeding limit', () => {
    const state = new StateManager();

    // Add more than 1000 IDs
    const ids = Array.from({ length: 1100 }, (_, i) => `id-${i}`);
    state.markSeenBatch(ids);

    // Should be pruned to 1000
    expect(state.getSeenCount()).toBe(1000);

    // Newer IDs should still be present
    expect(state.isNew('id-1099')).toBe(false);
    expect(state.isNew('id-1050')).toBe(false);
  });
});
