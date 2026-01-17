import { Command } from 'commander';
import { loadConfig, ConfigNotFoundError, ConfigValidationError } from '../config/loader.js';
import { checkGhAuth, fetchNotifications } from '../github/client.js';
import { sendTestNotification } from '../notifications/notifier.js';

export const testCommand = new Command('test')
  .description('Test configuration and send a test notification')
  .action(async () => {
    console.log('Testing gh-ping configuration...\n');

    // Check gh CLI
    console.log('1. Checking GitHub CLI...');
    const authCheck = await checkGhAuth();
    if (!authCheck.ok) {
      console.error('   ✖ GitHub CLI not authenticated');
      console.error(`     ${authCheck.error}`);
      console.error('   Run "gh auth login" to authenticate.');
      process.exit(1);
    }
    console.log('   ✔ GitHub CLI authenticated');

    // Load config
    console.log('\n2. Loading config...');
    let config;
    try {
      config = await loadConfig();
      console.log('   ✔ Config loaded successfully');
      console.log(`   • Polling interval: ${config.polling.intervalMs / 1000}s`);
      console.log(`   • Filters: ${config.filters.length}`);
      console.log(`   • Sound: ${config.notifications.sound ? 'enabled' : 'disabled'}`);
    } catch (err) {
      if (err instanceof ConfigNotFoundError) {
        console.error('   ✖ Config not found');
        console.error('   Run "gh-ping init" to create one.');
        process.exit(1);
      }
      if (err instanceof ConfigValidationError) {
        console.error('   ✖ Config validation error');
        console.error(`     ${err.message}`);
        process.exit(1);
      }
      throw err;
    }

    // Test fetching notifications
    console.log('\n3. Fetching notifications...');
    try {
      const notifications = await fetchNotifications();
      console.log(`   ✔ Fetched ${notifications.length} notifications`);

      // Show sample if any exist
      if (notifications.length > 0) {
        const sample = notifications[0];
        console.log(`   Sample: [${sample.repository.fullName}] ${sample.subject.title}`);
      }
    } catch (err) {
      console.error(`   ✖ Failed to fetch: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }

    // Send test notification
    console.log('\n4. Sending test notification...');
    try {
      await sendTestNotification();
      console.log('   ✔ Test notification sent');
    } catch (err) {
      console.error(`   ✖ Failed to send: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }

    console.log('\n✔ All tests passed! gh-ping is ready to use.');
    console.log('Run "gh-ping start" to start the daemon.');
  });
