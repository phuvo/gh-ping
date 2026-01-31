import type { Endpoints } from '@octokit/types';

// Re-use Octokit types where available
type GitHubNotification = Endpoints['GET /notifications']['response']['data'][number];
export type NotificationReason = GitHubNotification['reason'];
export type SubjectType = GitHubNotification['subject']['type'];

/**
 * Raw notification data exposed to ThreadFilter
 * (before enrichment, minimal fields only)
 */
export interface ThreadFilterInput {
  id: string;
  reason: NotificationReason;
  subject: {
    type: SubjectType;
    title: string;
  };
  repository: {
    fullName: string;
    name: string;
    owner: string;
    private: boolean;
  };
  unread: boolean;
  updatedAt: Date;
}

/**
 * Activity data exposed to ActivityFilter
 */
export interface ActivityFilterInput {
  event: string;
  createdAt: Date;
  actor?: { login: string };
  state?: 'approved' | 'changes_requested' | 'commented' | 'dismissed';
  assignee?: { login: string };
  requestedReviewer?: { login: string };
  requestedTeam?: { name: string; slug: string };
  /** For 'committed' events - git signature name */
  author?: { name: string; email: string };
  committer?: { name: string; email: string };
}

/**
 * Thread filter - return true to SKIP the thread
 * Called before enrichment, only has access to raw notification data
 */
export type ThreadFilter = (thread: ThreadFilterInput) => boolean;

/**
 * Activity filter - return true to SKIP the activity
 * Called after enrichment
 */
export type ActivityFilter = (thread: ThreadFilterInput, activity: ActivityFilterInput) => boolean;

/**
 * User-facing config (before defaults are applied)
 */
export interface GhPingUserConfig {
  skipThreads?: ThreadFilter[];
  markSkippedAsRead?: boolean;
  skipActivities?: ActivityFilter[];
  repoAliases?: Record<string, string>;
  userAliases?: Record<string, string>;
  sound?: boolean;
  markAsReadOnClick?: boolean;
  /** Collapse activities before a merge into the merge notification (default: true) */
  collapseMergedPrActivities?: boolean;
}

/**
 * Full config (after defaults applied)
 */
export interface GhPingConfig {
  skipThreads: ThreadFilter[];
  markSkippedAsRead: boolean;
  skipActivities: ActivityFilter[];
  repoAliases: Record<string, string>;
  userAliases: Record<string, string>;
  sound: boolean;
  markAsReadOnClick: boolean;
  /** Collapse activities before a merge into the merge notification */
  collapseMergedPrActivities: boolean;
}

/**
 * Thread - a GitHub notification thread
 */
export interface Thread {
  id: string;
  reason: NotificationReason;
  subject: {
    type: SubjectType;
    title: string;
    url: string | null;      // API URL
    htmlUrl: string | null;  // Browser URL
  };
  repository: {
    fullName: string;
    name: string;
    owner: string;
    private: boolean;
    htmlUrl: string;
  };
  unread: boolean;
  updatedAt: Date;
  /** Populated after enrichment */
  activities: Activity[];
}

/**
 * Activity - a timeline event within a thread
 * Uses raw GitHub timeline event types
 */
export interface Activity {
  /** Raw GitHub event type: 'reviewed', 'commented', 'merged', etc. */
  event: string;
  createdAt: Date;
  actor?: { login: string; };
  /** Comment/review body text */
  body?: string;
  /** For 'reviewed' events */
  state?: 'approved' | 'changes_requested' | 'commented' | 'dismissed';
  /** For 'assigned'/'unassigned' events */
  assignee?: { login: string };
  /** For 'review_requested' events */
  requestedReviewer?: { login: string };
  requestedTeam?: { name: string; slug: string };
  /** For 'committed' events - git signature */
  author?: { name: string; email: string };
  committer?: { name: string; email: string };
  /** Number of collapsed activities (set by reduceActivities) */
  count?: number;
  /** Number of events collapsed before a merge (set by collapseMergeEvents) */
  preMergeCount?: number;
}

/**
 * Helper to define config with type checking
 */
export function defineConfig(config: GhPingUserConfig): GhPingUserConfig {
  return config;
}
