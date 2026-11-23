/** Entity keys are `domain/name`, identical in the /events stream and in REST URLs. */
export const Entity = {
  cycleProgress: 'text_sensor/Cycle Progress',
  cycles: 'number/Cycles',
  drainMinutes: {
    High: 'number/Drain High (min)',
    Low: 'number/Drain Low (min)',
    Medium: 'number/Drain Medium (min)',
  },
  fillMinutes: {
    High: 'number/Fill High (min)',
    Low: 'number/Fill Low (min)',
    Medium: 'number/Fill Medium (min)',
  },
  mixMinutes: 'number/Mix Time (min)',
  running: 'binary_sensor/Running',
  soakMinutes: 'number/Soak Time (min)',
  stage: 'text_sensor/Stage',
  startFullCycle: 'button/Start Full Cycle',
  startQuickCycle: 'button/Start Quick Cycle',
  stopAll: 'button/Stop All',
  timeRemaining: 'text_sensor/Time Remaining',
  washMinutes: 'number/Wash Time (min)',
  waterLevel: 'select/Water Level',
} as const;

export type EntityStates = Readonly<Record<string, EntityValue | undefined>>;
export type EntityValue = boolean | number | string;

/** Every number entity edited in the settings screen. */
export const MINUTE_SETTINGS: readonly string[] = [
  Entity.fillMinutes.Low,
  Entity.fillMinutes.Medium,
  Entity.fillMinutes.High,
  Entity.drainMinutes.Low,
  Entity.drainMinutes.Medium,
  Entity.drainMinutes.High,
  Entity.mixMinutes,
  Entity.soakMinutes,
  Entity.washMinutes,
];

/** Panel order of the manual-mode relays. */
export const RELAYS = [
  'switch/Water Valve',
  'switch/Motor',
  'switch/Drain Pump',
  'switch/Auxiliary',
] as const;
export type RelayKey = (typeof RELAYS)[number];

export const STAGES = ['Filling', 'Mixing', 'Soaking', 'Washing', 'Draining'] as const;
export type Stage = (typeof STAGES)[number];

export const WATER_LEVELS = ['Low', 'Medium', 'High'] as const;
export type WaterLevel = (typeof WATER_LEVELS)[number];

export function isOn(states: EntityStates, key: string): boolean {
  return states[key] === true;
}

export function readNumber(states: EntityStates, key: string, fallback: number): number {
  const value = states[key];

  return typeof value === 'number' && !Number.isNaN(value) ? value : fallback;
}

export function readText(states: EntityStates, key: string): string {
  const value = states[key];

  return typeof value === 'string' ? value : '';
}

export function readWaterLevel(states: EntityStates): WaterLevel {
  const value = states[Entity.waterLevel];

  return WATER_LEVELS.find(level => level === value) ?? 'Medium';
}
