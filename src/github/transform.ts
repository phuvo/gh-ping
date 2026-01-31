import type { Thread, Activity } from '../config/schema.js';
import type { GitHubNotification, IssueTimelineItem } from './types.js';

/**
 * Transform raw GitHub notifications to Thread objects
 */
export function transformNotifications(raw: GitHubNotification[]): Thread[] {
  return raw.map(transformNotification);
}

/**
 * Transform a single GitHub notification to Thread
 */
export function transformNotification(n: GitHubNotification): Thread {
  const [owner, name] = n.repository.full_name.split('/');

  return {
    id: n.id,
    reason: n.reason,
    subject: {
      type: n.subject.type,
      title: n.subject.title,
      url: n.subject.url ?? null,
      htmlUrl: null, // Will be resolved later
    },
    repository: {
      fullName: n.repository.full_name,
      name: name ?? n.repository.name,
      owner: owner ?? '',
      private: n.repository.private,
      htmlUrl: n.repository.html_url,
    },
    unread: n.unread,
    updatedAt: new Date(n.updated_at),
    activities: [],
  };
}

/**
 * Transform timeline items to Activity objects
 */
export function transformTimeline(items: IssueTimelineItem[]): Activity[] {
  const activities: Activity[] = [];

  for (const item of items) {
    const activity = transformTimelineItem(item);
    if (activity) {
      activities.push(activity);
    }
  }

  // Skip redundant 'closed' event if it immediately follows a 'merged' event
  // (GitHub fires both when a PR is merged)
  if (activities.length >= 2) {
    const last = activities[activities.length - 1];
    const secondLast = activities[activities.length - 2];
    if (last.event === 'closed' && secondLast.event === 'merged') {
      activities.pop();
    }
  }

  return activities;
}

/**
 * Transform a single timeline item to Activity (or null if not tracked)
 */
function transformTimelineItem(item: IssueTimelineItem): Activity | null {
  switch (item.event) {
    case 'committed':
      return {
        event: 'committed',
        createdAt: new Date(item.author.date),
        body: item.message,
        author: { name: item.author.name, email: item.author.email },
        committer: { name: item.committer.name, email: item.committer.email },
      };

    case 'reviewed':
      return {
        event: item.event,
        createdAt: item.submitted_at ? new Date(item.submitted_at) : new Date(),
        actor: { login: item.user.login },
        state: item.state as Activity['state'],
        body: item.body ?? undefined,
      };

    case 'assigned':
    case 'unassigned':
      return {
        event: item.event,
        createdAt: new Date(item.created_at),
        actor: { login: item.actor.login },
        assignee: { login: item.assignee.login },
      };

    case 'review_requested':
    case 'review_request_removed':
      return {
        event: item.event,
        createdAt: new Date(item.created_at),
        actor: { login: item.actor.login },
        requestedReviewer: item.requested_reviewer ? { login: item.requested_reviewer.login } : undefined,
        requestedTeam: item.requested_team ? { name: item.requested_team.name, slug: item.requested_team.slug } : undefined,
      };

    case 'commented':
      return {
        event: item.event,
        createdAt: new Date(item.created_at),
        actor: { login: item.actor.login },
        body: item.body,
      };

    case 'line-commented': {
      const firstComment = item.comments?.[0];
      return {
        event: item.event,
        createdAt: firstComment?.created_at ? new Date(firstComment.created_at) : new Date(),
        actor: firstComment?.user ? { login: firstComment.user.login } : undefined,
        body: firstComment?.body,
      };
    }

    case 'closed':
    case 'reopened':
    case 'merged':
      return {
        event: item.event,
        createdAt: new Date(item.created_at),
        actor: { login: item.actor.login },
      };

    default:
      return null;
  }
}
