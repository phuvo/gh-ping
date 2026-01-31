#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand, startCommand, stopCommand, statusCommand, testCommand } from './commands/index.js';

const VERSION = '0.1.0';

const program = new Command();

program
  .name('gh-ping')
  .description('GitHub notifications via native OS alerts, powered by gh CLI')
  .version(VERSION);

program
  .command('start')
  .description('Start the notification daemon')
  .option('-f, --foreground', 'Run daemon loop in foreground')
  .option('-v, --verbose', 'Enable debug logging')
  .action(startCommand);

program
  .command('stop')
  .description('Stop the notification daemon')
  .action(stopCommand);

program
  .command('status')
  .description('Show daemon status and configuration')
  .action(statusCommand);

program
  .command('test')
  .description('Test configuration and send a test notification')
  .action(testCommand);

program
  .command('init')
  .description('Create a configuration file')
  .option('-f, --force', 'Overwrite existing config file')
  .option('-l, --local', 'Create config in current directory instead of global location')
  .action(initCommand);

program.parse();
