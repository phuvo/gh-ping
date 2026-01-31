/**
 * Get display name for a repository
 * Uses alias if available, otherwise just the repo name without owner
 */
export function getRepoDisplayName(fullName: string, aliases: Record<string, string>): string {
  if (aliases[fullName]) {
    return aliases[fullName];
  }
  // Fall back to just the repo name (without owner)
  return fullName.split('/')[1] ?? fullName;
}

/**
 * Get display name for a user
 * Uses alias if available, otherwise uses the login as-is
 */
export function getUserDisplayName(login: string, aliases: Record<string, string>): string {
  if (aliases[login]) {
    return aliases[login];
  }
  return login;
}
