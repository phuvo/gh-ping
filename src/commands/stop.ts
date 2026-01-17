import { Command } from 'commander';
import { getDaemonStatus, stopDaemon } from '../daemon/index.js';

export const stopCommand = new Command('stop')
  .description('Stop the gh-ping daemon')
  .action(() => {
    const status = getDaemonStatus();

    if (!status.running) {
      console.log('Daemon is not running');
      return;
    }

    if (stopDaemon()) {
      console.log(`Daemon stopped (was PID: ${status.pid})`);
    } else {
      console.error('Failed to stop daemon');
      process.exit(1);
    }
  });
