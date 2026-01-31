// See: https://github.com/phuvo/gh-ping#configuration

/** @type {import('./src/config/schema.js').GhPingUserConfig} */
export default {
  // ─── Thread Filtering ───
  // Return true to SKIP the thread (no toast, no timeline fetch)
  skipThreads: [
    // Skip CI noise
    (thread) => thread.subject.type === 'CheckSuite',
    (thread) => thread.subject.type === 'WorkflowRun',

    // Skip dependabot
    (thread) => thread.subject.title.includes('dependabot'),
  ],

  // Mark skipped threads as read in GitHub?
  markSkippedAsRead: true,

  // ─── Activity filtering ───
  // Return true to SKIP the activity when formatting
  skipActivities: [
    // Skip bot activity
    (thread, activity) => activity.actor?.login?.endsWith('[bot]'),
  ],

  // ─── Display ───
  repoAliases: {
    'my-org/long-repository-name': 'repo-name',
  },
  userAliases: {
    'john-smith-long-username': 'john',
  },

  // ─── Behavior ───
  sound: true,
  markAsReadOnClick: true,

  // Collapse activities before a merge into the merge notification (e.g., "John merged 'PR' and more")
  collapseMergedPrActivities: true,
};
