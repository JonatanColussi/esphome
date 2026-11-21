import type { StateUpdate } from './protocol';

import type { EntityStates, EntityValue } from '../domain/entities';

export type Listener = () => void;

/** Latest value of every entity plus the connection flag; the single source of truth for the UI. */
export class StateStore {
  private readonly values: Record<string, EntityValue> = {};

  private readonly listeners = new Set<Listener>();

  private connected = false;

  public get states(): EntityStates {
    return this.values;
  }

  public get isConnected(): boolean {
    return this.connected;
  }

  public apply(update: StateUpdate): void {
    this.values[update.key] = update.value;
    this.connected = true;
    this.notify();
  }

  public setConnected(connected: boolean): void {
    if (this.connected === connected) {
      return;
    }

    this.connected = connected;
    this.notify();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach(listener => listener());
  }
}
