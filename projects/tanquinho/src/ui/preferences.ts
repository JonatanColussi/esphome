import type { WashType } from '../domain/wash';

const WASH_TYPE_KEY = 'tq-wash-type';

export interface Preferences {
  loadWashType(): WashType;
  saveWashType(washType: WashType): void;
}

/** localStorage can be missing (private tabs); the screen keeps working without it. */
export function createLocalPreferences(
  getStorage: () => Storage = () => window.localStorage,
): Preferences {
  return {
    loadWashType: () => {
      try {
        return getStorage().getItem(WASH_TYPE_KEY) === 'quick' ? 'quick' : 'normal';
      } catch {
        return 'normal';
      }
    },
    saveWashType: washType => {
      try {
        getStorage().setItem(WASH_TYPE_KEY, washType);
      } catch {
        // Nothing to do: the choice just will not survive a reload.
      }
    },
  };
}
