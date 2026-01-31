import { describe, it, expect } from 'vitest';
import { resolveHtmlUrl } from './url-resolver.js';
import type { Thread } from '../config/schema.js';

function createThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: '123',
    reason: 'comment',
    subject: {
      type: 'PullRequest',
      title: 'Test PR',
      url: 'https://api.github.com/repos/owner/repo/pulls/42',
      htmlUrl: null,
    },
    repository: {
      fullName: 'owner/repo',
      name: 'repo',
      owner: 'owner',
      private: false,
      htmlUrl: 'https://github.com/owner/repo',
    },
    unread: true,
    updatedAt: new Date(),
    activities: [],
    ...overrides,
  };
}

describe('resolveHtmlUrl', () => {
  it('should use existing htmlUrl if present', () => {
    const thread = createThread({
      subject: {
        type: 'PullRequest',
        title: 'Test PR',
        url: 'https://api.github.com/repos/owner/repo/pulls/42',
        htmlUrl: 'https://github.com/owner/repo/pull/42',
      },
    });
    expect(resolveHtmlUrl(thread)).toBe('https://github.com/owner/repo/pull/42');
  });

  it('should convert PR API URL to HTML URL', () => {
    const thread = createThread();
    expect(resolveHtmlUrl(thread)).toBe('https://github.com/owner/repo/pull/42');
  });

  it('should convert Issue API URL to HTML URL', () => {
    const thread = createThread({
      subject: {
        type: 'Issue',
        title: 'Test Issue',
        url: 'https://api.github.com/repos/owner/repo/issues/123',
        htmlUrl: null,
      },
    });
    expect(resolveHtmlUrl(thread)).toBe('https://github.com/owner/repo/issues/123');
  });

  it('should convert Commit API URL to HTML URL', () => {
    const thread = createThread({
      subject: {
        type: 'Commit',
        title: 'Test Commit',
        url: 'https://api.github.com/repos/owner/repo/commits/abc123',
        htmlUrl: null,
      },
    });
    expect(resolveHtmlUrl(thread)).toBe('https://github.com/owner/repo/commit/abc123');
  });

  it('should convert Release API URL to releases page', () => {
    const thread = createThread({
      subject: {
        type: 'Release',
        title: 'v1.0.0',
        url: 'https://api.github.com/repos/owner/repo/releases/12345',
        htmlUrl: null,
      },
    });
    expect(resolveHtmlUrl(thread)).toBe('https://github.com/owner/repo/releases');
  });

  it('should return discussions URL for Discussion type', () => {
    const thread = createThread({
      subject: {
        type: 'Discussion',
        title: 'Test Discussion',
        url: null,
        htmlUrl: null,
      },
    });
    expect(resolveHtmlUrl(thread)).toBe('https://github.com/owner/repo/discussions');
  });

  it('should return repo URL for WorkflowRun type', () => {
    const thread = createThread({
      subject: {
        type: 'WorkflowRun',
        title: 'CI failed',
        url: null,
        htmlUrl: null,
      },
    });
    expect(resolveHtmlUrl(thread)).toBe('https://github.com/owner/repo');
  });

  it('should return repo URL for CheckSuite type', () => {
    const thread = createThread({
      subject: {
        type: 'CheckSuite',
        title: 'CI failed',
        url: null,
        htmlUrl: null,
      },
    });
    expect(resolveHtmlUrl(thread)).toBe('https://github.com/owner/repo');
  });

  it('should return repo URL for unknown path format', () => {
    const thread = createThread({
      subject: {
        type: 'PullRequest',
        title: 'Test',
        url: 'https://api.github.com/something/weird',
        htmlUrl: null,
      },
    });
    expect(resolveHtmlUrl(thread)).toBe('https://github.com/owner/repo');
  });
});
