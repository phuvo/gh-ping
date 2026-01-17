import { spawn } from 'child_process';
import { openSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { getLogPath } from '../utils/paths.js';
import { writePidFile } from './pid.js';

/**
 * Spawn daemon as a detached background process
 */
export function spawnDaemon(configDir: string): number {
  // Get the path to the CLI entry point
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const cliPath = resolve(__dirname, '..', 'index.js');

  // Open log file for stdout/stderr
  const logFile = openSync(getLogPath(), 'a');

  const child = spawn(
    process.execPath,
    [cliPath, 'start', '--daemon-mode'],
    {
      detached: true,
      stdio: ['ignore', logFile, logFile],
      cwd: configDir,
      env: {
        ...process.env,
        GH_PING_DAEMON: '1',
      },
    }
  );

  child.unref();

  const pid = child.pid!;
  writePidFile(pid);

  return pid;
}
