/**
 * @jest-environment jsdom
 */
import { StateStore } from '../../src/device/store';
import type { EntityValue } from '../../src/domain/entities';
import { Entity } from '../../src/domain/entities';
import type { WashType } from '../../src/domain/wash';
import { createApp } from '../../src/ui/app';
import { buildStates } from '../fixtures';

type SentCommand = [string, string, unknown];

function setup(overrides: Record<string, EntityValue> = {}) {
  const store = new StateStore();
  const sent: SentCommand[] = [];
  let savedWashType: WashType = 'normal';
  const vibrate = jest.fn();
  const saveWashType = jest.fn((washType: WashType) => {
    savedWashType = washType;
  });

  Object.entries(buildStates(overrides)).forEach(([key, value]) => store.apply({ key, value }));

  const app = createApp({
    commands: {
      send: (key, action, params) => {
        sent.push([key, action, params]);
      },
    },
    now: () => new Date(2026, 10, 21, 15, 0, 0).getTime(),
    openAdvanced: jest.fn(),
    preferences: {
      loadWashType: () => savedWashType,
      saveWashType,
    },
    scrollToTop: jest.fn(),
    store,
    vibrate,
  });

  document.body.replaceChildren(app.element, ...app.overlays);
  app.render();

  return { app, saveWashType, sent, store, vibrate };
}

const RELAY_MOTOR = 'switch/Motor';

function firstMinutesField(): HTMLInputElement {
  const field = document.querySelector<HTMLInputElement>('input[type="number"]');

  if (!field) {
    throw new Error('No minutes field');
  }

  return field;
}

function relayButtons(): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>('.relays button')];
}

function findButton(text: string): HTMLButtonElement {
  const match = [...document.querySelectorAll('button')].find(candidate =>
    candidate.textContent?.includes(text),
  );

  if (!match) {
    throw new Error(`No button with text "${text}"`);
  }

  return match;
}

function pageText(): string {
  return document.body.textContent ?? '';
}

function textOf(element: Element | null): string {
  return element?.textContent ?? '';
}

function attributeOf(element: Element, name: string): string | null {
  return element.getAttribute(name);
}

function hasClass(element: Element, name: string): boolean {
  return element.classList.contains(name);
}

function isVisible(element: HTMLElement): boolean {
  let current: HTMLElement | null = element;

  while (current) {
    if (current.style.display === 'none') {
      return false;
    }

    current = current.parentElement;
  }

  return true;
}

describe('createApp', () => {
  it('shows the ready screen with the selected level and finish time', () => {
    setup({ [Entity.running]: false });

    expect(pageText()).toContain('Quanta roupa?');
    expect(attributeOf(findButton('Média'), 'aria-pressed')).toBe('true');
    expect(textOf(findButton('▶ Começar'))).toContain('termina às 15:28');
    expect(isVisible(findButton('■ Parar lavagem'))).toBe(false);
  });

  it('sends the chosen level and starts the selected wash type', () => {
    const { sent } = setup({ [Entity.running]: false });

    findButton('Pouca').click();
    findButton('Rápida').click();
    findButton('▶ Começar').click();

    expect(sent).toEqual([
      ['select/Water Level', 'set', { option: 'Low' }],
      ['button/Start Quick Cycle', 'press', undefined],
    ]);
  });

  it('shows the washing screen in Portuguese', () => {
    setup({
      [Entity.cycleProgress]: '1/2',
      [Entity.cycles]: 2,
      [Entity.running]: true,
      [Entity.stage]: 'Filling',
      [Entity.timeRemaining]: '0:20:00',
    });

    expect(pageText()).toContain('Enchendo de água');
    expect(pageText()).toContain('Lavagem 1 de 2');
    expect(pageText()).toContain('15:20');
    expect(isVisible(findButton('■ Parar lavagem'))).toBe(true);
    expect(isVisible(findButton('▶ Começar'))).toBe(false);
  });

  it('asks for confirmation before stopping a wash', () => {
    const { sent } = setup({ [Entity.running]: true, [Entity.stage]: 'Washing' });

    findButton('■ Parar lavagem').click();
    expect(sent).toEqual([]);

    findButton('Sim, parar').click();
    expect(sent).toEqual([['button/Stop All', 'press', undefined]]);
  });

  it('celebrates a wash that finished by itself', () => {
    const { app, store, vibrate } = setup({ [Entity.running]: true, [Entity.stage]: 'Draining' });

    store.apply({ key: Entity.running, value: false });
    app.render();

    expect(pageText()).toContain('Pronto! Pode tirar a roupa');
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('opens settings and saves a typed fill time', () => {
    const { sent } = setup({ [Entity.running]: false });

    findButton('⚙️ Ajustes').click();
    expect(textOf(document.querySelector('h1'))).toContain('Ajustes');

    const firstField = document.querySelector<HTMLInputElement>('input[type="number"]');

    if (!firstField) {
      throw new Error('No minutes field');
    }

    expect(firstField.value).toBe('2.5');
    firstField.value = '4';
    firstField.dispatchEvent(new Event('change'));

    expect(sent).toEqual([['number/Fill Low (min)', 'set', { value: 4 }]]);
  });

  it('disables commands while offline', () => {
    const { app, store } = setup({ [Entity.running]: false });

    store.setConnected(false);
    app.render();

    expect(findButton('⏻ Desligar tudo').disabled).toBe(true);
    expect(findButton('▶ Começar').disabled).toBe(true);
    expect(hasClass(app.element, 'offline')).toBe(true);
  });

  it('warns about a relay left on in manual mode and turns it off without asking', () => {
    const { sent } = setup({ [RELAY_MOTOR]: true, [Entity.running]: false });

    expect(pageText()).toContain('Ligado no modo manual: o motor.');

    document.querySelector<HTMLButtonElement>('.manual-alert button')?.click();

    expect(sent).toEqual([['button/Stop All', 'press', undefined]]);
  });

  it('does not overwrite a minutes field while the person is typing in it', () => {
    const { app, store } = setup({ [Entity.running]: false });

    findButton('⚙️ Ajustes').click();

    const field = firstMinutesField();

    field.focus();
    field.value = '7';
    store.apply({ key: Entity.fillMinutes.Low, value: 3 });
    app.render();

    expect(field.value).toBe('7');
  });

  it('disables the manual relays during a wash and enables them when idle', () => {
    const { app, store } = setup({ [RELAY_MOTOR]: true, [Entity.running]: true });

    findButton('⚙️ Ajustes').click();

    expect(relayButtons().map(relay => relay.disabled)).toEqual([true, true, true, true]);

    store.apply({ key: Entity.running, value: false });
    app.render();

    expect(relayButtons().map(relay => relay.disabled)).toEqual([false, false, false, false]);
    expect(relayButtons().map(relay => attributeOf(relay, 'aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
      'false',
    ]);
  });

  it('remembers a quick wash and drops the soak step from the timeline', () => {
    const { app, saveWashType, store } = setup({ [Entity.running]: false });

    findButton('Rápida').click();
    findButton('▶ Começar').click();

    expect(saveWashType).toHaveBeenCalledWith('quick');

    store.apply({ key: Entity.running, value: true });
    store.apply({ key: Entity.stage, value: 'Filling' });
    app.render();

    const timeline = textOf(document.querySelector('ol'));

    expect(timeline).toContain('Encher');
    expect(timeline).not.toContain('Molho');
  });

  it('reports a wash stopped by the person as interrupted, without vibrating', () => {
    const { app, sent, store, vibrate } = setup({
      [Entity.running]: true,
      [Entity.stage]: 'Washing',
    });

    findButton('■ Parar lavagem').click();
    findButton('Sim, parar').click();
    store.apply({ key: Entity.running, value: false });
    app.render();

    expect(sent).toEqual([['button/Stop All', 'press', undefined]]);
    expect(pageText()).toContain('Lavagem interrompida');
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('shows the offline banner and status when the connection is lost', () => {
    const { app, store } = setup({ [Entity.running]: false });

    store.setConnected(false);
    app.render();

    const banner = document.querySelector<HTMLElement>('.offline-banner');

    expect(textOf(banner)).toContain('Sem conexão com o tanquinho. Tentando de novo…');
    expect(textOf(document.querySelector('.status'))).toBe('Sem conexão');
  });
});
