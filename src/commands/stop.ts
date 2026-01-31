import chalk from 'chalk';
import { stopDaemon, getDaemonStatus } from '../daemon/index.js';

export async function stopCommand(): Promise<void> {
  const status = getDaemonStatus();

  if (!status.running) {
    console.log(chalk.yellow('Daemon is not running'));
    return;
  }

  const result = stopDaemon();

  if (result.success) {
    console.log(chalk.green(`Daemon stopped (was PID: ${result.pid})`));
  } else {
    console.error(chalk.red('Failed to stop daemon'));
    process.exit(1);
  }
}
