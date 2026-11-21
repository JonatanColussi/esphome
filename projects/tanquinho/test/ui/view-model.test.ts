import type { EntityValue } from '../../src/domain/entities';
import { Entity } from '../../src/domain/entities';
import type { ViewInput } from '../../src/ui/view-model';
import { buildViewModel } from '../../src/ui/view-model';
import { buildStates } from '../fixtures';

const THREE_PM = new Date(2026, 10, 21, 15, 0, 0).getTime();

function input(states: Record<string, EntityValue>, overrides: Partial<ViewInput> = {}): ViewInput {
  return {
    connected: true,
    nowMs: THREE_PM,
    outcome: null,
    requestedScreen: 'ready',
    roundTotalSeconds: 0,
    runningWashType: 'normal',
    selectedWashType: 'normal',
    states,
    ...overrides,
  };
}

describe('buildViewModel', () => {
  it('shows the ready screen with estimates when idle', () => {
    const model = buildViewModel(input(buildStates({ [Entity.running]: false })));

    expect(model.screen).toBe('ready');
    expect(model.statusText).toBe('Pronto');
    expect(model.headerTitle).toBe('🧺 Tanquinho');
    expect(model.normalSubtitle).toBe('com molho · 28 min');
    expect(model.startSubtitle).toBe('termina às 15:28');
    expect(model.waterLevel).toBe('Medium');
  });

  it('uses the quick estimate for the start button when quick is selected', () => {
    const model = buildViewModel(input(buildStates(), { selectedWashType: 'quick' }));

    expect(model.startSubtitle).toBe('termina às 15:15');
  });

  it('shows the washing screen with stage, timeline and finish time', () => {
    const states = buildStates({
      [Entity.cycleProgress]: '1/2',
      [Entity.cycles]: 2,
      [Entity.running]: true,
      [Entity.stage]: 'Mixing',
      [Entity.timeRemaining]: '0:20:00',
    });
    const model = buildViewModel(input(states, { outcome: 'completed', roundTotalSeconds: 2400 }));

    expect(model.screen).toBe('washing');
    expect(model.stage.title).toBe('Misturando o sabão');
    expect(model.cycleText).toBe('Lavagem 1 de 2');
    expect(model.finishTime).toBe('15:20');
    expect(model.remainingText).toBe('faltam 20 min');
    expect(model.progressPercent).toBe(50);
    expect(model.outcome).toBeNull();
    expect(model.timeline.map(step => step.state)).toEqual([
      'done',
      'current',
      'pending',
      'pending',
      'pending',
    ]);
    expect(model.timeline[0].label).toBe('Encher');
  });

  it('hides the cycle text for a single cycle', () => {
    const states = buildStates({ [Entity.cycleProgress]: '1/1', [Entity.running]: true });

    expect(buildViewModel(input(states)).cycleText).toBe('');
  });

  it('keeps the settings screen even while washing', () => {
    const model = buildViewModel(
      input(buildStates({ [Entity.running]: true }), { requestedScreen: 'settings' }),
    );

    expect(model.screen).toBe('settings');
    expect(model.headerTitle).toBe('Ajustes');
    expect(model.manualNote).toBe('Indisponível durante a lavagem.');
  });

  it('warns about relays left on in manual mode only when idle', () => {
    const idle = buildViewModel(input(buildStates({ 'switch/Motor': true })));
    const running = buildViewModel(
      input(buildStates({ [Entity.running]: true, 'switch/Motor': true })),
    );

    expect(idle.manualAlert).toBe('Ligado no modo manual: o motor.');
    expect(running.manualAlert).toBeNull();
    expect(idle.relays.find(relay => relay.key === 'switch/Motor')?.on).toBe(true);
  });

  it('exposes the current minute settings', () => {
    const model = buildViewModel(input(buildStates()));

    expect(model.minuteSettings[Entity.fillMinutes.Low]).toBe(2.5);
    expect(model.minuteSettings[Entity.washMinutes]).toBe(15);
  });
});
