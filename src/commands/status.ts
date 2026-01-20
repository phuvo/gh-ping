import { Command } from 'commander';
import { getDaemonStatus } from '../daemon/index.js';
import { findConfigPath } from '../config/loader.js';
import { checkGhAuth } from '../github/client.js';
import { getDataDir, getLogPath } from '../utils/paths.js';

export const statusCommand = new Command('status')
  .description('Show gh-ping status')
  .action(async () => {
    // Daemon status
    const status = getDaemonStatus();
    console.log('Daemon:');
    if (status.running) {
      console.log(`  Status: Running (PID: ${status.pid})`);
    } else {
      console.log('  Status: Stopped');
    }

    // Config
    const configPath = findConfigPath();
    console.log('\nConfig:');
    if (configPath) {
      console.log(`  File: ${configPath}`);
    } else {
      console.log('  File: Not found');
    }

    // gh CLI auth
    const authCheck = await checkGhAuth();
    console.log('\nGitHub CLI:');
    if (authCheck.ok) {
      console.log('  Auth: Authenticated');
    } else {
      console.log('  Auth: Not authenticated');
      console.log(`  Error: ${authCheck.error}`);
    }

    // Paths
    console.log('\nPaths:');
    console.log(`  Data dir: ${getDataDir()}`);
    console.log(`  Log file: ${getLogPath()}`);
  });
