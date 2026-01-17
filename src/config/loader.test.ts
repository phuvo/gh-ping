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
        polling: { intervalSec: 30 },
        filters: [],
        notifications: { sound: false },
      };
    `;
    writeFileSync(join(testDir, 'gh-ping.config.js'), configContent);

    const config = await loadConfig(testDir);
    expect(config.polling.intervalSec).toBe(30);
    expect(config.notifications.sound).toBe(false);
  });

  it('should load .mjs config', async () => {
    const configContent = `
      export default {
        polling: { intervalSec: 45 },
        filters: [],
      };
    `;
    writeFileSync(join(testDir, 'gh-ping.config.mjs'), configContent);

    const config = await loadConfig(testDir);
    expect(config.polling.intervalSec).toBe(45);
  });

  it('should apply defaults for missing values', async () => {
    const configContent = `export default {};`;
    writeFileSync(join(testDir, 'gh-ping.config.js'), configContent);

    const config = await loadConfig(testDir);
    expect(config.polling.intervalSec).toBe(60); // Default 1 minute
    expect(config.notifications.sound).toBe(true); // Default true
    expect(config.filters).toEqual([]);
  });

  it('should enforce minimum polling interval', async () => {
    const configContent = `
      export default {
        polling: { intervalSec: 1 }, // Too low
      };
    `;
    writeFileSync(join(testDir, 'gh-ping.config.js'), configContent);

    const config = await loadConfig(testDir);
    expect(config.polling.intervalSec).toBe(10); // Minimum 10s
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
        polling: { intervalSec: 'not a number' },
      };
    `;
    writeFileSync(join(testDir, 'gh-ping.config.js'), configContent);

    await expect(loadConfig(testDir)).rejects.toThrow(ConfigValidationError);
  });

  it('should prefer .js over .mjs config', async () => {
    writeFileSync(join(testDir, 'gh-ping.config.js'), `export default { polling: { intervalSec: 111 } };`);
    writeFileSync(join(testDir, 'gh-ping.config.mjs'), `export default { polling: { intervalSec: 222 } };`);

    const config = await loadConfig(testDir);
    expect(config.polling.intervalSec).toBe(111);
  });
});
