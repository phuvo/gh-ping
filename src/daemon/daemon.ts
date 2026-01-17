import type { GhPingConfig, NotificationEvent } from '../config/schema.js';
import { fetchNotifications, GitHubClientError } from '../github/client.js';
import { sendNotification, formatTitle, getRepoDisplayName } from '../notifications/notifier.js';
import { StateManager } from '../state/state.js';
import { logger } from '../logging/logger.js';
import { removePidFile } from './pid.js';

/**
 * Run the daemon poll loop
 */
export async function runDaemon(config: GhPingConfig): Promise<void> {
  const state = new StateManager();

  logger.info(`Starting gh-ping daemon (polling every ${config.polling.intervalSec}s)`);

  // Handle graceful shutdown
  const shutdown = () => {
    logger.info('Shutting down...');
    state.save();
    removePidFile();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Initial poll
  await poll(config, state);

  // Set up polling interval
  setInterval(() => {
    poll(config, state).catch((err) => {
      logger.error(`Poll failed: ${err.message}`);
    });
  }, config.polling.intervalSec * 1000);
}

/**
 * Single poll iteration
 */
async function poll(config: GhPingConfig, state: StateManager): Promise<void> {
  logger.debug('Polling notifications...');

  let notifications: NotificationEvent[];

  try {
    notifications = await fetchNotifications();
  } catch (err) {
    if (err instanceof GitHubClientError) {
      logger.error(err.message);
    } else {
      logger.error(`Failed to fetch notifications: ${err}`);
    }
    return;
  }

  logger.debug(`Fetched ${notifications.length} notifications`);

  // Filter to new, unread notifications
  const newNotifications = notifications.filter((n) => {
    if (!n.unread) return false;
    if (!state.isNew(n.id)) return false;
    return true;
  });

  logger.debug(`${newNotifications.length} are new and unread`);

  // Apply user filters
  const filtered = newNotifications.filter((n) => {
    return config.filters.every((filter) => {
      try {
        return filter(n);
      } catch (err) {
        logger.warn(`Filter error: ${err}`);
        return false;
      }
    });
  });

  logger.debug(`${filtered.length} passed filters`);

  // Send notifications
  for (const event of filtered) {
    const repoName = getRepoDisplayName(event.repository.fullName, config.repoAliases);
    const title = formatTitle(event, repoName);
    logger.info(`${title}: ${event.subject.title}`);

    await sendNotification(event, {
      sound: config.notifications.sound ?? true,
      repoAliases: config.repoAliases,
    });

    state.markSeen(event.id);
  }

  // Mark all fetched notifications as seen (even if filtered out)
  // This prevents re-processing on next poll
  state.markSeenBatch(notifications.map((n) => n.id));
  state.updateLastPoll();
  state.save();
}
