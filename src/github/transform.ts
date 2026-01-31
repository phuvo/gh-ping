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
 * Events we care about for activity tracking
 */
const TRACKED_EVENTS = new Set([
  'reviewed',
  'commented',
  'line-commented',
  'review_requested',
  'review_request_removed',
  'assigned',
  'unassigned',
  'closed',
  'reopened',
  'merged',
  'committed',
  'head_ref_force_pushed',
]);

/**
 * Transform timeline items to Activity objects
 */
export function transformTimeline(items: IssueTimelineItem[]): Activity[] {
  const activities: Activity[] = [];

  for (const item of items) {
    const event = item.event;
    if (!event || !TRACKED_EVENTS.has(event)) {
      continue;
    }

    // Get actor from various possible fields
    const actorLogin = item.actor?.login ?? item.user?.login;

    const activity: Activity = {
      event,
      createdAt: item.created_at ? new Date(item.created_at) : new Date(),
      actor: actorLogin ? { login: actorLogin } : null,
    };

    // Add body for comments/reviews
    if (item.body) {
      activity.body = item.body;
    }

    // Add state for reviewed events
    if (event === 'reviewed' && item.state) {
      activity.state = item.state as Activity['state'];
    }

    // Add assignee for assigned/unassigned events
    if ((event === 'assigned' || event === 'unassigned') && item.assignee?.login) {
      activity.assignee = { login: item.assignee.login };
    }

    // Add requested reviewer for review_requested/review_request_removed events
    if (event === 'review_requested' || event === 'review_request_removed') {
      if (item.requested_reviewer?.login) {
        activity.requestedReviewer = { login: item.requested_reviewer.login };
      }
      if (item.requested_team?.name && item.requested_team?.slug) {
        activity.requestedTeam = {
          name: item.requested_team.name,
          slug: item.requested_team.slug,
        };
      }
    }

    activities.push(activity);
  }

  return activities;
}
