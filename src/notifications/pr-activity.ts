import type { NotificationEvent } from '../config/schema.js';
import type { IssueTimelineItem } from '../github/types.js';
import { fetchIssueTimeline } from '../github/client.js';

const MAX_SUMMARIES = 2;

export async function getPrActivitySummary(
  event: NotificationEvent,
  options: { viewerLogin: string | null; cache: Map<string, string | null> }
): Promise<string | null> {
  if (event.subject.type !== 'PullRequest') {
    return null;
  }

  const apiUrl = event._raw.subject.url;
  if (!apiUrl) {
    return null;
  }

  if (options.cache.has(apiUrl)) {
    return options.cache.get(apiUrl) ?? null;
  }

  try {
    const timeline = await fetchIssueTimeline(apiUrl, { perPage: 30 });
    const summary = summarizeTimeline(timeline, options.viewerLogin);
    options.cache.set(apiUrl, summary);
    return summary;
  } catch {
    options.cache.set(apiUrl, null);
    return null;
  }
}

function summarizeTimeline(items: IssueTimelineItem[], viewerLogin: string | null): string | null {
  const sorted = items
    .filter((item) => typeof item.created_at === 'string')
    .sort((a, b) => Date.parse(b.created_at!) - Date.parse(a.created_at!));

  const summaries: string[] = [];
  let totalRelevant = 0;

  for (const item of sorted) {
    const summary = formatTimelineItem(item);
    if (!summary) {
      continue;
    }

    const actor = getItemActor(item);
    if (viewerLogin && actor && actor.toLowerCase() === viewerLogin.toLowerCase()) {
      continue;
    }

    totalRelevant++;
    if (summaries.length < MAX_SUMMARIES && !summaries.includes(summary)) {
      summaries.push(summary);
    }
  }

  if (summaries.length === 0) {
    return null;
  }

  let result = summaries.join(' + ');
  if (totalRelevant > summaries.length) {
    result += ' + more';
  }

  return result;
}

function formatTimelineItem(item: IssueTimelineItem): string | null {
  const actor = getItemActor(item);
  if (!actor) {
    return null;
  }

  switch (item.event) {
    case 'reviewed': {
      const state = (item.state || '').toLowerCase();
      if (state === 'approved') {
        return `${actor} approved`;
      }
      if (state === 'changes_requested') {
        return `${actor} requested changes`;
      }
      if (state === 'commented') {
        return `${actor} left a review`;
      }
      if (state === 'dismissed') {
        return `${actor} dismissed a review`;
      }
      return `${actor} reviewed`;
    }
    case 'commented':
      return `${actor} commented`;
    case 'line-commented':
      return `${actor} commented on a line`;
    case 'review_requested': {
      const reviewer = getRequestedReviewer(item);
      return reviewer
        ? `${actor} requested review from ${reviewer}`
        : `${actor} requested review`;
    }
    case 'review_request_removed': {
      const reviewer = getRequestedReviewer(item);
      return reviewer
        ? `${actor} removed review request for ${reviewer}`
        : `${actor} removed review request`;
    }
    case 'assigned': {
      const assignee = item.assignee?.login;
      return assignee ? `${actor} assigned ${assignee}` : `${actor} assigned`;
    }
    case 'unassigned': {
      const assignee = item.assignee?.login;
      return assignee ? `${actor} unassigned ${assignee}` : `${actor} unassigned`;
    }
    case 'closed':
      return `${actor} closed`;
    case 'reopened':
      return `${actor} reopened`;
    case 'merged':
      return `${actor} merged`;
    default:
      return null;
  }
}

function getItemActor(item: IssueTimelineItem): string | null {
  return item.actor?.login ?? item.user?.login ?? null;
}

function getRequestedReviewer(item: IssueTimelineItem): string | null {
  return (
    item.requested_reviewer?.login ??
    item.requested_team?.slug ??
    item.requested_team?.name ??
    null
  );
}
