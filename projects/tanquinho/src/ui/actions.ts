import type { ViewModel } from './view-model';

import type { CommandAction, CommandParams } from '../device/protocol';
import type { RelayKey, WaterLevel } from '../domain/entities';
import type { WashType } from '../domain/wash';

/** What the views can ask for; implemented once in app.ts. */
export interface Actions {
  dismissOutcome(this: void): void;
  openAdvanced(this: void): void;
  openSettings(this: void): void;
  requestPowerOff(this: void): void;
  requestStop(this: void): void;
  selectCycles(count: number): void;
  selectWashType(washType: WashType): void;
  selectWaterLevel(level: WaterLevel): void;
  setMinutes(key: string, minutes: number): void;
  showReady(this: void): void;
  start(this: void): void;
  stopNow(this: void): void;
  toggleRelay(key: RelayKey): void;
}

export interface CommandSender {
  send(key: string, action: CommandAction, params?: CommandParams): void;
}

/** A piece of the screen built once and refreshed from the view model on every render. */
export interface View {
  element: HTMLElement;
  update(model: ViewModel): void;
}
