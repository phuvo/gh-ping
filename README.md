# gh-ping

A CLI tool that sends OS notifications for GitHub activity, powered by the GitHub CLI (`gh`).

## Features

- **No token management** — Uses `gh` CLI for authentication (supports SSO, OAuth, etc.)
- **Real-time notifications** — Polls GitHub at configurable intervals
- **Cross-platform** — Windows toast, macOS Notification Center, Linux libnotify
- **Click to open** — Clicking a notification opens the PR/issue in your browser
- **TypeScript filters** — Write filter rules as code for maximum flexibility
- **Background daemon** — Runs silently in the background

## Prerequisites

- Node.js 18+
- [GitHub CLI](https://cli.github.com/) installed and authenticated (`gh auth login`)

## Installation

```sh
# Clone and install
git clone https://github.com/user/gh-ping.git
cd gh-ping
npm install
npm run build

# Or link globally
npm link
```

## Quick Start

1. **Ensure you're authenticated with GitHub CLI**
   ```sh
   gh auth status
   # If not authenticated: gh auth login
   ```

2. **Create a config file**
   ```sh
   gh-ping init
   ```

3. **Test your setup**
   ```sh
   gh-ping test
   ```

4. **Start the daemon**
   ```sh
   gh-ping start
   ```

## CLI Commands

| Command            | Description                                   |
| ------------------ | --------------------------------------------- |
| `gh-ping start`    | Start the daemon in the background            |
| `gh-ping start -f` | Run in foreground (for debugging)             |
| `gh-ping start -v` | Run with verbose logging                      |
| `gh-ping stop`     | Stop the background daemon                    |
| `gh-ping status`   | Show daemon status and config info            |
| `gh-ping test`     | Test your config and send a test notification |
| `gh-ping init`     | Create a starter config file                  |

## Configuration

gh-ping looks for config files in this order:

- `gh-ping.config.ts`
- `gh-ping.config.js`
- `gh-ping.config.mjs`

### Example Config

```ts
// gh-ping.config.ts
import { defineConfig } from 'gh-ping';

export default defineConfig({
  polling: {
    intervalMs: 60_000, // 1 minute (minimum: 10 seconds)
  },
  filters: [
    // Only PRs and Issues
    (e) => ['PullRequest', 'Issue'].includes(e.subject.type),

    // Only important notifications
    (e) => ['review_requested', 'mention', 'assign'].includes(e.reason),

    // Exclude dependabot
    (e) => !e.subject.title.toLowerCase().includes('dependabot'),
  ],
  notifications: {
    sound: true,
  },
});
```

### Config Options

```ts
interface GhPingConfig {
  polling: {
    intervalMs: number;  // Polling interval (min: 10000ms)
  };
  filters: NotificationFilter[];  // Array of filter functions
  notifications: {
    sound?: boolean;  // Play sound (default: true)
  };
}
```

### Filter Functions

Filters use AND logic — all filters must return `true` for a notification to be shown.

```ts
type NotificationFilter = (event: NotificationEvent) => boolean;

interface NotificationEvent {
  id: string;
  reason: 'review_requested' | 'mention' | 'assign' | 'comment' | ...;
  subject: {
    type: 'PullRequest' | 'Issue' | 'Commit' | 'Release' | ...;
    title: string;
    htmlUrl: string | null;
  };
  repository: {
    fullName: string;  // "owner/repo"
    name: string;
    owner: string;
    private: boolean;
  };
  unread: boolean;
  updatedAt: Date;
  _raw: GitHubNotification;  // Raw API response
}
```

### Example Filters

```typescript
filters: [
  // Only PRs, not issues
  (e) => e.subject.type === 'PullRequest',

  // Only important reasons
  (e) => ['review_requested', 'mention', 'assign'].includes(e.reason),

  // Exclude noisy repos
  (e) => !e.repository.fullName.includes('dependabot'),

  // Only work repos
  (e) => e.repository.fullName.startsWith('my-company/'),

  // Only public repos
  (e) => !e.repository.private,
]
```

## State & Logs

gh-ping stores state in `~/.gh-ping/`:

- `state.json` — Seen notifications, last poll time
- `daemon.pid` — Daemon process ID
- `daemon.log` — Log output (when running in background)

## Development

```sh
# Run in dev mode
npm run dev -- start -f -v

# Run tests
npm test

# Build
npm run build
```

## License

MIT
