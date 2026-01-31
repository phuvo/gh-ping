# gh-ping

> GitHub notification via native OS alerts, powered by the `gh` CLI.

`gh-ping` polls the GitHub `notifications` API and surfaces new activities as native OS toasts. Click a notification to open the issue, PR, or discussion in your browser.

## Features

- **Native OS notifications**: Uses Windows toast notifications, MacOS Notification Center, or Linux notification daemons
- **Background daemon**: Runs quietly in the background, polling for new notifications
- **Smart filtering**: Filter threads and activities with JavaScript functions
- **Activity-level notifications**: Get notified about specific events (reviews, comments, assignments) not just thread updates
- **Click to open**: Click a notification to open it in your browser and optionally mark as read
- **Uses `gh` CLI**: No token management, uses your existing GitHub CLI authentication

## Requirements

- [GitHub CLI](https://cli.github.com/) (`gh`) installed and authenticated

## Installation

```sh
npm install -g gh-ping
```

Or install from source:

```sh
git clone https://github.com/phuvo/gh-ping.git
cd gh-ping
npm install
npm run build
npm link
```

## Quick Start

1. **Authenticate with GitHub CLI** (if not already done):
   ```sh
   gh auth login
   ```

2. **Create a config file**:
   ```sh
   gh-ping init
   ```

3. **Test your setup**:
   ```sh
   gh-ping test
   ```

4. **Start the daemon**:
   ```sh
   gh-ping start
   ```

## Commands

### `gh-ping start`

Start the notification daemon.

```sh
gh-ping start           # Start as background daemon
gh-ping start -f        # Run in foreground (Ctrl+C to stop)
gh-ping start -v        # Enable verbose/debug logging
```

### `gh-ping stop`

Stop the running daemon.

```sh
gh-ping stop
```

### `gh-ping status`

Show daemon status, config location, and auth status.

```sh
gh-ping status
```

### `gh-ping test`

Test your configuration and send a test notification.

```sh
gh-ping test
```

### `gh-ping init`

Create a configuration file.

```bash
gh-ping init            # Create global config (~/.config/gh-ping/config.js)
gh-ping init -l         # Create local config (./gh-ping.config.js)
gh-ping init -f         # Overwrite existing config
```

## Configuration

`gh-ping` looks for config files in this order:

1. `./gh-ping.config.js` (current directory)
2. `~/.config/gh-ping/config.js` (global)

### Example Config

```js
// gh-ping.config.js

/** @type {import('gh-ping').GhPingUserConfig} */
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
};
```

### Config Options

| Option | Type | Default | Description |
| ------ | ---- | ------- | ----------- |
| `skipThreads` | `ThreadFilter[]` | `[]` | Functions to filter out threads. Return `true` to skip. |
| `markSkippedAsRead` | `boolean` | `false` | Mark filtered threads as read in GitHub. |
| `skipActivities` | `ActivityFilter[]` | `[]` | Functions to filter out activities. Return `true` to skip. |
| `repoAliases` | `Record<string, string>` | `{}` | Map full repo names to short display names. |
| `userAliases` | `Record<string, string>` | `{}` | Map usernames to short display names. |
| `sound` | `boolean` | `true` | Play sound with notifications. |
| `markAsReadOnClick` | `boolean` | `true` | Mark thread as read when clicking notification. |

## How It Works

`gh-ping` implements a processing pipeline for each poll:

1. **Fetch**: Get notifications from GitHub via `gh api notifications`
2. **Filter threads**: Apply `skipThreads` filters (optionally mark skipped as read)
3. **Enrich**: Fetch timeline events for each thread (PR reviews, comments, etc.)
4. **Filter activities**: Apply `skipActivities` filters (also auto-skips your own activity)
5. **Format**: Build notification title/body with aliases applied
6. **Notify**: Send OS toast, handle click → open URL + mark as read

## Data Storage

Runtime data is stored in `~/.gh-ping/`:

- `daemon.pid` - Process ID file
- `daemon.log` - Log output when running as daemon

## Troubleshooting

### Notifications not showing

1. Run `gh-ping test` to verify setup
2. Check that `gh auth status` shows you're authenticated
3. Check the log file: `~/.gh-ping/daemon.log`

### Windows: Notifications disappear quickly

Windows toast notifications require a Start Menu shortcut for proper display. gh-ping automatically creates this on first run using SnoreToast.

### Too many/few notifications

Adjust your `skipThreads` and `skipActivities` filters. Use `gh-ping start -fv` to run in foreground with verbose logging to see what's being filtered.

## License

MIT
