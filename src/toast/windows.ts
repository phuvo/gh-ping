import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { logger } from '../logging/logger.js';

const WINDOWS_APP_ID = 'gh-ping';
let windowsShortcutReady: Promise<boolean> | null = null;

/**
 * Escape XML special characters for toast XML
 */
function escapeXml(value: string): string {
  return value
    .replace(/\r?\n/g, ' ')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Escape PowerShell string (single quotes)
 */
function escapePowerShellString(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Build Windows toast XML with protocol activation
 */
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

/**
 * Encode PowerShell command for -EncodedCommand parameter
 */
function encodePowerShell(command: string): string {
  return Buffer.from(command, 'utf16le').toString('base64');
}

/**
 * Get path to SnoreToast executable bundled with node-notifier
 */
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
 * Ensure Windows Start Menu shortcut is installed for toast notifications
 */
export function ensureWindowsShortcut(): Promise<boolean> {
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
      logger.error('SnoreToast install error: APPDATA is not set.');
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
      logger.error('SnoreToast install error: snoretoast executable not found.');
      resolve(false);
      return;
    }

    execFile(
      snoreToastPath,
      ['-install', shortcutPath, process.execPath, WINDOWS_APP_ID],
      { windowsHide: true },
      (error) => {
        if (error) {
          logger.error(`SnoreToast install error: ${error.message}`);
          resolve(false);
          return;
        }
        resolve(true);
      }
    );
  });

  return windowsShortcutReady;
}

/**
 * Send a Windows toast notification using PowerShell and WinRT APIs
 */
export async function sendWindowsProtocolNotification(options: {
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
    `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('${WINDOWS_APP_ID}').Show($toast)`,
  ].join(';');
  const encodedCommand = encodePowerShell(script);

  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodedCommand],
      { windowsHide: true },
      (error) => {
        if (error) {
          logger.error(`Windows toast error: ${error.message}`);
          resolve(false);
          return;
        }
        resolve(true);
      }
    );
  });
}

/**
 * Get the Windows App ID for notifications
 */
export function getWindowsAppId(): string {
  return WINDOWS_APP_ID;
}
