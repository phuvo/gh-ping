import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Get the data directory for gh-ping (~/.gh-ping/)
 * Creates the directory if it doesn't exist
 */
export function getDataDir(): string {
  const dir = join(homedir(), '.gh-ping');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Get the path to the PID file (~/.gh-ping/daemon.pid)
 */
export function getPidPath(): string {
  return join(getDataDir(), 'daemon.pid');
}

/**
 * Get the path to the log file (~/.gh-ping/daemon.log)
 */
export function getLogPath(): string {
  return join(getDataDir(), 'daemon.log');
}

/**
 * Get the global config directory (~/.config/gh-ping/)
 */
export function getGlobalConfigDir(): string {
  return join(homedir(), '.config', 'gh-ping');
}

/**
 * Get the global config file path (~/.config/gh-ping/config.js)
 */
export function getGlobalConfigPath(): string {
  return join(getGlobalConfigDir(), 'config.js');
}
