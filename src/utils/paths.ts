import { existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const GH_PING_DIR = '.gh-ping';

/**
 * Get the gh-ping data directory (~/.gh-ping/)
 */
export function getDataDir(): string {
  const dir = join(homedir(), GH_PING_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Get path to state file (~/.gh-ping/state.json)
 */
export function getStatePath(): string {
  return join(getDataDir(), 'state.json');
}

/**
 * Get path to PID file (~/.gh-ping/daemon.pid)
 */
export function getPidPath(): string {
  return join(getDataDir(), 'daemon.pid');
}

/**
 * Get path to log file (~/.gh-ping/daemon.log)
 */
export function getLogPath(): string {
  return join(getDataDir(), 'daemon.log');
}
