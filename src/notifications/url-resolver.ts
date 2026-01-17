import type { GitHubNotification } from '../github/types.js';

/**
 * Resolve HTML URL from GitHub notification
 * The API returns API URLs (api.github.com/repos/...) but we need HTML URLs for browser
 */
export function resolveHtmlUrl(notification: GitHubNotification): string | null {
  const { subject, repository } = notification;

  // Handle types with null subject.url first
  if (subject.type === 'Discussion') {
    return `${repository.html_url}/discussions`;
  }

  // WorkflowRun, CheckSuite have null subject URL - fall back to repo
  if (!subject.url) {
    return repository.html_url;
  }

  const apiUrl = subject.url;

  // Transform API URL to HTML URL
  // api.github.com/repos/owner/repo/pulls/123 -> github.com/owner/repo/pull/123
  if (apiUrl.includes('/pulls/')) {
    return apiUrl
      .replace('https://api.github.com/repos', 'https://github.com')
      .replace('/pulls/', '/pull/');
  }

  // api.github.com/repos/owner/repo/issues/123 -> github.com/owner/repo/issues/123
  if (apiUrl.includes('/issues/')) {
    return apiUrl.replace('https://api.github.com/repos', 'https://github.com');
  }

  // api.github.com/repos/owner/repo/commits/sha -> github.com/owner/repo/commit/sha
  if (apiUrl.includes('/commits/')) {
    return apiUrl
      .replace('https://api.github.com/repos', 'https://github.com')
      .replace('/commits/', '/commit/');
  }

  // api.github.com/repos/owner/repo/releases/123 -> github.com/owner/repo/releases/tag/...
  // Releases are trickier - fall back to repo releases page
  if (apiUrl.includes('/releases/')) {
    return `${repository.html_url}/releases`;
  }

  // Fallback to repository URL
  return repository.html_url;
}
