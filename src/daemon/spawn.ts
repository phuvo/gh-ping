import { spawn } from 'node:child_process';
import { openSync } from 'node:fs';
import { getLogPath } from '../utils/paths.js';

/**
 * Spawn the daemon as a detached background process
 */
export function spawnDaemon(verbose: boolean): number {
  const logPath = getLogPath();

  // Open log file for stdout/stderr
  const logFd = openSync(logPath, 'a');

  // Build arguments for the daemon process
  const args = ['start', '--foreground'];
  if (verbose) {
    args.push('--verbose');
  }

  // Spawn detached process
  const child = spawn(process.execPath, [process.argv[1], ...args], {
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: {
      ...process.env,
      GH_PING_DAEMON: '1',
    },
  });

  // Unreference so parent can exit
  child.unref();

  return child.pid ?? 0;
}
