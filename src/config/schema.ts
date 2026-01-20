import type { GitHubNotification, NotificationReason, SubjectType } from '../github/types.js';

/**
 * Transformed notification event passed to filter functions
 */
export interface NotificationEvent {
  id: string;
  reason: NotificationReason;
  subject: {
    type: SubjectType;
    title: string;
    /** HTML URL for browser, may be null for some types (WorkflowRun, CheckSuite) */
    htmlUrl: string | null;
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
  /** Raw GitHub API response */
  _raw: GitHubNotification;
}

/**
 * Filter function - return true to show notification, false to skip
 */
export type NotificationFilter = (event: NotificationEvent) => boolean;

/**
 * gh-ping configuration
 */
export interface GhPingConfig {
  /** Array of filter functions - all must return true for notification to show */
  filters: NotificationFilter[];
  notifications: {
    /** Play sound with notification (default: true) */
    sound?: boolean;
  };
  /** Map of full repo names to short aliases (e.g., "acme/my-long-repo-name" -> "repo") */
  repoAliases: Record<string, string>;
}

/**
 * User-facing config (before defaults are applied)
 */
export interface GhPingUserConfig {
  filters?: NotificationFilter[];
  notifications?: {
    sound?: boolean;
  };
  /** Map of full repo names to short aliases (e.g., "acme/my-long-repo-name" -> "repo") */
  repoAliases?: Record<string, string>;
}

/**
 * Helper to define config with type checking
 */
export function defineConfig(config: GhPingUserConfig): GhPingUserConfig {
  return config;
}
