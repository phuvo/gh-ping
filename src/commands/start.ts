import chalk from 'chalk';
import { loadConfig, ConfigNotFoundError, ConfigValidationError } from '../config/index.js';
import { checkGhAuth } from '../github/client.js';
import { getDaemonStatus, spawnDaemon, runDaemon } from '../daemon/index.js';
import { logger } from '../logging/logger.js';

interface StartOptions {
  foreground?: boolean;
  verbose?: boolean;
}

export async function startCommand(options: StartOptions): Promise<void> {
  const isDaemonMode = process.env.GH_PING_DAEMON === '1';
  const foreground = options.foreground || isDaemonMode;

  // Configure logger
  logger.configure({
    verbose: options.verbose,
    daemon: isDaemonMode,
  });

  // If not in daemon mode, check if already running
  if (!isDaemonMode) {
    const status = getDaemonStatus();
    if (status.running) {
      console.error(chalk.red(`Daemon is already running (PID: ${status.pid})`));
      console.error(chalk.gray('Use "gh-ping stop" to stop it first.'));
      process.exit(1);
    }
  }

  // Check gh auth
  const auth = await checkGhAuth();
  if (!auth.ok) {
    console.error(chalk.red('✖ GitHub CLI is not authenticated'));
    if (auth.error) {
      console.error(chalk.gray(`  ${auth.error}`));
    }
    console.error(chalk.gray('  Run "gh auth login" to authenticate'));
    process.exit(1);
  }

  // Load config
  let config;
  try {
    const result = await loadConfig();
    config = result.config;
  } catch (err) {
    if (err instanceof ConfigNotFoundError) {
      console.error(chalk.red('✖ Config file not found'));
      console.error(chalk.gray('  Run "gh-ping init" to create one'));
      process.exit(1);
    }
    if (err instanceof ConfigValidationError) {
      console.error(chalk.red('✖ Config validation failed:'));
      for (const error of err.errors) {
        console.error(chalk.gray(`  - ${error}`));
      }
      process.exit(1);
    }
    throw err;
  }

  if (foreground) {
    // Run in foreground
    if (!isDaemonMode) {
      console.log(chalk.cyan('Running in foreground (Ctrl+C to stop)'));
    }
    await runDaemon(config);
  } else {
    // Spawn detached daemon
    const pid = spawnDaemon(options.verbose ?? false);

    console.log(chalk.green(`Daemon started (PID: ${pid})`));
    console.log(chalk.gray('Use "gh-ping status" to check status'));
    console.log(chalk.gray('Use "gh-ping stop" to stop'));
  }
}
