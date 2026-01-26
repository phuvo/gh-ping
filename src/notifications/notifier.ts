import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import notifier from 'node-notifier';
import type { Notification } from 'node-notifier/notifiers/notificationcenter.js';
import open from 'open';
import type { NotificationEvent } from '../config/schema.js';

interface NotifyOptions {
  sound: boolean;
  repoAliases: Record<string, string>;
  titleOverride?: string;
  messageOverride?: string;
}

/**
 * Send OS notification for a GitHub event
 */
export async function sendNotification(event: NotificationEvent, options: NotifyOptions): Promise<void> {
  const repoName = getRepoDisplayName(event.repository.fullName, options.repoAliases);
  const title = options.titleOverride ?? formatTitle(event, repoName);
  const message = options.messageOverride ?? event.subject.title;
  const url = event.subject.htmlUrl;

  const isWindows = process.platform === 'win32';
  const appIdReady = isWindows ? await ensureWindowsShortcut() : false;

  if (isWindows && url) {
    const shown = await sendWindowsProtocolNotification({
      title,
      message,
      url,
      sound: options.sound,
    });
    if (shown) {
      return;
    }
  }

  return sendNotifierNotification({
    title,
    message,
    sound: options.sound,
    url,
    appId: appIdReady ? windowsAppId : undefined,
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

function sendNotifierNotification(options: {
  title: string;
  message: string;
  sound: boolean;
  url?: string;
  appId?: string;
}): Promise<void> {
  return new Promise((resolve) => {
    const notification: Notification & { appID?: string } = {
      title: options.title,
      message: options.message,
      sound: options.sound,
      wait: true, // Required for click handling
      timeout: 10, // Seconds before auto-dismiss (Linux)
    };
    if (options.appId) {
      notification.appID = options.appId;
    }

    notifier.notify(notification, (err, response, metadata) => {
      if (err) {
        // Log but don't fail - notification might still have shown
        console.error('Notification error:', err.message);
      }
      const activationType = typeof metadata?.activationType === 'string'
        ? metadata.activationType.toLowerCase()
        : undefined;
      const clicked = response === 'activate' || response === 'click' || activationType === 'activate'
        || activationType === 'clicked';
      if (options.url && clicked) {
        open(options.url).catch(() => {
          // Ignore errors opening browser
        });
      }
      resolve();
    });
  });
}

const windowsAppId = 'gh-ping';
let windowsShortcutReady: Promise<boolean> | null = null;

function escapeXml(value: string): string {
  return value
    .replace(/\r?\n/g, ' ')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapePowerShellString(value: string): string {
  return value.replace(/'/g, "''");
}

function buildWindowsToastXml(options: {
  title: string;
  message: string;
  url: string;
  sound: boolean;
}): string {
  const title = escapeXml(options.title);
  const message = escapeXml(options.message);
  const url = escapeXml(options.url);
  const audio = options.sound ? '' : '<audio silent="true" />';

  return `<toast activationType="protocol" launch="${url}">${audio}<visual><binding template="ToastGeneric"><text>${title}</text><text>${message}</text></binding></visual></toast>`;
}

function encodePowerShell(command: string): string {
  return Buffer.from(command, 'utf16le').toString('base64');
}

async function sendWindowsProtocolNotification(options: {
  title: string;
  message: string;
  url: string;
  sound: boolean;
}): Promise<boolean> {
  const ready = await ensureWindowsShortcut();
  if (!ready) {
    return false;
  }

  const xml = buildWindowsToastXml(options);
  const script = [
    "$ErrorActionPreference = 'Stop'",
    '[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null',
    '[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null',
    `$xml = '${escapePowerShellString(xml)}'`,
    '$doc = New-Object Windows.Data.Xml.Dom.XmlDocument',
    '$doc.LoadXml($xml)',
    '$toast = New-Object Windows.UI.Notifications.ToastNotification $doc',
    `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('${windowsAppId}').Show($toast)`,
  ].join(';');
  const encodedCommand = encodePowerShell(script);

  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodedCommand],
      { windowsHide: true },
      (error) => {
        if (error) {
          console.error('Windows toast error:', error.message);
          resolve(false);
          return;
        }
        resolve(true);
      }
    );
  });
}

function ensureWindowsShortcut(): Promise<boolean> {
  if (windowsShortcutReady) {
    return windowsShortcutReady;
  }

  windowsShortcutReady = new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(false);
      return;
    }

    const appData = process.env.APPDATA;
    if (!appData) {
      console.error('SnoreToast install error: APPDATA is not set.');
      resolve(false);
      return;
    }

    const shortcutPath = path.join(
      appData,
      'Microsoft',
      'Windows',
      'Start Menu',
      'Programs',
      'gh-ping.lnk'
    );

    if (existsSync(shortcutPath)) {
      resolve(true);
      return;
    }

    const snoreToastPath = getSnoreToastPath();
    if (!snoreToastPath || !existsSync(snoreToastPath)) {
      console.error('SnoreToast install error: snoretoast executable not found.');
      resolve(false);
      return;
    }

    execFile(
      snoreToastPath,
      ['-install', shortcutPath, process.execPath, windowsAppId],
      { windowsHide: true },
      (error) => {
        if (error) {
          console.error('SnoreToast install error:', error.message);
          resolve(false);
          return;
        }
        resolve(true);
      }
    );
  });

  return windowsShortcutReady;
}

function getSnoreToastPath(): string | null {
  try {
    const require = createRequire(import.meta.url);
    const packagePath = require.resolve('node-notifier/package.json');
    const notifierDir = path.dirname(packagePath);
    const exeName = os.arch() === 'x64' ? 'snoretoast-x64.exe' : 'snoretoast-x86.exe';
    return path.join(notifierDir, 'vendor', 'snoreToast', exeName);
  } catch {
    return null;
  }
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
