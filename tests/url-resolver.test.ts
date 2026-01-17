import { describe, it, expect } from 'vitest';
import { resolveHtmlUrl } from '../src/notifications/url-resolver.js';
import type { GitHubNotification } from '../src/github/types.js';

function createNotification(overrides: Partial<GitHubNotification>): GitHubNotification {
  return {
    id: '123',
    unread: true,
    reason: 'mention',
    updated_at: '2024-01-01T00:00:00Z',
    last_read_at: null,
    subject: {
      title: 'Test notification',
      url: 'https://api.github.com/repos/owner/repo/issues/1',
      latest_comment_url: null,
      type: 'Issue',
    },
    repository: {
      id: 1,
      name: 'repo',
      full_name: 'owner/repo',
      private: false,
      html_url: 'https://github.com/owner/repo',
      owner: { login: 'owner' },
    },
    url: 'https://api.github.com/notifications/threads/123',
    subscription_url: 'https://api.github.com/notifications/threads/123/subscription',
    ...overrides,
  };
}

describe('resolveHtmlUrl', () => {
  it('should convert pull request API URL to HTML URL', () => {
    const notification = createNotification({
      subject: {
        title: 'Fix bug',
        url: 'https://api.github.com/repos/owner/repo/pulls/42',
        latest_comment_url: null,
        type: 'PullRequest',
      },
    });

    expect(resolveHtmlUrl(notification)).toBe('https://github.com/owner/repo/pull/42');
  });

  it('should convert issue API URL to HTML URL', () => {
    const notification = createNotification({
      subject: {
        title: 'Bug report',
        url: 'https://api.github.com/repos/owner/repo/issues/123',
        latest_comment_url: null,
        type: 'Issue',
      },
    });

    expect(resolveHtmlUrl(notification)).toBe('https://github.com/owner/repo/issues/123');
  });

  it('should convert commit API URL to HTML URL', () => {
    const notification = createNotification({
      subject: {
        title: 'Update readme',
        url: 'https://api.github.com/repos/owner/repo/commits/abc123',
        latest_comment_url: null,
        type: 'Commit',
      },
    });

    expect(resolveHtmlUrl(notification)).toBe('https://github.com/owner/repo/commit/abc123');
  });

  it('should return repo releases page for releases', () => {
    const notification = createNotification({
      subject: {
        title: 'v1.0.0',
        url: 'https://api.github.com/repos/owner/repo/releases/12345',
        latest_comment_url: null,
        type: 'Release',
      },
    });

    expect(resolveHtmlUrl(notification)).toBe('https://github.com/owner/repo/releases');
  });

  it('should return repo discussions page for discussions', () => {
    const notification = createNotification({
      subject: {
        title: 'Question about X',
        url: null,
        latest_comment_url: null,
        type: 'Discussion',
      },
    });

    expect(resolveHtmlUrl(notification)).toBe('https://github.com/owner/repo/discussions');
  });

  it('should return repo URL for WorkflowRun (null subject URL)', () => {
    const notification = createNotification({
      subject: {
        title: 'CI failed',
        url: null,
        latest_comment_url: null,
        type: 'WorkflowRun',
      },
    });

    expect(resolveHtmlUrl(notification)).toBe('https://github.com/owner/repo');
  });

  it('should return repo URL for CheckSuite (null subject URL)', () => {
    const notification = createNotification({
      subject: {
        title: 'Checks passed',
        url: null,
        latest_comment_url: null,
        type: 'CheckSuite',
      },
    });

    expect(resolveHtmlUrl(notification)).toBe('https://github.com/owner/repo');
  });
});
