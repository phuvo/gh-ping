import type { Thread } from '../config/schema.js';

/**
 * Convert GitHub API URL to browser-friendly HTML URL
 */
export function resolveHtmlUrl(thread: Thread): string {
  const { subject, repository } = thread;
  const apiUrl = subject.url;
  const repoHtmlUrl = repository.htmlUrl;

  // If we already have an htmlUrl, use it
  if (subject.htmlUrl) {
    return subject.htmlUrl;
  }

  // No API URL available - use repo-based fallbacks
  if (!apiUrl) {
    switch (subject.type) {
      case 'Discussion':
        return `${repoHtmlUrl}/discussions`;
      case 'WorkflowRun':
      case 'CheckSuite':
        return repoHtmlUrl;
      default:
        return repoHtmlUrl;
    }
  }

  // Parse API URL to extract path components
  // API URLs look like: https://api.github.com/repos/owner/repo/pulls/123
  const urlMatch = apiUrl.match(/\/repos\/[^/]+\/[^/]+\/(.+)/);
  if (!urlMatch) {
    return repoHtmlUrl;
  }

  const pathPart = urlMatch[1];

  // Convert API paths to HTML paths
  // pulls/123 -> pull/123
  if (pathPart.startsWith('pulls/')) {
    return `${repoHtmlUrl}/pull/${pathPart.slice(6)}`;
  }

  // issues/123 -> issues/123 (same)
  if (pathPart.startsWith('issues/')) {
    return `${repoHtmlUrl}/${pathPart}`;
  }

  // commits/sha -> commit/sha
  if (pathPart.startsWith('commits/')) {
    return `${repoHtmlUrl}/commit/${pathPart.slice(8)}`;
  }

  // releases/123 -> releases (can't link to specific release by ID easily)
  if (pathPart.startsWith('releases/')) {
    return `${repoHtmlUrl}/releases`;
  }

  // Fallback to repo URL
  return repoHtmlUrl;
}
