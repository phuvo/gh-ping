import { appendFileSync } from 'fs';
import { getLogPath } from '../utils/paths.js';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class Logger {
  private verbose = false;
  private isDaemon = false;

  /**
   * Configure logger options
   */
  configure(options: { verbose?: boolean; daemon?: boolean }): void {
    this.verbose = options.verbose ?? false;
    this.isDaemon = options.daemon ?? false;
  }

  /**
   * Log a message
   */
  log(level: LogLevel, message: string): void {
    if (level === 'debug' && !this.verbose) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '✖' : level === 'warn' ? '⚠' : level === 'debug' ? '…' : '•';
    const line = `[${timestamp}] ${prefix} ${message}`;

    if (this.isDaemon) {
      try {
        appendFileSync(getLogPath(), line + '\n');
      } catch {
        // Can't write to log file - nothing we can do
      }
    } else {
      if (level === 'error') {
        console.error(line);
      } else {
        console.log(line);
      }
    }
  }

  info(message: string): void {
    this.log('info', message);
  }

  warn(message: string): void {
    this.log('warn', message);
  }

  error(message: string): void {
    this.log('error', message);
  }

  debug(message: string): void {
    this.log('debug', message);
  }
}

export const logger = new Logger();
