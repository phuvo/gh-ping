import notifier from 'node-notifier';
import open from 'open';
import type { NotificationEvent } from '../config/schema.js';

interface NotifyOptions {
  sound: boolean;
}

/**
 * Send OS notification for a GitHub event
 */
export function sendNotification(event: NotificationEvent, options: NotifyOptions): Promise<void> {
  return new Promise((resolve) => {
    const notification = {
      title: event.repository.fullName,
      message: event.subject.title,
      subtitle: formatReason(event.reason),
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
 * Format notification reason for display
 */
function formatReason(reason: string): string {
  const reasonMap: Record<string, string> = {
    approval_requested: 'Approval requested',
    assign: 'Assigned to you',
    author: 'You authored this',
    ci_activity: 'CI activity',
    comment: 'New comment',
    invitation: 'Invitation',
    manual: 'Subscribed',
    mention: 'You were mentioned',
    review_requested: 'Review requested',
    security_alert: 'Security alert',
    state_change: 'State changed',
    subscribed: 'Subscribed',
    team_mention: 'Team mentioned',
  };

  return reasonMap[reason] || reason;
}
