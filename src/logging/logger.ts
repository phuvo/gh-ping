import { appendFileSync } from 'node:fs';
import chalk from 'chalk';
import { getLogPath } from '../utils/paths.js';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class Logger {
  private verbose = false;
  private isDaemon = false;

  configure(options: { verbose?: boolean; daemon?: boolean }): void {
    if (options.verbose !== undefined) {
      this.verbose = options.verbose;
    }
    if (options.daemon !== undefined) {
      this.isDaemon = options.daemon;
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
    if (this.verbose) {
      this.log('debug', message);
    }
  }

  private log(level: LogLevel, message: string): void {
    const timestamp = this.formatTimestamp();

    if (this.isDaemon) {
      // Daemon mode: append to log file
      const logPath = getLogPath();
      const line = `[${timestamp}] ${level.toUpperCase()} ${message}\n`;
      appendFileSync(logPath, line);
    } else {
      // Console mode: colored output
      const coloredTimestamp = chalk.gray(`[${timestamp}]`);
      const coloredLevel = this.colorLevel(level);
      console.log(`${coloredTimestamp} ${coloredLevel} ${message}`);
    }
  }

  private formatTimestamp(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  private colorLevel(level: LogLevel): string {
    switch (level) {
      case 'info':
        return chalk.blue('INFO');
      case 'warn':
        return chalk.yellow('WARN');
      case 'error':
        return chalk.red('ERROR');
      case 'debug':
        return chalk.magenta('DEBUG');
    }
  }
}

export const logger = new Logger();
