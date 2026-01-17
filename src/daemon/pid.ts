import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { getPidPath } from '../utils/paths.js';

/**
 * Write daemon PID to file
 */
export function writePidFile(pid: number): void {
  writeFileSync(getPidPath(), String(pid));
}

/**
 * Read daemon PID from file
 */
export function readPidFile(): number | null {
  const pidPath = getPidPath();
  if (!existsSync(pidPath)) {
    return null;
  }

  try {
    const content = readFileSync(pidPath, 'utf-8').trim();
    const pid = parseInt(content, 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

/**
 * Remove PID file
 */
export function removePidFile(): void {
  const pidPath = getPidPath();
  if (existsSync(pidPath)) {
    try {
      unlinkSync(pidPath);
    } catch {
      // Ignore errors
    }
  }
}

/**
 * Check if a process is running
 */
export function isProcessRunning(pid: number): boolean {
  try {
    // Signal 0 = check if process exists without killing it
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get daemon status
 */
export function getDaemonStatus(): { running: boolean; pid: number | null } {
  const pid = readPidFile();

  if (pid === null) {
    return { running: false, pid: null };
  }

  if (isProcessRunning(pid)) {
    return { running: true, pid };
  }

  // Stale PID file - remove it
  removePidFile();
  return { running: false, pid: null };
}

/**
 * Stop the daemon process
 */
export function stopDaemon(): boolean {
  const { running, pid } = getDaemonStatus();

  if (!running || pid === null) {
    return false;
  }

  try {
    process.kill(pid, 'SIGTERM');
    removePidFile();
    return true;
  } catch {
    return false;
  }
}
