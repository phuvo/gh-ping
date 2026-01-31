import type { components } from '@octokit/openapi-types';
import type { Endpoints } from '@octokit/types';

// Re-use Octokit types
export type GitHubNotification = Endpoints['GET /notifications']['response']['data'][number];

// Individual timeline event types from OpenAPI spec
type TimelineCommittedEvent = components['schemas']['timeline-committed-event'];
type TimelineReviewedEvent = components['schemas']['timeline-reviewed-event'];
type TimelineCommentEvent = components['schemas']['timeline-comment-event'];
type TimelineLineCommentedEvent = components['schemas']['timeline-line-commented-event'];
type TimelineAssignedEvent = components['schemas']['timeline-assigned-issue-event'];
type TimelineUnassignedEvent = components['schemas']['timeline-unassigned-issue-event'];
type ReviewRequestedEvent = components['schemas']['review-requested-issue-event'];
type ReviewRequestRemovedEvent = components['schemas']['review-request-removed-issue-event'];
type StateChangeEvent = components['schemas']['state-change-issue-event'];

/**
 * Issue/PR timeline item - discriminated union with explicit event literals
 */
export type IssueTimelineItem =
  | ({ event: 'committed' } & TimelineCommittedEvent)
  | ({ event: 'reviewed' } & TimelineReviewedEvent)
  | ({ event: 'commented' } & TimelineCommentEvent)
  | ({ event: 'line-commented' } & TimelineLineCommentedEvent)
  | ({ event: 'assigned' } & TimelineAssignedEvent)
  | ({ event: 'unassigned' } & TimelineUnassignedEvent)
  | ({ event: 'review_requested' } & ReviewRequestedEvent)
  | ({ event: 'review_request_removed' } & ReviewRequestRemovedEvent)
  | ({ event: 'closed' | 'reopened' | 'merged' } & StateChangeEvent)
  ;

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
