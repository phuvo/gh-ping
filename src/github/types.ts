import type { Endpoints } from '@octokit/types';

/**
 * Raw GitHub notification from the API
 * https://docs.github.com/en/rest/activity/notifications
 */
export type GitHubNotification =
  Endpoints['GET /notifications']['response']['data'][number];

export type NotificationReason = GitHubNotification['reason'];
export type SubjectType = GitHubNotification['subject']['type'];

type PullRequestResponse =
  Endpoints['GET /repos/{owner}/{repo}/pulls/{pull_number}']['response']['data'];

export type PullRequestDetails = Pick<PullRequestResponse, 'merged' | 'state'>;
