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
  const { event, state } = activity;

  switch (event) {
    case 'commented':
      return `${actor} commented on "${prTitle}"`;

    case 'line-commented':
      return `${actor} commented on code in "${prTitle}"`;

    case 'reviewed':
      switch (state) {
        case 'approved':
          return `${actor} approved "${prTitle}"`;
        case 'changes_requested':
          return `${actor} requested changes on "${prTitle}"`;
        case 'commented':
          return `${actor} left a review on "${prTitle}"`;
        case 'dismissed':
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
        const assignee = getUserDisplayName(activity.assignee.login, config.userAliases);
        // Check if assigned to viewer
        if (viewerLogin && activity.assignee.login === viewerLogin) {
          return `${actor} assigned you to "${prTitle}"`;
        }
        return `${actor} assigned ${assignee} to "${prTitle}"`;
      }
      return `${actor} assigned someone to "${prTitle}"`;

    case 'merged':
      return `${actor} merged "${prTitle}"`;

    case 'closed':
      return `${actor} closed "${prTitle}"`;

    case 'reopened':
      return `${actor} reopened "${prTitle}"`;

    default:
      // Skip unknown events
      return '';
  }
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
