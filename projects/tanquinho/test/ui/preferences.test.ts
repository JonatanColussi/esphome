import { createLocalPreferences } from '../../src/ui/preferences';

function createFakeStorage(): Storage {
  const values = new Map<string, string>();

  return {
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
    removeItem: key => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe('createLocalPreferences', () => {
  it('defaults to the normal wash', () => {
    expect(createLocalPreferences(createFakeStorage).loadWashType()).toBe('normal');
  });

  it('remembers the saved wash type', () => {
    const storage = createFakeStorage();
    const preferences = createLocalPreferences(() => storage);

    preferences.saveWashType('quick');

    expect(preferences.loadWashType()).toBe('quick');

    preferences.saveWashType('normal');

    expect(preferences.loadWashType()).toBe('normal');
  });

  it('keeps working when storage is unavailable', () => {
    const preferences = createLocalPreferences(() => {
      throw new Error('Storage is blocked');
    });

    expect(preferences.loadWashType()).toBe('normal');
    expect(() => preferences.saveWashType('quick')).not.toThrow();
  });
});
