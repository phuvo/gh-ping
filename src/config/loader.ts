import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { getGlobalConfigPath } from '../utils/paths.js';
import { applyDefaults } from './defaults.js';
import type { GhPingConfig, GhPingUserConfig } from './schema.js';

/**
 * Error thrown when no config file is found
 */
export class ConfigNotFoundError extends Error {
  constructor(searchedPaths: string[]) {
    super(`No config file found. Searched:\n${searchedPaths.map(p => `  - ${p}`).join('\n')}`);
    this.name = 'ConfigNotFoundError';
  }
}

/**
 * Error thrown when config validation fails
 */
export class ConfigValidationError extends Error {
  public readonly errors: string[];

  constructor(errors: string[]) {
    super(`Config validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`);
    this.name = 'ConfigValidationError';
    this.errors = errors;
  }
}

/**
 * Get config file search paths in priority order
 */
export function getConfigSearchPaths(): string[] {
  const localPath = join(process.cwd(), 'gh-ping.config.js');
  const globalPath = getGlobalConfigPath();
  return [localPath, globalPath];
}

/**
 * Find the first existing config file
 */
export function findConfigFile(): string | null {
  const paths = getConfigSearchPaths();
  for (const configPath of paths) {
    if (existsSync(configPath)) {
      return configPath;
    }
  }
  return null;
}

/**
 * Validate user config object
 */
export function validateConfig(config: unknown): string[] {
  const errors: string[] = [];

  if (config === null || typeof config !== 'object') {
    errors.push('Config must be an object');
    return errors;
  }

  const cfg = config as Record<string, unknown>;

  // Validate skipThreads
  if (cfg.skipThreads !== undefined) {
    if (!Array.isArray(cfg.skipThreads)) {
      errors.push('`skipThreads` must be an array');
    } else {
      for (let i = 0; i < cfg.skipThreads.length; i++) {
        if (typeof cfg.skipThreads[i] !== 'function') {
          errors.push(`skipThreads[${i}] must be a function`);
        }
      }
    }
  }

  // Validate skipActivities
  if (cfg.skipActivities !== undefined) {
    if (!Array.isArray(cfg.skipActivities)) {
      errors.push('`skipActivities` must be an array');
    } else {
      for (let i = 0; i < cfg.skipActivities.length; i++) {
        if (typeof cfg.skipActivities[i] !== 'function') {
          errors.push(`skipActivities[${i}] must be a function`);
        }
      }
    }
  }

  // Validate booleans
  if (cfg.markSkippedAsRead !== undefined && typeof cfg.markSkippedAsRead !== 'boolean') {
    errors.push('`markSkippedAsRead` must be a boolean');
  }

  if (cfg.sound !== undefined && typeof cfg.sound !== 'boolean') {
    errors.push('`sound` must be a boolean');
  }

  if (cfg.markAsReadOnClick !== undefined && typeof cfg.markAsReadOnClick !== 'boolean') {
    errors.push('`markAsReadOnClick` must be a boolean');
  }

  return errors;
}

/**
 * Load and validate config from a file path
 */
export async function loadConfigFromPath(configPath: string): Promise<GhPingConfig> {
  // Use file:// URL for cross-platform compatibility with ESM imports
  const fileUrl = pathToFileURL(configPath).href;

  // Add cache-busting query to ensure fresh import
  const urlWithCacheBust = `${fileUrl}?t=${Date.now()}`;

  const module = await import(urlWithCacheBust);
  const userConfig: GhPingUserConfig = module.default ?? {};

  const errors = validateConfig(userConfig);
  if (errors.length > 0) {
    throw new ConfigValidationError(errors);
  }

  return applyDefaults(userConfig);
}

/**
 * Load config from the first available config file
 */
export async function loadConfig(): Promise<{ config: GhPingConfig; path: string }> {
  const configPath = findConfigFile();

  if (!configPath) {
    throw new ConfigNotFoundError(getConfigSearchPaths());
  }

  const config = await loadConfigFromPath(configPath);
  return { config, path: configPath };
}
