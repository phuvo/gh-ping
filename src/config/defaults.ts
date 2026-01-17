import type { GhPingConfig, GhPingUserConfig } from './schema.js';

const MIN_INTERVAL_MS = 10_000; // 10 seconds minimum
const DEFAULT_INTERVAL_MS = 60_000; // 1 minute

/**
 * Apply defaults to user config
 */
export function applyDefaults(userConfig: GhPingUserConfig): GhPingConfig {
  const intervalMs = Math.max(
    userConfig.polling?.intervalMs ?? DEFAULT_INTERVAL_MS,
    MIN_INTERVAL_MS
  );

  return {
    polling: {
      intervalMs,
    },
    filters: userConfig.filters ?? [],
    notifications: {
      sound: userConfig.notifications?.sound ?? true,
    },
  };
}
