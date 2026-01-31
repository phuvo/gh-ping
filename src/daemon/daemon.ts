import type {
  GhPingConfig,
  Thread,
  Activity,
  ThreadFilterInput,
  ActivityFilterInput,
} from '../config/schema.js';
import {
  fetchNotifications,
  fetchLatestActivities,
  fetchLatestWorkflowRun,
  fetchViewerLogin,
  markThreadAsRead,
} from '../github/client.js';
import { transformTimeline } from '../github/transform.js';
import {
  formatActivityNotification,
  formatThreadNotification,
  extractBranchFromSubject,
  reduceActivities,
  collapseMergeActivities,
} from '../formatting/index.js';
import { sendNotification } from '../toast/sender.js';
import { logger } from '../logging/logger.js';
import { writePidFile, removePidFile } from './pid.js';

// Default poll interval fallback (seconds)
const DEFAULT_POLL_INTERVAL_SEC = 60;

// Track when we last processed activities (only show newer ones)
let lastProcessedTime: Date | null = null;

// Workflow pass cache
const workflowPassCache = new Map<string, boolean>();

/**
 * Convert Thread to ThreadFilterInput (minimal data for filter functions)
 */
function toThreadFilterInput(thread: Thread): ThreadFilterInput {
  return {
    id: thread.id,
    reason: thread.reason,
    subject: {
      type: thread.subject.type,
      title: thread.subject.title,
    },
    repository: {
      fullName: thread.repository.fullName,
      name: thread.repository.name,
      owner: thread.repository.owner,
      private: thread.repository.private,
    },
    unread: thread.unread,
    updatedAt: thread.updatedAt,
  };
}

/**
 * Convert Activity to ActivityFilterInput
 */
function toActivityFilterInput(activity: Activity): ActivityFilterInput {
  const input: ActivityFilterInput = {
    event: activity.event,
    createdAt: activity.createdAt,
    actor: activity.actor,
  };

  if (activity.state) {
    input.state = activity.state;
  }
  if (activity.assignee) {
    input.assignee = activity.assignee;
  }
  if (activity.requestedReviewer) {
    input.requestedReviewer = activity.requestedReviewer;
  }
  if (activity.requestedTeam) {
    input.requestedTeam = activity.requestedTeam;
  }

  return input;
}

/**
 * Apply thread filters (return true to skip)
 */
function shouldSkipThread(thread: Thread, filters: GhPingConfig['skipThreads']): boolean {
  const input = toThreadFilterInput(thread);

  for (const filter of filters) {
    try {
      if (filter(input)) {
        return true;
      }
    } catch (err) {
      logger.warn(`Thread filter threw an error: ${err}`);
      // Treat error as "don't skip"
    }
  }

  return false;
}

/**
 * Apply activity filters (return true to skip)
 */
function shouldSkipActivity(
  thread: Thread,
  activity: Activity,
  filters: GhPingConfig['skipActivities'],
  viewerLogin: string | null
): boolean {
  // Skip viewer's own activities
  if (viewerLogin && activity.actor?.login === viewerLogin) {
    return true;
  }

  const threadInput = toThreadFilterInput(thread);
  const activityInput = toActivityFilterInput(activity);

  for (const filter of filters) {
    try {
      if (filter(threadInput, activityInput)) {
        return true;
      }
    } catch (err) {
      logger.warn(`Activity filter threw an error: ${err}`);
      // Treat error as "don't skip"
    }
  }

  return false;
}

/**
 * Filter threads into kept and skipped
 */
function filterThreads(
  threads: Thread[],
  filters: GhPingConfig['skipThreads']
): { kept: Thread[]; skipped: Thread[] } {
  const kept: Thread[] = [];
  const skipped: Thread[] = [];

  for (const thread of threads) {
    // Only consider unread threads
    if (!thread.unread) {
      continue;
    }

    if (shouldSkipThread(thread, filters)) {
      skipped.push(thread);
    } else {
      kept.push(thread);
    }
  }

  return { kept, skipped };
}

/**
 * Extract issue/PR number from API URL
 */
function extractIssueNumber(apiUrl: string | null): number | null {
  if (!apiUrl) {
    return null;
  }

  // Match /issues/123 or /pulls/123
  const match = apiUrl.match(/\/(issues|pulls)\/(\d+)$/);
  return match ? Number(match[2]) : null;
}

/**
 * Enrich a thread with timeline activities
 */
async function enrichThread(thread: Thread): Promise<void> {
  const { type } = thread.subject;

  // Only fetch timeline for Issues and Pull Requests
  if (type !== 'Issue' && type !== 'PullRequest') {
    return;
  }

  const issueNumber = extractIssueNumber(thread.subject.url);
  if (!issueNumber) {
    return;
  }

  try {
    const activities = await fetchLatestActivities({
      owner: thread.repository.owner,
      repo: thread.repository.name,
      issueId: issueNumber,
    });
    thread.activities = transformTimeline(activities);
  } catch (err) {
    logger.warn(`Failed to fetch timeline for ${thread.repository.fullName}#${issueNumber}: ${err}`);
    thread.activities = [];
  }
}

/**
 * Check if a WorkflowRun/CheckSuite should be skipped because CI has since passed
 */
async function shouldSkipWorkflowNotification(thread: Thread): Promise<boolean> {
  const { type, title } = thread.subject;

  if (type !== 'WorkflowRun' && type !== 'CheckSuite') {
    return false;
  }

  const branch = extractBranchFromSubject(title);
  if (!branch) {
    return false;
  }

  const cacheKey = `${thread.repository.fullName}#${branch}`;

  // Check cache first
  if (workflowPassCache.has(cacheKey)) {
    return workflowPassCache.get(cacheKey)!;
  }

  try {
    const run = await fetchLatestWorkflowRun(
      thread.repository.owner,
      thread.repository.name,
      branch
    );

    // Skip if latest run completed successfully
    const shouldSkip = run?.status === 'completed' && run?.conclusion === 'success';
    workflowPassCache.set(cacheKey, shouldSkip);
    return shouldSkip;
  } catch {
    return false;
  }
}

/**
 * Mark multiple threads as read
 */
async function markThreadsAsRead(threads: Thread[]): Promise<void> {
  for (const thread of threads) {
    try {
      await markThreadAsRead(thread.id);
    } catch (err) {
      logger.warn(`Failed to mark thread ${thread.id} as read: ${err}`);
    }
  }
}

/**
 * Poll result for tracking state between polls
 */
interface PollResult {
  nextSince: Date | null;
  pollIntervalSec: number;
}

/**
 * Execute one poll cycle
 */
async function poll(config: GhPingConfig, since: Date | null): Promise<PollResult> {
  const requestStartTime = new Date();

  // 1. FETCH
  logger.debug(`Fetching notifications${since ? ` since ${since.toISOString()}` : ''}...`);
  const { notifications: rawThreads, pollIntervalSec } = await fetchNotifications({ since: since ?? undefined });
  logger.debug(`Fetched ${rawThreads.length} notifications`);

  // 2. FILTER THREADS
  const { kept, skipped } = filterThreads(rawThreads, config.skipThreads);
  logger.debug(`Kept ${kept.length} threads, skipped ${skipped.length}`);

  // Mark skipped as read if configured
  if (config.markSkippedAsRead && skipped.length > 0) {
    await markThreadsAsRead(skipped);
  }

  // 3. ENRICH (fetch timeline for each thread)
  for (const thread of kept) {
    await enrichThread(thread);
  }

  // Get viewer login for filtering own activities
  const viewerLogin = await fetchViewerLogin();

  // 4. FILTER ACTIVITIES
  for (const thread of kept) {
    thread.activities = thread.activities.filter(
      (activity) => !shouldSkipActivity(thread, activity, config.skipActivities, viewerLogin)
    );
  }

  // 5. REDUCE ACTIVITIES (collapse same actor + event type)
  for (const thread of kept) {
    thread.activities = reduceActivities(thread.activities);
  }

  // 5.5 COLLAPSE MERGE ACTIVITIES (fold pre-merge activities into the merge notification)
  if (config.collapseMergedPrActivities) {
    for (const thread of kept) {
      if (thread.subject.type === 'PullRequest') {
        thread.activities = collapseMergeActivities(thread.activities);
      }
    }
  }

  // 6. FORMAT & 7. NOTIFY (one toast per activity since last processed time)
  let maxActivityTime: Date | null = null;

  for (const thread of kept) {
    // Check if workflow notification should be skipped
    if (await shouldSkipWorkflowNotification(thread)) {
      logger.debug(`Skipping workflow notification for ${thread.repository.fullName} (CI passed)`);
      continue;
    }

    if (thread.activities.length > 0) {
      // Send notification for each activity newer than lastProcessedTime
      for (const activity of thread.activities) {
        // Skip activities from before last processed time
        if (lastProcessedTime && activity.createdAt <= lastProcessedTime) {
          continue;
        }

        // Track max activity time for updating lastProcessedTime
        if (!maxActivityTime || activity.createdAt > maxActivityTime) {
          maxActivityTime = activity.createdAt;
        }

        const formatted = formatActivityNotification(thread, activity, config, viewerLogin);
        if (formatted) {
          logger.info(`🔔 ${formatted.title}`);
          await sendNotification({
            title: formatted.title,
            body: formatted.body,
            thread,
            config,
          });
        }
      }
    } else {
      // Fallback: thread-level notification (only if thread updated since last processed)
      if (lastProcessedTime && thread.updatedAt <= lastProcessedTime) {
        continue;
      }

      // Track max time for updating lastProcessedTime
      if (!maxActivityTime || thread.updatedAt > maxActivityTime) {
        maxActivityTime = thread.updatedAt;
      }

      const formatted = formatThreadNotification(thread, config);
      logger.info(`🔔 ${formatted.title}`);
      await sendNotification({
        title: formatted.title,
        body: formatted.body,
        thread,
        config,
      });
    }
  }

  // Update lastProcessedTime to the latest activity/thread time we saw
  if (maxActivityTime) {
    lastProcessedTime = maxActivityTime;
  } else if (!lastProcessedTime) {
    // On first run with no activities, set to now so we don't re-notify old stuff
    lastProcessedTime = requestStartTime;
  }

  // Compute next since
  let nextSince = since;
  if (rawThreads.length > 0) {
    const maxUpdatedAt = rawThreads.reduce(
      (max, t) => (t.updatedAt > max ? t.updatedAt : max),
      rawThreads[0].updatedAt
    );
    if (!nextSince || maxUpdatedAt > nextSince) {
      nextSince = maxUpdatedAt;
    }
  } else if (!nextSince) {
    nextSince = requestStartTime;
  }

  return { nextSince, pollIntervalSec };
}

/**
 * Run the daemon polling loop
 */
export async function runDaemon(config: GhPingConfig): Promise<void> {
  // Write PID file
  writePidFile(process.pid);

  // Set up signal handlers for graceful shutdown
  const shutdown = () => {
    logger.info('Shutting down...');
    removePidFile();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  logger.info('Daemon started');

  let since: Date | null = null;
  let pollIntervalSec = DEFAULT_POLL_INTERVAL_SEC;

  // Polling loop
  while (true) {
    try {
      const result = await poll(config, since);
      since = result.nextSince;
      pollIntervalSec = result.pollIntervalSec || DEFAULT_POLL_INTERVAL_SEC;
    } catch (err) {
      logger.error(`Poll error: ${err}`);
      // Continue to next poll
    }

    // Wait for next poll
    logger.debug(`Next poll in ${pollIntervalSec} seconds`);
    await new Promise((resolve) => setTimeout(resolve, pollIntervalSec * 1000));
  }
}
