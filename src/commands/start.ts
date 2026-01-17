import { Command } from 'commander';
import { loadConfig, ConfigNotFoundError, ConfigValidationError } from '../config/loader.js';
import { checkGhAuth } from '../github/client.js';
import { getDaemonStatus, spawnDaemon, runDaemon } from '../daemon/index.js';
import { logger } from '../logging/logger.js';

export const startCommand = new Command('start')
  .description('Start the gh-ping daemon')
  .option('-f, --foreground', 'Run in foreground instead of background')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--daemon-mode', 'Internal flag for spawned daemon')
  .action(async (options) => {
    const isDaemonMode = options.daemonMode || process.env.GH_PING_DAEMON === '1';
    const foreground = options.foreground || isDaemonMode;
    const verbose = options.verbose;

    // Configure logger
    logger.configure({
      verbose,
      daemon: isDaemonMode,
    });

    // Check if already running (unless we're the spawned daemon)
    if (!isDaemonMode) {
      const status = getDaemonStatus();
      if (status.running) {
        console.error(`Daemon is already running (PID: ${status.pid})`);
        console.error('Use "gh-ping stop" to stop it first.');
        process.exit(1);
      }
    }

    // Check gh CLI auth
    const authCheck = await checkGhAuth();
    if (!authCheck.ok) {
      console.error('GitHub CLI authentication failed:');
      console.error(authCheck.error);
      console.error('\nRun "gh auth login" to authenticate.');
      process.exit(1);
    }

    // Load config
    let config;
    try {
      config = await loadConfig();
    } catch (err) {
      if (err instanceof ConfigNotFoundError) {
        console.error(err.message);
        process.exit(1);
      }
      if (err instanceof ConfigValidationError) {
        console.error('Config validation error:', err.message);
        process.exit(1);
      }
      throw err;
    }

    if (foreground) {
      // Run in foreground
      if (!isDaemonMode) {
        console.log('Running in foreground (Ctrl+C to stop)');
      }
      await runDaemon(config);
    } else {
      // Spawn background daemon
      const pid = spawnDaemon(process.cwd());
      console.log(`Daemon started (PID: ${pid})`);
      console.log('Use "gh-ping status" to check status');
      console.log('Use "gh-ping stop" to stop');
    }
  });
