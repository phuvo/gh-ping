import type { Thread, Activity, GhPingConfig } from '../config/schema.js';
import { getRepoDisplayName, getUserDisplayName } from './display-name.js';

/**
 * Format activity title based on event type and state
 */
export function formatActivityTitle(
  activity: Activity,
  actor: string,
  prTitle: string,
  config: GhPingConfig,
  viewerLogin?: string | null
): string {
  const { event, state, count = 1 } = activity;

  switch (event) {
    case 'commented':
      if (count > 1) {
        return `${actor} left comments on "${prTitle}"`;
      }
      return `${actor} commented on "${prTitle}"`;

    case 'line-commented':
      if (count > 1) {
        return `${actor} left code comments on "${prTitle}"`;
      }
      return `${actor} commented on code in "${prTitle}"`;

    case 'reviewed':
      switch (state) {
        case 'approved':
          return `${actor} approved "${prTitle}"`;
        case 'changes_requested':
          return `${actor} requested changes on "${prTitle}"`;
        case 'commented':
          if (count > 1) {
            return `${actor} left reviews on "${prTitle}"`;
          }
          return `${actor} left a review on "${prTitle}"`;
        case 'dismissed':
          if (count > 1) {
            return `${actor} dismissed reviews on "${prTitle}"`;
          }
          return `${actor} dismissed a review on "${prTitle}"`;
        default:
          return `${actor} reviewed "${prTitle}"`;
      }

    case 'review_requested':
      if (activity.requestedTeam) {
        const team = activity.requestedTeam.name;
        return `${actor} requested review from @${team} on "${prTitle}"`;
      }
      return `${actor} requested your review on "${prTitle}"`;

    case 'assigned':
      if (activity.assignee) {
        // Check if self-assigned
        if (activity.actor?.login === activity.assignee.login) {
          return `${actor} assigned themselves to "${prTitle}"`;
        }
        const assignee = getUserDisplayName(activity.assignee.login, config.userAliases);
        // Check if assigned to viewer
        if (viewerLogin && activity.assignee.login === viewerLogin) {
          return `${actor} assigned you to "${prTitle}"`;
        }
        return `${actor} assigned ${assignee} to "${prTitle}"`;
      }
      return `${actor} assigned someone to "${prTitle}"`;

    case 'merged': {
        if (activity.preMergeCount) {
          return `${actor} merged "${prTitle}" + earlier activities`;
        }
        return `${actor} merged "${prTitle}"`;
    }
    case 'closed':
      return `${actor} closed "${prTitle}"`;

    case 'reopened':
      return `${actor} reopened "${prTitle}"`;

    case 'committed': {
      // Use committer as primary, show author if different
      const committerName = activity.committer?.name
        ? getUserDisplayName(activity.committer.name, config.userAliases)
        : undefined;
      const authorName = activity.author?.name
        ? getUserDisplayName(activity.author.name, config.userAliases)
        : undefined;

      const commitWord = count > 1 ? 'commits' : 'a commit';

      if (committerName && authorName && committerName !== authorName) {
        // Different author and committer (e.g., co-authored, cherry-picked)
        if (count > 1) {
          return `${authorName} committed (via ${committerName}) on "${prTitle}"`;
        }
        return `${authorName} committed (via ${committerName}) on "${prTitle}"`;
      } else if (committerName) {
        return `${committerName} pushed ${commitWord} to "${prTitle}"`;
      } else if (authorName) {
        return `${authorName} pushed ${commitWord} to "${prTitle}"`;
      }
      if (count > 1) {
        return `Commits pushed to "${prTitle}"`;
      }
      return `New commits pushed to "${prTitle}"`;
    }

    default:
      // Skip unknown events
      return '';
  }
}

/**
 * Get a unique key for grouping activities by actor and event type.
 * For 'reviewed' events, also includes state to differentiate approvals vs comments.
 * For 'committed' events, uses committer/author name as actor.
 */
function getActivityGroupKey(activity: Activity): string {
  const event = activity.event;

  // For commits, use committer or author name as the actor
  if (event === 'committed') {
    const actor = activity.committer?.name ?? activity.author?.name ?? 'unknown';
    return `${actor}:${event}`;
  }

  // For reviews, include state to group approvals separately from comment reviews
  if (event === 'reviewed' && activity.state) {
    return `${activity.actor?.login ?? 'unknown'}:${event}:${activity.state}`;
  }

  return `${activity.actor?.login ?? 'unknown'}:${event}`;
}

/**
 * Reduce activities by collapsing duplicate (actor + event type) combinations.
 * Keeps the latest occurrence of each group and sets count for pluralization.
 * Maintains order based on the latest occurrence of each group.
 */
export function reduceActivities(activities: Activity[]): Activity[] {
  // Map from group key to { activity, count, lastIndex }
  const groups = new Map<string, { activity: Activity; count: number; lastIndex: number }>();

  // Process activities in order (oldest to newest)
  activities.forEach((activity, index) => {
    const key = getActivityGroupKey(activity);
    const existing = groups.get(key);

    if (existing) {
      // Update to latest occurrence and increment count
      existing.activity = activity;
      existing.count += 1;
      existing.lastIndex = index;
    } else {
      groups.set(key, { activity, count: 1, lastIndex: index });
    }
  });

  // Sort by lastIndex to maintain order of latest occurrences
  const sorted = Array.from(groups.values()).sort((a, b) => a.lastIndex - b.lastIndex);

  // Return activities with count set
  return sorted.map(({ activity, count }) => ({
    ...activity,
    count,
  }));
}

/**
 * Collapse activities before a merge into the merge activity itself.
 * Activities after the merge are kept as separate notifications.
 * Returns the modified list of activities.
 */
export function collapseMergeActivities(activities: Activity[]): Activity[] {
  // Find the index of a 'merged' event
  const mergeIndex = activities.findIndex((a) => a.event === 'merged');

  // No merge event found, return as-is
  if (mergeIndex === -1) {
    return activities;
  }

  // Count events before the merge
  const preMergeCount = mergeIndex;

  // If no events before merge, return as-is
  if (preMergeCount === 0) {
    return activities;
  }

  // Get the merge event and events after it
  const mergeActivity = activities[mergeIndex];
  const postMergeActivity = activities.slice(mergeIndex + 1);

  // Create updated merge event with preMergeCount
  const collapsedMerge: Activity = {
    ...mergeActivity,
    preMergeCount,
  };

  // Return: collapsed merge + events after merge
  return [collapsedMerge, ...postMergeActivity];
}

/**
 * Format activity body with repo and optional comment text
 */
export function formatActivityBody(activity: Activity, repo: string): string {
  const commentText = activity.body?.trim();

  if (commentText) {
    // Has comment: "in repo: <comment text>"
    return `in ${repo}: ${commentText}`;
  }

  // No comment: "in repo"
  return `in ${repo}`;
}

/**
 * Format a notification for a specific activity
 */
export function formatActivityNotification(
  thread: Thread,
  activity: Activity,
  config: GhPingConfig,
  viewerLogin?: string | null
): { title: string; body: string } | null {
  const actor = getUserDisplayName(activity.actor?.login ?? 'Someone', config.userAliases);
  const title = formatActivityTitle(activity, actor, thread.subject.title, config, viewerLogin);

  // If title is empty, skip this activity (unknown event type)
  if (!title) {
    return null;
  }

  const repo = getRepoDisplayName(thread.repository.fullName, config.repoAliases);
  const body = formatActivityBody(activity, repo);

  return { title, body };
}
