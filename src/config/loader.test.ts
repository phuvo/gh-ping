import { describe, it, expect } from 'vitest';
import { validateConfig } from './loader.js';

describe('validateConfig', () => {
  it('should return empty array for valid empty config', () => {
    expect(validateConfig({})).toEqual([]);
  });

  it('should return empty array for valid full config', () => {
    const config = {
      skipThreads: [() => true],
      markSkippedAsRead: true,
      skipActivities: [() => false],
      repoAliases: { 'org/repo': 'alias' },
      userAliases: { 'user': 'u' },
      sound: false,
      markAsReadOnClick: true,
    };
    expect(validateConfig(config)).toEqual([]);
  });

  it('should error if config is null', () => {
    const errors = validateConfig(null);
    expect(errors).toContain('Config must be an object');
  });

  it('should error if config is not an object', () => {
    const errors = validateConfig('string');
    expect(errors).toContain('Config must be an object');
  });

  it('should error if `skipThreads` is not an array', () => {
    const errors = validateConfig({ skipThreads: 'not-array' });
    expect(errors).toContain('`skipThreads` must be an array');
  });

  it('should error if `skipThreads` contains non-functions', () => {
    const errors = validateConfig({ skipThreads: [() => true, 'string', 123] });
    expect(errors).toContain('skipThreads[1] must be a function');
    expect(errors).toContain('skipThreads[2] must be a function');
  });

  it('should error if `skipActivities` is not an array', () => {
    const errors = validateConfig({ skipActivities: {} });
    expect(errors).toContain('`skipActivities` must be an array');
  });

  it('should error if `skipActivities` contains non-functions', () => {
    const errors = validateConfig({ skipActivities: [null] });
    expect(errors).toContain('skipActivities[0] must be a function');
  });

  it('should error if `markSkippedAsRead` is not a boolean', () => {
    const errors = validateConfig({ markSkippedAsRead: 'yes' });
    expect(errors).toContain('`markSkippedAsRead` must be a boolean');
  });

  it('should error if `sound` is not a boolean', () => {
    const errors = validateConfig({ sound: 1 });
    expect(errors).toContain('`sound` must be a boolean');
  });

  it('should error if `markAsReadOnClick` is not a boolean', () => {
    const errors = validateConfig({ markAsReadOnClick: undefined });
    // undefined is allowed (optional field), so no error
    expect(validateConfig({ markAsReadOnClick: 'true' })).toContain('`markAsReadOnClick` must be a boolean');
  });

  it('should collect multiple errors', () => {
    const errors = validateConfig({
      skipThreads: 'bad',
      sound: 'bad',
      markAsReadOnClick: 123,
    });
    expect(errors.length).toBe(3);
  });
});
