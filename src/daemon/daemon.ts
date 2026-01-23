import type { GhPingConfig, NotificationEvent } from '../config/schema.js';
import {
  fetchNotifications,
  fetchPullRequest,
  fetchViewerLogin,
  GitHubClientError,
} from '../github/client.js';
import { sendNotification, formatTitle, getRepoDisplayName } from '../notifications/notifier.js';
import { getPrActivitySummary } from '../notifications/pr-activity.js';
import { logger } from '../logging/logger.js';
import { removePidFile } from './pid.js';

interface PollResult {
  pollIntervalSec?: number;
  nextSince: Date | null;
}

/**
 * Run the daemon poll loop
 */
export async function runDaemon(config: GhPingConfig): Promise<void> {
  const fallbackPollIntervalSec = 60;
  let nextPollIntervalSec = fallbackPollIntervalSec;
  let since: Date | null = null;

  logger.info('Starting gh-ping daemon');

  // Handle graceful shutdown
  const shutdown = () => {
    logger.info('Shutting down...');
    removePidFile();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Initial poll
  let initialPollIntervalSec: number | undefined;
  try {
    const result = await poll(config, since);
    initialPollIntervalSec = result.pollIntervalSec;
    since = result.nextSince;
  } catch (err) {
    logger.error(`Poll failed: ${err instanceof Error ? err.message : err}`);
  }

  const scheduleNext = (pollIntervalSec?: number) => {
    if (typeof pollIntervalSec === 'number' && Number.isFinite(pollIntervalSec) && pollIntervalSec > 0) {
      nextPollIntervalSec = pollIntervalSec;
    }

    logger.debug(`Next poll in ${nextPollIntervalSec}s`);
    setTimeout(() => {
      poll(config, since)
        .then((result) => {
          since = result.nextSince;
          scheduleNext(result.pollIntervalSec);
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
async function poll(config: GhPingConfig, since: Date | null): Promise<PollResult> {
  logger.debug('Polling notifications...');
  const requestStartedAt = new Date();

  let notifications: NotificationEvent[];
  let pollIntervalSec: number | undefined;

  try {
    const result = await fetchNotifications({ since: since ?? undefined });
    notifications = result.notifications;
    pollIntervalSec = result.pollIntervalSec;
  } catch (err) {
    if (err instanceof GitHubClientError) {
      logger.error(err.message);
    } else {
      logger.error(`Failed to fetch notifications: ${err}`);
    }
    return { pollIntervalSec, nextSince: since };
  }

  logger.debug(`Fetched ${notifications.length} notifications`);
  if (pollIntervalSec !== undefined) {
    logger.debug(`GitHub poll interval: ${pollIntervalSec}s`);
  }

  // Filter to new, unread notifications
  const newNotifications = notifications.filter((n) => n.unread);

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
  const prSummaryCache = new Map<string, string | null>();
  let viewerLogin: string | null = null;
  let viewerLoginReady = false;

  for (const event of filtered) {
    if (await isClosedPR(event)) {
      logger.ping('debug', 'Skipping closed PR', event.subject.title);
      continue;
    }

    const repoName = getRepoDisplayName(event.repository.fullName, config.repoAliases);
    let titleOverride: string | undefined;
    if (event.subject.type === 'PullRequest') {
      if (!viewerLoginReady) {
        viewerLogin = await fetchViewerLogin();
        viewerLoginReady = true;
      }
      const summary = await getPrActivitySummary(event, { viewerLogin, cache: prSummaryCache });
      if (summary) {
        titleOverride = `${summary} on \`${repoName}\``;
      }
    }
    const title = titleOverride ?? formatTitle(event, repoName);
    logger.ping('info', title, event.subject.title);

    await sendNotification(event, {
      sound: config.notifications.sound ?? true,
      repoAliases: config.repoAliases,
      titleOverride,
    });
  }

  const nextSince = getNextSince(since, notifications, requestStartedAt);
  return { pollIntervalSec, nextSince };
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

function getNextSince(
  previousSince: Date | null,
  notifications: NotificationEvent[],
  requestStartedAt: Date
): Date | null {
  let maxUpdatedAt: Date | null = null;

  for (const notification of notifications) {
    if (!maxUpdatedAt || notification.updatedAt > maxUpdatedAt) {
      maxUpdatedAt = notification.updatedAt;
    }
  }

  if (maxUpdatedAt) {
    return previousSince && previousSince > maxUpdatedAt ? previousSince : maxUpdatedAt;
  }

  return previousSince ?? requestStartedAt;
}
