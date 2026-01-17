import type { NotificationEvent } from '../config/schema.js';
import type { GitHubNotification } from './types.js';
import { resolveHtmlUrl } from '../notifications/url-resolver.js';

/**
 * Transform raw GitHub notification to NotificationEvent
 */
export function transformNotification(raw: GitHubNotification): NotificationEvent {
  return {
    id: raw.id,
    reason: raw.reason,
    subject: {
      type: raw.subject.type,
      title: raw.subject.title,
      htmlUrl: resolveHtmlUrl(raw),
    },
    repository: {
      fullName: raw.repository.full_name,
      name: raw.repository.name,
      owner: raw.repository.owner.login,
      private: raw.repository.private,
      htmlUrl: raw.repository.html_url,
    },
    unread: raw.unread,
    updatedAt: new Date(raw.updated_at),
    _raw: raw,
  };
}

/**
 * Transform array of raw notifications
 */
export function transformNotifications(raw: GitHubNotification[]): NotificationEvent[] {
  return raw.map(transformNotification);
}
