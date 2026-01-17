import { Command } from 'commander';
import { startCommand, stopCommand, statusCommand, testCommand, initCommand } from './commands/index.js';

const program = new Command();

program
  .name('gh-ping')
  .description('GitHub notification alerts via OS notifications')
  .version('0.1.0');

program.addCommand(startCommand);
program.addCommand(stopCommand);
program.addCommand(statusCommand);
program.addCommand(testCommand);
program.addCommand(initCommand);

program.parse();

// Re-export for config files
export { defineConfig } from './config/schema.js';
export type { GhPingConfig, GhPingUserConfig, NotificationEvent, NotificationFilter } from './config/schema.js';
export type { NotificationReason, SubjectType } from './github/types.js';
