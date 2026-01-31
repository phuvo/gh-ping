import type { Thread, GhPingConfig, SubjectType, NotificationReason } from '../config/schema.js';
import { getRepoDisplayName } from './display-name.js';

/**
 * Regex to extract branch name from WorkflowRun/CheckSuite subject titles
 */
const WORKFLOW_BRANCH_REGEX = /workflow run (?:failed|succeeded|cancelled) for\s+["']?([^"']+?)["']?(?:\s+branch)?$/i;

/**
 * Extract branch name from workflow/check subject title
 */
export function extractBranchFromSubject(title: string): string | null {
  const match = title.match(WORKFLOW_BRANCH_REGEX);
  return match?.[1] ?? null;
}

/**
 * Format fallback body for thread-level notifications
 */
export function formatFallbackBody(thread: Thread, repo: string): string {
  const { type } = thread.subject;

  // For workflow/check notifications, include branch if extractable
  if (type === 'WorkflowRun' || type === 'CheckSuite') {
    const branch = extractBranchFromSubject(thread.subject.title);
    if (branch) {
      return `in ${repo}: ${branch}`;
    }
  }

  return `in ${repo}`;
}

/**
 * Format reason-based title for fallback notifications
 */
export function formatReasonTitle(
  type: SubjectType,
  reason: NotificationReason,
  subjectTitle: string
): string {
  // PullRequest-specific
  if (type === 'PullRequest') {
    switch (reason) {
      case 'review_requested':
        return `Review requested on "${subjectTitle}"`;
      case 'comment':
        return `Comment on "${subjectTitle}"`;
      case 'author':
        return `Your PR "${subjectTitle}" was updated`;
      case 'mention':
        return `You were mentioned in "${subjectTitle}"`;
      case 'assign':
        return `You were assigned to "${subjectTitle}"`;
      default:
        return `Activity on "${subjectTitle}"`;
    }
  }

  // Issue-specific
  if (type === 'Issue') {
    switch (reason) {
      case 'mention':
        return `You were mentioned in "${subjectTitle}"`;
      case 'assign':
        return `You were assigned to "${subjectTitle}"`;
      case 'comment':
        return `Comment on "${subjectTitle}"`;
      case 'author':
        return `Your issue "${subjectTitle}" was updated`;
      default:
        return `Activity on "${subjectTitle}"`;
    }
  }

  // Discussion
  if (type === 'Discussion') {
    return `Discussion "${subjectTitle}"`;
  }

  // Release
  if (type === 'Release') {
    return `New release "${subjectTitle}"`;
  }

  // WorkflowRun / CheckSuite
  if (type === 'WorkflowRun' || type === 'CheckSuite') {
    return `CI workflow failed`;
  }

  // Commit
  if (type === 'Commit') {
    return `Commit activity on "${subjectTitle}"`;
  }

  // Default fallback
  return `Activity on "${subjectTitle}"`;
}

/**
 * Format a fallback thread-level notification
 * Used when no activities are available or for non-PR/Issue threads
 */
export function formatThreadNotification(
  thread: Thread,
  config: GhPingConfig
): { title: string; body: string } {
  const repo = getRepoDisplayName(thread.repository.fullName, config.repoAliases);
  const title = formatReasonTitle(thread.subject.type, thread.reason, thread.subject.title);
  const body = formatFallbackBody(thread, repo);

  return { title, body };
}
