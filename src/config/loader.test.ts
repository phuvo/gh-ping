import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadConfig, ConfigNotFoundError, ConfigValidationError } from './loader.js';

describe('loadConfig', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `gh-ping-config-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should throw ConfigNotFoundError when no config exists', async () => {
    await expect(loadConfig(testDir)).rejects.toThrow(ConfigNotFoundError);
  });

  it('should load JavaScript ESM config', async () => {
    const configContent = `
      export default {
        filters: [],
        notifications: { sound: false },
      };
    `;
    writeFileSync(join(testDir, 'gh-ping.config.js'), configContent);

    const config = await loadConfig(testDir);
    expect(config.notifications.sound).toBe(false);
  });

  it('should load .mjs config', async () => {
    const configContent = `
      export default {
        repoAliases: { 'owner/repo': 'alias' },
      };
    `;
    writeFileSync(join(testDir, 'gh-ping.config.mjs'), configContent);

    const config = await loadConfig(testDir);
    expect(config.repoAliases).toEqual({ 'owner/repo': 'alias' });
  });

  it('should apply defaults for missing values', async () => {
    const configContent = `export default {};`;
    writeFileSync(join(testDir, 'gh-ping.config.js'), configContent);

    const config = await loadConfig(testDir);
    expect(config.notifications.sound).toBe(true); // Default true
    expect(config.filters).toEqual([]);
    expect(config.repoAliases).toEqual({});
  });

  it('should load filters as functions', async () => {
    const configContent = `
      export default {
        filters: [
          (e) => e.subject.type === 'PullRequest',
          (e) => e.reason === 'mention',
        ],
      };
    `;
    writeFileSync(join(testDir, 'gh-ping.config.js'), configContent);

    const config = await loadConfig(testDir);
    expect(config.filters).toHaveLength(2);
    expect(typeof config.filters[0]).toBe('function');
  });

  it('should throw ConfigValidationError for invalid filters', async () => {
    const configContent = `
      export default {
        filters: ['not a function'],
      };
    `;
    writeFileSync(join(testDir, 'gh-ping.config.js'), configContent);

    await expect(loadConfig(testDir)).rejects.toThrow(ConfigValidationError);
  });

  it('should prefer .js over .mjs config', async () => {
    writeFileSync(join(testDir, 'gh-ping.config.js'), `export default { notifications: { sound: false } };`);
    writeFileSync(join(testDir, 'gh-ping.config.mjs'), `export default { notifications: { sound: true } };`);

    const config = await loadConfig(testDir);
    expect(config.notifications.sound).toBe(false);
  });
});
