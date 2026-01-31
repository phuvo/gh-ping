import type { GhPingConfig, GhPingUserConfig } from './schema.js';

/**
 * Apply default values to user config
 */
export function applyDefaults(userConfig: GhPingUserConfig): GhPingConfig {
  return {
    skipThreads: userConfig.skipThreads ?? [],
    markSkippedAsRead: userConfig.markSkippedAsRead ?? false,
    skipActivities: userConfig.skipActivities ?? [],
    repoAliases: userConfig.repoAliases ?? {},
    userAliases: userConfig.userAliases ?? {},
    sound: userConfig.sound ?? true,
    markAsReadOnClick: userConfig.markAsReadOnClick ?? true,
  };
}
