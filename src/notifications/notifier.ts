import notifier from 'node-notifier';
import type { Notification } from 'node-notifier/notifiers/notificationcenter.js';
import open from 'open';
import type { NotificationEvent } from '../config/schema.js';

interface NotifyOptions {
  sound: boolean;
  repoAliases: Record<string, string>;
}

/**
 * Send OS notification for a GitHub event
 */
export function sendNotification(event: NotificationEvent, options: NotifyOptions): Promise<void> {
  return new Promise((resolve) => {
    const repoName = getRepoDisplayName(event.repository.fullName, options.repoAliases);
    const title = formatTitle(event, repoName);
    const notification: Notification = {
      title,
      message: event.subject.title,
      sound: options.sound,
      wait: true, // Required for click handling
      timeout: 10, // Seconds before auto-dismiss (Linux)
    };

    notifier.notify(notification, (err) => {
      if (err) {
        // Log but don't fail - notification might still have shown
        console.error('Notification error:', err.message);
      }
      resolve();
    });

    // Handle click - open in browser
    notifier.once('click', () => {
      if (event.subject.htmlUrl) {
        open(event.subject.htmlUrl).catch(() => {
          // Ignore errors opening browser
        });
      }
    });
  });
}

/**
 * Send a test notification
 */
export function sendTestNotification(): Promise<void> {
  return new Promise((resolve) => {
    notifier.notify({
      title: 'gh-ping',
      message: 'Test notification - gh-ping is working!',
      sound: true,
      wait: false,
    }, () => {
      resolve();
    });
  });
}

/**
 * Get display name for a repository (alias or just the repo name without owner)
 */
export function getRepoDisplayName(fullName: string, aliases: Record<string, string>): string {
  if (aliases[fullName]) {
    return aliases[fullName];
  }
  // Fall back to just the repo name (without owner)
  return fullName.split('/')[1] || fullName;
}

/**
 * Format notification title based on reason, subject type, and repo name
 * Format: "[Action] on `[repo]`" e.g., "PR review requested on `explore`"
 */
export function formatTitle(event: NotificationEvent, repoName: string): string {
  const { reason, subject } = event;
  const type = subject.type;
  const repo = `\`${repoName}\``;

  // PR-specific messages
  if (type === 'PullRequest') {
    switch (reason) {
      case 'author':
        return `Your PR updated on ${repo}`;
      case 'comment':
        return `PR comment on ${repo}`;
      case 'review_requested':
        return `PR review requested on ${repo}`;
      case 'approval_requested':
        return `PR approval requested on ${repo}`;
      case 'state_change':
        return `PR status changed on ${repo}`;
      case 'mention':
        return `PR mention on ${repo}`;
      case 'team_mention':
        return `PR team mention on ${repo}`;
      case 'assign':
        return `PR assigned on ${repo}`;
      case 'ci_activity':
        return `PR CI activity on ${repo}`;
      case 'subscribed':
      case 'manual':
        return `PR activity on ${repo}`;
    }
  }

  // Issue-specific messages
  if (type === 'Issue') {
    switch (reason) {
      case 'author':
        return `Your issue updated on ${repo}`;
      case 'comment':
        return `Issue comment on ${repo}`;
      case 'state_change':
        return `Issue status changed on ${repo}`;
      case 'mention':
        return `Issue mention on ${repo}`;
      case 'team_mention':
        return `Issue team mention on ${repo}`;
      case 'assign':
        return `Issue assigned on ${repo}`;
      case 'subscribed':
      case 'manual':
        return `Issue activity on ${repo}`;
    }
  }

  // Discussion-specific messages
  if (type === 'Discussion') {
    switch (reason) {
      case 'author':
        return `Your discussion updated on ${repo}`;
      case 'comment':
        return `Discussion comment on ${repo}`;
      case 'mention':
        return `Discussion mention on ${repo}`;
      default:
        return `Discussion activity on ${repo}`;
    }
  }

  // CI/Workflow messages
  if (type === 'CheckSuite' || type === 'WorkflowRun') {
    return `CI workflow update on ${repo}`;
  }

  // Release messages
  if (type === 'Release') {
    return `New release on ${repo}`;
  }

  // Commit messages
  if (type === 'Commit') {
    switch (reason) {
      case 'author':
        return `Your commit updated on ${repo}`;
      case 'comment':
        return `Commit comment on ${repo}`;
      case 'mention':
        return `Commit mention on ${repo}`;
      default:
        return `Commit activity on ${repo}`;
    }
  }

  // Security alerts
  if (type === 'RepositoryVulnerabilityAlert') {
    return `Security alert on ${repo}`;
  }

  // Fallback: generic reason-based messages
  const fallbackMap: Record<string, string> = {
    approval_requested: 'Approval requested',
    assign: 'Assigned to you',
    author: 'Activity on your item',
    ci_activity: 'CI activity',
    comment: 'New comment',
    invitation: 'Invitation',
    manual: 'Subscribed',
    mention: 'You were mentioned',
    review_requested: 'Review requested',
    security_alert: 'Security alert',
    state_change: 'Status changed',
    subscribed: 'Activity',
    team_mention: 'Team mentioned',
  };

  return `${fallbackMap[reason] || reason} on ${repo}`;
}
