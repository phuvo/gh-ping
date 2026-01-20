import type { GhPingConfig, NotificationEvent } from '../config/schema.js';
import { fetchNotifications, fetchPullRequest, GitHubClientError } from '../github/client.js';
import { sendNotification, formatTitle, getRepoDisplayName } from '../notifications/notifier.js';
import { StateManager } from '../state/state.js';
import { logger } from '../logging/logger.js';
import { removePidFile } from './pid.js';

/**
 * Run the daemon poll loop
 */
export async function runDaemon(config: GhPingConfig): Promise<void> {
  const state = new StateManager();
  const fallbackPollIntervalSec = 60;
  let nextPollIntervalSec = fallbackPollIntervalSec;

  logger.info('Starting gh-ping daemon');

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
  let initialPollIntervalSec: number | undefined;
  try {
    initialPollIntervalSec = await poll(config, state);
  } catch (err) {
    logger.error(`Poll failed: ${err instanceof Error ? err.message : err}`);
  }

  const scheduleNext = (pollIntervalSec?: number) => {
    if (typeof pollIntervalSec === 'number' && Number.isFinite(pollIntervalSec) && pollIntervalSec > 0) {
      nextPollIntervalSec = pollIntervalSec;
    }

    logger.debug(`Next poll in ${nextPollIntervalSec}s`);
    setTimeout(() => {
      poll(config, state)
        .then((nextIntervalSec) => {
          scheduleNext(nextIntervalSec);
        })
        .catch((err) => {
          logger.error(`Poll failed: ${err instanceof Error ? err.message : err}`);
          scheduleNext();
        });
    }, nextPollIntervalSec * 1000);
  };

  scheduleNext(initialPollIntervalSec);
}

/**
 * Single poll iteration
 */
async function poll(config: GhPingConfig, state: StateManager): Promise<number | undefined> {
  logger.debug('Polling notifications...');

  let notifications: NotificationEvent[];
  let pollIntervalSec: number | undefined;

  try {
    const result = await fetchNotifications();
    notifications = result.notifications;
    pollIntervalSec = result.pollIntervalSec;
  } catch (err) {
    if (err instanceof GitHubClientError) {
      logger.error(err.message);
    } else {
      logger.error(`Failed to fetch notifications: ${err}`);
    }
    return pollIntervalSec;
  }

  logger.debug(`Fetched ${notifications.length} notifications`);
  if (pollIntervalSec !== undefined) {
    logger.debug(`GitHub poll interval: ${pollIntervalSec}s`);
  }

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
    if (await isClosedPR(event)) {
      logger.ping('debug', 'Skipping closed PR', event.subject.title);
      continue;
    }

    const repoName = getRepoDisplayName(event.repository.fullName, config.repoAliases);
    const title = formatTitle(event, repoName);
    logger.ping('info', title, event.subject.title);

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

  return pollIntervalSec;
}

/**
 * Check if a notification is for a PR that's already closed
 */
async function isClosedPR(event: NotificationEvent): Promise<boolean> {
  if (event.subject.type !== 'PullRequest') {
    return false;
  }

  const apiUrl = event._raw.subject.url;
  if (!apiUrl) {
    return false;
  }

  const pr = await fetchPullRequest(apiUrl);
  return pr?.state === 'closed';
}
