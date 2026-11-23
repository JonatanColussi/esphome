/** Every text the person reads lives here, in Portuguese. Code elsewhere stays in English. */
import type { RelayKey, Stage, WaterLevel } from './domain/entities';
import { formatDuration } from './domain/time';
import type { CycleProgress, WashOutcome, WashType } from './domain/wash';

export const LOAD_COPY: Readonly<Record<WaterLevel, LoadCopy>> = {
  High: { icon: '💧💧💧', subtitle: 'água alta', title: 'Muita' },
  Low: { icon: '💧', subtitle: 'água baixa', title: 'Pouca' },
  Medium: { icon: '💧💧', subtitle: 'água média', title: 'Média' },
};

export interface LoadCopy {
  icon: string;
  subtitle: string;
  title: string;
}

export const OUTCOME_COPY: Readonly<Record<WashOutcome, OutcomeCopy>> = {
  completed: { icon: '✅', message: 'A lavagem terminou.', title: 'Pronto! Pode tirar a roupa' },
  interrupted: {
    icon: '⏹️',
    message: 'Se ficou água no tanque, use ⚙️ Ajustes → Modo manual → Bomba para esvaziar.',
    title: 'Lavagem interrompida',
  },
};

export interface OutcomeCopy {
  icon: string;
  message: string;
  title: string;
}

export const RELAY_COPY: Readonly<Record<RelayKey, RelayCopy>> = {
  'switch/Auxiliary': { label: 'Auxiliar', phrase: 'o auxiliar' },
  'switch/Drain Pump': { label: 'Bomba', phrase: 'a bomba' },
  'switch/Motor': { label: 'Motor', phrase: 'o motor' },
  'switch/Water Valve': { label: 'Água', phrase: 'a água' },
};

export interface RelayCopy {
  label: string;
  phrase: string;
}

export const STAGE_COPY: Readonly<Record<Stage, StageCopy>> = {
  Draining: { icon: '⬇️', short: 'Esvaziar', title: 'Esvaziando a água' },
  Filling: { icon: '🚰', short: 'Encher', title: 'Enchendo de água' },
  Mixing: { icon: '🔄', short: 'Misturar', title: 'Misturando o sabão' },
  Soaking: { icon: '🫧', short: 'Molho', title: 'Roupa de molho' },
  Washing: { icon: '🌀', short: 'Lavar', title: 'Lavando' },
};

export interface StageCopy {
  icon: string;
  short: string;
  title: string;
}

export const TEXT = {
  advanced: 'Avançado',
  appTitle: '🧺 Tanquinho',
  back: '← Voltar',
  backToSimple: '🧺 Tela simples',
  cancel: 'Cancelar',
  commandFailed: 'Não foi possível falar com o tanquinho. Tente de novo.',
  cyclesQuestion: 'Quantas vezes lavar?',
  documentTitle: 'Tanquinho',
  drainTitle: 'Tempo para esvaziar (minutos)',
  fillTitle: 'Tempo para encher (minutos)',
  finishesAt: 'Termina às',
  loadHighLabel: 'Muita roupa',
  loadLowLabel: 'Pouca roupa',
  loadMediumLabel: 'Média',
  loadQuestion: 'Quanta roupa?',
  manualHint: 'Liga e desliga cada parte na hora. A água desliga sozinha depois de 10 minutos.',
  manualTitle: 'Modo manual',
  manualUnavailable: 'Indisponível durante a lavagem.',
  mixLabel: 'Misturar o sabão',
  ok: 'OK',
  offlineBanner: 'Sem conexão com o tanquinho. Tentando de novo…',
  otherStagesTitle: 'Outras etapas (minutos)',
  powerOff: '⏻ Desligar tudo',
  powerOffConfirm: '⏻ Desligar tudo',
  powerOffMessage:
    'A água, o motor e a bomba param na hora. Se estiver lavando, a lavagem é cancelada e a água fica no tanque.',
  powerOffTitle: 'Desligar tudo agora?',
  settings: '⚙️ Ajustes',
  settingsTitle: 'Ajustes',
  soakLabel: 'Molho',
  start: '▶ Começar',
  statusOffline: 'Sem conexão',
  statusReady: 'Pronto',
  statusWashing: 'Lavando',
  stopConfirm: 'Sim, parar',
  stopMessage: 'A máquina para na hora. A água que estiver no tanque fica lá.',
  stopTitle: 'Parar a lavagem?',
  stopWash: '■ Parar lavagem',
  timelineLabel: 'Etapas',
  turnOff: 'Desligar',
  washLabel: 'Lavar',
  washTypeNormal: 'Normal',
  washTypeQuestion: 'Tipo de lavagem',
  washTypeQuick: 'Rápida',
} as const;

export const UNKNOWN_STAGE_COPY: StageCopy = { icon: '🌀', short: '', title: 'Lavando' };

export function cycleProgressText(progress: CycleProgress | null): string {
  return progress ? `Lavagem ${progress.current} de ${progress.total}` : '';
}

export function manualRelaysText(relays: readonly RelayKey[]): string {
  return `Ligado no modo manual: ${relays.map(relay => RELAY_COPY[relay].phrase).join(', ')}.`;
}

export function remainingText(seconds: number): string {
  return seconds > 0 ? `faltam ${formatDuration(seconds)}` : '';
}

export function startSubtitle(clockTime: string): string {
  return `termina às ${clockTime}`;
}

export function statusText(connected: boolean, running: boolean): string {
  if (!connected) {
    return TEXT.statusOffline;
  }

  return running ? TEXT.statusWashing : TEXT.statusReady;
}

export function timesLabel(count: number): string {
  return count === 1 ? '1 vez' : `${count} vezes`;
}

export function washTypeSubtitle(washType: WashType, seconds: number): string {
  const soak = washType === 'quick' ? 'sem molho' : 'com molho';

  return `${soak} · ${formatDuration(seconds)}`;
}
