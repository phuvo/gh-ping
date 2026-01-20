import type { GhPingConfig, GhPingUserConfig } from './schema.js';

/**
 * Apply defaults to user config
 */
export function applyDefaults(userConfig: GhPingUserConfig): GhPingConfig {
  return {
    filters: userConfig.filters ?? [],
    notifications: {
      sound: userConfig.notifications?.sound ?? true,
    },
    repoAliases: userConfig.repoAliases ?? {},
  };
}
