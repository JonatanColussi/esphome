import type { Actions, CommandSender, View } from './actions';
import { createConfirmSheet } from './components/confirm-sheet';
import type { ClickHandler } from './dom';
import { h } from './dom';
import type { Preferences } from './preferences';
import { createActionBar } from './screens/action-bar';
import { createFooter } from './screens/footer';
import { createHeader } from './screens/header';
import { createManualAlert } from './screens/manual-alert';
import { createOutcomeCard } from './screens/outcome-card';
import { createReadyScreen } from './screens/ready-screen';
import { createSettingsScreen } from './screens/settings-screen';
import { createWashingScreen } from './screens/washing-screen';
import { WashSession } from './session';
import type { RequestedScreen } from './view-model';
import { buildViewModel } from './view-model';

import { TEXT } from '../copy';
import type { StateStore } from '../device/store';
import { Entity, isOn, readText } from '../domain/entities';
import { parseHms } from '../domain/time';

type Clock = () => number;
type Vibrate = (pattern: number[]) => void;

const COMPLETED_VIBRATION = [300, 150, 300];

export interface App {
  element: HTMLElement;
  /** Fixed-position layers that must be appended to <body> next to the app. */
  overlays: HTMLElement[];
  render: ClickHandler;
}

export interface AppEnvironment {
  commands: CommandSender;
  now: Clock;
  openAdvanced: ClickHandler;
  preferences: Preferences;
  scrollToTop: ClickHandler;
  store: StateStore;
  vibrate: Vibrate;
}

export function createApp(environment: AppEnvironment): App {
  const { commands, preferences, store } = environment;
  const session = new WashSession();
  const sheet = createConfirmSheet();
  let requestedScreen: RequestedScreen = 'ready';
  let selectedWashType = preferences.loadWashType();

  const stopAll = () => {
    if (isOn(store.states, Entity.running)) {
      session.markStoppedByUser();
    }

    commands.send(Entity.stopAll, 'press');
  };

  const actions: Actions = {
    dismissOutcome: () => {
      session.dismissOutcome();
      render();
    },
    openAdvanced: () => environment.openAdvanced(),
    openSettings: () => navigate('settings'),
    requestPowerOff: () =>
      sheet.open({
        confirmLabel: TEXT.powerOffConfirm,
        message: TEXT.powerOffMessage,
        onConfirm: stopAll,
        title: TEXT.powerOffTitle,
      }),
    requestStop: () =>
      sheet.open({
        confirmLabel: TEXT.stopConfirm,
        message: TEXT.stopMessage,
        onConfirm: stopAll,
        title: TEXT.stopTitle,
      }),
    selectCycles: count => commands.send(Entity.cycles, 'set', { value: count }),
    selectWashType: washType => {
      selectedWashType = washType;
      render();
    },
    selectWaterLevel: level => commands.send(Entity.waterLevel, 'set', { option: level }),
    setMinutes: (key, minutes) => commands.send(key, 'set', { value: minutes }),
    showReady: () => navigate('ready'),
    start: () => {
      session.markStarted();
      preferences.saveWashType(selectedWashType);
      commands.send(
        selectedWashType === 'quick' ? Entity.startQuickCycle : Entity.startFullCycle,
        'press',
      );
    },
    stopNow: stopAll,
    toggleRelay: key => commands.send(key, 'toggle'),
  };

  const views: View[] = [
    createHeader(actions),
    createManualAlert(actions),
    createOutcomeCard(actions),
    createReadyScreen(actions),
    createWashingScreen(),
    createSettingsScreen(actions),
    createFooter(actions),
    createActionBar(actions),
  ];
  const element = h(
    'div',
    { attrs: { id: 'tq' } },
    views.map(view => view.element),
  );

  function render(): void {
    const { states } = store;
    const running = states[Entity.running];
    const finished = session.observe(
      typeof running === 'boolean' ? running : undefined,
      parseHms(readText(states, Entity.timeRemaining)),
    );

    if (finished === 'completed') {
      environment.vibrate(COMPLETED_VIBRATION);
    }

    const model = buildViewModel({
      connected: store.isConnected,
      nowMs: environment.now(),
      outcome: session.outcome,
      requestedScreen,
      roundTotalSeconds: session.roundTotalSeconds,
      runningWashType: preferences.loadWashType(),
      selectedWashType,
      states,
    });

    element.classList.toggle('offline', !model.connected);
    views.forEach(view => view.update(model));
  }

  function navigate(screen: RequestedScreen): void {
    requestedScreen = screen;
    render();
    environment.scrollToTop();
  }

  return { element, overlays: [sheet.element], render };
}
