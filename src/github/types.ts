/**
 * Raw GitHub notification from the API
 * https://docs.github.com/en/rest/activity/notifications
 */
export interface GitHubNotification {
  id: string;
  unread: boolean;
  reason: NotificationReason;
  updated_at: string;
  last_read_at: string | null;
  subject: {
    title: string;
    url: string | null;
    latest_comment_url: string | null;
    type: SubjectType;
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    html_url: string;
    owner: {
      login: string;
    };
  };
  url: string;
  subscription_url: string;
}

export type NotificationReason =
  | 'approval_requested'
  | 'assign'
  | 'author'
  | 'ci_activity'
  | 'comment'
  | 'invitation'
  | 'manual'
  | 'mention'
  | 'review_requested'
  | 'security_alert'
  | 'state_change'
  | 'subscribed'
  | 'team_mention';

export type SubjectType =
  | 'CheckSuite'
  | 'Commit'
  | 'Discussion'
  | 'Issue'
  | 'PullRequest'
  | 'Release'
  | 'RepositoryVulnerabilityAlert'
  | 'WorkflowRun';
