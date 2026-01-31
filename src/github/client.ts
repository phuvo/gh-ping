import { spawn } from 'node:child_process';
import type { GitHubNotification, IssueTimelineItem, WorkflowRunSummary, FetchNotificationsResult } from './types.js';
import { GitHubClientError } from './types.js';
import { transformNotifications } from './transform.js';
import { logger } from '../logging/logger.js';

/**
 * Spawn gh CLI and return stdout, stderr, and exit code
 */
function spawnGhAsync(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn('gh', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('error', (err) => {
      stderr += err.message;
      resolve({ stdout, stderr, exitCode: 1 });
    });

    proc.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });
  });
}

/**
 * Execute a gh api call and return parsed JSON
 */
export async function ghApi<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  endpoint: string,
  args: string[] = []
): Promise<T | undefined> {
  const fullArgs = ['api', endpoint, '--method', method, ...args];
  const { stdout, stderr, exitCode } = await spawnGhAsync(fullArgs);

  if (exitCode !== 0) {
    throw new GitHubClientError(`gh api failed: ${stderr}`, stderr);
  }

  if (!stdout.trim()) {
    return undefined;
  }
  return JSON.parse(stdout);
}

/**
 * Parse HTTP response with headers from gh --include output
 */
function parseResponseWithHeaders(output: string): { data: string; headers: Record<string, string> } {
  const lines = output.split('\n');
  const headers: Record<string, string> = {};
  let bodyStartIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip HTTP status line
    if (line.startsWith('HTTP/')) {
      continue;
    }

    // Empty line marks end of headers
    if (line.trim() === '') {
      bodyStartIndex = i + 1;
      break;
    }

    // Parse header line
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim().toLowerCase();
      const value = line.slice(colonIndex + 1).trim();
      headers[key] = value;
    }
  }

  const body = lines.slice(bodyStartIndex).join('\n');
  return { data: body, headers };
}

/**
 * Execute a gh api call and return parsed JSON with response headers
 * Used for notifications to get X-Poll-Interval
 */
export async function ghApiWithHeaders<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  endpoint: string,
  args: string[] = []
): Promise<{ data: T; headers: Record<string, string> }> {
  const fullArgs = ['api', endpoint, '--method', method, '--include', ...args];
  const { stdout, stderr, exitCode } = await spawnGhAsync(fullArgs);

  if (exitCode !== 0) {
    throw new GitHubClientError(`gh api failed: ${stderr}`, stderr);
  }

  const { data, headers } = parseResponseWithHeaders(stdout);

  if (!data.trim()) {
    return { data: [] as T, headers };
  }

  return { data: JSON.parse(data), headers };
}

/**
 * Fetch notifications with poll interval
 */
export async function fetchNotifications(options?: { since?: Date }): Promise<FetchNotificationsResult> {
  const args: string[] = [];
  if (options?.since) {
    args.push('-f', `since=${options.since.toISOString()}`);
  }

  const { data, headers } = await ghApiWithHeaders<GitHubNotification[]>('GET', 'notifications', args);

  return {
    notifications: transformNotifications(data),
    pollIntervalSec: Number(headers['x-poll-interval'] ?? '60'),
  };
}

/**
 * Parse Link header to extract page numbers
 * Format: <url?page=2>; rel="next", <url?page=5>; rel="last"
 */
function parseLinkHeader(linkHeader: string): { last?: number } {
  const result: { last?: number } = {};

  const links = linkHeader.split(',');
  for (const link of links) {
    const match = link.match(/<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="(\w+)"/);
    if (match) {
      const [, page, rel] = match;
      if (rel === 'last') {
        result.last = Number(page);
      }
    }
  }

  return result;
}

/**
 * Fetch issue/PR timeline (latest activities)
 * GitHub returns timeline events oldest-first, so we fetch the last page and walk backwards if needed
 */
export async function fetchLatestActivities({
  owner,
  repo,
  issueId,
  limit = 10,
}: {
  owner: string;
  repo: string;
  issueId: number;
  limit?: number;
}): Promise<IssueTimelineItem[]> {
  if (limit <= 0) {
    return [];
  }

  const endpoint = `repos/${owner}/${repo}/issues/${issueId}/timeline`;
  const pageArgs = ['-F', `per_page=${limit}`];

  // First request to get pagination info
  const { data, headers } = await ghApiWithHeaders<IssueTimelineItem[]>('GET', endpoint, pageArgs);
  const firstPage = data ?? [];

  const linkHeader = headers['link'];
  if (!linkHeader) {
    // Only one page, return as-is
    return firstPage;
  }

  const { last } = parseLinkHeader(linkHeader);
  if (!last) {
    // Link header exists but couldn't parse last page - unexpected
    logger.warn(`Failed to parse last page from Link header: ${linkHeader}`);
    return firstPage;
  }

  let currentPage = last;
  let combinedItems: IssueTimelineItem[] = [];

  while (combinedItems.length < limit && currentPage >= 1) {
    const pageItems = await ghApi<IssueTimelineItem[]>(
      'GET',
      endpoint,
      ['-F', `page=${currentPage}`, ...pageArgs],
    );
    combinedItems = (pageItems ?? []).concat(combinedItems);
    currentPage -= 1;
  }

  return combinedItems.slice(-limit);
}

/**
 * Fetch latest workflow run for a branch
 */
export async function fetchLatestWorkflowRun(
  owner: string,
  repo: string,
  branch: string
): Promise<WorkflowRunSummary | null> {
  const result = await ghApi<{ workflow_runs?: WorkflowRunSummary[] }>(
    'GET',
    `repos/${owner}/${repo}/actions/runs`,
    ['-f', `branch=${branch}`, '-F', 'per_page=1']
  );
  return result?.workflow_runs?.[0] ?? null;
}

/**
 * Mark thread as read
 */
export async function markThreadAsRead(threadId: string): Promise<void> {
  await ghApi<void>('PATCH', `notifications/threads/${threadId}`);
}

/**
 * Cached viewer login
 */
let cachedViewerLogin: string | null | undefined;

/**
 * Fetch viewer login (cached)
 */
export async function fetchViewerLogin(): Promise<string | null> {
  if (cachedViewerLogin !== undefined) {
    return cachedViewerLogin;
  }

  try {
    const user = await ghApi<{ login: string }>('GET', 'user');
    cachedViewerLogin = user?.login ?? null;
  } catch {
    cachedViewerLogin = null;
  }

  return cachedViewerLogin;
}

/**
 * Reset cached viewer login (for testing)
 */
export function resetViewerLoginCache(): void {
  cachedViewerLogin = undefined;
}

/**
 * Check gh CLI auth status
 */
export async function checkGhAuth(): Promise<{ ok: boolean; error?: string }> {
  const { stderr, exitCode } = await spawnGhAsync(['auth', 'status']);

  if (exitCode !== 0) {
    return { ok: false, error: stderr.trim() || 'Not authenticated' };
  }

  return { ok: true };
}
