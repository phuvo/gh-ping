import chalk from 'chalk';
import { checkGhAuth, fetchNotifications } from '../github/client.js';
import { loadConfig, ConfigNotFoundError, ConfigValidationError } from '../config/index.js';
import { sendTestNotification } from '../toast/sender.js';

export async function testCommand(): Promise<void> {
  let hasError = false;

  // 1. Checking GitHub CLI
  console.log(chalk.bold('1. Checking GitHub CLI'));
  const auth = await checkGhAuth();
  if (auth.ok) {
    console.log(chalk.green('   ✔ Authenticated'));
  } else {
    console.log(chalk.red('   ✖ Not authenticated'));
    if (auth.error) {
      console.log(chalk.gray(`     ${auth.error}`));
    }
    hasError = true;
  }

  // 2. Loading config
  console.log('\n' + chalk.bold('2. Loading config'));
  let config;
  let configPath: string | null = null;
  try {
    const result = await loadConfig();
    config = result.config;
    configPath = result.path;
    console.log(chalk.green(`   ✔ Config loaded from: ${configPath}`));
    console.log(chalk.gray(`     Thread filters: ${config.skipThreads.length}`));
    console.log(chalk.gray(`     Activity filters: ${config.skipActivities.length}`));
    console.log(chalk.gray(`     Sound: ${config.sound ? 'enabled' : 'disabled'}`));
  } catch (err) {
    if (err instanceof ConfigNotFoundError) {
      console.log(chalk.red('   ✖ Config file not found'));
      console.log(chalk.gray('     Run "gh-ping init" to create one'));
    } else if (err instanceof ConfigValidationError) {
      console.log(chalk.red('   ✖ Config validation failed:'));
      for (const error of err.errors) {
        console.log(chalk.gray(`     - ${error}`));
      }
    } else {
      console.log(chalk.red(`   ✖ Failed to load config: ${err}`));
    }
    hasError = true;
  }

  // 3. Fetching notifications (only if auth passed)
  console.log('\n' + chalk.bold('3. Fetching notifications'));
  if (!auth.ok) {
    console.log(chalk.yellow('   ⊘ Skipped (not authenticated)'));
  } else {
    try {
      const { notifications, pollIntervalSec } = await fetchNotifications();
      console.log(chalk.green(`   ✔ Fetched ${notifications.length} notifications`));
      console.log(chalk.gray(`     Poll interval: ${pollIntervalSec}s`));
      if (notifications.length > 0) {
        const sample = notifications[0];
        console.log(chalk.gray(`     Sample: [${sample.subject.type}] ${sample.subject.title}`));
      }
    } catch (err) {
      console.log(chalk.red(`   ✖ Failed to fetch notifications: ${err}`));
      hasError = true;
    }
  }

  // 4. Sending test notification
  console.log('\n' + chalk.bold('4. Sending test notification'));
  try {
    await sendTestNotification();
    console.log(chalk.green('   ✔ Test notification sent'));
  } catch (err) {
    console.log(chalk.red(`   ✖ Failed to send notification: ${err}`));
    hasError = true;
  }

  // Summary
  console.log();
  if (hasError) {
    console.log(chalk.red('✖ Some tests failed. Please fix the issues above.'));
    process.exit(1);
  } else {
    console.log(chalk.green('✔ All tests passed! gh-ping is ready to use.'));
    console.log(chalk.gray('Run "gh-ping start" to start the daemon.'));
  }
}
