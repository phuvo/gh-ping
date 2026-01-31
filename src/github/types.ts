import type { Endpoints } from '@octokit/types';

// Re-use Octokit types
export type GitHubNotification = Endpoints['GET /notifications']['response']['data'][number];

/**
 * Issue/PR timeline item from GitHub API
 */
export interface IssueTimelineItem {
  event?: string;
  created_at?: string;
  actor?: { login?: string };
  user?: { login?: string };
  assignee?: { login?: string };
  requested_reviewer?: { login?: string };
  requested_team?: { name?: string; slug?: string };
  state?: string;
  body?: string;  // comment/review body text
}

/**
 * Workflow run summary from GitHub API
 */
export interface WorkflowRunSummary {
  id: number;
  status?: string;      // 'completed', 'in_progress', 'queued', etc.
  conclusion?: string;  // 'success', 'failure', 'cancelled', etc.
  head_branch?: string;
}

/**
 * Result of fetching notifications
 */
export interface FetchNotificationsResult {
  notifications: import('../config/schema.js').Thread[];
  pollIntervalSec: number;
}

/**
 * GitHub client error
 */
export class GitHubClientError extends Error {
  public readonly stderr: string;

  constructor(message: string, stderr: string) {
    super(message);
    this.name = 'GitHubClientError';
    this.stderr = stderr;
  }
}
