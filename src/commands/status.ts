import chalk from 'chalk';
import { getDaemonStatus } from '../daemon/index.js';
import { findConfigFile } from '../config/index.js';
import { checkGhAuth } from '../github/client.js';
import { getDataDir, getLogPath } from '../utils/paths.js';

export async function statusCommand(): Promise<void> {
  // Daemon status
  const daemonStatus = getDaemonStatus();
  console.log(chalk.bold('Daemon:'));
  if (daemonStatus.running) {
    console.log(`  Status: ${chalk.green('Running')} (PID: ${daemonStatus.pid})`);
  } else {
    console.log(`  Status: ${chalk.yellow('Stopped')}`);
  }

  // Config status
  const configPath = findConfigFile();
  console.log('\n' + chalk.bold('Config:'));
  if (configPath) {
    console.log(`  File: ${configPath}`);
  } else {
    console.log(`  File: ${chalk.yellow('Not found')}`);
  }

  // GitHub CLI status
  const auth = await checkGhAuth();
  console.log('\n' + chalk.bold('GitHub CLI:'));
  if (auth.ok) {
    console.log(`  Auth: ${chalk.green('Authenticated')}`);
  } else {
    console.log(`  Auth: ${chalk.red('Not authenticated')}`);
    if (auth.error) {
      console.log(`  Error: ${auth.error}`);
    }
  }

  // Paths
  console.log('\n' + chalk.bold('Paths:'));
  console.log(`  Data dir: ${getDataDir()}`);
  console.log(`  Log file: ${getLogPath()}`);
}
