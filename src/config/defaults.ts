import type { GhPingConfig, GhPingUserConfig } from './schema.js';

const MIN_INTERVAL_SEC = 10; // 10 seconds minimum
const DEFAULT_INTERVAL_SEC = 60; // 1 minute

/**
 * Apply defaults to user config
 */
export function applyDefaults(userConfig: GhPingUserConfig): GhPingConfig {
  const intervalSec = Math.max(
    userConfig.polling?.intervalSec ?? DEFAULT_INTERVAL_SEC,
    MIN_INTERVAL_SEC
  );

  return {
    polling: {
      intervalSec,
    },
    filters: userConfig.filters ?? [],
    notifications: {
      sound: userConfig.notifications?.sound ?? true,
    },
  };
}
