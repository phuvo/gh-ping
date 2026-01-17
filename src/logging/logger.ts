import chalk from 'chalk';
import { appendFileSync } from 'fs';
import { getLogPath } from '../utils/paths.js';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function formatTime(): string {
  return new Date().toISOString().slice(11, 19);
}

class Logger {
  private verbose = false;
  private isDaemon = false;

  configure(options: { verbose?: boolean; daemon?: boolean }): void {
    this.verbose = options.verbose ?? false;
    this.isDaemon = options.daemon ?? false;
  }

  private log(level: LogLevel, message: string): void {
    if (level === 'debug' && !this.verbose) {
      return;
    }

    const time = formatTime();

    if (this.isDaemon) {
      const prefix = level.toUpperCase().padEnd(5);
      const line = `[${time}] ${prefix} ${message}`;
      try {
        appendFileSync(getLogPath(), line + '\n');
      } catch {
        // Can't write to log file - nothing we can do
      }
    } else {
      this.logToConsole(level, time, message);
    }
  }

  private logToConsole(level: LogLevel, time: string, message: string): void {
    const levelColors = {
      debug: chalk.gray,
      info: chalk.blue,
      warn: chalk.yellow,
      error: chalk.red,
    };
    const color = levelColors[level];
    const label = level.toUpperCase().padEnd(5);

    const formatted = `${color(`[${time}]`)} ${color(label)} ${message}`;

    if (level === 'error') {
      console.error(formatted);
    } else {
      console.log(formatted);
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

  success(message: string): void {
    console.log(chalk.green('✓'), message);
  }

  ping(message: string): void {
    console.log(chalk.magenta('🔔'), message);
  }
}

export const logger = new Logger();
