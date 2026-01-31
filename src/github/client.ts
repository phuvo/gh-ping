import { spawn } from 'node:child_process';
import type { Activity } from '../config/schema.js';
import type { GitHubNotification, IssueTimelineItem, WorkflowRunSummary, FetchNotificationsResult } from './types.js';
import { GitHubClientError } from './types.js';
import { transformNotifications, transformTimeline } from './transform.js';

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
 * Fetch issue/PR timeline
 */
export async function fetchTimeline(owner: string, repo: string, issueNumber: number): Promise<Activity[]> {
  const items = await ghApi<IssueTimelineItem[]>(
    'GET',
    `repos/${owner}/${repo}/issues/${issueNumber}/timeline`,
    ['-F', 'per_page=10'],
  );
  return transformTimeline(items ?? []);
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
