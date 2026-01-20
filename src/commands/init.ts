import { Command } from 'commander';
import { existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const CONFIG_TEMPLATE = `// gh-ping configuration
// See: https://github.com/phuvo/gh-ping#configuration

/** @type {import('gh-ping').GhPingUserConfig} */
export default {
  filters: [
    // Only PRs and Issues (skip CI noise like WorkflowRun, CheckSuite)
    (e) => ['PullRequest', 'Issue'].includes(e.subject.type),

    // Only important notifications
    (e) => ['review_requested', 'mention', 'assign', 'comment'].includes(e.reason),

    // Example: Exclude dependabot
    // (e) => !e.subject.title.toLowerCase().includes('dependabot'),

    // Example: Only specific repos
    // (e) => e.repository.fullName.startsWith('my-org/'),
  ],
  notifications: {
    sound: true,
  },
};
`;

export const initCommand = new Command('init')
  .description('Create a starter config file')
  .option('-f, --force', 'Overwrite existing config')
  .action((options) => {
    const configPath = resolve(process.cwd(), 'gh-ping.config.js');

    if (existsSync(configPath) && !options.force) {
      console.error(`Config file already exists: ${configPath}`);
      console.error('Use --force to overwrite.');
      process.exit(1);
    }

    writeFileSync(configPath, CONFIG_TEMPLATE);
    console.log(`Created config file: ${configPath}`);
    console.log('\nNext steps:');
    console.log('1. Edit the config to customize filters');
    console.log('2. Run "gh-ping test" to verify setup');
    console.log('3. Run "gh-ping start" to start the daemon');
  });
