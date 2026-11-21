import type { EntityStates, RelayKey, Stage } from './entities';
import { Entity, isOn, readNumber, readWaterLevel, RELAYS, STAGES } from './entities';

export interface CycleProgress {
  current: number;
  total: number;
}
export type WashOutcome = 'completed' | 'interrupted';

export type WashType = 'normal' | 'quick';

const QUICK_FACTOR = 0.5;
const CYCLE_PROGRESS_PATTERN = /^(\d+)\/(\d+)$/;

export function activeRelays(states: EntityStates): RelayKey[] {
  return RELAYS.filter(relay => isOn(states, relay));
}

/** Same arithmetic as the firmware's prepare_cycle script. */
export function estimateSeconds(states: EntityStates, washType: WashType): number {
  const level = readWaterLevel(states);
  const isQuick = washType === 'quick';
  const factor = isQuick ? QUICK_FACTOR : 1;
  const minutes =
    readNumber(states, Entity.fillMinutes[level], 0) +
    readNumber(states, Entity.drainMinutes[level], 0) +
    (readNumber(states, Entity.mixMinutes, 0) + readNumber(states, Entity.washMinutes, 0)) *
      factor +
    (isQuick ? 0 : readNumber(states, Entity.soakMinutes, 0));
  const cycles = Math.max(1, Math.round(readNumber(states, Entity.cycles, 1)));

  return Math.round(minutes * 60) * cycles;
}

/** Firmware publishes "current/total" while a wash runs and "" otherwise. */
export function parseCycleProgress(text: string): CycleProgress | null {
  const match = CYCLE_PROGRESS_PATTERN.exec(text);

  if (!match) {
    return null;
  }

  return { current: Number(match[1]), total: Number(match[2]) };
}

export function parseStage(text: string): Stage | null {
  return STAGES.find(stage => stage === text) ?? null;
}

export function timelineStages(washType: WashType): Stage[] {
  return washType === 'quick' ? STAGES.filter(stage => stage !== 'Soaking') : [...STAGES];
}

/** A wash that ends without the person pressing stop has completed. */
export function washOutcome(
  wasRunning: boolean,
  isRunning: boolean,
  stoppedByUser: boolean,
): WashOutcome | null {
  if (!wasRunning || isRunning) {
    return null;
  }

  return stoppedByUser ? 'interrupted' : 'completed';
}
