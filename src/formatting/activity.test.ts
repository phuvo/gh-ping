import { describe, it, expect } from 'vitest';
import type { Activity } from '../config/schema.js';
import { reduceActivities } from './activity.js';

describe('reduceActivities', () => {
  it('should collapse activities with same actor and event type', () => {
    const activities: Activity[] = [
      { event: 'review_requested', createdAt: new Date('2026-01-01T10:00:00Z'), actor: { login: 'alice' } },
      { event: 'reviewed', createdAt: new Date('2026-01-01T10:01:00Z'), actor: { login: 'bob' }, state: 'commented' },
      { event: 'committed', createdAt: new Date('2026-01-01T10:02:00Z'), committer: { name: 'Calvin', email: 'calvin@example.com' } },
      { event: 'review_requested', createdAt: new Date('2026-01-01T10:03:00Z'), actor: { login: 'alice' } },
      { event: 'committed', createdAt: new Date('2026-01-01T10:04:00Z'), committer: { name: 'Calvin', email: 'calvin@example.com' } },
      { event: 'reviewed', createdAt: new Date('2026-01-01T10:05:00Z'), actor: { login: 'bob' }, state: 'commented' },
    ];

    const reduced = reduceActivities(activities);

    expect(reduced).toHaveLength(3);

    // Order should be based on latest occurrence
    // Alice's review_requested last at index 3
    // Calvin's committed last at index 4
    // Bob's reviewed last at index 5
    expect(reduced[0].event).toBe('review_requested');
    expect(reduced[0].actor?.login).toBe('alice');
    expect(reduced[0].count).toBe(2);
    expect(reduced[0].createdAt).toEqual(new Date('2026-01-01T10:03:00Z')); // Latest

    expect(reduced[1].event).toBe('committed');
    expect(reduced[1].committer?.name).toBe('Calvin');
    expect(reduced[1].count).toBe(2);
    expect(reduced[1].createdAt).toEqual(new Date('2026-01-01T10:04:00Z')); // Latest

    expect(reduced[2].event).toBe('reviewed');
    expect(reduced[2].actor?.login).toBe('bob');
    expect(reduced[2].count).toBe(2);
    expect(reduced[2].createdAt).toEqual(new Date('2026-01-01T10:05:00Z')); // Latest
  });

  it('should not collapse activities with different actors', () => {
    const activities: Activity[] = [
      { event: 'reviewed', createdAt: new Date('2026-01-01T10:00:00Z'), actor: { login: 'alice' }, state: 'commented' },
      { event: 'reviewed', createdAt: new Date('2026-01-01T10:01:00Z'), actor: { login: 'bob' }, state: 'commented' },
    ];

    const reduced = reduceActivities(activities);

    expect(reduced).toHaveLength(2);
    expect(reduced[0].actor?.login).toBe('alice');
    expect(reduced[0].count).toBe(1);
    expect(reduced[1].actor?.login).toBe('bob');
    expect(reduced[1].count).toBe(1);
  });

  it('should not collapse reviews with different states', () => {
    const activities: Activity[] = [
      { event: 'reviewed', createdAt: new Date('2026-01-01T10:00:00Z'), actor: { login: 'alice' }, state: 'commented' },
      { event: 'reviewed', createdAt: new Date('2026-01-01T10:01:00Z'), actor: { login: 'alice' }, state: 'approved' },
    ];

    const reduced = reduceActivities(activities);

    expect(reduced).toHaveLength(2);
    expect(reduced[0].state).toBe('commented');
    expect(reduced[0].count).toBe(1);
    expect(reduced[1].state).toBe('approved');
    expect(reduced[1].count).toBe(1);
  });

  it('should return empty array for empty input', () => {
    const reduced = reduceActivities([]);
    expect(reduced).toHaveLength(0);
  });

  it('should handle single activity', () => {
    const activities: Activity[] = [
      { event: 'commented', createdAt: new Date('2026-01-01T10:00:00Z'), actor: { login: 'alice' } },
    ];

    const reduced = reduceActivities(activities);

    expect(reduced).toHaveLength(1);
    expect(reduced[0].count).toBe(1);
  });
});
