import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadConfig, ConfigNotFoundError, ConfigValidationError } from '../src/config/loader.js';

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
        polling: { intervalMs: 30000 },
        filters: [],
        notifications: { sound: false },
      };
    `;
    writeFileSync(join(testDir, 'gh-ping.config.js'), configContent);

    const config = await loadConfig(testDir);
    expect(config.polling.intervalMs).toBe(30000);
    expect(config.notifications.sound).toBe(false);
  });

  it('should load .mjs config', async () => {
    const configContent = `
      export default {
        polling: { intervalMs: 45000 },
        filters: [],
      };
    `;
    writeFileSync(join(testDir, 'gh-ping.config.mjs'), configContent);

    const config = await loadConfig(testDir);
    expect(config.polling.intervalMs).toBe(45000);
  });

  it('should apply defaults for missing values', async () => {
    const configContent = `export default {};`;
    writeFileSync(join(testDir, 'gh-ping.config.js'), configContent);

    const config = await loadConfig(testDir);
    expect(config.polling.intervalMs).toBe(60000); // Default 1 minute
    expect(config.notifications.sound).toBe(true); // Default true
    expect(config.filters).toEqual([]);
  });

  it('should enforce minimum polling interval', async () => {
    const configContent = `
      export default {
        polling: { intervalMs: 1000 }, // Too low
      };
    `;
    writeFileSync(join(testDir, 'gh-ping.config.js'), configContent);

    const config = await loadConfig(testDir);
    expect(config.polling.intervalMs).toBe(10000); // Minimum 10s
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

  it('should throw ConfigValidationError for invalid polling interval type', async () => {
    const configContent = `
      export default {
        polling: { intervalMs: 'not a number' },
      };
    `;
    writeFileSync(join(testDir, 'gh-ping.config.js'), configContent);

    await expect(loadConfig(testDir)).rejects.toThrow(ConfigValidationError);
  });

  it('should prefer .js over .mjs config', async () => {
    writeFileSync(join(testDir, 'gh-ping.config.js'), `export default { polling: { intervalMs: 11111 } };`);
    writeFileSync(join(testDir, 'gh-ping.config.mjs'), `export default { polling: { intervalMs: 22222 } };`);

    const config = await loadConfig(testDir);
    expect(config.polling.intervalMs).toBe(11111);
  });
});
