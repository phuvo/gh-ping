import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { getPidPath } from '../utils/paths.js';

/**
 * Result of reading daemon status
 */
export interface DaemonStatus {
  running: boolean;
  pid: number | null;
}

/**
 * Check if a process is running by PID
 */
function isProcessRunning(pid: number): boolean {
  try {
    // Sending signal 0 checks if process exists without actually sending a signal
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Write PID file
 */
export function writePidFile(pid: number): void {
  const pidPath = getPidPath();
  writeFileSync(pidPath, pid.toString(), 'utf8');
}

/**
 * Remove PID file
 */
export function removePidFile(): void {
  const pidPath = getPidPath();
  if (existsSync(pidPath)) {
    unlinkSync(pidPath);
  }
}

/**
 * Read daemon status from PID file
 */
export function getDaemonStatus(): DaemonStatus {
  const pidPath = getPidPath();

  if (!existsSync(pidPath)) {
    return { running: false, pid: null };
  }

  const content = readFileSync(pidPath, 'utf8').trim();
  const pid = parseInt(content, 10);

  if (isNaN(pid)) {
    // Invalid PID file, clean it up
    removePidFile();
    return { running: false, pid: null };
  }

  if (isProcessRunning(pid)) {
    return { running: true, pid };
  }

  // Process not running, clean up stale PID file
  removePidFile();
  return { running: false, pid: null };
}

/**
 * Stop the daemon by PID
 */
export function stopDaemon(): { success: boolean; pid: number | null } {
  const status = getDaemonStatus();

  if (!status.running || status.pid === null) {
    return { success: false, pid: null };
  }

  try {
    // Send SIGTERM on Unix, or terminate on Windows
    process.kill(status.pid, 'SIGTERM');
    removePidFile();
    return { success: true, pid: status.pid };
  } catch {
    return { success: false, pid: status.pid };
  }
}
