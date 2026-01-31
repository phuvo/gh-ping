import notifier from 'node-notifier';
import type { Notification } from 'node-notifier/notifiers/notificationcenter.js';
import open from 'open';
import type { Thread, GhPingConfig } from '../config/schema.js';
import { markThreadAsRead } from '../github/client.js';
import { logger } from '../logging/logger.js';
import { resolveHtmlUrl } from './url-resolver.js';
import { sendWindowsProtocolNotification, ensureWindowsShortcut, getWindowsAppId } from './windows.js';

export interface SendNotificationOptions {
  title: string;
  body: string;
  thread: Thread;
  config: GhPingConfig;
}

/**
 * Send OS notification for a thread/activity
 */
export async function sendNotification(options: SendNotificationOptions): Promise<void> {
  const { title, body, thread, config } = options;
  const url = resolveHtmlUrl(thread);
  const isWindows = process.platform === 'win32';

  // Try Windows-native toast first
  if (isWindows && url) {
    const shown = await sendWindowsProtocolNotification({
      title,
      message: body,
      url,
      sound: config.sound,
    });
    if (shown) {
      return;
    }
  }

  // Fall back to node-notifier
  return sendNotifierNotification({
    title,
    message: body,
    sound: config.sound,
    url,
    threadId: thread.id,
    markAsReadOnClick: config.markAsReadOnClick,
  });
}

interface NotifierOptions {
  title: string;
  message: string;
  sound: boolean;
  url?: string;
  threadId?: string;
  markAsReadOnClick?: boolean;
}

/**
 * Send notification using node-notifier
 */
async function sendNotifierNotification(options: NotifierOptions): Promise<void> {
  const appIdReady = process.platform === 'win32' ? await ensureWindowsShortcut() : false;

  return new Promise((resolve) => {
    const notification: Notification & { appID?: string } = {
      title: options.title,
      message: options.message,
      sound: options.sound,
      wait: true, // Required for click handling
      timeout: 10, // Seconds before auto-dismiss
    };

    if (appIdReady) {
      notification.appID = getWindowsAppId();
    }

    notifier.notify(notification, async (err, response, metadata) => {
      if (err) {
        logger.error(`Notification error: ${err.message}`);
      }

      // Check if user clicked the notification
      const activationType = typeof metadata?.activationType === 'string'
        ? metadata.activationType.toLowerCase()
        : undefined;
      const clicked = response === 'activate' ||
        response === 'click' ||
        activationType === 'activate' ||
        activationType === 'clicked';

      if (options.url && clicked) {
        try {
          await open(options.url);
        } catch {
          // Ignore errors opening browser
        }

        // Mark as read on click if configured
        if (options.markAsReadOnClick && options.threadId) {
          try {
            await markThreadAsRead(options.threadId);
          } catch {
            logger.warn('Failed to mark thread as read');
          }
        }
      }

      resolve();
    });
  });
}

/**
 * Send a test notification
 */
export function sendTestNotification(): Promise<void> {
  return new Promise((resolve) => {
    notifier.notify(
      {
        title: 'gh-ping',
        message: 'Test notification - gh-ping is working!',
        sound: true,
        wait: false,
      },
      () => {
        resolve();
      }
    );
  });
}
