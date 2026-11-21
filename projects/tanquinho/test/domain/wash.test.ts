import { Entity, readWaterLevel } from '../../src/domain/entities';
import {
  activeRelays,
  estimateSeconds,
  parseCycleProgress,
  parseStage,
  timelineStages,
  washOutcome,
} from '../../src/domain/wash';
import { buildStates } from '../fixtures';

describe('estimateSeconds', () => {
  it('normal wash, medium level, 1 cycle takes 28 min', () => {
    // 3.5 fill + 0.5 mix + 5 soak + 15 wash + 4 drain
    expect(estimateSeconds(buildStates(), 'normal')).toBe(28 * 60);
  });

  it('quick wash halves mix and wash, skips soak and repeats per cycle', () => {
    const states = buildStates({ [Entity.waterLevel]: 'High', [Entity.cycles]: 2 });

    // per cycle: 5 + 0.25 + 7.5 + 5.5 = 18.25 min, × 2
    expect(estimateSeconds(states, 'quick')).toBe(36.5 * 60);
  });

  it('falls back to Medium when the level is unknown', () => {
    const states = buildStates({ [Entity.waterLevel]: 'Baixo' });

    expect(readWaterLevel(states)).toBe('Medium');
    expect(estimateSeconds(states, 'normal')).toBe(28 * 60);
  });
});

describe('timelineStages', () => {
  it('has no soak in the quick wash', () => {
    expect(timelineStages('normal')).toEqual([
      'Filling',
      'Mixing',
      'Soaking',
      'Washing',
      'Draining',
    ]);
    expect(timelineStages('quick')).toEqual(['Filling', 'Mixing', 'Washing', 'Draining']);
  });
});

describe('parseStage', () => {
  it('accepts only the firmware stage codes', () => {
    expect(parseStage('Filling')).toBe('Filling');
    expect(parseStage('Off')).toBeNull();
    expect(parseStage('')).toBeNull();
  });
});

describe('parseCycleProgress', () => {
  it('reads "current/total" and rejects anything else', () => {
    expect(parseCycleProgress('1/2')).toEqual({ current: 1, total: 2 });
    expect(parseCycleProgress('')).toBeNull();
    expect(parseCycleProgress('Ciclo 1 de 2')).toBeNull();
  });
});

describe('activeRelays', () => {
  it('lists relays that are on, in panel order', () => {
    expect(activeRelays({})).toEqual([]);
    expect(
      activeRelays({
        'switch/Auxiliary': true,
        'switch/Motor': false,
        'switch/Water Valve': true,
      }),
    ).toEqual(['switch/Water Valve', 'switch/Auxiliary']);
  });
});

describe('washOutcome', () => {
  it('is completed or interrupted only when a running wash stops', () => {
    expect(washOutcome(true, false, false)).toBe('completed');
    expect(washOutcome(true, false, true)).toBe('interrupted');
    expect(washOutcome(true, true, false)).toBeNull();
    expect(washOutcome(false, false, false)).toBeNull();
    expect(washOutcome(false, true, false)).toBeNull();
  });
});
