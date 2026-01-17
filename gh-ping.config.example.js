// See: https://github.com/phuvo/gh-ping#configuration

/** @type {import('./src/config/schema.js').GhPingUserConfig} */
export default {
  polling: {
    intervalSec: 60, // 1 minute
  },

  filters: [
    // Only PRs and Issues (skip CI noise like WorkflowRun, CheckSuite)
    (e) => ['PullRequest', 'Issue'].includes(e.subject.type),

    // Only important notifications
    (e) => ['review_requested', 'mention', 'assign', 'comment'].includes(e.reason),

    // Example: Exclude dependabot
    // (e) => !e.subject.title.toLowerCase().includes('dependabot'),

    // Example: Only specific repos
    // (e) => e.repository.fullName.startsWith('my-org/'),
  ],

  // Short aliases for repository names (shown in notifications)
  repoAliases: {
    // 'owner/long-repository-name': 'short-name',
  },

  notifications: {
    sound: true,
  },
};
