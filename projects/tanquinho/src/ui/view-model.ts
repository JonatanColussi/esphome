import type { StageCopy } from '../copy';
import {
  cycleProgressText,
  manualRelaysText,
  RELAY_COPY,
  remainingText,
  STAGE_COPY,
  startSubtitle,
  statusText,
  TEXT,
  UNKNOWN_STAGE_COPY,
  washTypeSubtitle,
} from '../copy';
import type { EntityStates, RelayKey, Stage, WaterLevel } from '../domain/entities';
import {
  Entity,
  isOn,
  MINUTE_SETTINGS,
  readNumber,
  readText,
  readWaterLevel,
  RELAYS,
} from '../domain/entities';
import { clockTimeAfter, parseHms, progressPercent } from '../domain/time';
import type { WashOutcome, WashType } from '../domain/wash';
import {
  activeRelays,
  estimateSeconds,
  parseCycleProgress,
  parseStage,
  timelineStages,
} from '../domain/wash';

export interface RelayView {
  key: RelayKey;
  label: string;
  on: boolean;
}
export type RequestedScreen = 'ready' | 'settings';
export type Screen = RequestedScreen | 'washing';

export interface TimelineStep {
  label: string;
  state: TimelineStepState;
}

export type TimelineStepState = 'current' | 'done' | 'pending';

export interface ViewInput {
  connected: boolean;
  nowMs: number;
  outcome: WashOutcome | null;
  requestedScreen: RequestedScreen;
  roundTotalSeconds: number;
  /** Wash type saved when the current wash started; drives the timeline. */
  runningWashType: WashType;
  /** Wash type selected on the ready screen; drives the start button. */
  selectedWashType: WashType;
  states: EntityStates;
}

/** Everything the views draw, already computed and translated. */
export interface ViewModel {
  connected: boolean;
  cycleText: string;
  cycles: number;
  finishTime: string;
  headerTitle: string;
  manualAlert: string | null;
  manualNote: string;
  minuteSettings: Readonly<Record<string, number | undefined>>;
  normalSubtitle: string;
  outcome: WashOutcome | null;
  progressPercent: number;
  quickSubtitle: string;
  relays: RelayView[];
  remainingText: string;
  running: boolean;
  screen: Screen;
  stage: StageCopy;
  startSubtitle: string;
  statusText: string;
  timeline: TimelineStep[];
  washType: WashType;
  waterLevel: WaterLevel;
}

const NO_TIME = '--:--';

function resolveScreen(requested: RequestedScreen, running: boolean): Screen {
  if (requested === 'settings') {
    return 'settings';
  }

  return running ? 'washing' : 'ready';
}

function buildTimeline(washType: WashType, stage: Stage | null): TimelineStep[] {
  const stages = timelineStages(washType);
  const currentIndex = stage ? stages.indexOf(stage) : -1;

  return stages.map((step, index) => {
    let state: TimelineStepState = 'pending';

    if (index < currentIndex) {
      state = 'done';
    } else if (index === currentIndex) {
      state = 'current';
    }

    return { label: STAGE_COPY[step].short, state };
  });
}

function readMinuteSettings(states: EntityStates): Record<string, number | undefined> {
  return Object.fromEntries(
    MINUTE_SETTINGS.map(key => {
      const value = states[key];

      return [key, typeof value === 'number' ? value : undefined];
    }),
  );
}

export function buildViewModel(input: ViewInput): ViewModel {
  const { connected, nowMs, states } = input;
  const running = isOn(states, Entity.running);
  const screen = resolveScreen(input.requestedScreen, running);
  const cycles = Math.round(readNumber(states, Entity.cycles, 1));
  const remaining = parseHms(readText(states, Entity.timeRemaining));
  const stage = parseStage(readText(states, Entity.stage));
  const normalSeconds = estimateSeconds(states, 'normal');
  const quickSeconds = estimateSeconds(states, 'quick');
  const selectedSeconds = input.selectedWashType === 'quick' ? quickSeconds : normalSeconds;
  const relaysOn = activeRelays(states);

  return {
    connected,
    cycleText:
      cycles > 1
        ? cycleProgressText(parseCycleProgress(readText(states, Entity.cycleProgress)))
        : '',
    cycles,
    finishTime: remaining > 0 ? clockTimeAfter(nowMs, remaining) : NO_TIME,
    headerTitle: screen === 'settings' ? TEXT.settingsTitle : TEXT.appTitle,
    manualAlert: !running && relaysOn.length > 0 ? manualRelaysText(relaysOn) : null,
    manualNote: running ? TEXT.manualUnavailable : TEXT.manualHint,
    minuteSettings: readMinuteSettings(states),
    normalSubtitle: washTypeSubtitle('normal', normalSeconds),
    outcome: running ? null : input.outcome,
    progressPercent: progressPercent(remaining, input.roundTotalSeconds),
    quickSubtitle: washTypeSubtitle('quick', quickSeconds),
    relays: RELAYS.map(key => ({ key, label: RELAY_COPY[key].label, on: isOn(states, key) })),
    remainingText: remainingText(remaining),
    running,
    screen,
    stage: stage ? STAGE_COPY[stage] : UNKNOWN_STAGE_COPY,
    startSubtitle: startSubtitle(clockTimeAfter(nowMs, selectedSeconds)),
    statusText: statusText(connected, running),
    timeline: buildTimeline(input.runningWashType, stage),
    washType: input.selectedWashType,
    waterLevel: readWaterLevel(states),
  };
}
