import { spawn } from 'node:child_process';
import type { GitHubNotification, IssueTimelineItem, PullRequestDetails } from './types.js';
import type { NotificationEvent } from '../config/schema.js';
import { transformNotifications } from './transform.js';

let cachedViewerLogin: string | null | undefined;

function spawnGh(args: string[]) {
  return spawn('gh', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
}

export interface FetchNotificationsResult {
  notifications: NotificationEvent[];
  pollIntervalSec?: number;
}

interface FetchRawNotificationsResult {
  notifications: GitHubNotification[];
  pollIntervalSec?: number;
}

export class GitHubClientError extends Error {
  constructor(message: string, public readonly stderr: string) {
    super(message);
    this.name = 'GitHubClientError';
  }
}

/**
 * Fetch notifications using gh CLI
 */
export async function fetchNotifications(options?: { since?: Date }): Promise<FetchNotificationsResult> {
  const raw = await fetchRawNotifications(options);
  return {
    notifications: transformNotifications(raw.notifications),
    pollIntervalSec: raw.pollIntervalSec,
  };
}

/**
 * Fetch raw notifications from gh api
 */
export async function fetchRawNotifications(options?: { since?: Date }): Promise<FetchRawNotificationsResult> {
  return new Promise((resolve, reject) => {
    const args = ['api', 'notifications', '--method', 'GET', '--include'];
    if (options?.since) {
      args.push('-f', `since=${options.since.toISOString()}`);
    }

    const proc = spawnGh(args);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('error', (err) => {
      reject(new GitHubClientError(`Failed to spawn gh CLI: ${err.message}`, ''));
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new GitHubClientError(
          `gh api failed with exit code ${code}: ${stderr.trim()}`,
          stderr
        ));
        return;
      }

      // Handle empty response
      if (!stdout.trim()) {
        resolve({ notifications: [] });
        return;
      }

      try {
        const parsed = parseGhOutputWithHeaders(stdout);
        resolve(parsed);
      } catch (e) {
        reject(new GitHubClientError(
          `Failed to parse gh output: ${e instanceof Error ? e.message : String(e)}`,
          stdout
        ));
      }
    });
  });
}

function parseGhOutputWithHeaders(output: string): FetchRawNotificationsResult {
  const { body, pollIntervalSec } = extractHeaders(output);
  return {
    notifications: JSON.parse(body),
    pollIntervalSec,
  };
}

function extractHeaders(output: string): { body: string; pollIntervalSec?: number } {
  const lines = output.split(/\r?\n/);
  const bodyLines: string[] = [];
  let pollIntervalSec: number | undefined;
  let inHeaders = false;

  for (const line of lines) {
    if (line.startsWith('HTTP/')) {
      inHeaders = true;
      continue;
    }

    if (inHeaders) {
      if (!line.trim()) {
        inHeaders = false;
        continue;
      }
      const match = /^x-poll-interval:\s*(\d+)/i.exec(line);
      if (match) {
        const parsed = Number.parseInt(match[1], 10);
        if (!Number.isNaN(parsed)) {
          pollIntervalSec = parsed;
        }
      }
      continue;
    }

    bodyLines.push(line);
  }

  return { body: bodyLines.join('\n'), pollIntervalSec };
}

/**
 * Fetch PR details to check if it's merged
 * @param apiUrl - The API URL from notification subject (e.g., https://api.github.com/repos/owner/repo/pulls/123)
 */
export async function fetchPullRequest(apiUrl: string): Promise<PullRequestDetails> {
  return new Promise((resolve, reject) => {
    const proc = spawnGh(['api', apiUrl]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('error', (err) => {
      reject(new GitHubClientError(`Failed to spawn gh CLI: ${err.message}`, ''));
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new GitHubClientError(
          `gh api failed with exit code ${code}: ${stderr.trim()}`,
          stderr
        ));
        return;
      }

      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(parsed);
      } catch (e) {
        reject(new GitHubClientError(
          `Failed to parse gh output: ${e instanceof Error ? e.message : String(e)}`,
          stdout
        ));
      }
    });
  });
}

/**
 * Fetch issue timeline items for a PR
 */
export async function fetchIssueTimeline(
  prApiUrl: string,
  options?: { perPage?: number }
): Promise<IssueTimelineItem[]> {
  const timelineUrl = toIssueTimelineUrl(prApiUrl);
  if (!timelineUrl) {
    return [];
  }

  return new Promise((resolve, reject) => {
    const perPage = options?.perPage ?? 10;
    const args = [
      'api',
      timelineUrl,
      '--method',
      'GET',
      '-F',
      `per_page=${perPage}`,
    ];
    const proc = spawnGh(args);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('error', (err) => {
      reject(new GitHubClientError(`Failed to spawn gh CLI: ${err.message}`, ''));
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new GitHubClientError(
          `gh api failed with exit code ${code}: ${stderr.trim()}`,
          stderr
        ));
        return;
      }

      if (!stdout.trim()) {
        resolve([]);
        return;
      }

      try {
        const parsed = JSON.parse(stdout.trim()) as IssueTimelineItem[];
        resolve(parsed);
      } catch (e) {
        reject(new GitHubClientError(
          `Failed to parse gh output: ${e instanceof Error ? e.message : String(e)}`,
          stdout
        ));
      }
    });
  });
}

/**
 * Fetch the authenticated user's login
 */
export async function fetchViewerLogin(): Promise<string | null> {
  if (cachedViewerLogin !== undefined) {
    return cachedViewerLogin;
  }

  return new Promise((resolve) => {
    const proc = spawnGh(['api', 'user', '--jq', '.login']);

    let stdout = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.on('error', () => {
      cachedViewerLogin = null;
      resolve(cachedViewerLogin);
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        cachedViewerLogin = null;
        resolve(cachedViewerLogin);
        return;
      }

      const login = stdout.trim();
      cachedViewerLogin = login ? login : null;
      resolve(cachedViewerLogin);
    });
  });
}

/**
 * Check if gh CLI is available and authenticated
 */
export async function checkGhAuth(): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawnGh(['auth', 'status']);

    let stderr = '';

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('error', () => {
      resolve({ ok: false, error: 'gh CLI not found. Install it from: https://cli.github.com' });
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ ok: true });
      } else {
        resolve({ ok: false, error: stderr.trim() || 'gh CLI not authenticated' });
      }
    });
  });
}

function toIssueTimelineUrl(prApiUrl: string): string | null {
  if (!prApiUrl.includes('/pulls/')) {
    return null;
  }
  return prApiUrl.replace('/pulls/', '/issues/') + '/timeline';
}
