import { existsSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import type { GhPingConfig, GhPingUserConfig } from './schema.js';
import { applyDefaults } from './defaults.js';

const CONFIG_FILES = [
  'gh-ping.config.js',
  'gh-ping.config.mjs',
];

export class ConfigNotFoundError extends Error {
  constructor(cwd: string) {
    super(
      `No gh-ping config file found in ${cwd}.\n` +
      `Expected one of: ${CONFIG_FILES.join(', ')}\n` +
      `Run 'gh-ping init' to create a starter config.`
    );
    this.name = 'ConfigNotFoundError';
  }
}

export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

/**
 * Load and validate gh-ping config from the current directory
 */
export async function loadConfig(cwd: string = process.cwd()): Promise<GhPingConfig> {
  for (const filename of CONFIG_FILES) {
    const configPath = resolve(cwd, filename);
    if (existsSync(configPath)) {
      // Use file URL for cross-platform compatibility + cache busting
      const fileUrl = pathToFileURL(configPath).href + `?t=${Date.now()}`;
      const module = await import(fileUrl);
      const userConfig = module.default ?? module;

      validateConfig(userConfig);
      return applyDefaults(userConfig);
    }
  }

  throw new ConfigNotFoundError(cwd);
}

/**
 * Validate user config structure
 */
function validateConfig(config: unknown): asserts config is GhPingUserConfig {
  if (!config || typeof config !== 'object') {
    throw new ConfigValidationError('Config must be an object');
  }

  const c = config as Record<string, unknown>;

  // Validate polling
  if (c.polling !== undefined) {
    if (typeof c.polling !== 'object' || c.polling === null) {
      throw new ConfigValidationError('polling must be an object');
    }
    const polling = c.polling as Record<string, unknown>;
    if (polling.intervalSec !== undefined && typeof polling.intervalSec !== 'number') {
      throw new ConfigValidationError('polling.intervalSec must be a number');
    }
  }

  // Validate filters
  if (c.filters !== undefined) {
    if (!Array.isArray(c.filters)) {
      throw new ConfigValidationError('filters must be an array');
    }
    for (let i = 0; i < c.filters.length; i++) {
      if (typeof c.filters[i] !== 'function') {
        throw new ConfigValidationError(`filters[${i}] must be a function`);
      }
    }
  }

  // Validate notifications
  if (c.notifications !== undefined) {
    if (typeof c.notifications !== 'object' || c.notifications === null) {
      throw new ConfigValidationError('notifications must be an object');
    }
    const notifs = c.notifications as Record<string, unknown>;
    if (notifs.sound !== undefined && typeof notifs.sound !== 'boolean') {
      throw new ConfigValidationError('notifications.sound must be a boolean');
    }
  }
}

/**
 * Find config file path (for display purposes)
 */
export function findConfigPath(cwd: string = process.cwd()): string | null {
  for (const filename of CONFIG_FILES) {
    const configPath = resolve(cwd, filename);
    if (existsSync(configPath)) {
      return configPath;
    }
  }
  return null;
}
