import { spawn } from 'child_process';
import type { GitHubNotification } from './types.js';
import type { NotificationEvent } from '../config/schema.js';
import { transformNotifications } from './transform.js';

export class GitHubClientError extends Error {
  constructor(message: string, public readonly stderr: string) {
    super(message);
    this.name = 'GitHubClientError';
  }
}

/**
 * Fetch notifications using gh CLI
 */
export async function fetchNotifications(): Promise<NotificationEvent[]> {
  const raw = await fetchRawNotifications();
  return transformNotifications(raw);
}

/**
 * Fetch raw notifications from gh api
 */
export async function fetchRawNotifications(): Promise<GitHubNotification[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn('gh', ['api', 'notifications', '--paginate'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true, // Required for Windows PATH resolution
    });

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
        // Check for common errors
        if (stderr.includes('gh auth login')) {
          reject(new GitHubClientError(
            'GitHub CLI not authenticated. Run: gh auth login',
            stderr
          ));
        } else {
          reject(new GitHubClientError(
            `gh api failed with exit code ${code}: ${stderr.trim()}`,
            stderr
          ));
        }
        return;
      }

      // Handle empty response
      if (!stdout.trim()) {
        resolve([]);
        return;
      }

      try {
        // gh api --paginate returns concatenated JSON arrays
        // We need to handle both single array and multiple arrays
        const parsed = parseGhOutput(stdout);
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
 * Parse gh api --paginate output
 * It may return multiple JSON arrays concatenated together
 */
function parseGhOutput(output: string): GitHubNotification[] {
  const trimmed = output.trim();

  if (!trimmed) {
    return [];
  }

  // Try parsing as single array first
  try {
    const result = JSON.parse(trimmed);
    return Array.isArray(result) ? result : [result];
  } catch {
    // If that fails, try to find and merge multiple arrays
    // gh --paginate concatenates arrays like: [{...}][{...}]
    const results: GitHubNotification[] = [];
    let depth = 0;
    let start = -1;

    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];
      if (char === '[') {
        if (depth === 0) start = i;
        depth++;
      } else if (char === ']') {
        depth--;
        if (depth === 0 && start !== -1) {
          const chunk = trimmed.slice(start, i + 1);
          const parsed = JSON.parse(chunk) as GitHubNotification[];
          results.push(...parsed);
          start = -1;
        }
      }
    }

    return results;
  }
}

/**
 * Check if gh CLI is available and authenticated
 */
export async function checkGhAuth(): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn('gh', ['auth', 'status'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

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
