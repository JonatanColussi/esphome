import type { EntityValue } from '../src/domain/entities';
import { Entity } from '../src/domain/entities';

/** Entity states with the firmware's default settings (Medium level, 1 cycle). */
export function buildStates(
  overrides: Record<string, EntityValue> = {},
): Record<string, EntityValue> {
  return {
    [Entity.waterLevel]: 'Medium',
    [Entity.cycles]: 1,
    [Entity.fillMinutes.Low]: 2.5,
    [Entity.fillMinutes.Medium]: 3.5,
    [Entity.fillMinutes.High]: 5,
    [Entity.drainMinutes.Low]: 3,
    [Entity.drainMinutes.Medium]: 4,
    [Entity.drainMinutes.High]: 5.5,
    [Entity.mixMinutes]: 0.5,
    [Entity.soakMinutes]: 5,
    [Entity.washMinutes]: 15,
    ...overrides,
  };
}
